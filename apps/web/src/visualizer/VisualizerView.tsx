import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {CSSProperties,KeyboardEvent,PointerEvent,ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {message} from '../i18n/messages';
import type {Locale,MessageArgs,MessageKey} from '../i18n/messages';
import {surfaceLibrary,surfaceMaterialName,surfaceTextureLibrary} from '../editor/material-library';
import {Icon} from '../ui/Icon';
import {CompareSlider} from './CompareSlider';
import {orderQuad} from './homography';
import type {Point} from './homography';
import {MaskHistory,strokeSegment} from './mask';
import type {DirtyRect} from './mask';
import {fitSize,preparePhoto,prepareReference,toPixel} from './photo-prep';
import type {Pixels,PhotoProblem} from './photo-prep';
import {canShareImages,encodeResult,saveResult,shareResult} from './result-export';
import type {SaveOutcome} from './result-export';
import type {Rgb,SurfaceMaterial} from './surface-engine';
import {standInSurface} from './surface-provider';
import type {SurfaceEditProvider,SurfaceEditResult} from './surface-provider';
import {addVariant,MAX_VARIANTS,nextLetter,variantLabel} from './variants';
import type {Variant} from './variants';

type AreaTool='brush'|'erase'|'corners';
type Mode='paint'|'pattern'|'picture';
type Stage='area'|'result'|'compare';
type Pattern={readonly name:string;readonly pixels:Pixels};
/** Mask overlay colour (a clear blue that reads on walls, floors and wood alike), drawn at half the mask alpha. */
const OVERLAY:Rgb=[40,120,255];
/** App finishes offered as patterns: the D76/D82 colour maps already shipped for the 3D view (same-origin files). */
const FINISHES:readonly {id:string;file:string}[]=[
 {id:'m_tile_vitrified',file:'tile_vitrified_600'},{id:'m_tile_terracotta',file:'tile_terracotta_600'},{id:'m_wood_laminate',file:'wood_oak'},{id:'m_wood_walnut',file:'wood_walnut'},
 {id:'m_marble_white',file:'marble_white'},{id:'m_marble_charcoal',file:'marble_charcoal'},{id:'m_wallpaper_linen',file:'wallpaper_linen'},
];
const PAINTS=surfaceLibrary.filter(e=>e.material.id.startsWith('m_paint_')||e.material.id==='m_ext');
const hexRgb=(hex:string):Rgb=>{const v=/^#([0-9a-f]{6})$/i.exec(hex)?.[1]??'cccccc';return [parseInt(v.slice(0,2),16),parseInt(v.slice(2,4),16),parseInt(v.slice(4,6),16)];};

/** A canvas showing pixels at their own size (CSS scales it); redrawn when the pixels change. */
function PixelCanvas({pixels,label,testId}:{pixels:Pixels;label:string;testId?:string}){
 const ref=useRef<HTMLCanvasElement>(null);
 useLayoutEffect(()=>{const c=ref.current!;c.width=pixels.width;c.height=pixels.height;// putImageData copies into the canvas, so the pixels are wrapped, not duplicated.
  c.getContext('2d')?.putImageData(new ImageData(pixels.data as Uint8ClampedArray<ArrayBuffer>,pixels.width,pixels.height),0,0);},[pixels]);
 useEffect(()=>()=>{const c=ref.current;if(c)c.width=c.height=0;},[]);
 return <canvas ref={ref} className="viz-canvas" role="img" aria-label={label} data-testid={testId}/>;
}

/**
 * D85 Room photo visualizer (Phase 1, offline). A full-screen modal over the editor: choose an area on the photo, pick
 * paint, a pattern or a picture, see before/after, keep up to four options, save or share the image. All state lives
 * here and dies with the view; nothing is written to the project store or saved with the drawing.
 */
export default function VisualizerView({file,locale,onClose,provider=standInSurface}:{file:File;locale:Locale;onClose(problem?:PhotoProblem):void;provider?:SurfaceEditProvider}):ReactNode{
 const t=<K extends MessageKey>(key:K,...args:MessageArgs<K>)=>message(locale,key,...args);
 const dialog=useRef<HTMLDialogElement>(null),stageRef=useRef<HTMLDivElement>(null),overlay=useRef<HTMLCanvasElement>(null),patternInput=useRef<HTMLInputElement>(null),pictureInput=useRef<HTMLInputElement>(null);
 const [photo,setPhoto]=useState<Pixels|null>(null),history=useRef<MaskHistory|null>(null),[maskVersion,setMaskVersion]=useState(0);
 const [box,setBox]=useState({width:0,height:0});
 const [tool,setTool]=useState<AreaTool>('brush'),[brush,setBrush]=useState(24),[corners,setCorners]=useState<readonly Point[]>([]),[cornerNote,setCornerNote]=useState<'bad'|'set'|null>(null);
 const [mode,setMode]=useState<Mode>('paint'),[paint,setPaint]=useState(PAINTS.find(e=>e.material.id==='m_paint_blue')?.material.baseColor??'#bcd7ea');
 const [pattern,setPattern]=useState<Pattern|null>(null),[patternNote,setPatternNote]=useState<'loading'|'failed'|null>(null),[patternSize,setPatternSize]=useState(160),[turn,setTurn]=useState(false),[grout,setGrout]=useState(false),[groutColour,setGroutColour]=useState('#d9d6cf');
 const [picture,setPicture]=useState<Pixels|null>(null),[pictureNote,setPictureNote]=useState<'ready'|'failed'|null>(null);
 const [result,setResult]=useState<SurfaceEditResult|null>(null),[busy,setBusy]=useState(false),[status,setStatus]=useState<{key:'vizRendering'|'vizRenderFailed'|'vizNeedArea'|'vizNeedPattern'|'vizNeedPicture'|'vizNeedCorners'|'vizKeepFull'}|{key:'vizRendered';ms:number}|null>(null);
 const [stage,setStage]=useState<Stage>('area'),[variants,setVariants]=useState<Variant[]>([]),[optionName,setOptionName]=useState(''),[pairA,setPairA]=useState(''),[pairB,setPairB]=useState('');
 const [saveState,setSaveState]=useState<SaveOutcome|'busy'|null>(null),[shareable]=useState(canShareImages);
 const render=useRef<AbortController|null>(null),referenceTicket=useRef(0),variantsRef=useRef<Variant[]>([]);
 variantsRef.current=variants;

 // Open as a modal over the editor; Escape (the dialog's cancel) closes it.
 useEffect(()=>{const d=dialog.current!;if(!d.open)d.showModal();return()=>{if(d.open)d.close();};},[]);
 // Decode the photo once; a failure closes the view and the panel says why.
 const closeRef=useRef(onClose);closeRef.current=onClose;
 useEffect(()=>{let live=true;preparePhoto(file).then(p=>{if(!live)return;history.current=new MaskHistory(p.width,p.height);setPhoto(p);},e=>{if(live)closeRef.current((e instanceof Error?e.message:'decode') as PhotoProblem);});return()=>{live=false;};},[file]);
 useEffect(()=>()=>{render.current?.abort();for(const v of variantsRef.current)URL.revokeObjectURL(v.url);},[]);
 // The stage area decides the shown photo size; pointer maths uses the shown box.
 useLayoutEffect(()=>{const el=stageRef.current;if(!el)return;const measure=()=>setBox({width:el.clientWidth,height:el.clientHeight});measure();if(typeof ResizeObserver==='undefined'){window.addEventListener('resize',measure);return()=>window.removeEventListener('resize',measure);}const o=new ResizeObserver(measure);o.observe(el);return()=>o.disconnect();},[photo]);
 const shown=photo&&box.width>0?fitSize(box.width-16,box.height-16,photo.width,photo.height):null;

 /** Paints the mask overlay for a rectangle of the photo (all of it by default). */
 const drawOverlay=useCallback((rect?:DirtyRect)=>{
  const c=overlay.current,h=history.current;if(!c||!h)return;const ctx=c.getContext('2d');if(!ctx)return;
  const r=rect??{x0:0,y0:0,x1:h.width,y1:h.height},w=r.x1-r.x0,ht=r.y1-r.y0;if(w<1||ht<1)return;
  const img=new ImageData(w,ht),d=img.data;
  for(let y=0;y<ht;y++)for(let x=0;x<w;x++){const m=h.mask[(r.y0+y)*h.width+r.x0+x]!;if(!m)continue;const i=(y*w+x)*4;d[i]=OVERLAY[0];d[i+1]=OVERLAY[1];d[i+2]=OVERLAY[2];d[i+3]=m>>1;}
  ctx.putImageData(img,r.x0,r.y0);
 },[]);
 // A full overlay repaint (6 MB of RGBA at working size) only when needed: a new overlay canvas, Undo, Redo or Clear.
 // Strokes and corner fills paint just their own rectangle as they happen.
 const overlayStale=useRef(true);
 useLayoutEffect(()=>{const c=overlay.current;if(!c||!photo||stage!=='area')return;if(c.width!==photo.width||c.height!==photo.height){c.width=photo.width;c.height=photo.height;overlayStale.current=true;}if(overlayStale.current){overlayStale.current=false;drawOverlay();}},[photo,stage,drawOverlay,maskVersion]);

 // Brush / Eraser strokes draw live, then become one undoable step; "4 corners" collects taps.
 const stroke=useRef<{id:number;kind:'brush'|'erase';radius:number;points:Point[]}|null>(null);
 const pixelAt=(event:PointerEvent<HTMLCanvasElement>):Point=>toPixel(event.clientX,event.clientY,event.currentTarget.getBoundingClientRect(),photo!.width,photo!.height);
 const down=(event:PointerEvent<HTMLCanvasElement>)=>{
  const h=history.current;if(!h||!photo||busy)return;event.preventDefault();const p=pixelAt(event);
  if(tool==='corners'){
   const next=[...corners,p];if(next.length<4){setCorners(next);setCornerNote(null);return;}
   const quad=orderQuad(next);setCorners([]);
   if(!quad){setCornerNote('bad');return;}
   const dirty=h.apply({kind:'quad',quad});setCornerNote('set');drawOverlay(dirty);setMaskVersion(v=>v+1);return;
  }
  const rect=event.currentTarget.getBoundingClientRect(),radius=Math.max(1,brush*photo.width/Math.max(1,rect.width));
  event.currentTarget.setPointerCapture?.(event.pointerId);
  stroke.current={id:event.pointerId,kind:tool==='erase'?'erase':'brush',radius,points:[p]};
  drawOverlay(strokeSegment(h.mask,h.width,h.height,stroke.current.kind,radius,p,p));
 };
 const move=(event:PointerEvent<HTMLCanvasElement>)=>{
  const s=stroke.current,h=history.current;if(!s||!h||s.id!==event.pointerId)return;
  const p=pixelAt(event),last=s.points.at(-1)!;if(Math.hypot(p[0]-last[0],p[1]-last[1])<1)return;
  s.points.push(p);drawOverlay(strokeSegment(h.mask,h.width,h.height,s.kind,s.radius,last,p));
 };
 const up=(event:PointerEvent<HTMLCanvasElement>)=>{const s=stroke.current,h=history.current;if(!s||!h||s.id!==event.pointerId)return;stroke.current=null;h.apply({kind:s.kind,radius:s.radius,points:s.points},true);setMaskVersion(v=>v+1);};
 const changed=()=>{overlayStale.current=true;setCorners([]);setCornerNote(null);setMaskVersion(v=>v+1);};
 const undo=()=>{if(history.current?.undo())changed();};
 const redo=()=>{if(history.current?.redo())changed();};
 const clear=()=>{const h=history.current;if(!h||h.isEmpty()&&!h.plane())return;h.apply({kind:'clear'});changed();};

 // Pattern and picture references are decoded on the device; the last one chosen wins.
 const loadPattern=async(name:string,blob:Promise<Blob>)=>{
  const ticket=++referenceTicket.current;setPatternNote('loading');
  try{const pixels=await prepareReference(await blob,512);if(ticket===referenceTicket.current){setPattern({name,pixels});setPatternNote(null);}}
  catch{if(ticket===referenceTicket.current)setPatternNote('failed');}
 };
 const finishBlob=async(file:string)=>{const base=new URL(import.meta.env.BASE_URL,window.location.href),response=await fetch(new URL(`textures/${file}/color.jpg`,base));if(!response.ok)throw new Error('pattern');return response.blob();};
 const loadPicture=async(chosen:File|undefined)=>{if(!chosen)return;try{setPicture(await prepareReference(chosen,1024));setPictureNote('ready');}catch{setPicture(null);setPictureNote('failed');}};

 const material=():SurfaceMaterial|null=>mode==='paint'?{kind:'paint',rgb:hexRgb(paint)}:mode==='pattern'?pattern&&{kind:'pattern',texture:pattern.pixels,sizePx:patternSize,rotate:turn?90:0,grout:grout?hexRgb(groutColour):null}:picture&&{kind:'picture',image:picture};
 const show=async()=>{
  const h=history.current;if(!photo||!h||busy)return;
  if(h.isEmpty()){setStatus({key:'vizNeedArea'});return;}
  if(mode==='picture'&&!h.plane()){setStatus({key:'vizNeedCorners'});return;}
  const m=material();if(!m){setStatus({key:mode==='pattern'?'vizNeedPattern':'vizNeedPicture'});return;}
  render.current?.abort();const controller=new AbortController();render.current=controller;setBusy(true);setStatus({key:'vizRendering'});
  try{const out=await provider.render({photo,mask:new Uint8Array(h.mask),plane:h.plane(),material:m},controller.signal);if(controller.signal.aborted)return;setResult(out);setStage('result');setStatus({key:'vizRendered',ms:Math.round(out.ms)});setSaveState(null);}
  catch{if(!controller.signal.aborted)setStatus({key:'vizRenderFailed'});}
  finally{if(render.current===controller){render.current=null;setBusy(false);}}
 };
 const keep=async()=>{
  if(!result)return;if(variants.length>=MAX_VARIANTS){setStatus({key:'vizKeepFull'});return;}
  const blob=await encodeResult(result,'image/jpeg'),url=URL.createObjectURL(blob),label=variantLabel(optionName,nextLetter(variantsRef.current,t('vizOption')));
  const next=addVariant(variantsRef.current,{id:crypto.randomUUID(),label,blob,url});
  if(!next){URL.revokeObjectURL(url);setStatus({key:'vizKeepFull'});return;}
  setVariants(next);setOptionName('');
  if(next.length===2){setPairA(next[0]!.id);setPairB(next[1]!.id);}
 };
 const remove=(id:string)=>{
  const v=variants.find(x=>x.id===id);if(v)URL.revokeObjectURL(v.url);
  const next=variants.filter(x=>x.id!==id),a=next.some(x=>x.id===pairA)?pairA:next[0]?.id??'',b=next.some(x=>x.id===pairB)&&pairB!==a?pairB:next.find(x=>x.id!==a)?.id??'';
  setVariants(next);setPairA(a);setPairB(b);if(next.length<2&&stage==='compare')setStage(result?'result':'area');
 };
 const save=async(share:boolean)=>{if(!result||saveState==='busy')return;setSaveState('busy');try{setSaveState(share?await shareResult(result,t('vizWatermark'),t('toolPhoto')):await saveResult(result,t('vizWatermark')));}catch{setSaveState('failed');}};

 const key=(event:KeyboardEvent<HTMLDialogElement>)=>{
  // The editor listens on window for its own shortcuts (Undo of the drawing, tool keys); none may reach it from here.
  event.stopPropagation();
  if(!(event.ctrlKey||event.metaKey)||event.target instanceof HTMLInputElement)return;
  const k=event.key.toLowerCase();if(k==='z'){event.preventDefault();if(event.shiftKey)redo();else undo();}if(k==='y'){event.preventDefault();redo();}
 };
 const h=history.current,a=variants.find(v=>v.id===pairA),b=variants.find(v=>v.id===pairB&&v.id!==pairA);
 const frame={width:shown?.width??0,height:shown?.height??0};
 return createPortal(<dialog ref={dialog} className="viz-dialog" aria-label={t('toolPhoto')} onKeyDown={key} onCancel={event=>{event.preventDefault();onClose();}}>
  <header className="viz-head"><h2>{t('toolPhoto')}</h2><button className="icon-button" aria-label={t('vizClose')} onClick={()=>onClose()}><Icon name="close"/></button></header>
  <div className="viz-body">
   <div ref={stageRef} className="viz-stage" data-stage={stage} style={photo?{['--viz-aspect' as string]:`${photo.width} / ${photo.height}`} as CSSProperties:undefined}>
    {!photo&&<p role="status" className="viz-stage-note">{t('vizOpening')}</p>}
    {photo&&shown&&stage==='area'&&<div className="viz-frame" style={frame}>
     <PixelCanvas pixels={photo} label={t('vizOriginal')} testId="viz-photo"/>
     <canvas ref={overlay} className="viz-canvas viz-overlay" data-testid="viz-mask" data-tool={tool} aria-label={t('vizPhotoArea')} role="img" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}/>
     {corners.map(([x,y],i)=><span key={i} className="viz-corner" style={{left:`${x/photo.width*100}%`,top:`${y/photo.height*100}%`}} aria-hidden="true"/>)}
    </div>}
    {photo&&shown&&stage==='result'&&result&&<CompareSlider testId="viz-compare" style={frame} label={t('vizDivider')} leftLabel={t('vizBefore')} rightLabel={t('vizAfter')} left={<PixelCanvas pixels={photo} label={t('vizOriginal')}/>} right={<PixelCanvas pixels={result} label={t('vizChanged')} testId="viz-result"/>}/>}
    {photo&&shown&&stage==='compare'&&a&&b&&<CompareSlider testId="viz-options" style={frame} label={t('vizOptionDivider')} leftLabel={a.label} rightLabel={b.label} left={<img className="viz-canvas" src={a.url} alt={a.label}/>} right={<img className="viz-canvas" src={b.url} alt={b.label}/>}/>}
   </div>
   <div className="viz-controls">
    <p className="viz-note">{t('vizPreviewNote')}</p>
    {photo&&<>
     <div className="viz-view" role="group" aria-label={t('vizView')}>
      <button aria-pressed={stage==='area'} onClick={()=>setStage('area')}>{t('vizViewArea')}</button>
      <button aria-pressed={stage==='result'} disabled={!result} onClick={()=>setStage('result')}>{t('vizViewResult')}</button>
      <button aria-pressed={stage==='compare'} disabled={variants.length<2} onClick={()=>setStage('compare')}>{t('vizViewCompare')}</button>
     </div>
     <section className="viz-section" aria-label={t('vizStepArea')}>
      <h3>{t('vizStepArea')}</h3><p>{t('vizAreaHelp')}</p>
      <div className="viz-tools" role="group" aria-label={t('vizAreaTools')}>
       {(['brush','erase','corners'] as const).map(id=><button key={id} aria-pressed={tool===id} onClick={()=>{setTool(id);setCorners([]);setCornerNote(null);setStage('area');}}>{t(id==='brush'?'vizBrush':id==='erase'?'vizEraser':'vizCorners')}</button>)}
      </div>
      {tool!=='corners'&&<label>{t('vizBrushSize')}<input type="range" min={6} max={80} step={2} value={brush} aria-label={t('vizBrushSize')} onChange={event=>setBrush(Number(event.target.value))}/></label>}
      {tool==='corners'&&cornerNote!=='set'&&<p role="status">{t('vizCornerNext',{n:corners.length+1})}</p>}
      {cornerNote==='bad'&&<p role="alert">{t('vizCornersBad')}</p>}
      {cornerNote==='set'&&<p role="status">{t('vizCornersSet')}</p>}
      <div className="viz-row">
       <button disabled={!h?.canUndo} onClick={undo} data-version={maskVersion}>{t('vizUndoArea')}</button>
       <button disabled={!h?.canRedo} onClick={redo}>{t('vizRedoArea')}</button>
       <button disabled={!h?.size} onClick={clear}>{t('vizClearArea')}</button>
      </div>
     </section>
     <section className="viz-section" aria-label={t('vizStepMaterial')}>
      <h3>{t('vizStepMaterial')}</h3>
      <div className="viz-tools" role="group" aria-label={t('vizMaterialKind')}>
       {(['paint','pattern','picture'] as const).map(id=><button key={id} aria-pressed={mode===id} onClick={()=>setMode(id)}>{t(id==='paint'?'vizModePaint':id==='pattern'?'vizModePattern':'vizModePicture')}</button>)}
      </div>
      {mode==='paint'&&<>
       <div className="viz-swatches" role="group" aria-label={t('vizPaintColours')}>{PAINTS.map(e=><button key={e.material.id} className="viz-swatch" aria-pressed={paint.toLowerCase()===e.material.baseColor.toLowerCase()} aria-label={surfaceMaterialName(e.material,locale)} title={surfaceMaterialName(e.material,locale)} style={{backgroundColor:e.material.baseColor}} onClick={()=>setPaint(e.material.baseColor)}/>)}</div>
       <label className="viz-colour">{t('vizCustomColour')}<input type="color" value={paint} aria-label={t('vizCustomColour')} onChange={event=>setPaint(event.target.value)}/></label>
      </>}
      {mode==='pattern'&&<>
       <button className="viz-upload" onClick={()=>patternInput.current?.click()}>{t('vizPatternUpload')}</button>
       <input ref={patternInput} className="viz-file" type="file" accept="image/*" tabIndex={-1} aria-hidden="true" onChange={event=>{const f=event.target.files?.[0];if(f)void loadPattern(t('vizPatternYours'),Promise.resolve(f));event.target.value='';}}/>
       <p className="viz-subhead">{t('vizPatternFinishes')}</p>
       <div className="viz-finishes">{FINISHES.map(f=>{const entry=[...surfaceLibrary,...surfaceTextureLibrary].find(e=>e.material.id===f.id)!,name=surfaceMaterialName(entry.material,locale);return <button key={f.id} aria-pressed={pattern?.name===name} onClick={()=>{void loadPattern(name,finishBlob(f.file));}}><span className="viz-chip" style={{backgroundColor:entry.material.baseColor}} aria-hidden="true"/>{name}</button>;})}</div>
       {patternNote==='loading'&&<p role="status">{t('vizPatternLoading')}</p>}
       {patternNote==='failed'&&<p role="alert">{t('vizPatternFailed')}</p>}
       {pattern&&patternNote!=='loading'&&<p role="status">{t('vizPatternChosen',{name:pattern.name})}</p>}
       <label>{t('vizPatternSize')}<input type="range" min={24} max={480} step={8} value={patternSize} aria-label={t('vizPatternSize')} onChange={event=>setPatternSize(Number(event.target.value))}/></label>
       <label className="ai-check"><input type="checkbox" checked={turn} onChange={event=>setTurn(event.target.checked)}/>{t('vizPatternTurn')}</label>
       <label className="ai-check"><input type="checkbox" checked={grout} onChange={event=>setGrout(event.target.checked)}/>{t('vizGrout')}</label>
       {grout&&<label className="viz-colour">{t('vizGroutColour')}<input type="color" value={groutColour} aria-label={t('vizGroutColour')} onChange={event=>setGroutColour(event.target.value)}/></label>}
      </>}
      {mode==='picture'&&<>
       <button className="viz-upload" onClick={()=>pictureInput.current?.click()}>{t('vizPictureUpload')}</button>
       <input ref={pictureInput} className="viz-file" type="file" accept="image/*" tabIndex={-1} aria-hidden="true" onChange={event=>{void loadPicture(event.target.files?.[0]);event.target.value='';}}/>
       {pictureNote==='ready'&&<p role="status">{t('vizPictureReady')}</p>}
       {pictureNote==='failed'&&<p role="alert">{t('vizPictureFailed')}</p>}
       {!h?.plane()&&<p className="structure-note">{t('vizNeedCorners')}</p>}
      </>}
      <button className="primary-button" disabled={busy} onClick={()=>{void show();}}>{t('vizShow')}</button>
      {status&&<p role={status.key==='vizRenderFailed'||status.key==='vizKeepFull'||status.key.startsWith('vizNeed')?'alert':'status'}>{status.key==='vizRendered'?t('vizRendered',{ms:status.ms}):t(status.key)}</p>}
     </section>
     {result&&<section className="viz-section" aria-label={t('vizStepResult')}>
      <h3>{t('vizStepResult')}</h3>
      <div className="viz-row">
       <button className="primary-button" disabled={saveState==='busy'} onClick={()=>{void save(false);}}><Icon name="export"/>{t('vizSave')}</button>
       {shareable&&<button disabled={saveState==='busy'} onClick={()=>{void save(true);}}>{t('vizShare')}</button>}
      </div>
      {saveState&&saveState!=='busy'&&<p role={saveState==='failed'?'alert':'status'}>{t(`vizSave_${saveState}`)}</p>}
      <label>{t('vizOptionName')}<input type="text" maxLength={24} value={optionName} placeholder={nextLetter(variants,t('vizOption'))} aria-label={t('vizOptionName')} onChange={event=>setOptionName(event.target.value)}/></label>
      <button disabled={variants.length>=MAX_VARIANTS} onClick={()=>{void keep();}}>{t('vizKeep')}</button>
      {variants.length>0&&<>
       <p className="viz-subhead">{t('vizKept',{count:variants.length})}</p>
       <ul className="viz-variants">{variants.map(v=><li key={v.id}><img src={v.url} alt="" width={64} height={44}/><span>{v.label}</span><button className="icon-button" aria-label={t('vizDeleteOption',{label:v.label})} onClick={()=>remove(v.id)}><Icon name="close"/></button></li>)}</ul>
      </>}
      {variants.length>=2?<div className="viz-pair">
       <label>{t('vizCompareFirst')}<select value={pairA} aria-label={t('vizCompareFirst')} onChange={event=>{setPairA(event.target.value);setStage('compare');}}>{variants.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}</select></label>
       <label>{t('vizCompareSecond')}<select value={pairB} aria-label={t('vizCompareSecond')} onChange={event=>{setPairB(event.target.value);setStage('compare');}}>{variants.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}</select></label>
      </div>:<p className="structure-note">{t('vizCompareNeedTwo')}</p>}
     </section>}
    </>}
   </div>
  </div>
 </dialog>,document.body);
}
