import {furnitureStepCommand} from './furniture-gesture';
import {useEffect,useState,useSyncExternalStore} from 'react';
import type {ProjectStore} from '@gharplan/core-model';
import {furnitureCommand,furnitureDraft} from './furniture-transform';
import type {FurnitureDraft} from './furniture-transform';
import {editError,message} from '../i18n/messages';
import type {Locale} from '../i18n/messages';
export function FurnitureControls({store,selected,onSelect,locale,onMessage}:{store:ProjectStore;selected:string;onSelect(id:string):void;locale:Locale;onMessage(text:string):void}){
 const snapshot=useSyncExternalStore(store.subscribe,store.getSnapshot),item=snapshot.document.furniture.find(f=>f.id===selected);
 const [largeStep,setLargeStep]=useState(false);
 const [draft,setDraft]=useState<FurnitureDraft|null>(null),[base,setBase]=useState(-1),[error,setError]=useState('');
 const reset=()=>{setDraft(item?furnitureDraft(snapshot,item.id):null);setBase(snapshot.localGeneration);setError('');};
 useEffect(()=>{reset();},[selected,snapshot.localGeneration]);
 return <section className="drawing-controls" aria-label={message(locale,'furniturePanel')}><h3>{message(locale,'furniturePanel')}</h3>
  <label>{message(locale,'chooseFurniture')}<select aria-label={message(locale,'chooseFurniture')} value={item?.id??''} onChange={e=>onSelect(e.target.value)}><option value="">{message(locale,'noFurnitureSelection')}</option>{snapshot.document.furniture.map((f,i)=><option key={f.id} value={f.id}>{message(locale,'focusFurniture',{number:i+1})}</option>)}</select></label>
  <p>{message(locale,'furnitureDraftHelp')}</p>
  {item&&draft&&<form onSubmit={e=>{e.preventDefault();setError('');if(base!==store.getSnapshot().localGeneration){reset();setError(message(locale,'dragChanged'));return;}try{const result=store.execute(furnitureCommand(snapshot,item.id,draft));if(!result.ok)setError(editError(locale,result.errors[0]));else{reset();onMessage(message(locale,result.changed?'furnitureApplied':'furnitureUnchanged'));}}catch{setError(message(locale,'furnitureValuesInvalid'));}}}>
   {(['x','y','elevation','rotation','scale'] as const).map(key=><label key={key}>{message(locale,key==='x'?'furnitureX':key==='y'?'furnitureY':key==='elevation'?'furnitureElevation':key==='rotation'?'furnitureRotation':'furnitureScale')}<input maxLength={80} aria-label={message(locale,key==='x'?'furnitureX':key==='y'?'furnitureY':key==='elevation'?'furnitureElevation':key==='rotation'?'furnitureRotation':'furnitureScale')} value={draft[key]} onChange={e=>{setError('');setDraft({...draft,[key]:e.target.value});}}/></label>)}
   <div className="furniture-step-controls" role="group" aria-label={message(locale,'furnitureSteps')}><label><input type="checkbox" checked={largeStep} onChange={e=>setLargeStep(e.target.checked)}/>{message(locale,'furnitureLargeStep')}</label>{(['left','right','up','down','rotateLeft','rotateRight'] as const).map(action=><button type="button" key={action} onClick={()=>{const live=store.getSnapshot();if(!live.document.furniture.some(f=>f.id===item.id)){setError(message(locale,'dragChanged'));return;}const n=largeStep?100:10,steps={left:{dx:-n},right:{dx:n},up:{dy:-n},down:{dy:n},rotateLeft:{rotation:-15},rotateRight:{rotation:15}},result=store.execute(furnitureStepCommand(live,item.id,steps[action]));onMessage(result.ok?message(locale,'furnitureApplied'):editError(locale,result.errors[0]));}}>{message(locale,action==='left'?'furnitureStepLeft':action==='right'?'furnitureStepRight':action==='up'?'furnitureStepUp':action==='down'?'furnitureStepDown':action==='rotateLeft'?'furnitureRotateLeft':'furnitureRotateRight')}</button>)}</div>
   <p>{message(locale,'furnitureSize',{w:item.size.w,d:item.size.d,h:item.size.h})}</p><button className="primary-button" type="submit">{message(locale,'applyFurniture')}</button><button type="button" onClick={reset}>{message(locale,'resetFurnitureDraft')}</button>
  </form>}{error&&<p role="alert">{error}</p>}
 </section>;
}
