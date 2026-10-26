import {useCallback,useEffect,useLayoutEffect,useRef,useState,useSyncExternalStore} from 'react';
import type {CSSProperties,KeyboardEvent,PointerEvent,ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {message} from '../i18n/messages';
import type {Locale,MessageArgs,MessageKey} from '../i18n/messages';
import {surfaceLibrary,surfaceMaterialName,surfaceTextureLibrary} from '../editor/material-library';
import {Icon} from '../ui/Icon';
import {Capacitor} from '@capacitor/core';
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
import type {AiQuota} from '../cloud/api';
import {CLOUD_OFF,cloudWasUsed,noSubscription} from '../cloud/session';
import type {CloudSession} from '../cloud/session';
import {AiConsent} from './AiConsent';
import {browserCodec} from './ai-codec';
import {createRoomAi,giveConsent,hasConsent,loadPending,newClientJobId,RoomAiError,savePending,Waker} from './server-surface';
import type {AiPhase,AiProblem,AiSurfaceRequest,RoomAi} from './server-surface';

type AreaTool='brush'|'erase'|'corners'|'ai-tap';
type Mode='paint'|'pattern'|'picture';
type Stage='area'|'result'|'compare';
/** `en` is the English name sent to the AI prompt (the server allows only a short cleaned label). */
type Pattern={readonly name:string;readonly en:string;readonly pixels:Pixels};
type AiNote=Readonly<{kind:'phase';phase:AiPhase}|{kind:'done';kept:boolean}|{kind:'problem';code:AiProblem;again:boolean}|{kind:'resuming'}|{kind:'other-photo'}>;
type TapNote='busy'|'added'|'nothing'|AiProblem|null;
const cloudOff=()=>CLOUD_OFF;
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
export default function VisualizerView({file,locale,onClose,provider=standInSurface,cloud=null}:{file:File;locale:Locale;onClose(problem?:PhotoProblem):void;provider?:SurfaceEditProvider;cloud?:CloudSession|null}):ReactNode{
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
 // D86 AI (server provider): only with cloud set up and a signed-in person; the offline engine above stays the default.
 const cloudState=useSyncExternalStore(cloud?.subscribe??noSubscription,cloud?.getSnapshot??cloudOff),userId=cloudState.status==='signed-in'?cloudState.user?.id??null:null;
 const [waker]=useState(()=>new Waker()),[roomAi,setRoomAi]=useState<RoomAi|null>(null),[quota,setQuota]=useState<AiQuota|'loading'|'failed'|null>(null);
 const [surface,setSurface]=useState<'wall'|'floor'|'other'>('wall'),[aiBusy,setAiBusy]=useState(false),[aiNote,setAiNote]=useState<AiNote|null>(null),[tapNote,setTapNote]=useState<TapNote>(null);
 const [consent,setConsent]=useState<(()=>void)|null>(null),aiRun=useRef<AbortController|null>(null),aiAttempt=useRef<AiSurfaceRequest|null>(null),tapRun=useRef<AbortController|null>(null);
 const photoKey=`${file.name}:${file.size}:${file.lastModified}`;

 // Open as a modal over the editor; Escape (the dialog's cancel) closes it.
 useEffect(()=>{const d=dialog.current!;if(!d.open)d.showModal();return()=>{if(d.open)d.close();};},[]);
 // Decode the photo once; a failure closes the view and the panel says why.
 const closeRef=useRef(onClose);closeRef.current=onClose;
 useEffect(()=>{let live=true;preparePhoto(file).then(p=>{if(!live)return;history.current=new MaskHistory(p.width,p.height);setPhoto(p);},e=>{if(live)closeRef.current((e instanceof Error?e.message:'decode') as PhotoProblem);});return()=>{live=false;};},[file]);
 useEffect(()=>()=>{render.current?.abort();aiRun.current?.abort();tapRun.current?.abort();for(const v of variantsRef.current)URL.revokeObjectURL(v.url);},[]);
 // Someone who signed in before reconnects quietly; anyone else never loads the cloud library from here.
 useEffect(()=>{let used:boolean;try{used=cloudWasUsed(globalThis.localStorage??null,location.search);}catch{used=false;}if(cloud&&used&&cloud.getSnapshot().status==='idle')void cloud.ensure();},[cloud]);
 useEffect(()=>{
  if(!cloud||!userId){setRoomAi(null);return;}
  let live=true,made:RoomAi|null=null;
  void cloud.ensure().then(api=>{if(!live||!api)return;made=createRoomAi({api:api.roomAi,userId,codec:browserCodec,waker});setRoomAi(made);});
  return()=>{live=false;made?.close();setRoomAi(null);};
 },[cloud,userId,waker]);
 const refreshQuota=useCallback(async(ai:RoomAi)=>{const q=await ai.quota();setQuota(q??'failed');},[]);
 useEffect(()=>{if(!roomAi||!photo)return;setQuota('loading');void refreshQuota(roomAi);},[roomAi,photo,refreshQuota]);
 // A waiting AI preview checks again at once when the app or tab comes back to the front.
 useEffect(()=>{
  if(!roomAi)return;
  const visible=()=>{if(document.visibilityState==='visible')waker.wake();};document.addEventListener('visibilitychange',visible);
  let remove:(()=>void)|null=null,live=true;
  if(Capacitor.isNativePlatform())void import('@capacitor/app').then(({App})=>App.addListener('resume',()=>waker.wake())).then(handle=>{if(live)remove=()=>{void handle.remove();};else void handle.remove();}).catch(()=>undefined);
  return()=>{live=false;document.removeEventListener('visibilitychange',visible);remove?.();};
 },[roomAi,waker]);
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
  if(tool==='ai-tap'){void tapAt(p);return;}
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
 const loadPattern=async(name:string,en:string,blob:Promise<Blob>)=>{
  const ticket=++referenceTicket.current;setPatternNote('loading');
  try{const pixels=await prepareReference(await blob,512);if(ticket===referenceTicket.current){setPattern({name,en,pixels});setPatternNote(null);}}
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
 /** Keeps pixels as a compressed option; false when four are already kept. */
 const keepPixels=async(pixels:Pixels,label:string):Promise<boolean>=>{
  if(variantsRef.current.length>=MAX_VARIANTS)return false;
  const blob=await encodeResult(pixels,'image/jpeg'),url=URL.createObjectURL(blob),next=addVariant(variantsRef.current,{id:crypto.randomUUID(),label,blob,url});
  if(!next){URL.revokeObjectURL(url);return false;}
  variantsRef.current=next;setVariants(next);
  if(next.length===2){setPairA(next[0]!.id);setPairB(next[1]!.id);}
  return true;
 };
 const keep=async()=>{
  if(!result)return;if(variants.length>=MAX_VARIANTS){setStatus({key:'vizKeepFull'});return;}
  if(await keepPixels(result,variantLabel(optionName,nextLetter(variantsRef.current,t('vizOption')))))setOptionName('');else setStatus({key:'vizKeepFull'});
 };
 // D86 AI preview. A first tap makes a new clientJobId; "Try again" and "Keep waiting" reuse the same request, so the
 // server answers the same job and never takes a second preview.
 const showAiResult=async(out:SurfaceEditResult)=>{
  setResult(out);setStage('result');setSaveState(null);
  const label=variantsRef.current.some(v=>v.label===t('roomAiOption'))?nextLetter(variantsRef.current,t('roomAiOption')):t('roomAiOption');
  setAiNote({kind:'done',kept:await keepPixels(out,label)});
 };
 const showAiResultRef=useRef(showAiResult);showAiResultRef.current=showAiResult;
 const aiFailed=(error:unknown)=>{
  const problem=error instanceof RoomAiError?error:new RoomAiError('UNEXPECTED');
  if(!problem.again){aiAttempt.current=null;if(userId)savePending(userId,null);}
  setAiNote({kind:'problem',code:problem.code,again:problem.again});
 };
 const withConsent=(run:()=>void)=>{if(!userId)return;if(hasConsent(userId))run();else setConsent(()=>run);};
 const makeAi=async(again:boolean)=>{
  const h=history.current;if(!photo||!h||aiBusy||!roomAi||!userId)return;
  let request=again?aiAttempt.current:null;
  if(!request){
   if(h.isEmpty()){setStatus({key:'vizNeedArea'});return;}
   const references=mode==='pattern'?pattern&&[pattern.pixels]:mode==='picture'?picture&&[picture]:[];
   if(!references){setStatus({key:mode==='pattern'?'vizNeedPattern':'vizNeedPicture'});return;}
   const m=material();if(!m)return;
   const paintEntry=PAINTS.find(e=>e.material.baseColor.toLowerCase()===paint.toLowerCase());
   const label=mode==='paint'?paintEntry?surfaceMaterialName(paintEntry.material,'en'):'custom colour':mode==='pattern'?pattern!.en:'uploaded artwork';
   request={photo,mask:new Uint8Array(h.mask),plane:h.plane(),material:m,ai:{clientJobId:newClientJobId(),label,colour:mode==='paint'?paint:null,surface,kind:mode,references}};
   aiAttempt.current=request;
  }
  const controller=new AbortController(),user=userId,hints=request.ai!;aiRun.current?.abort();aiRun.current=controller;setAiBusy(true);setStatus(null);
  try{
   const out=await roomAi.provider.render({...request,ai:{...hints,onPhase:phase=>setAiNote({kind:'phase',phase}),onJob:jobId=>savePending(user,{jobId,clientJobId:hints.clientJobId,photoKey,createdAt:Date.now()})}},controller.signal);
   if(controller.signal.aborted)return;
   aiAttempt.current=null;savePending(user,null);await showAiResult(out);
  }catch(error){if(!controller.signal.aborted)aiFailed(error);}
  finally{if(aiRun.current===controller){aiRun.current=null;setAiBusy(false);void refreshQuota(roomAi);}}
 };
 // A preview started before the visualizer was closed is finished here when the same photo is opened again.
 const resumed=useRef(false);
 useEffect(()=>{
  if(!roomAi||!photo||!userId||resumed.current)return;resumed.current=true;
  const pending=loadPending(userId);if(!pending)return;
  if(pending.photoKey!==photoKey){setAiNote({kind:'other-photo'});return;}
  const controller=new AbortController();aiRun.current=controller;setAiBusy(true);setAiNote({kind:'resuming'});
  void roomAi.finishEarlier(pending,photo,controller.signal).then(async out=>{if(controller.signal.aborted)return;savePending(userId,null);await showAiResultRef.current(out);},
   error=>{if(controller.signal.aborted)return;if(!(error instanceof RoomAiError&&error.code==='TIMEOUT'))savePending(userId,null);setAiNote({kind:'problem',code:error instanceof RoomAiError?error.code:'UNEXPECTED',again:false});})
   .finally(()=>{if(aiRun.current===controller){aiRun.current=null;setAiBusy(false);}});
 },[roomAi,photo,userId,photoKey]);
 /** Tap to select (AI): one tap → the surface around it is added to the area as one undoable step. */
 const tapAt=async(point:Point)=>{
  const h=history.current;if(!photo||!h||!roomAi||tapRun.current)return;
  const controller=new AbortController();tapRun.current=controller;setTapNote('busy');
  try{
   const selection=await roomAi.segment(photo,point,controller.signal);if(controller.signal.aborted)return;
   if(!selection){setTapNote('nothing');return;}
   const dirty=h.apply({kind:'union',box:selection.box,data:selection.data});drawOverlay(dirty);setMaskVersion(v=>v+1);setTapNote('added');
  }catch(error){if(!controller.signal.aborted)setTapNote(error instanceof RoomAiError?error.code:'UNEXPECTED');}
  finally{if(tapRun.current===controller)tapRun.current=null;void refreshQuota(roomAi);}
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
 return createPortal(<dialog ref={dialog} className="viz-dialog" aria-label={t('toolPhoto')} onKeyDown={key} onCancel={event=>{event.preventDefault();if(consent)setConsent(null);else onClose();}}>
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
       {roomAi&&<button aria-pressed={tool==='ai-tap'} onClick={()=>withConsent(()=>{setTool('ai-tap');setCorners([]);setCornerNote(null);setStage('area');setTapNote(null);})}>{t('roomAiTap')}</button>}
      </div>
      {tool==='ai-tap'&&roomAi&&<p role="status" data-testid="ai-tap-note">{tapNote==='busy'?t('roomAiTapping'):tapNote==='added'?t('roomAiTapAdded'):tapNote==='nothing'?t('roomAiTapNothing'):tapNote?t(`roomAiProblem_${tapNote}`):t('roomAiTapHelp',{left:quota&&typeof quota==='object'?quota.segmentsLeft:'…'})}</p>}
      {(tool==='brush'||tool==='erase')&&<label>{t('vizBrushSize')}<input type="range" min={6} max={80} step={2} value={brush} aria-label={t('vizBrushSize')} onChange={event=>setBrush(Number(event.target.value))}/></label>}
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
       <input ref={patternInput} className="viz-file" type="file" accept="image/*" tabIndex={-1} aria-hidden="true" onChange={event=>{const f=event.target.files?.[0];if(f)void loadPattern(t('vizPatternYours'),'uploaded sample',Promise.resolve(f));event.target.value='';}}/>
       <p className="viz-subhead">{t('vizPatternFinishes')}</p>
       <div className="viz-finishes">{FINISHES.map(f=>{const entry=[...surfaceLibrary,...surfaceTextureLibrary].find(e=>e.material.id===f.id)!,name=surfaceMaterialName(entry.material,locale);return <button key={f.id} aria-pressed={pattern?.name===name} onClick={()=>{void loadPattern(name,surfaceMaterialName(entry.material,'en'),finishBlob(f.file));}}><span className="viz-chip" style={{backgroundColor:entry.material.baseColor}} aria-hidden="true"/>{name}</button>;})}</div>
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
      {cloud&&<div className="viz-ai" data-testid="viz-ai">
       <h4>{t('roomAiTitle')}</h4>
       {!userId?<p className="structure-note">{t('roomAiSignIn')}</p>:!roomAi||quota==='loading'?<p role="status">{t('roomAiChecking')}</p>:<>
        <p>{t('roomAiIntro')}</p>
        {quota==='failed'||quota===null?<p role="status">{t('roomAiQuotaFailed')}</p>:quota.paused?<p role="status" className="viz-ai-quota">{t('roomAiPaused')}</p>:<p className="viz-ai-quota" data-testid="ai-quota">{t('roomAiLeft',{left:quota.previewsLeft,total:quota.previewsPerMonth})}</p>}
        <label>{t('roomAiSurface')}<select value={surface} aria-label={t('roomAiSurface')} onChange={event=>setSurface(event.target.value as 'wall'|'floor'|'other')}>{(['wall','floor','other'] as const).map(id=><option key={id} value={id}>{t(`roomAiSurface_${id}`)}</option>)}</select></label>
        <button className="primary-button" disabled={aiBusy||typeof quota==='object'&&quota!==null&&(quota.paused||quota.previewsLeft<1)} onClick={()=>withConsent(()=>{void makeAi(false);})}>{t('roomAiMake')}</button>
        {aiNote?.kind==='problem'&&aiNote.again&&<button disabled={aiBusy} onClick={()=>{void makeAi(true);}}>{t(aiNote.code==='TIMEOUT'?'roomAiKeepWaiting':'roomAiTryAgain')}</button>}
        {aiNote&&<p role={aiNote.kind==='problem'?'alert':'status'} data-testid="ai-note">{aiNote.kind==='phase'?t(`roomAiPhase_${aiNote.phase}`):aiNote.kind==='done'?t(aiNote.kept?'roomAiDone':'roomAiDoneNotKept'):aiNote.kind==='resuming'?t('roomAiResuming'):aiNote.kind==='other-photo'?t('roomAiPendingOther'):t(`roomAiProblem_${aiNote.code}`)}</p>}
       </>}
      </div>}
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
  {consent&&userId&&<AiConsent locale={locale} previews={quota&&typeof quota==='object'?quota.previewsPerMonth:3} onAgree={()=>{giveConsent(userId);const run=consent;setConsent(null);run();}} onCancel={()=>setConsent(null)}/>}
 </dialog>,document.body);
}
