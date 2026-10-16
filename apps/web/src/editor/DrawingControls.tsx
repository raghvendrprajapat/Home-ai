import { useEffect, useState, useSyncExternalStore } from 'react';
import type { ProjectStore, RoomType } from '@gharplan/core-model';
import { DrawingTool, drawingCommand } from './drawing-tools';
import {parseLength} from './measurements';
import { message, editError } from '../i18n/messages';
import type { Locale } from '../i18n/messages';
type NumericLabel='originX'|'originY'|'endX'|'endY'|'roomWidth'|'roomDepth'|'wallThickness'|'wallHeight'|'ceilingHeight';
function NumberField({label,value,onChange,min=-100000,max=100000,locale,measured=false}:{label:NumericLabel;value:string;onChange(value:string):void;min?:number;max?:number;locale:Locale;measured?:boolean}) {
 return <label>{message(locale,label)}<input type={measured?'text':'number'} step="1" min={min} max={max} required value={value} onChange={e=>onChange(e.target.value)} /></label>;
}
export function DrawingControls({tool,store,locale,onMessage}:{tool:DrawingTool;store:ProjectStore;locale:Locale;onMessage(text:string):void}) {
 const state=useSyncExternalStore(tool.subscribe,tool.getSnapshot),snapshot=useSyncExternalStore(store.subscribe,store.getSnapshot);
 const [values,setValues]=useState({x:'0',y:'0',width:'4000',depth:'3000',endX:'4000',endY:'0',thickness:'200',height:'2700'});
 const [choiceRoom,setChoiceRoom]=useState(''),[choiceX,setChoiceX]=useState(''),[choiceY,setChoiceY]=useState('');
 const sharedWall=state.error?.code==='shared-wall-properties'?snapshot.document.walls.find(w=>state.error?.entityIds.includes(w.id)):undefined;
 const measured=(value:string)=>{try{return parseLength(value);}catch{return NaN;}};
 useEffect(()=>{tool.properties={thickness:measured(values.thickness),height:measured(values.height)};if(state.end)tool.hover(state.end);},[values.thickness,values.height,tool]);
 useEffect(()=>{onMessage(state.error?editError(locale,state.error):message(locale,state.notice));},[state.error,state.notice,locale,onMessage]);
 useEffect(()=>{if(!snapshot.document.rooms.some(r=>r.id===choiceRoom))setChoiceRoom(snapshot.document.rooms[0]?.id??'');},[snapshot,choiceRoom]);
 const field=(key:keyof typeof values,label:NumericLabel,min?:number,max?:number)=><NumberField key={key} label={label} value={values[key]} locale={locale} measured onChange={v=>{if(tool.getSnapshot().unresolved)tool.clear();setValues(old=>({...old,[key]:v}));}} {...(min===undefined?{}:{min})} {...(max===undefined?{}:{max})}/>;
 const numeric=(mode:'wall'|'rectangle')=>{
  try{
   const from=[parseLength(values.x,{coordinate:true}),parseLength(values.y,{coordinate:true})] as const;
   const to=mode==='wall'?[parseLength(values.endX,{coordinate:true}),parseLength(values.endY,{coordinate:true})] as const:[from[0]+parseLength(values.width),from[1]+parseLength(values.depth)] as const;
   const properties={thickness:parseLength(values.thickness),height:parseLength(values.height)};
   tool.clear();tool.commit(drawingCommand(mode,from,to,properties,snapshot.localGeneration));
  }catch{onMessage(message(locale,'invalidMeasuredLength'));}
 };
 return <section className="drawing-controls" aria-label={message(locale,'drawingTools')}>
  <h3>{message(locale,'drawingTools')}</h3><div className="tool-buttons" role="group" aria-label={message(locale,'drawingTools')}>
   {(['select','wall','rectangle'] as const).map(mode=><button key={mode} aria-pressed={state.mode===mode} onClick={()=>tool.setMode(mode)}>{message(locale,mode==='select'?'selectTool':mode==='wall'?'wallTool':'rectangleTool')}</button>)}
   <button onClick={()=>{tool.clear();tool.setMode('select');}}>{message(locale,'doneDrawing')}</button>
  </div><p>{message(locale,'centrelineNote')}</p><p>{message(locale,'measuredEntryHint')}</p>
  <label><input type="checkbox" checked={state.snappingEnabled} onChange={e=>tool.setSnapping(e.target.checked)}/>{message(locale,'snapEnabled')}</label>
  <div className="coordinate-fields">{field('thickness','wallThickness',50,1000)}{field('height','wallHeight',1000,6000)}</div>
  {sharedWall&&<div role="alert"><p>{message(locale,'sharedWallValues',{thickness:sharedWall.thickness,height:sharedWall.height})}</p><button onClick={()=>setValues(old=>({...old,thickness:String(sharedWall.thickness),height:String(sharedWall.height)}))}>{message(locale,'useSharedDimensions')}</button></div>}
  {state.anchor&&state.end&&<p data-testid="drawing-size">{state.mode==='wall'?message(locale,'liveLength',{length:Math.round(Math.hypot(state.end[0]-state.anchor[0],state.end[1]-state.anchor[1]))}):<>{message(locale,'liveRoomSize',{width:Math.abs(state.end[0]-state.anchor[0]),depth:Math.abs(state.end[1]-state.anchor[1])})}<br/>{Number.isFinite(measured(values.thickness))&&message(locale,'clearSize',{width:Math.abs(state.end[0]-state.anchor[0])-measured(values.thickness),depth:Math.abs(state.end[1]-state.anchor[1])-measured(values.thickness)})}</>}</p>}
  <details><summary>{message(locale,'addMeasuredRoom')}</summary><form onSubmit={e=>{e.preventDefault();numeric('rectangle');}}><div className="coordinate-fields">{field('x','originX')}{field('y','originY')}{field('width','roomWidth',300,200000)}{field('depth','roomDepth',300,200000)}</div>{[values.width,values.depth,values.thickness].every(v=>Number.isFinite(measured(v)))&&<p>{message(locale,'clearSize',{width:measured(values.width)-measured(values.thickness),depth:measured(values.depth)-measured(values.thickness)})}</p>}<button type="submit" className="primary-button">{message(locale,'addMeasuredRoom')}</button></form></details>
  <details><summary>{message(locale,'addMeasuredWall')}</summary><form onSubmit={e=>{e.preventDefault();numeric('wall');}}><div className="coordinate-fields">{field('x','originX')}{field('y','originY')}{field('endX','endX')}{field('endY','endY')}</div><button type="submit" className="primary-button">{message(locale,'addMeasuredWall')}</button></form></details>
  {state.unresolved&&<form className="room-choice" aria-label={message(locale,'roomChoiceTitle')} onSubmit={e=>{e.preventDefault();if(!choiceX.trim()||!choiceY.trim()){onMessage(message(locale,'roomChoiceError'));return;}tool.resolve(choiceRoom,[Number(choiceX),Number(choiceY)]);}}>
   <h4>{message(locale,'roomChoiceTitle')}</h4><p>{message(locale,'roomChoiceHelp')}</p><label>{message(locale,'selectedRoom')}<select aria-label={message(locale,'selectedRoom')} value={choiceRoom} onChange={e=>setChoiceRoom(e.target.value)}>{snapshot.document.rooms.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
   <div className="coordinate-fields"><NumberField label="originX" locale={locale} value={choiceX} onChange={setChoiceX}/><NumberField label="originY" locale={locale} value={choiceY} onChange={setChoiceY}/></div><button className="primary-button">{message(locale,'retainRoom')}</button><button type="button" onClick={()=>tool.clear()}>{message(locale,'cancel')}</button>
  </form>}
 </section>;
}
const roomTypes:RoomType[]=['living','bedroom','kitchen','bathroom','dining','pooja','balcony','utility','hall','study','other'];
export function RoomControls({store,locale,onMessage,selectedRoomId}:{store:ProjectStore;locale:Locale;onMessage(text:string):void;selectedRoomId?:string|undefined}) {
 const snapshot=useSyncExternalStore(store.subscribe,store.getSnapshot),[selected,setSelected]=useState(''),room=snapshot.document.rooms.find(r=>r.id===selected);
 useEffect(()=>{if(selectedRoomId&&snapshot.document.rooms.some(r=>r.id===selectedRoomId))setSelected(selectedRoomId);},[selectedRoomId]);
 const [name,setName]=useState(''),[type,setType]=useState<RoomType>('other'),[height,setHeight]=useState('3000'),[material,setMaterial]=useState('');
 useEffect(()=>{if(!room)setSelected(snapshot.document.rooms[0]?.id??'');},[room,snapshot]);
 useEffect(()=>{if(room){setName(room.name);setType(roomTypes.find(t=>t===room.type)??'other');setHeight(String(room.ceilingHeight));}},[room?.id,room?.name,room?.type,room?.ceilingHeight]);
 useEffect(()=>{if(room)setMaterial(room.floorMaterial);},[room?.id,room?.floorMaterial]);
 if(!room)return null;
 return <section className="drawing-controls" aria-label={message(locale,'roomProperties')}><h3>{message(locale,'roomProperties')}</h3><label>{message(locale,'selectedRoom')}<select aria-label={message(locale,'selectedRoom')} value={selected} onChange={e=>setSelected(e.target.value)}>{snapshot.document.rooms.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
  <form onSubmit={e=>{e.preventDefault();if(!name.trim()||!height.trim()||!Number.isSafeInteger(Number(height))){onMessage(message(locale,'invalidEdit'));return;}const result=store.execute({id:`room_${crypto.randomUUID().replaceAll('-','')}`,baseGeneration:snapshot.localGeneration,type:'UpdateRoom',roomId:room.id,properties:{name:name.trim(),type,ceilingHeight:Number(height),floorMaterial:material}});onMessage(result.ok?message(locale,'roomUpdated'):editError(locale,result.errors[0]));}}>
   <label>{message(locale,'roomName')}<input required maxLength={60} value={name} onChange={e=>setName(e.target.value)}/></label><label>{message(locale,'roomType')}<select aria-label={message(locale,'roomType')} value={type} onChange={e=>setType(e.target.value as RoomType)}>{roomTypes.map(t=><option key={t} value={t}>{message(locale,`room_${t}`)}</option>)}</select></label>
   <NumberField label="ceilingHeight" locale={locale} value={height} onChange={setHeight} min={1800} max={6000}/><label>{message(locale,'floorFinish')}<select aria-label={message(locale,'floorFinish')} value={material} onChange={e=>setMaterial(e.target.value)}>{snapshot.document.materials.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><button type="submit" className="primary-button">{message(locale,'saveRoom')}</button>
  </form></section>;
}
