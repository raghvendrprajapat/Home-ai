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
import {decodeMask,encodeMask,MaskHistory,strokeSegment} from './mask';
import type {DirtyRect} from './mask';
import {fitSize,preparePhoto,prepareReference} from './photo-prep';
import type {Pixels,PhotoProblem} from './photo-prep';
import {canShareImages,encodeResult,saveResult,shareResult,thumbnailJpeg} from './result-export';
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
import {AiCodePrompt} from './AiCodePrompt';
import {browserCodec,browserTestCodec} from './ai-codec';
import {createTestAi,TestAiError,xhrTransport} from './test-surface';
import type {TestAi,TestAiProblem,TestPhase} from './test-surface';
import {forgetCode,giveTestConsent,hasTestConsent,loadCode,saveCode,testModeConfig} from './test-mode';
import {createRoomAi,giveConsent,hasConsent,loadPending,newClientJobId,RoomAiError,savePending,Waker} from './server-surface';
import type {AiPhase,AiProblem,AiSurfaceRequest,RoomAi} from './server-surface';
import {SessionError} from './room-sessions';
import type {RoomSession,RoomSessions} from './room-sessions';
import {brushRadius,FIT_VIEW,isZoomed,MAX_ZOOM,pixelToScreen,screenToPixel,TAP_SLOP,viewTransform,wheelFactor,ZOOM_STEP,ZoomGestures,zoomAt} from './view-zoom';
import type {ZoomView} from './view-zoom';

type AreaTool='brush'|'erase'|'corners'|'ai-tap';
type Mode='paint'|'pattern'|'picture';
type Stage='area'|'result'|'compare';
/** `en` is the English name sent to the AI prompt (the server allows only a short cleaned label). */
type Pattern={readonly name:string;readonly en:string;readonly pixels:Pixels};
type AiNote=Readonly<{kind:'phase';phase:AiPhase}|{kind:'done';kept:boolean}|{kind:'problem';code:AiProblem;again:boolean}|{kind:'resuming'}|{kind:'other-photo'}>;
type TapNote='busy'|'added'|'nothing'|AiProblem|`test:${TestAiProblem}`|null;
type TestNote=Readonly<{kind:'phase';phase:TestPhase;percent?:number}|{kind:'done';kept:boolean}|{kind:'problem';code:TestAiProblem}|{kind:'cancelled'}|{kind:'forgotten'}>;
/** D92 AI test mode from the public build flags (null when off): same-origin /api on the web, VITE_API_BASE_URL on Android. */
function defaultTestAi():TestAi|null{
 const config=testModeConfig(import.meta.env,Capacitor.isNativePlatform(),location.origin);
 return config?createTestAi({base:config.base,codec:browserTestCodec,transport:xhrTransport,code:loadCode}):null;
}
const cloudOff=()=>CLOUD_OFF;
/** Mask overlay colour (a clear blue that reads on walls, floors and wood alike), drawn at half the mask alpha. */
const OVERLAY:Rgb=[40,120,255];
/** App finishes offered as patterns: the D76/D82 colour maps already shipped for the 3D view (same-origin files). */
const FINISHES:readonly {id:string;file:string}[]=[
 {id:'m_tile_vitrified',file:'tile_vitrified_600'},{id:'m_tile_terracotta',file:'tile_terracotta_600'},{id:'m_wood_laminate',file:'wood_oak'},{id:'m_wood_walnut',file:'wood_walnut'},
 {id:'m_marble_white',file:'marble_white'},{id:'m_marble_charcoal',file:'marble_charcoal'},{id:'m_wallpaper_linen',file:'wallpaper_linen'},
];
const PAINTS=surfaceLibrary.filter(e=>e.material.id.startsWith('m_paint_')||e.material.id==='m_ext');
const bytesOf=async(blob:Blob)=>new Uint8Array(await blob.arrayBuffer());
const jpegBlob=(bytes:Uint8Array)=>new Blob([bytes as Uint8Array<ArrayBuffer>],{type:'image/jpeg'});
const typing=(target:EventTarget|null)=>target instanceof HTMLInputElement||target instanceof HTMLSelectElement||target instanceof HTMLTextAreaElement||target instanceof HTMLElement&&target.getAttribute('role')==='slider';
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
 * D87: pinch/wheel zoom and pan of the photo; when an option is kept the session is saved on this device only
 * (`sessions`, never the project), and a saved `session` reopens with its photo, area and kept options.
 * D92: with the public flag VITE_ROOM_AI_TEST_MODE=1 the AI section is "AI test mode" (`testAi`): the access code,
 * then consent, then one call to the app's own /api function; the D86 account AI is not used in such a build.
 */
export default function VisualizerView({file,locale,onClose,provider=standInSurface,cloud=null,session=null,sessions=null,onSessionSaved,testAi:testAiProp}:{file:File;locale:Locale;onClose(problem?:PhotoProblem):void;provider?:SurfaceEditProvider;cloud?:CloudSession|null;session?:RoomSession|null;sessions?:RoomSessions|null;onSessionSaved?():void;testAi?:TestAi|null}):ReactNode{
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
 // D92 AI test mode state: the device's access code, the code prompt, the running preview (one at a time).
 const [testAi]=useState(()=>testAiProp===undefined?defaultTestAi():testAiProp),[testCode,setTestCode]=useState<string|null>(()=>testAi?loadCode():null);
 const [codeAsk,setCodeAsk]=useState<{run:()=>void;wrong:boolean}|null>(null),[testNote,setTestNote]=useState<TestNote|null>(null),[testBusy,setTestBusy]=useState(false),testRun=useRef<AbortController|null>(null);

 // Open as a modal over the editor; Escape (the dialog's cancel) closes it.
 useEffect(()=>{const d=dialog.current!;if(!d.open)d.showModal();return()=>{if(d.open)d.close();};},[]);
 // Decode the photo once; a failure closes the view and the panel says why.
 const closeRef=useRef(onClose);closeRef.current=onClose;
 const sessionRef=useRef(session);
 useEffect(()=>{let live=true;preparePhoto(file).then(async p=>{
  if(!live)return;const h=new MaskHistory(p.width,p.height),saved=sessionRef.current;
  // D87: a reopened session gets back its exact area, plane and kept options; the newest option shows as the result.
  if(saved){
   if(saved.width!==p.width||saved.height!==p.height)throw new Error('decode');
   h.load(decodeMask(saved.mask,p.width*p.height),saved.plane);
   const newest=saved.options.at(-1),shownResult=newest?await preparePhoto(new File([jpegBlob(newest.jpeg)],'option.jpg',{type:'image/jpeg'})):null;if(!live)return;
   const kept=saved.options.map(o=>{const blob=jpegBlob(o.jpeg);return {id:o.id,label:o.label,blob,url:URL.createObjectURL(blob)};});
   variantsRef.current=kept;setVariants(kept);if(kept.length>=2){setPairA(kept[0]!.id);setPairB(kept[1]!.id);}
   if(shownResult){setResult({...shownResult,changed:0,ms:0});setStage('result');}
  }
  history.current=h;setPhoto(p);
 }).catch(e=>{if(live)closeRef.current((e instanceof Error&&['type','size','small','decode'].includes(e.message)?e.message:'decode') as PhotoProblem);});return()=>{live=false;};},[file]);
 useEffect(()=>()=>{render.current?.abort();aiRun.current?.abort();tapRun.current?.abort();testRun.current?.abort();for(const v of variantsRef.current)URL.revokeObjectURL(v.url);},[]);
 // Someone who signed in before reconnects quietly; anyone else never loads the cloud library from here.
 useEffect(()=>{let used:boolean;try{used=cloudWasUsed(globalThis.localStorage??null,location.search);}catch{used=false;}if(cloud&&used&&cloud.getSnapshot().status==='idle')void cloud.ensure();},[cloud]);
 useEffect(()=>{
  if(!cloud||!userId||testAi){setRoomAi(null);return;}
  let live=true,made:RoomAi|null=null;
  void cloud.ensure().then(api=>{if(!live||!api)return;made=createRoomAi({api:api.roomAi,userId,codec:browserCodec,waker});setRoomAi(made);});
  return()=>{live=false;made?.close();setRoomAi(null);};
 },[cloud,userId,waker,testAi]);
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
 // D87 zoom and pan. The view is shared by the area, result and compare stages (they all show the same photo frame).
 const frameRef=useRef<HTMLDivElement>(null),[view,setView]=useState<ZoomView>(FIT_VIEW),viewRef=useRef(view),gestures=useRef(new ZoomGestures()),[moveMode,setMoveMode]=useState(false);
 viewRef.current=view;
 const frameRect=()=>frameRef.current!.getBoundingClientRect();
 const zoomBy=(factor:number)=>{const el=frameRef.current;if(!el)return;const w=el.clientWidth,ht=el.clientHeight;setView(v=>zoomAt(v,factor,w/2,ht/2,w,ht));};
 const local=(event:PointerEvent<HTMLElement>):[number,number]=>{const r=frameRect();return [event.clientX-r.left,event.clientY-r.top];};
 // Capture phase: a pan or a second finger is taken here, before the drawing layer or the compare divider sees it.
 const zoomDown=(event:PointerEvent<HTMLDivElement>)=>{
  if(!gestures.current.down(event.pointerId,local(event),viewRef.current,moveMode||event.shiftKey||event.button===1))return;
  event.stopPropagation();event.preventDefault();cancelStroke();
  try{event.currentTarget.setPointerCapture(event.pointerId);}catch{/* synthetic or already lifted pointer */}
 };
 const zoomMove=(event:PointerEvent<HTMLDivElement>)=>{const r=frameRect(),next=gestures.current.move(event.pointerId,[event.clientX-r.left,event.clientY-r.top],r.width,r.height);if(next){event.stopPropagation();setView(next);}};
 const zoomUp=(event:PointerEvent<HTMLDivElement>)=>{if(gestures.current.up(event.pointerId,viewRef.current))event.stopPropagation();};
 const zoomHandlers={onPointerDownCapture:zoomDown,onPointerMoveCapture:zoomMove,onPointerUpCapture:zoomUp,onPointerCancelCapture:zoomUp};
 // The wheel needs a non-passive listener so a trackpad pinch (ctrl + wheel) zooms the photo, not the page.
 const frameShown=!!(photo&&shown);
 useEffect(()=>{
  const el=frameRef.current;if(!el)return;
  const wheel=(event:WheelEvent)=>{event.preventDefault();const r=el.getBoundingClientRect();setView(v=>zoomAt(v,wheelFactor(event.deltaY,event.deltaMode),event.clientX-r.left,event.clientY-r.top,r.width,r.height));};
  el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);
 },[frameShown,stage]);
 const zoomed:CSSProperties=frameShown?{transform:viewTransform(view,shown!.width,shown!.height)}:{};

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
 // D87: pointer → working pixel goes through the zoom view (pure `screenToPixel`); the brush keeps its size on screen.
 // Corners and AI taps count on release, so a press that becomes a pinch or a drag never places a corner.
 const stroke=useRef<{id:number;kind:'brush'|'erase';radius:number;points:Point[]}|null>(null),tap=useRef<{id:number;x:number;y:number;p:Point}|null>(null);
 const pixelAt=(event:PointerEvent<HTMLElement>):Point=>{const r=frameRect();return screenToPixel(event.clientX-r.left,event.clientY-r.top,viewRef.current,r.width,r.height,photo!.width,photo!.height);};
 /** A second finger arrived: the stroke in progress is dropped (never recorded) and the mask is redrawn without it. */
 const cancelStroke=()=>{tap.current=null;if(!stroke.current)return;stroke.current=null;history.current?.redraw();overlayStale.current=false;drawOverlay();};
 const down=(event:PointerEvent<HTMLCanvasElement>)=>{
  const h=history.current;if(!h||!photo||busy||stroke.current)return;event.preventDefault();const p=pixelAt(event);
  if(tool==='ai-tap'||tool==='corners'){tap.current={id:event.pointerId,x:event.clientX,y:event.clientY,p};return;}
  const radius=brushRadius(brush,viewRef.current,frameRect().width,photo.width);
  try{event.currentTarget.setPointerCapture(event.pointerId);}catch{/* synthetic or already lifted pointer */}
  stroke.current={id:event.pointerId,kind:tool==='erase'?'erase':'brush',radius,points:[p]};
  drawOverlay(strokeSegment(h.mask,h.width,h.height,stroke.current.kind,radius,p,p));
 };
 const move=(event:PointerEvent<HTMLCanvasElement>)=>{
  const s=stroke.current,h=history.current;if(!s||!h||s.id!==event.pointerId)return;
  const p=pixelAt(event),last=s.points.at(-1)!;if(Math.hypot(p[0]-last[0],p[1]-last[1])<1)return;
  s.points.push(p);drawOverlay(strokeSegment(h.mask,h.width,h.height,s.kind,s.radius,last,p));
 };
 const tapped=(p:Point)=>{
  const h=history.current;if(!h)return;
  if(tool==='ai-tap'){void tapAt(p);return;}
  const next=[...corners,p];if(next.length<4){setCorners(next);setCornerNote(null);return;}
  const quad=orderQuad(next);setCorners([]);
  if(!quad){setCornerNote('bad');return;}
  const dirty=h.apply({kind:'quad',quad});setCornerNote('set');drawOverlay(dirty);setMaskVersion(v=>v+1);
 };
 const up=(event:PointerEvent<HTMLCanvasElement>)=>{
  const t=tap.current;
  if(t&&t.id===event.pointerId){tap.current=null;if(event.type==='pointerup'&&Math.hypot(event.clientX-t.x,event.clientY-t.y)<=TAP_SLOP)tapped(t.p);return;}
  const s=stroke.current,h=history.current;if(!s||!h||s.id!==event.pointerId)return;stroke.current=null;h.apply({kind:s.kind,radius:s.radius,points:s.points},true);setMaskVersion(v=>v+1);
 };
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
 // D87: the session is saved on this device after each kept (or removed) option. Saves run one after another; the
 // photo is encoded to JPEG once per visualizer (a reopened session reuses its stored bytes, so they never drift).
 const sessionId=useRef(session?.id??crypto.randomUUID()),photoJpeg=useRef<Uint8Array|null>(session?.photo??null),saveChain=useRef<Promise<void>>(Promise.resolve()),savedOnce=useRef(!!session);
 const [sessionNote,setSessionNote]=useState<'saved'|'quota'|'failed'|null>(null);
 const persist=()=>{
  const h=history.current;if(!sessions||!photo||!h)return;
  const mask=encodeMask(h.mask),plane=h.plane(),kept=[...variantsRef.current],savedAt=Date.now();savedOnce.current=true;
  saveChain.current=saveChain.current.then(async()=>{
   try{
    const photoBytes=photoJpeg.current??=await bytesOf(await encodeResult(photo,'image/jpeg'));
    const options=await Promise.all(kept.map(async v=>({id:v.id,label:v.label,jpeg:await bytesOf(v.blob)})));
    const thumb=await bytesOf(await thumbnailJpeg(kept.at(-1)?.blob??jpegBlob(photoBytes)));
    await sessions.save({id:sessionId.current,savedAt,width:photo.width,height:photo.height,photo:photoBytes,mask,plane,options},thumb);
    setSessionNote('saved');onSessionSaved?.();
   }catch(error){setSessionNote(error instanceof SessionError&&error.code==='quota'?'quota':'failed');}
  });
 };
 /** Keeps pixels as a compressed option; false when four are already kept. */
 const keepPixels=async(pixels:Pixels,label:string):Promise<boolean>=>{
  if(variantsRef.current.length>=MAX_VARIANTS)return false;
  const blob=await encodeResult(pixels,'image/jpeg'),url=URL.createObjectURL(blob),next=addVariant(variantsRef.current,{id:crypto.randomUUID(),label,blob,url});
  if(!next){URL.revokeObjectURL(url);return false;}
  variantsRef.current=next;setVariants(next);
  if(next.length===2){setPairA(next[0]!.id);setPairB(next[1]!.id);}
  persist();
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
  const h=history.current,segmenter=testAi??roomAi;if(!photo||!h||!segmenter||tapRun.current)return;
  const controller=new AbortController();tapRun.current=controller;setTapNote('busy');
  try{
   const selection=await segmenter.segment(photo,point,controller.signal);if(controller.signal.aborted)return;
   if(!selection){setTapNote('nothing');return;}
   const dirty=h.apply({kind:'union',box:selection.box,data:selection.data});drawOverlay(dirty);setMaskVersion(v=>v+1);setTapNote('added');
  }catch(error){
   if(controller.signal.aborted)return;
   if(error instanceof TestAiError){
    setTapNote(`test:${error.code}`);
    // A refused or missing code: forget it and ask again; the person then taps once more.
    if(error.code==='WRONG_CODE'||error.code==='NEED_CODE'){forgetCode();setTestCode(null);setCodeAsk({run:()=>setTapNote(null),wrong:error.code==='WRONG_CODE'});}
   }else setTapNote(error instanceof RoomAiError?error.code:'UNEXPECTED');
  }
  finally{if(tapRun.current===controller)tapRun.current=null;if(roomAi)void refreshQuota(roomAi);}
 };
 /** D92: the access code first (once per device), then the test-mode consent (once per device), then `run`. */
 const withTestAccess=(run:()=>void)=>{
  if(!testAi)return;
  if(!loadCode()){setCodeAsk({run:()=>withTestAccess(run),wrong:false});return;}
  if(hasTestConsent())run();else setConsent(()=>run);
 };
 const acceptCode=(code:string)=>{const ask=codeAsk;saveCode(code);setTestCode(code);setCodeAsk(null);setTestNote(null);if(ask)withTestAccess(ask.run);};
 const forgetTestCode=()=>{forgetCode();setTestCode(null);setTestNote({kind:'forgotten'});};
 /** D92 AI preview in test mode: one paid call, never retried automatically; the person may cancel while waiting. */
 const makeTestAi=async()=>{
  const h=history.current;if(!photo||!h||!testAi||testRun.current)return;
  if(h.isEmpty()){setStatus({key:'vizNeedArea'});return;}
  const references=mode==='pattern'?pattern&&[pattern.pixels]:mode==='picture'?picture&&[picture]:[];
  if(!references){setStatus({key:mode==='pattern'?'vizNeedPattern':'vizNeedPicture'});return;}
  const m=material();if(!m)return;
  const paintEntry=PAINTS.find(e=>e.material.baseColor.toLowerCase()===paint.toLowerCase());
  const label=mode==='paint'?paintEntry?surfaceMaterialName(paintEntry.material,'en'):'custom colour':mode==='pattern'?pattern!.en:'uploaded artwork';
  const controller=new AbortController();testRun.current=controller;setTestBusy(true);setStatus(null);setTestNote({kind:'phase',phase:'preparing'});
  try{
   const out=await testAi.provider.render({photo,mask:new Uint8Array(h.mask),plane:h.plane(),material:m,test:{label,colour:mode==='paint'?paint:null,surface,kind:mode,references,
    onPhase:(phase,percent)=>{if(!controller.signal.aborted)setTestNote(percent===undefined?{kind:'phase',phase}:{kind:'phase',phase,percent});}}},controller.signal);
   if(controller.signal.aborted)return;
   setResult(out);setStage('result');setSaveState(null);
   const optionLabel=variantsRef.current.some(v=>v.label===t('roomAiOption'))?nextLetter(variantsRef.current,t('roomAiOption')):t('roomAiOption');
   setTestNote({kind:'done',kept:await keepPixels(out,optionLabel)});
  }catch(error){
   if(controller.signal.aborted)return;
   const code=error instanceof TestAiError?error.code:'UNEXPECTED';
   if(code==='WRONG_CODE'||code==='NEED_CODE'){forgetCode();setTestCode(null);setTestNote(null);setCodeAsk({run:()=>{void makeTestAi();},wrong:code==='WRONG_CODE'});return;}
   setTestNote({kind:'problem',code});
  }finally{if(testRun.current===controller){testRun.current=null;setTestBusy(false);}}
 };
 const cancelTestAi=()=>{const c=testRun.current;if(!c)return;testRun.current=null;c.abort();setTestBusy(false);setTestNote({kind:'cancelled'});};
 const remove=(id:string)=>{
  const v=variants.find(x=>x.id===id);if(v)URL.revokeObjectURL(v.url);
  const next=variants.filter(x=>x.id!==id),a=next.some(x=>x.id===pairA)?pairA:next[0]?.id??'',b=next.some(x=>x.id===pairB)&&pairB!==a?pairB:next.find(x=>x.id!==a)?.id??'';
  variantsRef.current=next;setVariants(next);setPairA(a);setPairB(b);if(next.length<2&&stage==='compare')setStage(result?'result':'area');
  if(savedOnce.current)persist();
 };
 const save=async(share:boolean)=>{if(!result||saveState==='busy')return;setSaveState('busy');try{setSaveState(share?await shareResult(result,t('vizWatermark'),t('toolPhoto')):await saveResult(result,t('vizWatermark')));}catch{setSaveState('failed');}};

 const key=(event:KeyboardEvent<HTMLDialogElement>)=>{
  // The editor listens on window for its own shortcuts (Undo of the drawing, tool keys); none may reach it from here.
  event.stopPropagation();
  // D87: + / − / 0 zoom the photo (not while typing or on a slider).
  if(!event.ctrlKey&&!event.metaKey&&!event.altKey&&photo&&!typing(event.target)){
   if(event.key==='+'||event.key==='='){event.preventDefault();zoomBy(ZOOM_STEP);return;}
   if(event.key==='-'){event.preventDefault();zoomBy(1/ZOOM_STEP);return;}
   if(event.key==='0'){event.preventDefault();setView(FIT_VIEW);return;}
  }
  if(!(event.ctrlKey||event.metaKey)||event.target instanceof HTMLInputElement)return;
  const k=event.key.toLowerCase();if(k==='z'){event.preventDefault();if(event.shiftKey)redo();else undo();}if(k==='y'){event.preventDefault();redo();}
 };
 const h=history.current,a=variants.find(v=>v.id===pairA),b=variants.find(v=>v.id===pairB&&v.id!==pairA);
 const frame={width:shown?.width??0,height:shown?.height??0};
 return createPortal(<dialog ref={dialog} className="viz-dialog" aria-label={t('toolPhoto')} onKeyDown={key} onCancel={event=>{event.preventDefault();if(codeAsk)setCodeAsk(null);else if(consent)setConsent(null);else onClose();}}>
  <header className="viz-head"><h2>{t('toolPhoto')}</h2><button className="icon-button" aria-label={t('vizClose')} onClick={()=>onClose()}><Icon name="close"/></button></header>
  <div className="viz-body">
   <div ref={stageRef} className="viz-stage" data-stage={stage} style={photo?{['--viz-aspect' as string]:`${photo.width} / ${photo.height}`} as CSSProperties:undefined}>
    {!photo&&<p role="status" className="viz-stage-note">{t('vizOpening')}</p>}
    {photo&&shown&&<div ref={frameRef} className="viz-frame" style={frame} data-testid="viz-frame" data-zoom={view.scale.toFixed(3)} data-move={moveMode||undefined} {...zoomHandlers}>
     {stage==='area'&&<>
      <div className="viz-zoomed" style={zoomed}>
       <PixelCanvas pixels={photo} label={t('vizOriginal')} testId="viz-photo"/>
       <canvas ref={overlay} className="viz-canvas viz-overlay" data-testid="viz-mask" data-tool={tool} aria-label={t('vizPhotoArea')} role="img" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}/>
      </div>
      {corners.map(([x,y],i)=>{const [cx,cy]=pixelToScreen(x,y,view,shown.width,shown.height,photo.width,photo.height);return <span key={i} className="viz-corner" style={{left:cx,top:cy}} aria-hidden="true"/>;})}
     </>}
     {stage==='result'&&result&&<CompareSlider testId="viz-compare" style={{width:'100%',height:'100%'}} contentStyle={zoomed} label={t('vizDivider')} leftLabel={t('vizBefore')} rightLabel={t('vizAfter')} left={<PixelCanvas pixels={photo} label={t('vizOriginal')}/>} right={<PixelCanvas pixels={result} label={t('vizChanged')} testId="viz-result"/>}/>}
     {stage==='compare'&&a&&b&&<CompareSlider testId="viz-options" style={{width:'100%',height:'100%'}} contentStyle={zoomed} label={t('vizOptionDivider')} leftLabel={a.label} rightLabel={b.label} left={<img className="viz-canvas" src={a.url} alt={a.label}/>} right={<img className="viz-canvas" src={b.url} alt={b.label}/>}/>}
     <span className="viz-zoom-level" role="status" data-testid="viz-zoom-level">{t('vizZoomLevel',{zoom:view.scale.toFixed(1)})}</span>
    </div>}
   </div>
   <div className="viz-controls">
    {photo&&<div className="viz-zoombar" role="group" aria-label={t('vizZoomControls')}>
     <button className="viz-zoom-button" aria-label={t('vizZoomOut')} title={t('vizZoomOut')} disabled={!isZoomed(view)} onClick={()=>zoomBy(1/ZOOM_STEP)}>−</button>
     <button className="viz-zoom-button" aria-label={t('vizZoomIn')} title={t('vizZoomIn')} disabled={view.scale>=MAX_ZOOM-1e-9} onClick={()=>zoomBy(ZOOM_STEP)}>+</button>
     <button aria-label={t('vizZoomFitLabel')} disabled={!isZoomed(view)} onClick={()=>setView(FIT_VIEW)}>{t('vizZoomFit')}</button>
     <button aria-pressed={moveMode} onClick={()=>setMoveMode(m=>!m)}>{t('vizMovePhoto')}</button>
    </div>}
    <p className="viz-note">{t('vizPreviewNote')}</p>
    {photo&&<>
     <div className="viz-view" role="group" aria-label={t('vizView')}>
      <button aria-pressed={stage==='area'} onClick={()=>setStage('area')}>{t('vizViewArea')}</button>
      <button aria-pressed={stage==='result'} disabled={!result} onClick={()=>setStage('result')}>{t('vizViewResult')}</button>
      <button aria-pressed={stage==='compare'} disabled={variants.length<2} onClick={()=>setStage('compare')}>{t('vizViewCompare')}</button>
     </div>
     <section className="viz-section" aria-label={t('vizStepArea')}>
      <h3>{t('vizStepArea')}</h3><p>{t('vizAreaHelp')}</p><p className="structure-note">{t('vizZoomHelp')}</p>
      <div className="viz-tools" role="group" aria-label={t('vizAreaTools')}>
       {(['brush','erase','corners'] as const).map(id=><button key={id} aria-pressed={tool===id} onClick={()=>{setTool(id);setCorners([]);setCornerNote(null);setStage('area');}}>{t(id==='brush'?'vizBrush':id==='erase'?'vizEraser':'vizCorners')}</button>)}
       {(roomAi||testAi)&&<button aria-pressed={tool==='ai-tap'} onClick={()=>(testAi?withTestAccess:withConsent)(()=>{setTool('ai-tap');setCorners([]);setCornerNote(null);setStage('area');setTapNote(null);})}>{t('roomAiTap')}</button>}
      </div>
      {tool==='ai-tap'&&(roomAi||testAi)&&<p role="status" data-testid="ai-tap-note">{tapNote==='busy'?t('roomAiTapping'):tapNote==='added'?t('roomAiTapAdded'):tapNote==='nothing'?t('roomAiTapNothing'):tapNote?.startsWith('test:')?t(`roomAiTestProblem_${tapNote.slice(5) as TestAiProblem}`):tapNote?t(`roomAiProblem_${tapNote as AiProblem}`):testAi?t('roomAiTestTapHelp'):t('roomAiTapHelp',{left:quota&&typeof quota==='object'?quota.segmentsLeft:'…'})}</p>}
      {(tool==='brush'||tool==='erase')&&<label>{t('vizBrushSize')}<input type="range" min={6} max={80} step={2} value={brush} aria-label={t('vizBrushSize')} onChange={event=>setBrush(Number(event.target.value))}/></label>}
      {tool==='corners'&&cornerNote!=='set'&&<p role="status">{t('vizCornerNext',{n:corners.length+1})}</p>}
      {cornerNote==='bad'&&<p role="alert">{t('vizCornersBad')}</p>}
      {cornerNote==='set'&&<p role="status">{t('vizCornersSet')}</p>}
      <div className="viz-row">
       <button disabled={!h?.canUndo} onClick={undo} data-version={maskVersion}>{t('vizUndoArea')}</button>
       <button disabled={!h?.canRedo} onClick={redo}>{t('vizRedoArea')}</button>
       <button disabled={!h?.canClear} onClick={clear}>{t('vizClearArea')}</button>
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
      {testAi&&<div className="viz-ai" data-testid="viz-ai-test">
       <h4>{t('roomAiTitle')}<span className="viz-ai-test-badge">{t('roomAiTestTitle')}</span></h4>
       <p>{t('roomAiTestIntro')}</p>
       <label>{t('roomAiSurface')}<select value={surface} aria-label={t('roomAiSurface')} onChange={event=>setSurface(event.target.value as 'wall'|'floor'|'other')}>{(['wall','floor','other'] as const).map(id=><option key={id} value={id}>{t(`roomAiSurface_${id}`)}</option>)}</select></label>
       <button className="primary-button" disabled={testBusy} onClick={()=>withTestAccess(()=>{void makeTestAi();})}>{t('roomAiTestMake')}</button>
       {testBusy&&<button onClick={cancelTestAi}>{t('roomAiTestCancel')}</button>}
       {testNote&&<p role={testNote.kind==='problem'?'alert':'status'} data-testid="ai-test-note">{testNote.kind==='phase'?testNote.phase==='uploading'?t('roomAiTestPhase_uploading',{percent:testNote.percent??0}):t(`roomAiTestPhase_${testNote.phase}`):testNote.kind==='done'?t(testNote.kept?'roomAiTestDone':'roomAiTestDoneNotKept'):testNote.kind==='cancelled'?t('roomAiTestCancelled'):testNote.kind==='forgotten'?t('roomAiTestForgotten'):t(`roomAiTestProblem_${testNote.code}`)}</p>}
       {testNote?.kind==='phase'&&testNote.phase==='uploading'&&<progress className="viz-ai-progress" max={100} value={testNote.percent??0} aria-label={t('roomAiTestPhase_uploading',{percent:testNote.percent??0})}/>}
       {testCode&&!testBusy&&<button onClick={forgetTestCode}>{t('roomAiTestForget')}</button>}
      </div>}
      {cloud&&!testAi&&<div className="viz-ai" data-testid="viz-ai">
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
      {sessionNote&&<p role={sessionNote==='saved'?'status':'alert'} data-testid="viz-session-note">{t(sessionNote==='saved'?'vizSessionSaved':`vizSession_${sessionNote}`)}</p>}
      {variants.length>=2?<div className="viz-pair">
       <label>{t('vizCompareFirst')}<select value={pairA} aria-label={t('vizCompareFirst')} onChange={event=>{setPairA(event.target.value);setStage('compare');}}>{variants.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}</select></label>
       <label>{t('vizCompareSecond')}<select value={pairB} aria-label={t('vizCompareSecond')} onChange={event=>{setPairB(event.target.value);setStage('compare');}}>{variants.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}</select></label>
      </div>:<p className="structure-note">{t('vizCompareNeedTwo')}</p>}
     </section>}
    </>}
   </div>
  </div>
  {consent&&testAi&&<AiConsent locale={locale} mode="test" onAgree={()=>{giveTestConsent();const run=consent;setConsent(null);run();}} onCancel={()=>setConsent(null)}/>}
  {consent&&!testAi&&userId&&<AiConsent locale={locale} previews={quota&&typeof quota==='object'?quota.previewsPerMonth:3} onAgree={()=>{giveConsent(userId);const run=consent;setConsent(null);run();}} onCancel={()=>setConsent(null)}/>}
  {codeAsk&&testAi&&<AiCodePrompt locale={locale} wrong={codeAsk.wrong} onUse={acceptCode} onCancel={()=>setCodeAsk(null)}/>}
 </dialog>,document.body);
}
