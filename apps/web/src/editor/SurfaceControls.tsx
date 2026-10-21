import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import type {MaterialDef,ProjectStore} from '@gharplan/core-model';
import {beginSurfacePaint,currentSurfacePaint,surfaceMaterialId,surfacePaintCommand,wallSideDirection} from './surface-materials';
import type {SurfacePaintIntent,SurfaceTarget} from './surface-materials';
import {surfaceMaterialName,surfacePalette,surfaceTextureLibrary} from './material-library';
import type {Pick} from './hit-test';
import {editError,message} from '../i18n/messages';
import type {Locale} from '../i18n/messages';
type Armed={paint:SurfacePaintIntent;epoch:number;button:HTMLButtonElement;rect:readonly number[];input:'pointer'|'keyboard';pointer:number;start:readonly[number,number];released:boolean};
export function SurfaceControls({store,locale,view,picked,onSelect,onEditStart,onMessage}:{store:ProjectStore;locale:Locale;view:'2d'|'3d'|'split';picked?:Pick|undefined;onSelect(pick:Pick):void;onEditStart():void;onMessage(text:string):void}){
 const snapshot=useSyncExternalStore(store.subscribe,store.getSnapshot),doc=snapshot.document,pickKey=picked?.kind==='wall'?`wall:${picked.id}`:picked?.kind==='room'?`floor:${picked.id}`:null;
 const [choice,setChoice]=useState(()=>({pickKey,value:pickKey??(doc.walls[0]?`wall:${doc.walls[0].id}`:doc.rooms[0]?`floor:${doc.rooms[0].id}`:'')})),[side,setSide]=useState<'left'|'right'>('left');
 const value=choice.pickKey===pickKey?choice.value:pickKey??choice.value,id=value.slice(value.indexOf(':')+1),target:SurfaceTarget|null=value.startsWith('wall:')&&doc.walls.some(w=>w.id===id)?{kind:'wall',id,side}:value.startsWith('floor:')&&doc.rooms.some(r=>r.id===id)?{kind:'floor',id}:null;
 const key=JSON.stringify([store.asyncTag(),target,view,locale,picked]),owner=useRef({key,epoch:0});if(owner.current.key!==key)owner.current={key,epoch:owner.current.epoch+1};
 const armed=useRef<Armed|null>(null),blocked=useRef(false),held=useRef(new Set<number>());
 const cancel=()=>{if(armed.current)blocked.current=true;armed.current=null;};
 useEffect(()=>{
  const down=(e:PointerEvent)=>{held.current.add(e.pointerId);if(held.current.size>1)cancel();},up=(e:PointerEvent)=>{held.current.delete(e.pointerId);const a=armed.current;if(a?.input==='pointer'&&a.pointer===e.pointerId&&(e.type==='pointercancel'||!(e.target instanceof Node)||!a.button.contains(e.target)))cancel();},blur=()=>{cancel();held.current.clear();},scroll=()=>{const a=armed.current;if(a&&a.rect.some((v,i)=>Math.abs(v-rect(a.button)[i]!)>=.5))cancel();},hidden=()=>{if(document.hidden)blur();},escape=(e:KeyboardEvent)=>{if(e.key==='Escape')cancel();};
  document.addEventListener('pointerdown',down,true);document.addEventListener('pointerup',up,true);document.addEventListener('pointercancel',up,true);window.addEventListener('blur',blur);window.addEventListener('scroll',scroll,true);document.addEventListener('visibilitychange',hidden);document.addEventListener('keydown',escape,true);
  return()=>{document.removeEventListener('pointerdown',down,true);document.removeEventListener('pointerup',up,true);document.removeEventListener('pointercancel',up,true);window.removeEventListener('blur',blur);window.removeEventListener('scroll',scroll,true);document.removeEventListener('visibilitychange',hidden);document.removeEventListener('keydown',escape,true);armed.current=null;held.current.clear();};
 },[]);
 const rect=(button:HTMLButtonElement)=>{const r=button.getBoundingClientRect();return [r.left,r.top,r.width,r.height];};
 const arm=(material:MaterialDef,button:HTMLButtonElement,input:Armed['input'],pointer=-1,start:readonly[number,number]=[0,0])=>{cancel();if(!target)return;try{armed.current={paint:beginSurfacePaint(store,target,material),epoch:owner.current.epoch,button,rect:rect(button),input,pointer,start,released:false};blocked.current=false;}catch{onMessage(message(locale,'surfaceChanged'));}};
 const paint=(material:MaterialDef,button:HTMLButtonElement,detail:number)=>{
  let intent=armed.current;
  // Assistive activation can dispatch click without a physical pointer/key sequence.
  if(!intent&&detail===0&&!blocked.current){onEditStart();arm(material,button,'keyboard');intent=armed.current;}
  const valid=intent&&target&&intent.button===button&&intent.paint.material.id===material.id&&intent.epoch===owner.current.epoch&&currentSurfacePaint(store,intent.paint,target)&&(intent.input==='keyboard'||intent.released)&&intent.rect.every((v,i)=>Math.abs(v-rect(button)[i]!)<.5);
  armed.current=null;blocked.current=false;if(!valid||!intent){onMessage(message(locale,'surfaceChanged'));return;}
  const result=store.execute(surfacePaintCommand(intent.paint));onMessage(result.ok?message(locale,result.changed?'surfaceApplied':'surfaceUnchanged'):editError(locale,result.errors[0]));
 };
 const current=target?surfaceMaterialId(doc,target):undefined;
 return <section className="drawing-controls surface-controls" aria-label={message(locale,'surfaceTitle')} onPointerDownCapture={onEditStart} onKeyDownCapture={e=>{if(e.key!=='Escape')onEditStart();}} onBlurCapture={e=>{if(armed.current?.button===e.target)cancel();}}>
  <h3>{message(locale,'surfaceTitle')}</h3><p>{message(locale,'surfaceHelp')}</p>
  <label>{message(locale,'surfaceTarget')}<select aria-label={message(locale,'surfaceTarget')} value={target?value:''} onChange={e=>{cancel();setChoice({pickKey,value:e.target.value});const [kind,...parts]=e.target.value.split(':');onSelect({kind:kind==='wall'?'wall':'room',id:parts.join(':')});}}><option value="" disabled>{message(locale,'surfaceChoose')}</option>{doc.walls.map((w,i)=><option key={`wall:${w.id}`} value={`wall:${w.id}`}>{message(locale,'surfaceWall',{number:i+1})}</option>)}{doc.rooms.map(r=><option key={`floor:${r.id}`} value={`floor:${r.id}`}>{message(locale,'surfaceFloor',{name:r.name})}</option>)}</select></label>
  {target?.kind==='wall'&&<label>{message(locale,'surfaceWallSide')}<select aria-label={message(locale,'surfaceWallSide')} value={side} onChange={e=>{cancel();setSide(e.target.value as 'left'|'right');}}>{(['left','right'] as const).map(s=><option key={s} value={s}>{message(locale,s==='left'?'surfaceLeft':'surfaceRight',{direction:message(locale,`surface_${wallSideDirection(doc,target.id,s)}`)})}</option>)}</select></label>}
  {!target&&<p role="status">{message(locale,'surfaceChoose')}</p>}
  <div className="surface-palette" role="group" aria-label={message(locale,'surfacePalette')}>{surfacePalette(doc,surfaceTextureLibrary).map(material=><button key={material.id} type="button" data-material-id={material.id} aria-label={message(locale,'surfaceApply',{name:surfaceMaterialName(material,locale)})} aria-pressed={current===material.id} disabled={!target} onPointerDown={e=>{if(!e.isPrimary||e.button!==0||held.current.size>1){cancel();return;}arm(material,e.currentTarget,'pointer',e.pointerId,[e.clientX,e.clientY]);}} onPointerMove={e=>{const a=armed.current;if(a?.input==='pointer'&&a.pointer===e.pointerId&&Math.hypot(e.clientX-a.start[0],e.clientY-a.start[1])>6)cancel();}} onPointerUp={e=>{const a=armed.current;if(a?.input==='pointer'&&a.pointer===e.pointerId){if(Math.hypot(e.clientX-a.start[0],e.clientY-a.start[1])>6)cancel();else a.released=true;}}} onPointerCancel={cancel} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){if(e.repeat){e.preventDefault();return;}arm(material,e.currentTarget,'keyboard');}}} onClick={e=>paint(material,e.currentTarget,e.detail)}><span aria-hidden="true" className="surface-chip" style={{backgroundColor:material.baseColor}}/><span>{surfaceMaterialName(material,locale)}</span></button>)}</div>
  <p>{message(locale,'surfaceBaseColours')}</p>
 </section>;
}
