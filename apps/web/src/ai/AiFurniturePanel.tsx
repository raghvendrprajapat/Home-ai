import {useEffect,useState,useSyncExternalStore} from 'react';
import type {ProjectStore,RoomType} from '@gharplan/core-model';
import {assetName,latestAssets} from '../catalog/catalog';
import type {Catalog,CatalogAsset} from '../catalog/catalog';
import {message} from '../i18n/messages';
import type {Locale} from '../i18n/messages';
import type {Point2} from '../editor/view2d';
import {acceptSuggestions,roomBrief,WALKWAY_MM} from './furniture-suggest';
import type {AiProvider,FurnitureSuggestion} from './furniture-suggest';

type State=Readonly<{phase:'idle'}|{phase:'loading'}|{phase:'ready';roomId:string;items:readonly FurnitureSuggestion[]}|{phase:'failed'}>;

/**
 * D73 "AI furniture ideas" for one room. The provider proposes, acceptSuggestions filters, and Place opens the normal
 * placement form centred in the room, so nothing is added to the drawing until the person confirms it there.
 */
export function AiFurniturePanel({store,locale,selectedRoomId,provider,catalog,onPlace}:{store:ProjectStore;locale:Locale;selectedRoomId:string|undefined;provider:AiProvider;catalog:(signal:AbortSignal)=>Promise<Catalog>;onPlace(asset:CatalogAsset,centre:Point2):void}){
 const snapshot=useSyncExternalStore(store.subscribe,store.getSnapshot),rooms=snapshot.document.rooms.filter(r=>snapshot.derived.faces.some(f=>f.roomId===r.id));
 const [chosen,setChosen]=useState(''),[state,setState]=useState<State>({phase:'idle'});
 const roomId=rooms.some(r=>r.id===chosen)?chosen:selectedRoomId&&rooms.some(r=>r.id===selectedRoomId)?selectedRoomId:rooms[0]?.id??'';
 useEffect(()=>{if(selectedRoomId)setChosen(selectedRoomId);},[selectedRoomId]);
 useEffect(()=>{setState({phase:'idle'});},[roomId]);
 const room=rooms.find(r=>r.id===roomId),face=snapshot.derived.faces.find(f=>f.roomId===roomId);
 const suggest=async()=>{
  if(!room||!face)return;
  setState({phase:'loading'});const controller=new AbortController();
  try{
   const candidates=latestAssets(await catalog(controller.signal)),existing=snapshot.document.furniture.filter(f=>{const [x0,y0,x1,y1]=face.clearRect;return f.position.x>=x0&&f.position.x<=x1&&f.position.y>=y0&&f.position.y<=y1;}).map(f=>f.assetId);
   // The model validator only admits known room types.
   const brief=roomBrief(room.type as RoomType,face.clearRect,existing);
   setState({phase:'ready',roomId:room.id,items:acceptSuggestions(await provider.suggestFurniture(brief,candidates,controller.signal),brief,candidates)});
  }catch{setState({phase:'failed'});}
 };
 const reason=(s:FurnitureSuggestion)=>s.reason.kind==='text'?s.reason[locale]:message(locale,s.reason.kind==='largest'?'aiReasonLargest':'aiReasonFits',{walk:WALKWAY_MM});
 const centre=():Point2=>{const [x0,y0,x1,y1]=face!.clearRect;return [Math.round((x0+x1)/2),Math.round((y0+y1)/2)];};
 return <section className="drawing-controls ai-panel" aria-label={message(locale,'aiTitle')}>
  <h3>{message(locale,'aiTitle')}</h3>
  <p className="structure-note">{message(locale,provider.kind==='stand-in'?'aiTestMode':'aiServerMode')}</p>
  {!rooms.length?<p>{message(locale,'aiNoRooms')}</p>:<>
   <label>{message(locale,'aiRoom')}<select aria-label={message(locale,'aiRoom')} value={roomId} onChange={event=>setChosen(event.target.value)}>{rooms.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
   <button className="primary-button" disabled={state.phase==='loading'} onClick={()=>{void suggest();}}>{message(locale,'aiSuggest')}</button>
  </>}
  {state.phase==='loading'&&<p role="status">{message(locale,'aiThinking')}</p>}
  {state.phase==='failed'&&<p role="alert">{message(locale,'aiFailed')}</p>}
  {state.phase==='ready'&&(state.items.length?<ul className="ai-ideas">{state.items.map(s=><li key={s.asset.id} data-asset-id={s.asset.id}>
   <strong>{assetName(s.asset,locale)}</strong> <span>{message(locale,'aiSize',{w:s.asset.dims.w,d:s.asset.dims.d})}</span>
   <p className="structure-note">{reason(s)}</p>
   <button onClick={()=>onPlace(s.asset,centre())}>{message(locale,'aiPlace')}</button>
  </li>)}</ul>:<p role="status">{message(locale,'aiNone')}</p>)}
 </section>;
}
