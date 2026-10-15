import type {ProjectStore} from '@gharplan/core-model';
import type {SolidFace,WallSolids} from '../render3d/solids';
type ProjectDoc=ReturnType<ProjectStore['getSnapshot']>['document'];
type FurnitureItem=ProjectDoc['furniture'][number];
/** Numerical comparison tolerance in derived millimetres, not saved geometry. */
export const SPATIAL_EPSILON_MM=1e-7;
type Point=readonly [number,number];
export interface OrientedFootprint {centre:Point;halfWidth:number;halfDepth:number;right:Point;back:Point}
export interface FurnitureCollisions {wallIds:string[];furnitureIds:string[]}
export interface BackAlignment {position:{x:number;y:number};distanceMm:number;key:string;axis:0|2;at:number;sign:-1|1}
const dot=(a:Point,b:Point)=>a[0]*b[0]+a[1]*b[1];
const positiveInterval=(a:number,b:number,c:number,d:number)=>Math.min(b,d)-Math.max(a,c)>SPATIAL_EPSILON_MM;
export function furnitureFootprint(item:Pick<FurnitureItem,'position'|'size'|'rotationDeg'>):OrientedFootprint {
 const {position:p,size:s,rotationDeg}=item;
 if(![p.x,p.y,s.w,s.d,rotationDeg].every(Number.isFinite)||s.w<=0||s.d<=0)throw Error('furniture-footprint');
 const angle=rotationDeg*Math.PI/180,c=Math.cos(angle),n=Math.sin(angle);
 return {centre:[p.x,p.y],halfWidth:s.w/2,halfDepth:s.d/2,right:[c,n],back:[-n,c]};
}
/** Four-axis SAT. Strict positive penetration; a touching edge/corner is not overlap. */
export function footprintsOverlap(a:OrientedFootprint,b:OrientedFootprint):boolean {
 const delta:Point=[b.centre[0]-a.centre[0],b.centre[1]-a.centre[1]];
 return [a.right,a.back,b.right,b.back].every(axis=>{
  const radius=(box:OrientedFootprint)=>box.halfWidth*Math.abs(dot(box.right,axis))+box.halfDepth*Math.abs(dot(box.back,axis));
  return radius(a)+radius(b)-Math.abs(dot(delta,axis))>SPATIAL_EPSILON_MM;
 });
}
export function furniturePairOverlap(a:FurnitureItem,b:FurnitureItem):boolean {
 return a.floorId===b.floorId&&positiveInterval(a.elevation,a.elevation+a.size.h,b.elevation,b.elevation+b.size.h)&&footprintsOverlap(furnitureFootprint(a),furnitureFootprint(b));
}
/** Chosen object versus actual cut/unioned wall solids and other objects, never all pairs. */
function overlappingWalls(document:ProjectDoc,item:FurnitureItem,solids:WallSolids):string[] {
 const base=document.floors.find(f=>f.id===item.floorId)?.elevation;
 if(base===undefined)throw Error('furniture-floor');
 const footprint=furnitureFootprint(item),bottom=base+item.elevation,top=bottom+item.size.h,walls=new Set<string>();
 const floorWalls=new Set(document.walls.filter(w=>w.floorId===item.floorId).map(w=>w.id));
 for(const box of solids.boxes){
  if(!floorWalls.has(box.ownerId)||!positiveInterval(bottom,top,box.lo[1],box.hi[1]))continue;
  const other:OrientedFootprint={centre:[(box.lo[0]+box.hi[0])/2,(box.lo[2]+box.hi[2])/2],halfWidth:(box.hi[0]-box.lo[0])/2,halfDepth:(box.hi[2]-box.lo[2])/2,right:[1,0],back:[0,1]};
  if(footprintsOverlap(footprint,other))walls.add(box.ownerId);
 }
 return [...walls].sort();
}
export function furnitureCollisions(document:ProjectDoc,item:FurnitureItem,solids:WallSolids):FurnitureCollisions {
 return {wallIds:overlappingWalls(document,item,solids),furnitureIds:document.furniture.filter(f=>f.id!==item.id&&furniturePairOverlap(item,f)).map(f=>f.id).sort()};
}

interface WallSide {axis:0|2;at:number;sign:-1|1;faces:SolidFace[];key:string}
const sidesCache=new WeakMap<WallSolids,Map<string,WallSide[]>>();
/** Intersect exposed faces with the actual longitudinal strip at each height.
 * Union material ownership cannot extend a nearby side onto a perpendicular cap.
 * Geometry-only solids identity caches the plane index and support intersection. */
function wallSides(document:ProjectDoc,solids:WallSolids,floorId:string):WallSide[]{
 let byFloor=sidesCache.get(solids);if(!byFloor){byFloor=new Map();sidesCache.set(solids,byFloor);}
 const previous=byFloor.get(floorId);if(previous)return previous;
 const groups=new Map<string,WallSide>(),planes=new Map<string,SolidFace[]>(),floorWalls=new Set(document.walls.filter(w=>w.floorId===floorId).map(w=>w.id));
 for(const face of solids.faces){if(face.axis===1)continue;const key=`${face.axis}:${face.at}:${face.sign}`,list=planes.get(key)??[];list.push(face);planes.set(key,list);}
 for(const support of solids.longitudinalSides){
  if(!floorWalls.has(support.ownerId)||support.axis===1)continue;
  const key=`${support.axis}:${support.at}:${support.sign}`,group=groups.get(key)??{axis:support.axis,at:support.at,sign:support.sign,key,faces:[]};
  for(const face of planes.get(key)??[]){
   const rect:[number,number,number,number]=[Math.max(face.rect[0],support.rect[0]),Math.max(face.rect[1],support.rect[1]),Math.min(face.rect[2],support.rect[2]),Math.min(face.rect[3],support.rect[3])];
   if(rect[2]-rect[0]>SPATIAL_EPSILON_MM&&rect[3]-rect[1]>SPATIAL_EPSILON_MM)group.faces.push({...face,rect});
  }
  if(group.faces.length)groups.set(key,group);
 }
 const result=[...groups.values()].sort((a,b)=>a.key.localeCompare(b.key));byFloor.set(floorId,result);return result;
}
/** Full tangent span must be covered at a COMMON positive height interval.
 * Preserve the 2D (tangent,height) union: low/high patches cannot bridge a hole. */
function supported(side:WallSide,lo:number,hi:number,bottom:number,top:number):boolean {
 const rectangles=side.faces.map(f=>side.axis===0?[f.rect[1],f.rect[0],f.rect[3],f.rect[2]] as const:f.rect)
  .filter(r=>positiveInterval(r[0],r[2],lo,hi)&&positiveInterval(r[1],r[3],bottom,top));
 const levels=[...new Set([bottom,top,...rectangles.flatMap(r=>[Math.max(bottom,r[1]),Math.min(top,r[3])])])].sort((a,b)=>a-b);
 for(let i=0;i<levels.length-1;i++){
  const low=levels[i]!,high=levels[i+1]!;if(high-low<=SPATIAL_EPSILON_MM)continue;
  let end=lo;
  for(const r of rectangles.filter(r=>r[1]<=low&&r[3]>=high).sort((a,b)=>a[0]-b[0])){
   if(r[2]<end)continue;if(r[0]>end+SPATIAL_EPSILON_MM)break;end=Math.max(end,r[2]);if(end>=hi-SPATIAL_EPSILON_MM)return true;
  }
 }
 return false;
}
/** Translate only: cardinal back face opposes the free-space normal. Max distance
 * is caller supplied (pointer pixels or explicit measured alignment), never infinite.
 * Odd half-mm surfaces quantize the centre AWAY from the wall by free-space sign. */
export function alignFurnitureBack(document:ProjectDoc,item:FurnitureItem,solids:WallSolids,maxDistanceMm:number,previousKey?:string):BackAlignment|null {
 if(!Number.isFinite(maxDistanceMm)||maxDistanceMm<0)throw Error('furniture-snap-distance');
 const box=furnitureFootprint(item),floor=document.floors.find(f=>f.id===item.floorId);if(!floor)throw Error('furniture-floor');
 const bottom=floor.elevation+item.elevation,top=bottom+item.size.h,candidates:BackAlignment[]=[];
 for(const side of wallSides(document,solids,item.floorId)){
  const normal:Point=side.axis===0?[side.sign,0]:[0,side.sign];
  if(dot(box.back,normal)>-1+1e-10)continue;
  const raw=side.at+side.sign*box.halfDepth,normalCoordinate=side.sign===1?Math.ceil(raw):Math.floor(raw);
  const tangent=Math.round(side.axis===0?item.position.y:item.position.x),position=side.axis===0?{x:normalCoordinate,y:tangent}:{x:tangent,y:normalCoordinate};
  const distanceMm=Math.hypot(position.x-item.position.x,position.y-item.position.y);if(distanceMm>maxDistanceMm+SPATIAL_EPSILON_MM)continue;
  const gap=side.sign*(normalCoordinate-side.sign*box.halfDepth-side.at);
  if(gap< -SPATIAL_EPSILON_MM||gap>1+SPATIAL_EPSILON_MM||!supported(side,tangent-box.halfWidth,tangent+box.halfWidth,bottom,top))continue;
  const aligned={...item,position};if(overlappingWalls(document,aligned,solids).length)continue;
  candidates.push({position,distanceMm,key:side.key,axis:side.axis,at:side.at,sign:side.sign});
 }
 return candidates.sort((a,b)=>Number(b.key===previousKey)-Number(a.key===previousKey)||a.distanceMm-b.distanceMm||a.key.localeCompare(b.key))[0]??null;
}
