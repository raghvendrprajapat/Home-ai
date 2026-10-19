import {releaseOnce} from './resources';
import * as THREE from 'three';
import type {MeshData} from './types';
export interface EntityTriangleRange {entityId:string;category:MeshData['category'];start:number;count:number;sourceStart:number}
export interface BatchData {key:string;materialId:string;ceiling:boolean;floorId?:string|undefined;geometry:THREE.BufferGeometry;ranges:EntityTriangleRange[]}
/** Low-profile batches preserve exact triangles/normals/UV and face-index ownership.
 * With `floorOf`, batches never mix floors, so a floor cutaway can hide whole batches (FR-034). */
export function materialBatches(meshes:MeshData[],floorOf?:(mesh:MeshData)=>string|undefined):BatchData[]{
 const batches=new Map<string,{materialId:string;ceiling:boolean;floorId:string|undefined;p:number[];n:number[];uv:number[];ranges:EntityTriangleRange[]}>();
 for(const mesh of meshes)for(const group of mesh.groups){const ceiling=mesh.category==='ceiling',floorId=floorOf?.(mesh),key=JSON.stringify([ceiling?mesh.entityId:null,ceiling,group.materialId,...floorOf?[floorId??null]:[]]),b=batches.get(key)??{materialId:group.materialId,ceiling,floorId,p:[],n:[],uv:[],ranges:[]};
  if(group.start%3||group.count%3||group.start<0||group.count<0||group.start+group.count>mesh.positions.length/3)throw new Error('batch-group');
  const start=b.p.length/9;for(let i=group.start;i<group.start+group.count;i++){b.p.push(mesh.positions[i*3]!,mesh.positions[i*3+1]!,mesh.positions[i*3+2]!);b.n.push(mesh.normals[i*3]!,mesh.normals[i*3+1]!,mesh.normals[i*3+2]!);b.uv.push(mesh.uv[i*2]!,mesh.uv[i*2+1]!);}b.ranges.push({entityId:mesh.entityId,category:mesh.category,start,count:group.count/3,sourceStart:group.start});batches.set(key,b);
 }
 const owned:THREE.BufferGeometry[]=[];try{return [...batches].map(([key,b])=>{const geometry=new THREE.BufferGeometry();owned.push(geometry);geometry.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(b.n,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(b.uv,2));geometry.computeBoundingBox();geometry.computeBoundingSphere();return {key,materialId:b.materialId,ceiling:b.ceiling,floorId:b.floorId,geometry,ranges:b.ranges};});}catch(error){try{releaseOnce(owned.map(geometry=>()=>geometry.dispose()))();}catch{/* Preserve allocation failure after attempting every independent disposal. */}throw error;}
}
export function triangleEntity(ranges:EntityTriangleRange[],face:number):string|null {if(!Number.isInteger(face)||face<0)return null;return ranges.find(r=>face>=r.start&&face<r.start+r.count)?.entityId??null;}

/** Rebind an existing batch's triangle order, including splits of formerly merged
 * source groups. No position/normal/UV buffer or picking range is reconstructed. */
export function batchMaterialGroups(ranges:readonly EntityTriangleRange[],meshes:readonly MeshData[]):MeshData['groups']{
 const sources=new Map(meshes.map(m=>[JSON.stringify([m.category,m.entityId]),m])),checked=new Set<MeshData>(),result:MeshData['groups']=[];let covered=0;
 for(const r of ranges){
  const source=sources.get(JSON.stringify([r.category,r.entityId]));
  if(!source||!Number.isSafeInteger(r.start)||!Number.isSafeInteger(r.count)||!Number.isSafeInteger(r.sourceStart)||r.start*3!==covered||r.count<=0||r.sourceStart<0||r.sourceStart%3||r.sourceStart+r.count*3>source.positions.length/3)throw Error('batch-range');
  if(!checked.has(source)){let end=0;for(const g of source.groups){if(!Number.isSafeInteger(g.start)||!Number.isSafeInteger(g.count)||g.start!==end||g.count<=0||g.count%3||!g.materialId)throw Error('batch-source-group');end+=g.count;}if(end!==source.positions.length/3)throw Error('batch-source-coverage');checked.add(source);}
  let cursor=r.sourceStart;const end=cursor+r.count*3;
  // Find the first intersecting source group without rescanning every prior group.
  let lo=0,hi=source.groups.length;while(lo<hi){const mid=(lo+hi)>>>1,g=source.groups[mid]!;if(g.start+g.count<=cursor)lo=mid+1;else hi=mid;}
  while(cursor<end){const g=source.groups[lo++];if(!g||g.start>cursor)throw Error('batch-source-gap');const count=Math.min(g.start+g.count,end)-cursor,start=r.start*3+cursor-r.sourceStart,last=result.at(-1);if(count<=0)throw Error('batch-source-group');if(last&&last.materialId===g.materialId&&last.start+last.count===start)last.count+=count;else result.push({start,count,materialId:g.materialId});cursor+=count;}
  covered+=r.count*3;
 }
 return result;
}
