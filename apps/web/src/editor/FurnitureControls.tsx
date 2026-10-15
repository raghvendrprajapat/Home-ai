import {useEffect,useState,useSyncExternalStore} from 'react';
import type {ProjectStore} from '@gharplan/core-model';
import {furnitureCommand,furnitureDraft} from './furniture-transform';
import type {FurnitureDraft} from './furniture-transform';
import {editError,message} from '../i18n/messages';
import type {Locale} from '../i18n/messages';
export function FurnitureControls({store,selected,onSelect,locale,onMessage}:{store:ProjectStore;selected:string;onSelect(id:string):void;locale:Locale;onMessage(text:string):void}){
 const snapshot=useSyncExternalStore(store.subscribe,store.getSnapshot),item=snapshot.document.furniture.find(f=>f.id===selected);
 const [draft,setDraft]=useState<FurnitureDraft|null>(null),[base,setBase]=useState(-1),[error,setError]=useState('');
 const reset=()=>{setDraft(item?furnitureDraft(snapshot,item.id):null);setBase(snapshot.localGeneration);setError('');};
 useEffect(()=>{reset();},[selected,snapshot.localGeneration]);
 return <section className="drawing-controls" aria-label={message(locale,'furniturePanel')}><h3>{message(locale,'furniturePanel')}</h3>
  <label>{message(locale,'chooseFurniture')}<select aria-label={message(locale,'chooseFurniture')} value={item?.id??''} onChange={e=>onSelect(e.target.value)}><option value="">{message(locale,'noFurnitureSelection')}</option>{snapshot.document.furniture.map((f,i)=><option key={f.id} value={f.id}>{message(locale,'focusFurniture',{number:i+1})}</option>)}</select></label>
  <p>{message(locale,'furnitureDraftHelp')}</p>
  {item&&draft&&<form onSubmit={e=>{e.preventDefault();setError('');if(base!==store.getSnapshot().localGeneration){reset();setError(message(locale,'dragChanged'));return;}try{const result=store.execute(furnitureCommand(snapshot,item.id,draft));if(!result.ok)setError(editError(locale,result.errors[0]));else{reset();onMessage(message(locale,result.changed?'furnitureApplied':'furnitureUnchanged'));}}catch{setError(message(locale,'furnitureValuesInvalid'));}}}>
   {(['x','y','elevation','rotation','scale'] as const).map(key=><label key={key}>{message(locale,key==='x'?'furnitureX':key==='y'?'furnitureY':key==='elevation'?'furnitureElevation':key==='rotation'?'furnitureRotation':'furnitureScale')}<input maxLength={80} aria-label={message(locale,key==='x'?'furnitureX':key==='y'?'furnitureY':key==='elevation'?'furnitureElevation':key==='rotation'?'furnitureRotation':'furnitureScale')} value={draft[key]} onChange={e=>{setError('');setDraft({...draft,[key]:e.target.value});}}/></label>)}
   <p>{message(locale,'furnitureSize',{w:item.size.w,d:item.size.d,h:item.size.h})}</p><button className="primary-button" type="submit">{message(locale,'applyFurniture')}</button><button type="button" onClick={reset}>{message(locale,'resetFurnitureDraft')}</button>
  </form>}{error&&<p role="alert">{error}</p>}
 </section>;
}
