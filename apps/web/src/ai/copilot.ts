import type {Command,MaterialDef,ProjectStore,RoomType,SurfaceMaterialTarget} from '@gharplan/core-model';
import {surfaceLibrary} from '../editor/material-library';
import {wallSideDirection} from '../editor/surface-materials';
import {readIntent} from './copilot-intents';
import type {FloorFinish,Intent,PaintColour,RoomWords} from './copilot-intents';

type Snapshot=ReturnType<ProjectStore['getSnapshot']>;
type Document=Snapshot['document'];
export type PlanRoom=Document['rooms'][number];

/** D76 M3: the Copilot's "brain" plug. The stand-in reads keywords on the device; a hosted model (Gemini, Phase 2)
 * must return the same Intent shape, and acceptIntent checks it before the app acts on it. */
export interface CopilotProvider {readonly kind:'stand-in'|'server';read(text:string,signal:AbortSignal):Promise<unknown>}
export const standInCopilot:CopilotProvider={kind:'stand-in',async read(text,signal){if(signal.aborted)throw new DOMException('aborted','AbortError');return readIntent(text);}};

export const PAINT_MATERIAL:Readonly<Record<PaintColour,string>>={beige:'m_paint_beige',white:'m_paint_white',sky_blue:'m_paint_blue',grey:'m_paint_grey',mint:'m_paint_mint',peach:'m_paint_peach'};
export const FLOOR_MATERIAL:Readonly<Record<FloorFinish,string>>={wood:'m_wood_laminate',tile:'m_tile_vitrified',marble:'m_marble_white'};
const ROOM_TYPES=new Set(['living','bedroom','kitchen','bathroom','dining','pooja','balcony','utility','hall','study','other']);

/** Anything that is not exactly one of the five intents (with known values) becomes 'help', so the drawing is untouched. */
export function acceptIntent(raw:unknown):Intent{
 const help:Intent={kind:'help'};
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return help;
 const r=raw as Record<string,unknown>,room=r.room;
 const words:RoomWords|undefined=room===null||room===undefined?null:typeof room==='object'&&!Array.isArray(room)&&ROOM_TYPES.has((room as {type?:unknown}).type as string)&&typeof (room as {text?:unknown}).text==='string'?{type:(room as {type:RoomType}).type,text:(room as {text:string}).text.slice(0,60)}:undefined;
 switch(r.kind){
  case 'template':return r.template==='1bhk'||r.template==='2bhk'?{kind:'template',template:r.template}:help;
  case 'furnish':return words===undefined?help:{kind:'furnish',room:words};
  case 'paintWalls':return words===undefined||!(r.colour===null||typeof r.colour==='string'&&Object.hasOwn(PAINT_MATERIAL,r.colour))?help:{kind:'paintWalls',colour:r.colour as PaintColour|null,room:words};
  case 'floor':return words===undefined||!(r.finish===null||typeof r.finish==='string'&&Object.hasOwn(FLOOR_MATERIAL,r.finish))?help:{kind:'floor',finish:r.finish as FloorFinish|null,room:words};
  default:return help;
 }
}

/** The drawing's own definition when the ID is already used (a different one would be rejected), else the library's. */
export function libraryMaterial(document:Document,id:string):MaterialDef{
 const own=document.materials.find(m=>m.id===id);if(own)return own;
 const known=surfaceLibrary.find(e=>e.material.id===id);if(!known)throw new Error('copilot-material');return known.material;
}

/** Closed rooms on this floor, largest first. */
export function floorRooms(snapshot:Snapshot):{room:PlanRoom;area:number}[]{
 return snapshot.derived.faces.flatMap(face=>{const room=snapshot.document.rooms.find(r=>r.id===face.roomId);return room?[{room,area:face.clearAreaMm2}]:[];}).sort((a,b)=>b.area-a.area);
}
/** The named room: the selected one when it matches, else the largest of that type (or whose name contains the words). */
export function findRoom(snapshot:Snapshot,words:NonNullable<RoomWords>,selectedRoomId?:string):PlanRoom|undefined{
 const rooms=floorRooms(snapshot).map(r=>r.room),text=words.text.toLowerCase();
 const matches=rooms.filter(r=>r.type===words.type||(words.type==='living'&&r.type==='hall')||r.name.toLowerCase().includes(text));
 return matches.find(r=>r.id===selectedRoomId)??matches[0];
}

/** Every side of every wall on this floor. */
export function allWallSides(document:Document):SurfaceMaterialTarget[]{
 return document.walls.flatMap(w=>(['left','right'] as const).map(side=>({kind:'wall' as const,id:w.id,side})));
}
const STEP:Readonly<Record<'north'|'south'|'east'|'west',readonly [number,number]>>={north:[0,-1],south:[0,1],east:[1,0],west:[-1,0]};
/** The wall sides that face into a room: a point just off the side's middle lies on the room's clear floor. */
export function roomWallSides(snapshot:Snapshot,roomId:string):SurfaceMaterialTarget[]{
 const face=snapshot.derived.faces.find(f=>f.roomId===roomId);if(!face)return [];
 const at=new Map(snapshot.document.junctions.map(j=>[j.id,j]));
 return snapshot.document.walls.flatMap(w=>{
  const a=at.get(w.a),b=at.get(w.b);if(!a||!b)return [];
  const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
  return (['left','right'] as const).filter(side=>{
   const [dx,dy]=STEP[wallSideDirection(snapshot.document,w.id,side)],off=w.thickness/2+20,x=mx+dx*off,y=my+dy*off;
   return face.clearRects.some(([x0,y0,x1,y1])=>x>x0&&x<x1&&y>y0&&y<y1);
  }).map(side=>({kind:'wall' as const,id:w.id,side}));
 });
}

/** One command for the request, or null when every chosen surface already has that material. */
export function surfaceCommand(snapshot:Snapshot,targets:readonly SurfaceMaterialTarget[],material:MaterialDef,id:string):Command|null{
 const doc=snapshot.document,current=(t:SurfaceMaterialTarget)=>t.kind==='wall'?doc.walls.find(w=>w.id===t.id)?.[t.side==='left'?'leftMaterial':'rightMaterial']:doc.rooms.find(r=>r.id===t.id)?.floorMaterial;
 const todo=targets.filter(t=>current(t)!==material.id);
 return todo.length?{id,baseGeneration:snapshot.localGeneration,type:'ApplySurfaceMaterials',targets:todo,material}:null;
}
