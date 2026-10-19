import * as THREE from 'three';
import type {ProjectStore} from '@gharplan/core-model';
import type {Pick} from '../editor/hit-test';
import type {EntityTriangleRange} from './batches';
import {openingBounds} from './camera';
type Document=ReturnType<ProjectStore['getSnapshot']>['document'];
const kind=(category:unknown):Pick['kind']|null=>category==='wall'?'wall':category==='floor'||category==='ceiling'?'room':category==='threshold'?'opening':category==='furniture-placeholder'||category==='furniture-instances'||category==='furniture-model'||category==='furniture-model-instances'?'furniture':null;
export function visibleMeshes(root:THREE.Object3D):THREE.Mesh[]{
 const meshes:THREE.Mesh[]=[];
 const visit=(node:THREE.Object3D)=>{if(!node.visible)return;if(node instanceof THREE.Mesh)meshes.push(node);for(const child of node.children)visit(child);};visit(root);return meshes;
}
export function intersectionPick(hit:THREE.Intersection):Pick|null{
 const data=hit.object.userData;
 if(data.category==='structural-batch'){
  if(!Number.isInteger(hit.faceIndex)||!Array.isArray(data.entityRanges))return null;
  const range=(data.entityRanges as EntityTriangleRange[]).find(r=>hit.faceIndex!>=r.start&&hit.faceIndex!<r.start+r.count),pickedKind=range&&kind(range.category);
  return range&&pickedKind?{kind:pickedKind,id:range.entityId}:null;
 }
 const pickedKind=kind(data.category);if(!pickedKind)return null;
 const id=(data.category==='furniture-instances'||data.category==='furniture-model-instances')&&Number.isInteger(hit.instanceId)&&hit.instanceId!>=0&&Array.isArray(data.entityIds)?data.entityIds[hit.instanceId!]:data.entityId;
 return typeof id==='string'?{kind:pickedKind,id}:null;
}
/** FR-034: the floor a pick belongs to; openings follow their host wall. */
function pickFloor(d:Document,p:Pick):string|undefined{
 if(p.kind==='opening'){const o=d.openings.find(o=>o.id===p.id);return d.walls.find(w=>w.id===o?.wallId)?.floorId;}
 return (p.kind==='wall'?d.walls:p.kind==='room'?d.rooms:p.kind==='furniture'?d.furniture:d.junctions).find(e=>e.id===p.id)?.floorId;
}
/** Three.js raycasting ignores clipping planes, so floors cut away above the active floor (`hidden`) are dropped here too. */
function rayHits(raycaster:THREE.Raycaster,root:THREE.Object3D,document:Document,hidden:ReadonlySet<string>):{pick:Pick;distance:number;point:THREE.Vector3}[]{
 if(!root.visible)return [];root.updateWorldMatrix(true,true);
 const fields={wall:'walls',room:'rooms',opening:'openings',furniture:'furniture',junction:'junctions'} as const;
 const hits:{pick:Pick;distance:number;point:THREE.Vector3}[]=[];
 for(const hit of raycaster.intersectObjects(visibleMeshes(root),false)){
  const pick=intersectionPick(hit);if(pick&&document[fields[pick.kind]].some(e=>e.id===pick.id)&&!(hidden.size&&hidden.has(pickFloor(document,pick)!)))hits.push({pick,distance:hit.distance,point:hit.point.clone()});
 }
 // A structural opening is an editable void before door/window assets exist.
 // Its logical box is pickable, but adds no rendered solid or GPU resource.
 for(const opening of document.openings){if(hidden.size&&hidden.has(pickFloor(document,{kind:'opening',id:opening.id})!))continue;const bounds=openingBounds(document,opening.id)!;
  const point=raycaster.ray.intersectBox(new THREE.Box3(new THREE.Vector3(bounds[0],bounds[1],bounds[2]),new THREE.Vector3(bounds[3],bounds[4],bounds[5])),new THREE.Vector3());
  if(point){const distance=point.distanceTo(raycaster.ray.origin);if(distance>=raycaster.near&&distance<=raycaster.far)hits.push({pick:{kind:'opening',id:opening.id},distance,point:point.clone()});}
 }
 const rank:Record<Pick['kind'],number>={furniture:0,opening:1,wall:2,room:3,junction:4};
 hits.sort((a,b)=>Math.abs(a.distance-b.distance)>1e-7?a.distance-b.distance:rank[a.pick.kind]-rank[b.pick.kind]||a.pick.id.localeCompare(b.pick.id));return hits;
}
export function pickRay(raycaster:THREE.Raycaster,root:THREE.Object3D,document:Document,hidden:ReadonlySet<string>=new Set()):Pick|null{return rayHits(raycaster,root,document,hidden)[0]?.pick??null;}
/** Same nearest visible hit/occlusion/canonical resolution as ordinary picking. */
export function furnitureRayHit(raycaster:THREE.Raycaster,root:THREE.Object3D,document:Document,hidden:ReadonlySet<string>=new Set()):{id:string;point:readonly[number,number,number]}|null{
 const hit=rayHits(raycaster,root,document,hidden)[0];return hit?.pick.kind==='furniture'?{id:hit.pick.id,point:[hit.point.x,hit.point.y,hit.point.z]}:null;
}
/** Orbit/pinch/cancellation and changed ownership cannot become a click edit. */
export class PickGesture {
 #held=new Set<number>();#candidate:{id:number;start:[number,number];tag:string}|null=null;
 begin(id:number,point:[number,number],tag:string,eligible=true):void{if(this.#held.has(id))return;this.#held.add(id);this.#candidate=this.#held.size===1&&eligible?{id,start:point,tag}:null;}
 move(id:number,point:[number,number]):void{if(this.#candidate?.id===id&&Math.hypot(point[0]-this.#candidate.start[0],point[1]-this.#candidate.start[1])>6)this.#candidate=null;}
 end(id:number,point:[number,number],tag:string):boolean{if(!this.#held.has(id))return false;this.move(id,point);const accepted=this.#candidate?.id===id&&this.#candidate.tag===tag;this.#held.delete(id);this.#candidate=null;return !!accepted&&!this.#held.size;}
 cancel():void{this.#candidate=null;}
 clear():void{this.#held.clear();this.#candidate=null;}
}
