import type {RoomType} from '@gharplan/core-model';
import type {PlanDocument} from '../editor/view2d';
import type {CatalogAsset} from '../catalog/catalog';
import {WALKWAY_MM} from './furniture-suggest';

/**
 * D73 AI-2 layout suggestion. A provider proposes where each chosen item stands; acceptLayout is the trust boundary
 * that keeps a placement only when it is on the room's clear floor, clear of door swings, existing furniture and the
 * items accepted before it, does not block a window with something taller than the sill, and leaves a 600 mm walkway
 * in front free of anything taller than a low table. Rugs only need to be on the floor.
 */
export type Rect=readonly [number,number,number,number];
export type Turn=0|90|180|270;
export interface LayoutRoom {
 readonly roomType:RoomType;
 /** The room's clear floor as disjoint rectangles, and their bounding box. */
 readonly clearRects:readonly Rect[];readonly bounds:Rect;
 /** Keep-clear zones: a door's swing (its width deep) or an open passage, inside this room. */
 readonly doors:readonly Rect[];
 readonly windows:readonly Readonly<{zone:Rect;sill:number}>[];
 /** Existing furniture on this floor near the room, as axis-aligned boxes. */
 readonly obstacles:readonly Readonly<{rect:Rect;h:number}>[];
}
/** ideaId is the furniture idea this piece stands for; it differs from asset.id when a smaller option was used. */
export interface LayoutPlacement {readonly asset:CatalogAsset;readonly x:number;readonly y:number;readonly rotationDeg:Turn;readonly ideaId?:string}
export interface LayoutResult {readonly placed:readonly LayoutPlacement[];readonly skipped:readonly CatalogAsset[]}
/** Items up to this height (coffee tables, pouffes, rugs) may stand in another item's walkway. */
export const LOW_ITEM_MM=500;
/** Flat items (rugs) never collide. */
export const FLAT_ITEM_MM=50;
export const PASSAGE_DEPTH_MM=600;
export const WINDOW_ZONE_MM=100;
export const MAX_LAYOUT_ITEMS=12;
/** At most this many different layouts are offered for one set of ideas. */
export const MAX_LAYOUTS=3;
/** Each move in the preview is this far. */
export const NUDGE_MM=100;
export type PlacementProblem='outside'|'overlap'|'door'|'window'|'walkway';
const TURNS:readonly Turn[]=[0,90,180,270];

const area=(r:Rect)=>Math.max(0,r[2]-r[0])*Math.max(0,r[3]-r[1]);
const meet=(a:Rect,b:Rect):Rect=>[Math.max(a[0],b[0]),Math.max(a[1],b[1]),Math.min(a[2],b[2]),Math.min(a[3],b[3])];
/** Positive-area overlap; touching edges are clear. */
export const overlaps=(a:Rect,b:Rect)=>a[0]<b[2]&&b[0]<a[2]&&a[1]<b[3]&&b[1]<a[3];
export const insideFloor=(r:Rect,floor:readonly Rect[])=>area(r)-floor.reduce((s,f)=>s+area(meet(r,f)),0)<=.5;
const isRug=(a:CatalogAsset)=>a.category==='rugs'||a.dims.h<=FLAT_ITEM_MM;

/** The item's box on the plan. At 0° the front faces north (−Y); 90° east, 180° south, 270° west. */
export function footprint(dims:Readonly<{w:number;d:number}>,x:number,y:number,turn:Turn):Rect{
 const [hx,hy]=turn%180===0?[dims.w/2,dims.d/2]:[dims.d/2,dims.w/2];
 return [x-hx,y-hy,x+hx,y+hy];
}
/** The walkway strip in front of the item. */
export function frontZone(box:Rect,turn:Turn,depth=WALKWAY_MM):Rect{
 return turn===0?[box[0],box[1]-depth,box[2],box[1]]:turn===180?[box[0],box[3],box[2],box[3]+depth]:turn===90?[box[2],box[1],box[2]+depth,box[3]]:[box[0]-depth,box[1],box[0],box[3]];
}

/** Why a placement is refused next to the ones already accepted, or undefined when it is fine. */
export function placementProblem(room:LayoutRoom,accepted:readonly LayoutPlacement[],p:LayoutPlacement):PlacementProblem|undefined{
 const box=footprint(p.asset.dims,p.x,p.y,p.rotationDeg);
 if(!insideFloor(box,room.clearRects))return 'outside';
 if(isRug(p.asset))return undefined;
 const others=[...room.obstacles.filter(o=>o.h>FLAT_ITEM_MM),...accepted.filter(a=>!isRug(a.asset)).map(a=>({rect:footprint(a.asset.dims,a.x,a.y,a.rotationDeg),h:a.asset.dims.h,turn:a.rotationDeg}))];
 if(others.some(o=>overlaps(box,o.rect)))return 'overlap';
 if(room.doors.some(d=>overlaps(box,d)))return 'door';
 if(p.asset.dims.h>LOW_ITEM_MM&&room.windows.some(w=>p.asset.dims.h>w.sill&&overlaps(box,w.zone)))return 'window';
 const walk=frontZone(box,p.rotationDeg);
 if(!insideFloor(walk,room.clearRects)||others.some(o=>o.h>LOW_ITEM_MM&&overlaps(walk,o.rect)))return 'walkway';
 // A tall item must not stand in the walkway of an item accepted before it.
 if(p.asset.dims.h>LOW_ITEM_MM&&others.some(o=>'turn' in o&&overlaps(box,frontZone(o.rect,o.turn as Turn))))return 'walkway';
 return undefined;
}

/**
 * The trust boundary for any provider's layout answer. Keeps the provider's order; each idea at most once. An entry may
 * stand for an idea with one of that idea's options (`for` names the idea), so a smaller piece can replace one that
 * does not fit.
 */
export function acceptLayout(raw:unknown,room:LayoutRoom,assets:readonly CatalogAsset[],options:ReadonlyMap<string,readonly CatalogAsset[]>=new Map()):LayoutResult{
 const byId=new Map(assets.map(a=>[a.id,a])),placed:LayoutPlacement[]=[];
 if(Array.isArray(raw))for(const entry of raw.slice(0,50)){
  if(placed.length>=MAX_LAYOUT_ITEMS)break;
  if(!entry||typeof entry!=='object')continue;
  const e=entry as Record<string,unknown>,ideaId=e.for===undefined?e.assetId:e.for,idea=typeof ideaId==='string'?byId.get(ideaId):undefined;
  const asset=!idea||typeof e.assetId!=='string'?undefined:e.assetId===idea.id?idea:options.get(idea.id)?.find(a=>a.id===e.assetId);
  if(!idea||!asset||placed.some(p=>(p.ideaId??p.asset.id)===idea.id))continue;
  const {x,y,rotationDeg}=e;
  if(typeof x!=='number'||typeof y!=='number'||!Number.isSafeInteger(x)||!Number.isSafeInteger(y)||Math.abs(x)>100000||Math.abs(y)>100000||!TURNS.includes(rotationDeg as Turn))continue;
  const p:LayoutPlacement={asset,x,y,rotationDeg:rotationDeg as Turn,ideaId:idea.id};
  if(!placementProblem(room,placed,p))placed.push(p);
 }
 return {placed,skipped:assets.filter(a=>!placed.some(p=>(p.ideaId??p.asset.id)===a.id))};
}

/** Several layouts: `{layouts:[…]}` (at most MAX_LAYOUTS) or one plain list. Empty and repeated layouts are dropped. */
export function acceptLayouts(raw:unknown,room:LayoutRoom,assets:readonly CatalogAsset[],options:ReadonlyMap<string,readonly CatalogAsset[]>=new Map()):LayoutResult[]{
 const lists=raw&&typeof raw==='object'&&!Array.isArray(raw)&&Array.isArray((raw as {layouts?:unknown}).layouts)?(raw as {layouts:unknown[]}).layouts.slice(0,MAX_LAYOUTS):[raw];
 const out:LayoutResult[]=[],keys=new Set<string>();
 for(const list of lists){
  const result=acceptLayout(list,room,assets,options),key=JSON.stringify(result.placed.map(p=>[p.asset.id,p.x,p.y,p.rotationDeg]));
  if(result.placed.length&&!keys.has(key)){keys.add(key);out.push(result);}
 }
 return out;
}

/**
 * Turns (90° about its centre) or moves one previewed piece, checked against the room and every other piece. Returns
 * the changed list, or the reason the new spot is not safe; the list is never changed on a refusal.
 */
export function adjustPlacement(room:LayoutRoom,placed:readonly LayoutPlacement[],index:number,change:Readonly<{dx?:number;dy?:number;turn?:boolean}>):{ok:true;placed:LayoutPlacement[]}|{ok:false;problem:PlacementProblem}{
 const current=placed[index];if(!current)return {ok:false,problem:'outside'};
 const moved:LayoutPlacement={...current,x:current.x+(change.dx??0),y:current.y+(change.dy??0),rotationDeg:change.turn?(current.rotationDeg+90)%360 as Turn:current.rotationDeg};
 const others=placed.filter((_,i)=>i!==index),problem=placementProblem(room,others,moved);
 return problem?{ok:false,problem}:{ok:true,placed:placed.map((p,i)=>i===index?moved:p)};
}

/** Builds the layout facts for one room face from the saved drawing: its clear floor, doors, windows and furniture. */
export function layoutRoom(document:PlanDocument,face:Readonly<{clearRects:readonly Rect[];clearRect:Rect}>,roomType:RoomType,floorId:string):LayoutRoom{
 const at=new Map(document.junctions.map(j=>[j.id,j])),doors:Rect[]=[],windows:{zone:Rect;sill:number}[]=[];
 for(const o of document.openings){
  const wall=document.walls.find(w=>w.id===o.wallId),a=wall&&at.get(wall.a),b=wall&&at.get(wall.b);
  if(!wall||!a||!b||wall.floorId!==floorId)continue;
  const horizontal=a.y===b.y,length=horizontal?Math.abs(b.x-a.x):Math.abs(b.y-a.y);if(!length||(!horizontal&&a.x!==b.x))continue;
  const c=(horizontal?a.x:a.y)+Math.sign(horizontal?b.x-a.x:b.y-a.y)*o.offset,line=horizontal?a.y:a.x,half=o.width/2,t=wall.thickness/2;
  const depth=o.kind==='window'?WINDOW_ZONE_MM:o.kind==='door'?o.width:PASSAGE_DEPTH_MM;
  for(const r of face.clearRects){
   const [lo,hi,near,far]=horizontal?[r[0],r[2],r[1],r[3]]:[r[1],r[3],r[0],r[2]];
   if(c+half<=lo||c-half>=hi)continue;
   let zone:Rect|undefined;
   if(Math.abs(near-(line+t))<=1)zone=horizontal?[c-half,near,c+half,near+depth]:[near,c-half,near+depth,c+half];
   else if(Math.abs(far-(line-t))<=1)zone=horizontal?[c-half,far-depth,c+half,far]:[far-depth,c-half,far,c+half];
   if(zone){if(o.kind==='window')windows.push({zone,sill:o.sill});else doors.push(zone);}
  }
 }
 const obstacles=document.furniture.filter(f=>f.floorId===floorId).map(f=>{
  const r=f.rotationDeg*Math.PI/180,c=Math.abs(Math.cos(r)),s=Math.abs(Math.sin(r)),hx=(c*f.size.w+s*f.size.d)/2,hy=(s*f.size.w+c*f.size.d)/2;
  return {rect:[f.position.x-hx,f.position.y-hy,f.position.x+hx,f.position.y+hy] as Rect,h:f.size.h};
 }).filter(o=>overlaps(o.rect,face.clearRect));
 return {roomType,clearRects:face.clearRects,bounds:face.clearRect,doors,windows,obstacles};
}
