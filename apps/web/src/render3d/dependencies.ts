import { canonicalStringify } from '@gharplan/core-model';
import type { ProjectDoc } from '@gharplan/core-model';

/** Fields read by CPU structural derivation; visual material definitions stay GPU-owned. */
export function geometryDependencies(d:ProjectDoc){return {
 floors:d.floors.map(f=>({id:f.id,elevation:f.elevation})),
 junctions:d.junctions.map(({id,floorId,x,y})=>({id,floorId,x,y})),
 walls:d.walls.map(({id,floorId,a,b,thickness,height,leftMaterial,rightMaterial})=>({id,floorId,a,b,thickness,height,leftMaterial,rightMaterial})),
 openings:d.openings.map(({id,wallId,kind,offset,width,height,sill})=>({id,wallId,kind,offset,width,height,sill})),
 rooms:d.rooms.map(({id,floorId,boundary,ceilingHeight,floorMaterial})=>({id,floorId,boundary,ceilingHeight,floorMaterial})),
 uv:d.materials.map(m=>({id:m.id,scale:m.uvScaleMm??1000})),
};}
export interface SceneInvalidation {geometryChanged:boolean;dirtyEntityIds:string[];furnitureIds:string[];materialIds:string[];removedIds:string[]}
const ids=(items:{id:string}[])=>new Set(items.map(i=>i.id));
function changed(a:{id:string}[],b:{id:string}[]):Set<string>{const before=new Map(a.map(e=>[e.id,canonicalStringify(e)])),after=new Map(b.map(e=>[e.id,canonicalStringify(e)]));return new Set([...before.keys(),...after.keys()].filter(id=>before.get(id)!==after.get(id)));}
/** Advisory local graph. Full union/shared-edge analysis remains authoritative on structural changes. */
export function sceneInvalidation(previous:ProjectDoc|null,next:ProjectDoc):SceneInvalidation{
 const empty={...next,floors:[],junctions:[],walls:[],openings:[],rooms:[],furniture:[],materials:[]} as ProjectDoc;
 const old=previous??empty,a=geometryDependencies(old),b=geometryDependencies(next);
 const dirty=new Set<string>(),junctions=changed(a.junctions,b.junctions),walls=changed(a.walls,b.walls),rooms=changed(a.rooms,b.rooms),openings=changed(a.openings,b.openings),uv=changed(a.uv,b.uv);
 const elevation=canonicalStringify(a.floors)!==canonicalStringify(b.floors);
 for(const d of [old,next]){
  for(const o of d.openings)if(openings.has(o.id)){walls.add(o.wallId);dirty.add(o.id);}
  for(const w of d.walls)if(junctions.has(w.a)||junctions.has(w.b)||uv.has(w.leftMaterial)||uv.has(w.rightMaterial))walls.add(w.id);
 }
 // Include caps of every wall incident to a changed body's endpoints, from old and new topology.
 const ends=new Set<string>();for(const d of [old,next])for(const w of d.walls)if(walls.has(w.id)){ends.add(w.a);ends.add(w.b);}
 for(const d of [old,next]){
  for(const w of d.walls)if(ends.has(w.a)||ends.has(w.b)||elevation)dirty.add(w.id);
  for(const room of d.rooms){
   if(elevation||rooms.has(room.id)||uv.has(room.floorMaterial)||d.walls.some(w=>dirty.has(w.id)&&room.boundary.includes(w.a)&&room.boundary.includes(w.b)))dirty.add(room.id);
  }
  for(const o of d.openings)if(elevation||dirty.has(o.wallId)||d.rooms.some(r=>dirty.has(r.id)&&d.walls.some(w=>w.id===o.wallId&&r.boundary.includes(w.a)&&r.boundary.includes(w.b))))dirty.add(o.id);
 }
 for(const id of [...junctions,...walls,...rooms,...openings])dirty.add(id);
 const all=(d:ProjectDoc)=>[...d.junctions,...d.walls,...d.openings,...d.rooms,...d.furniture,...d.materials,...d.floors];
 const newIds=ids(all(next));
 return {geometryChanged:canonicalStringify(a)!==canonicalStringify(b),dirtyEntityIds:[...dirty].sort(),furnitureIds:[...(elevation?new Set([...old.furniture,...next.furniture].map(f=>f.id)):changed(old.furniture,next.furniture))].sort(),materialIds:[...changed(old.materials,next.materials)].sort(),removedIds:all(old).filter(e=>!newIds.has(e.id)).map(e=>e.id).sort()};
}
