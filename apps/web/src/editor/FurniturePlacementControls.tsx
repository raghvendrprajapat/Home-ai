import {useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import type {ProjectStore} from '@gharplan/core-model';
import {editError,message} from '../i18n/messages';
import type {Locale} from '../i18n/messages';
import {currentPlacement,placementCommand,placementDraft} from './furniture-placement';
import type {PlacementIntent} from './furniture-placement';
import type {FurnitureDraft} from './furniture-transform';
import type {PrecisionPreview} from './WallPrecision';
export function FurniturePlacementControls({store,intent,label,locale,onPreview,onCancel,onAdded}:{store:ProjectStore;intent:PlacementIntent;label:string;locale:Locale;onPreview(preview:PrecisionPreview|null):void;onCancel():void;onAdded(id:string):void}){
 const snapshot=useSyncExternalStore(store.subscribe,store.getSnapshot),[draft,setDraft]=useState<FurnitureDraft>(()=>placementDraft(intent)),first=useRef<HTMLInputElement>(null),committed=useRef(false);
 const prepared=useMemo(()=>{
  try{const command=placementCommand(store,intent,draft),result=store.preview(command);return {command,result};}catch{return null;}
 },[store,intent,draft,snapshot.localGeneration]);
 useEffect(()=>{first.current?.focus({preventScroll:true});},[]);
 useEffect(()=>{
  if(!currentPlacement(store,intent)){onCancel();return;}
  onPreview(prepared?{projectId:intent.tag.projectId,sessionId:intent.tag.sessionId,generation:intent.tag.localGeneration,result:prepared.result,owner:'furniture'}:null);
  return()=>onPreview(null);
 },[prepared,store,intent,onPreview,onCancel]);
 useEffect(()=>{
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')onCancel();},blur=()=>onCancel(),hidden=()=>{if(document.hidden)onCancel();};
  window.addEventListener('keydown',escape);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',hidden);
  return()=>{window.removeEventListener('keydown',escape);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',hidden);};
 },[onCancel]);
 return <section className="drawing-controls" aria-label={message(locale,'placementTitle')} data-testid="furniture-placement"><h3>{message(locale,'placementTitle')}</h3><p>{label}</p><p>{message(locale,'placementHelp')}</p>
  <form onSubmit={event=>{event.preventDefault();if(committed.current||!prepared?.result.ok||!currentPlacement(store,intent))return;const result=store.execute(prepared.command);if(result.ok){committed.current=true;onAdded(intent.id);}}}>
   {(['x','y','elevation','rotation','scale'] as const).map((key,index)=>{const label=message(locale,key==='x'?'furnitureX':key==='y'?'furnitureY':key==='elevation'?'furnitureElevation':key==='rotation'?'furnitureRotation':'furnitureScale');return <label key={key}>{label}<input {...(index===0?{ref:first}:{})} maxLength={80} aria-label={label} value={draft[key]} onChange={event=>setDraft({...draft,[key]:event.target.value})}/></label>;})}
   {prepared?.result.ok?<p>{message(locale,'furnitureSize',prepared.command.furniture.size)}</p>:<p role="alert">{prepared?editError(locale,prepared.result.ok?undefined:prepared.result.errors[0]):message(locale,'furnitureValuesInvalid')}</p>}
   <button className="primary-button" type="submit" disabled={!prepared?.result.ok}>{message(locale,'placementAdd')}</button><button type="button" onClick={onCancel}>{message(locale,'placementCancel')}</button>
  </form>
 </section>;
}
