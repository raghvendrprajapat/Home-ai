import type {ProjectDoc} from '@gharplan/core-model';
import type {MeshData,MaterialRange} from './types';
type Bindings=ReadonlyMap<string,Readonly<Partial<Record<MaterialRange['slot'],string>>>>;
/** Rendering slots are derived, never a new project entity or serialized schema. */
export function materialBindings(document:ProjectDoc):Bindings {
 const result=new Map<string,Partial<Record<MaterialRange['slot'],string>>>(),walls=new Map(document.walls.map(w=>[w.id,w]));
 for(const w of document.walls)result.set(`wall:${w.id}`,{left:w.leftMaterial,right:w.rightMaterial});
 for(const r of document.rooms){result.set(`floor:${r.id}`,{floor:r.floorMaterial});result.set(`ceiling:${r.id}`,{ceiling:'__ceiling'});}
 for(const o of document.openings)if(o.kind==='door'&&o.sill===0){const w=walls.get(o.wallId);if(!w)throw Error('material-host');const material=document.rooms.find(r=>r.boundary.includes(w.a)&&r.boundary.includes(w.b))?.floorMaterial??document.materials[0]!.id;result.set(`threshold:${o.id}`,{threshold:material});}
 return result;
}
/** Definitions/labels/colours do not change these ID-to-surface bindings. */
export function materialBindingKey(document:ProjectDoc):string{return JSON.stringify([document.walls.map(w=>[w.id,w.leftMaterial,w.rightMaterial]),document.rooms.map(r=>[r.id,r.floorMaterial]),document.materials[0]?.id]);}
/** Rebind material groups only. Keep all position/normal/UV/range buffers owned by
 * their original generation; earlier bundles and cache entries stay immutable. */
export function bindMeshMaterials(mesh:MeshData,bindings:Bindings):MeshData {
 const ranges=mesh.materialRanges,slots=bindings.get(mesh.id);if(!ranges||!slots)throw Error('material-slots');
 const groups:MeshData['groups']=[];let end=0;
 for(const r of ranges){const materialId=Object.hasOwn(slots,r.slot)?slots[r.slot]:undefined;if(typeof materialId!=='string'||!materialId||!Number.isSafeInteger(r.start)||!Number.isSafeInteger(r.count)||r.start!==end||r.start%3||r.count<=0||r.count%3)throw Error('material-range');end+=r.count;const last=groups.at(-1);if(last?.materialId===materialId)last.count+=r.count;else groups.push({start:r.start,count:r.count,materialId});}
 if(end!==mesh.positions.length/3)throw Error('material-coverage');
 return groups.length===mesh.groups.length&&groups.every((g,i)=>g.start===mesh.groups[i]!.start&&g.count===mesh.groups[i]!.count&&g.materialId===mesh.groups[i]!.materialId)?mesh:{...mesh,groups};
}
export function bindSceneMaterials(meshes:MeshData[],document:ProjectDoc):MeshData[]{const bindings=materialBindings(document),next=meshes.map(mesh=>bindMeshMaterials(mesh,bindings));return next.every((m,i)=>m===meshes[i])?meshes:next;}
