import {FurnitureAdvisories} from './furniture-advisories';
import {FurnitureWarning} from './FurnitureWarning';
import {coordinateLabel} from './furniture-transform';
import {useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import type {ProjectStore} from '@gharplan/core-model';
import {editError,message} from '../i18n/messages';
import type {Locale} from '../i18n/messages';
import {currentPlacement,placementCommand,placementDraft} from './furniture-placement';
import type {PlacementIntent} from './furniture-placement';
import type {FurnitureDraft} from './furniture-transform';
import type {PrecisionPreview} from './WallPrecision';
export function FurniturePlacementControls({advisories:providedAdvisories,store,intent,label,locale,onPreview,onCancel,onAdded}:{advisories?:FurnitureAdvisories;store:ProjectStore;intent:PlacementIntent;label:string;locale:Locale;onPreview(preview:PrecisionPreview|null):void;onCancel():void;onAdded(id:string):void}){
 const [ownAdvisories]=useState(()=>new FurnitureAdvisories()),advisories=providedAdvisories??ownAdvisories;
 const snapshot=useSyncExternalStore(store.subscribe,store.getSnapshot),[draft,setDraft]=useState<FurnitureDraft>(()=>placementDraft(intent)),first=useRef<HTMLInputElement>(null),committed=useRef(false);
 const prepared=useMemo(()=>{
  try{const command=placementCommand(store,intent,draft),result=store.preview(command);return {command,result};}catch{return null;}
 },[store,intent,draft,snapshot.localGeneration]);
 const proposed=prepared?.result.ok?prepared.result.document.furniture.find(f=>f.id===intent.id):undefined;
 const advisory=useMemo(()=>proposed&&prepared?.result.ok?advisories.check(prepared.result.document,proposed):null,[advisories,proposed,prepared]);
 const [alignNotice,setAlignNotice]=useState('');
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
   {(['x','y','elevation','rotation','scale'] as const).map((key,index)=>{const label=message(locale,key==='x'?'furnitureX':key==='y'?'furnitureY':key==='elevation'?'furnitureElevation':key==='rotation'?'furnitureRotation':'furnitureScale');return <label key={key}>{label}<input {...(index===0?{ref:first}:{})} maxLength={80} aria-label={label} value={draft[key]} onChange={event=>{setAlignNotice('');setDraft({...draft,[key]:event.target.value});}}/></label>;})}
   {prepared?.result.ok?<p>{message(locale,'furnitureSize',prepared.command.furniture.size)}</p>:<p role="alert">{prepared?editError(locale,prepared.result.ok?undefined:prepared.result.errors[0]):message(locale,'furnitureValuesInvalid')}</p>}
   <p>{message(locale,'furnitureAlignHelp')}</p><button type="button" disabled={!prepared?.result.ok} onClick={()=>{if(!prepared?.result.ok||!proposed||!currentPlacement(store,intent))return;const result=advisories.align(prepared.result.document,proposed);if(!result.alignment){setAlignNotice(message(locale,result.available?'furnitureAlignNone':'furnitureAdvisoryUnavailable'));return;}setDraft({...draft,x:coordinateLabel(result.alignment.position.x,snapshot.document.units),y:coordinateLabel(result.alignment.position.y,snapshot.document.units)});setAlignNotice(message(locale,'furnitureAligned'));}}>{message(locale,'furnitureAlign')}</button>
   {alignNotice&&<p role="status">{alignNotice}</p>}{advisory&&<FurnitureWarning advisory={advisory} locale={locale}/>}
   <button className="primary-button" type="submit" disabled={!prepared?.result.ok}>{message(locale,'placementAdd')}</button><button type="button" onClick={onCancel}>{message(locale,'placementCancel')}</button>
  </form>
 </section>;
}
