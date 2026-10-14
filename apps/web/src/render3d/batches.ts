import * as THREE from 'three';
import type {MeshData} from './types';
export interface EntityTriangleRange {entityId:string;category:MeshData['category'];start:number;count:number;sourceStart:number}
export interface BatchData {key:string;materialId:string;ceiling:boolean;geometry:THREE.BufferGeometry;ranges:EntityTriangleRange[]}
/** Low-profile batches preserve exact triangles/normals/UV and face-index ownership. */
export function materialBatches(meshes:MeshData[]):BatchData[]{
 const batches=new Map<string,{materialId:string;ceiling:boolean;p:number[];n:number[];uv:number[];ranges:EntityTriangleRange[]}>();
 for(const mesh of meshes)for(const group of mesh.groups){const ceiling=mesh.category==='ceiling',key=JSON.stringify([ceiling?mesh.entityId:null,ceiling,group.materialId]),b=batches.get(key)??{materialId:group.materialId,ceiling,p:[],n:[],uv:[],ranges:[]};
  if(group.start%3||group.count%3||group.start<0||group.count<0||group.start+group.count>mesh.positions.length/3)throw new Error('batch-group');
  const start=b.p.length/9;for(let i=group.start;i<group.start+group.count;i++){b.p.push(mesh.positions[i*3]!,mesh.positions[i*3+1]!,mesh.positions[i*3+2]!);b.n.push(mesh.normals[i*3]!,mesh.normals[i*3+1]!,mesh.normals[i*3+2]!);b.uv.push(mesh.uv[i*2]!,mesh.uv[i*2+1]!);}b.ranges.push({entityId:mesh.entityId,category:mesh.category,start,count:group.count/3,sourceStart:group.start});batches.set(key,b);
 }
 return [...batches].map(([key,b])=>{const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(b.n,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(b.uv,2));geometry.computeBoundingBox();geometry.computeBoundingSphere();return {key,materialId:b.materialId,ceiling:b.ceiling,geometry,ranges:b.ranges};});
}
export function triangleEntity(ranges:EntityTriangleRange[],face:number):string|null {if(!Number.isInteger(face)||face<0)return null;return ranges.find(r=>face>=r.start&&face<r.start+r.count)?.entityId??null;}
