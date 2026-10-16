import {furnitureStepCommand} from './furniture-gesture';
import {useCallback,useEffect,useMemo,useState,useSyncExternalStore} from 'react';
import type {ProjectStore} from '@gharplan/core-model';
import {coordinateLabel,furnitureCommand,furnitureDraft} from './furniture-transform';
import type {FurnitureDraft} from './furniture-transform';
import type {PrecisionPreview} from './WallPrecision';
import {FurnitureAdvisories} from './furniture-advisories';
import {FurnitureWarning} from './FurnitureWarning';
import {editError,message} from '../i18n/messages';
import type {Locale} from '../i18n/messages';
export function FurnitureControls({store,selected,onSelect,locale,onMessage,advisories:providedAdvisories,onPreview,onEditStart,cancelToken=0}:{store:ProjectStore;selected:string;onSelect(id:string):void;locale:Locale;onMessage(text:string):void;advisories?:FurnitureAdvisories;onEditStart?:()=>void;onPreview?:(preview:PrecisionPreview|null,token:string)=>void;cancelToken?:number}){
 const snapshot=useSyncExternalStore(store.subscribe,store.getSnapshot),item=snapshot.document.furniture.find(f=>f.id===selected);
 const [ownAdvisories]=useState(()=>new FurnitureAdvisories()),advisories=providedAdvisories??ownAdvisories;
 const [largeStep,setLargeStep]=useState(false),[active,setActive]=useState(false),[token,setToken]=useState(()=>crypto.randomUUID()),[baseTag,setBaseTag]=useState(()=>store.asyncTag());
 const [draft,setDraft]=useState<FurnitureDraft|null>(null),[error,setError]=useState('');
 const reset=useCallback(()=>{const live=store.getSnapshot();setDraft(live.document.furniture.some(f=>f.id===selected)?furnitureDraft(live,selected):null);setBaseTag(store.asyncTag());setToken(crypto.randomUUID());setActive(false);setError('');},[store,selected]);
 useEffect(()=>{reset();},[reset,snapshot.localGeneration,cancelToken]);
 const prepared=useMemo(()=>{if(!draft||!item||!store.acceptsAsync(baseTag))return null;try{const command=furnitureCommand(snapshot,item.id,draft);return {command,result:store.preview(command)};}catch{return null;}},[draft,item,snapshot,store,baseTag]);
 const proposed=prepared?.result.ok?prepared.result.document.furniture.find(f=>f.id===selected):undefined;
 const advisory=useMemo(()=>proposed&&prepared?.result.ok?advisories.check(prepared.result.document,proposed):null,[advisories,proposed,prepared]);
 useEffect(()=>{
  if(active&&prepared&&store.acceptsAsync(baseTag))onPreview?.({projectId:baseTag.projectId,sessionId:baseTag.sessionId,generation:baseTag.localGeneration,result:prepared.result,owner:'furniture-edit',token},token);
  return()=>onPreview?.(null,token);
 },[active,prepared,store,baseTag,onPreview,token]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape')reset();},hidden=()=>{if(document.hidden)reset();};window.addEventListener('keydown',key);window.addEventListener('blur',reset);document.addEventListener('visibilitychange',hidden);return()=>{window.removeEventListener('keydown',key);window.removeEventListener('blur',reset);document.removeEventListener('visibilitychange',hidden);};},[reset]);
 return <section className="drawing-controls" aria-label={message(locale,'furniturePanel')}><h3>{message(locale,'furniturePanel')}</h3>
  <label>{message(locale,'chooseFurniture')}<select aria-label={message(locale,'chooseFurniture')} value={item?.id??''} onChange={e=>onSelect(e.target.value)}><option value="">{message(locale,'noFurnitureSelection')}</option>{snapshot.document.furniture.map((f,i)=><option key={f.id} value={f.id}>{message(locale,'focusFurniture',{number:i+1})}</option>)}</select></label>
  <p>{message(locale,'furnitureDraftHelp')}</p>
  {item&&draft&&<form onSubmit={e=>{e.preventDefault();setError('');if(!store.acceptsAsync(baseTag)){reset();setError(message(locale,'dragChanged'));return;}if(!prepared?.result.ok){setError(prepared?editError(locale,prepared.result.ok?undefined:prepared.result.errors[0]):message(locale,'furnitureValuesInvalid'));return;}const result=store.execute(prepared.command);if(!result.ok)setError(editError(locale,result.errors[0]));else{reset();onMessage(message(locale,result.changed?'furnitureApplied':'furnitureUnchanged'));}}}>
   {(['x','y','elevation','rotation','scale'] as const).map(key=><label key={key}>{message(locale,key==='x'?'furnitureX':key==='y'?'furnitureY':key==='elevation'?'furnitureElevation':key==='rotation'?'furnitureRotation':'furnitureScale')}<input maxLength={80} aria-label={message(locale,key==='x'?'furnitureX':key==='y'?'furnitureY':key==='elevation'?'furnitureElevation':key==='rotation'?'furnitureRotation':'furnitureScale')} value={draft[key]} onChange={e=>{if(!active)onEditStart?.();setError('');setActive(true);setDraft({...draft,[key]:e.target.value});}}/></label>)}
   <p>{message(locale,'furnitureAlignHelp')}</p><button type="button" disabled={!prepared?.result.ok} onClick={()=>{if(!prepared?.result.ok||!proposed||!store.acceptsAsync(baseTag)){reset();return;}if(!active)onEditStart?.();const result=advisories.align(prepared.result.document,proposed);if(!result.alignment){onMessage(message(locale,result.available?'furnitureAlignNone':'furnitureAdvisoryUnavailable'));return;}setDraft({...draft,x:coordinateLabel(result.alignment.position.x,snapshot.document.units),y:coordinateLabel(result.alignment.position.y,snapshot.document.units)});setActive(true);onMessage(message(locale,'furnitureAligned'));}}>{message(locale,'furnitureAlign')}</button>
   {advisory&&<FurnitureWarning advisory={advisory} locale={locale}/>}
   <div className="furniture-step-controls" role="group" aria-label={message(locale,'furnitureSteps')}><label><input type="checkbox" checked={largeStep} onChange={e=>setLargeStep(e.target.checked)}/>{message(locale,'furnitureLargeStep')}</label>{(['left','right','up','down','rotateLeft','rotateRight'] as const).map(action=><button type="button" key={action} onClick={()=>{const live=store.getSnapshot();if(!live.document.furniture.some(f=>f.id===item.id)){setError(message(locale,'dragChanged'));return;}const n=largeStep?100:10,steps={left:{dx:-n},right:{dx:n},up:{dy:-n},down:{dy:n},rotateLeft:{rotation:-15},rotateRight:{rotation:15}},result=store.execute(furnitureStepCommand(live,item.id,steps[action]));onMessage(result.ok?message(locale,'furnitureApplied'):editError(locale,result.errors[0]));}}>{message(locale,action==='left'?'furnitureStepLeft':action==='right'?'furnitureStepRight':action==='up'?'furnitureStepUp':action==='down'?'furnitureStepDown':action==='rotateLeft'?'furnitureRotateLeft':'furnitureRotateRight')}</button>)}</div>
   <p>{message(locale,'furnitureSize',proposed?.size??item.size)}</p><button className="primary-button" type="submit">{message(locale,'applyFurniture')}</button><button type="button" onClick={reset}>{message(locale,'resetFurnitureDraft')}</button>
  </form>}{(error||active&&!prepared?.result.ok)&&<p role="alert">{error||(prepared?editError(locale,prepared.result.ok?undefined:prepared.result.errors[0]):message(locale,'furnitureValuesInvalid'))}</p>}
 </section>;
}
