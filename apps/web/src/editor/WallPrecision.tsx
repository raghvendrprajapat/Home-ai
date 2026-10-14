import {useEffect,useState,useSyncExternalStore} from 'react';
import type {Command,PreviewResult,ProjectStore} from '@gharplan/core-model';
import type {DrawingTool} from './drawing-tools';
import {formatLength,parseLength} from './measurements';
import {wallLengthCommand} from './wall-edit';
import type {MovedEnd} from './wall-edit';
import {areaDisplay,editError,message} from '../i18n/messages';
import type {Locale} from '../i18n/messages';
export interface PrecisionPreview {projectId:string;sessionId:string;generation:number;result:PreviewResult;owner?:'wall'|'opening'}
export function WallPrecision({store,drawing,selected,onSelect,onPreview,cancelToken,locale,onMessage}:{store:ProjectStore;drawing:DrawingTool;selected:string;onSelect(id:string):void;onPreview(value:PrecisionPreview|null):void;cancelToken:number;locale:Locale;onMessage(text:string):void}) {
 const snapshot=useSyncExternalStore(store.subscribe,store.getSnapshot),wall=snapshot.document.walls.find(w=>w.id===selected);
 const [placement,setPlacement]=useState<'a'|'b'|'centre'>('a');
 const [length,setLength]=useState(''),[end,setEnd]=useState<MovedEnd>('b'),[thickness,setThickness]=useState(''),[height,setHeight]=useState(''),[pending,setPending]=useState<{command:Command;preview:PrecisionPreview}|null>(null),[error,setError]=useState<'symmetricInteger'|'invalidMeasuredLength'|null>(null);
 const clear=()=>{setPending(null);onPreview(null);setError(null);if(drawing.getSnapshot().unresolved)drawing.clear();};
 useEffect(()=>{clear();if(wall){const a=snapshot.document.junctions.find(j=>j.id===wall.a)!,b=snapshot.document.junctions.find(j=>j.id===wall.b)!;setLength(formatLength(Math.abs(b.x-a.x)+Math.abs(b.y-a.y),snapshot.document.units));setThickness(String(wall.thickness));setHeight(String(wall.height));}},[wall,snapshot.localGeneration,snapshot.document.units]);
 useEffect(()=>()=>onPreview(null),[onPreview]);
 useEffect(()=>{clear();},[cancelToken]);
 useEffect(()=>{
  const key=(event:KeyboardEvent)=>{if(event.key==='Escape')clear();},blur=()=>clear(),hidden=()=>{if(document.hidden)clear();};
  window.addEventListener('keydown',key);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',hidden);
  return()=>{window.removeEventListener('keydown',key);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',hidden);};
 },[drawing,onPreview]);
 if(!wall)return null;
 const a=snapshot.document.junctions.find(j=>j.id===wall.a)!,b=snapshot.document.junctions.find(j=>j.id===wall.b)!;
 const prepare=(properties:boolean)=>{
  clear();try{
   const command:Command=properties?{id:`properties_${crypto.randomUUID().replaceAll('-','')}`,baseGeneration:snapshot.localGeneration,type:'UpdateWall',wallId:wall.id,properties:{thickness:parseLength(thickness),height:parseLength(height)}}:wallLengthCommand(snapshot.document,wall.id,parseLength(length),end,snapshot.localGeneration);
   if(command.type==='MoveJunctions')command.openingPlacement=placement;
   const result=store.preview(command),preview={projectId:snapshot.document.id,sessionId:snapshot.sessionId,generation:snapshot.localGeneration,result};setPending({command,preview});onPreview(preview);
  }catch(e){setError(e instanceof Error&&e.message==='symmetric-integer'?'symmetricInteger':'invalidMeasuredLength');}
 };
 return <section className="drawing-controls" aria-label={message(locale,'wallPrecision')}><h3>{message(locale,'wallPrecision')}</h3>
  <label>{message(locale,'selectedWall')}<select aria-label={message(locale,'selectedWall')} value={selected} onChange={e=>onSelect(e.target.value)}>{snapshot.document.walls.map((w,i)=>{const a=snapshot.document.junctions.find(j=>j.id===w.a)!,b=snapshot.document.junctions.find(j=>j.id===w.b)!;return <option key={w.id} value={w.id}>{message(locale,'wallOption',{number:i+1,length:formatLength(Math.abs(b.x-a.x)+Math.abs(b.y-a.y),snapshot.document.units)})}</option>;})}</select></label>
  <p>{message(locale,'measuredEntryHint')}</p><form onSubmit={e=>{e.preventDefault();prepare(false);}}><label>{message(locale,'preciseLength')}<input aria-label={message(locale,'preciseLength')} value={length} required onChange={e=>{clear();setLength(e.target.value);}}/></label><label>{message(locale,'movedEnd')}<select aria-label={message(locale,'movedEnd')} value={end} onChange={e=>{clear();setEnd(e.target.value as MovedEnd);}}><option value="a">{message(locale,'endA',{x:a.x,y:a.y})}</option><option value="b">{message(locale,'endB',{x:b.x,y:b.y})}</option><option value="both">{message(locale,'bothEnds')}</option></select></label><label>{message(locale,'openingPlacement')}<select aria-label={message(locale,'openingPlacement')} value={placement} onChange={e=>{clear();setPlacement(e.target.value as 'a'|'b'|'centre');}}><option value="a">{message(locale,'openingKeepA')}</option><option value="b">{message(locale,'openingKeepB')}</option><option value="centre">{message(locale,'openingKeepCentre')}</option></select></label><p>{message(locale,'openingPlacementHelp')}</p><button className="primary-button" type="submit">{message(locale,'previewLength')}</button></form>
  <form onSubmit={e=>{e.preventDefault();prepare(true);}}><div className="coordinate-fields"><label>{message(locale,'selectedWallThickness')}<input aria-label={message(locale,'selectedWallThickness')} value={thickness} required onChange={e=>{clear();setThickness(e.target.value);}}/></label><label>{message(locale,'selectedWallHeight')}<input aria-label={message(locale,'selectedWallHeight')} value={height} required onChange={e=>{clear();setHeight(e.target.value);}}/></label></div><button className="primary-button" type="submit">{message(locale,'previewWallProperties')}</button></form>
  {error&&<p role="alert">{message(locale,error)}</p>}
  {pending&&<div data-testid="wall-preview"><p>{message(locale,'previewOnly')}</p>{pending.preview.result.ok?<>
   {pending.preview.result.derived.faces.map(face=>{const old=snapshot.derived.faces.find(f=>f.roomId===face.roomId),room=pending.preview.result.ok?pending.preview.result.document.rooms.find(r=>r.id===face.roomId):null;const before=areaDisplay(old?.clearAreaMm2??0,snapshot.document.units),after=areaDisplay(face.clearAreaMm2,snapshot.document.units);return <p key={face.roomId}>{message(locale,'previewRoomArea',{name:room?.name??'',before:`${before.value} ${before.unit}`,after:`${after.value} ${after.unit}`})}</p>;})}
   <button className="primary-button" onClick={()=>{const live=store.getSnapshot();if(live.localGeneration!==pending.preview.generation||live.sessionId!==pending.preview.sessionId){clear();onMessage(message(locale,'dragChanged'));return;}const result=store.execute(pending.command);clear();onMessage(result.ok?message(locale,'preciseUpdated'):editError(locale,result.errors[0]));}}>{message(locale,'applyPreview')}</button>
  </>:<><p role="alert">{editError(locale,pending.preview.result.errors[0])}</p>{pending.preview.result.errors[0]?.code==='ambiguous-room'&&<button onClick={()=>drawing.commit(pending.command)}>{message(locale,'chooseRoomIdentity')}</button>}</>}<button onClick={clear}>{message(locale,'cancelPreview')}</button></div>}
 </section>;
}
