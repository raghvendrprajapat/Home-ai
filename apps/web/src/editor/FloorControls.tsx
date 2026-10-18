import {useEffect,useState,useSyncExternalStore} from 'react';
import {MAX_FLOORS} from '@gharplan/core-model';
import type {ProjectStore} from '@gharplan/core-model';
import {editError,message} from '../i18n/messages';
import type {Locale} from '../i18n/messages';
/** FR-034 floor bar. It edits through the whole-project store; the parent keeps the active floor. */
export function FloorControls({store,activeFloorId,onActivate,locale,onMessage}:{store:ProjectStore;activeFloorId:string;onActivate(id:string):void;locale:Locale;onMessage(text:string):void}){
 const snapshot=useSyncExternalStore(store.subscribe,store.getSnapshot),floors=[...snapshot.document.floors].sort((a,b)=>a.level-b.level);
 const active=floors.find(f=>f.id===activeFloorId),top=floors.at(-1)!;
 const [copy,setCopy]=useState(true),[name,setName]=useState(active?.name??''),[confirming,setConfirming]=useState(false);
 useEffect(()=>{setName(active?.name??'');setConfirming(false);},[active?.id,active?.name]);
 const run=(command:Record<string,unknown>)=>store.execute({id:`floor_${crypto.randomUUID().replaceAll('-','')}`,baseGeneration:snapshot.localGeneration,...command} as Parameters<ProjectStore['execute']>[0]);
 const add=()=>{const before=new Set(floors.map(f=>f.id)),result=run({type:'AddFloor',name:message(locale,'floorDefaultName',{number:floors.length}),...copy?{copyOutlineFrom:top.id}:{}});
  if(!result.ok){onMessage(editError(locale,result.errors[0]));return;}
  const added=store.getSnapshot().document.floors.find(f=>!before.has(f.id));if(added)onActivate(added.id);onMessage(message(locale,copy?'floorAddedCopied':'floorAdded'));};
 const counts=active?{walls:snapshot.document.walls.filter(w=>w.floorId===active.id).length,items:snapshot.document.furniture.filter(f=>f.floorId===active.id).length}:{walls:0,items:0};
 return <section className="floor-controls" aria-label={message(locale,'floorsGroup')} data-active-floor={activeFloorId}>
  <div className="floor-tabs" role="group" aria-label={message(locale,'floorsGroup')}>{floors.map(f=><button key={f.id} type="button" aria-pressed={f.id===activeFloorId} className={f.id===activeFloorId?'active-tab':''} onClick={()=>{onActivate(f.id);onMessage(message(locale,'floorShown',{name:f.name}));}}>{f.name}</button>)}
   <button type="button" disabled={floors.length>=MAX_FLOORS} onClick={add}>{message(locale,'addFloor')}</button>
   <label className="snap-toggle"><input type="checkbox" checked={copy} onChange={e=>setCopy(e.target.checked)}/>{message(locale,'copyOutline')}</label>
  </div>
  {active&&<details className="floor-settings"><summary>{message(locale,'floorSettings')}</summary>
   <form onSubmit={e=>{e.preventDefault();const result=run({type:'UpdateFloor',floorId:active.id,properties:{name:name.trim()}});onMessage(result.ok?message(locale,'floorRenamed'):editError(locale,result.errors[0]));}}>
    <label>{message(locale,'floorName')}<input value={name} maxLength={60} onChange={e=>setName(e.target.value)}/></label><button type="submit" disabled={!name.trim()||name.trim()===active.name}>{message(locale,'renameFloor')}</button>
   </form>
   {!confirming?<button type="button" disabled={floors.length<2} onClick={()=>setConfirming(true)}>{message(locale,'deleteFloor')}</button>:
    <div role="alert"><p>{message(locale,'deleteFloorNotice',{name:active.name,walls:counts.walls,items:counts.items})}</p>
     <button type="button" className="primary-button" onClick={()=>{const result=run({type:'DeleteFloor',floorId:active.id});setConfirming(false);onMessage(result.ok?message(locale,'floorDeleted'):editError(locale,result.errors[0]));}}>{message(locale,'confirmDeleteFloor')}</button>
     <button type="button" onClick={()=>setConfirming(false)}>{message(locale,'cancel')}</button></div>}
  </details>}
 </section>;
}
