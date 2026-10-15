import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import type {FurnitureAssetData} from './types';
import {releaseOnce} from './resources';

export interface DecodedFurniture {
 primitives:readonly {name:string;geometry:THREE.BufferGeometry;material:THREE.MeshStandardMaterial}[];
 dims:Readonly<{w:number;d:number;h:number}>;triangles:number;byteLength:number;dispose():void;
}
type RecordValue=Record<string,unknown>;
const fail=():never=>{throw Error('furniture-profile');};
const record=(v:unknown):RecordValue=>v&&typeof v==='object'&&!Array.isArray(v)?v as RecordValue:fail();
const list=(v:unknown,max:number):unknown[]=>Array.isArray(v)&&v.length>0&&v.length<=max?v:fail();
const integer=(v:unknown,min:number,max:number):number=>typeof v==='number'&&Number.isInteger(v)&&v>=min&&v<=max?v:fail();
const vector=(v:unknown,n:number)=>Array.isArray(v)&&v.length===n&&v.every(x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=1000)?v as number[]:fail();
/** Narrow flat, static, untextured profile published by our original-asset tool.
 * Bound accessor allocation before GLTFLoader; this is not a general GLB importer. */
export function inspectFurniture(data:FurnitureAssetData):void{
 const bytes=data.bytes;if(bytes.byteLength<28||bytes.byteLength>2*1024*1024||![data.dims.w,data.dims.d,data.dims.h].every(x=>Number.isInteger(x)&&x>=1&&x<=20000)||!Number.isInteger(data.triangles)||data.triangles<1||data.triangles>(data.lod===0?20000:3000))fail();
 const view=new DataView(bytes),jsonLength=view.getUint32(12,true),binHeader=20+jsonLength;
 if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==bytes.byteLength||view.getUint32(16,true)!==0x4e4f534a||jsonLength%4||binHeader+8>bytes.byteLength||view.getUint32(binHeader+4,true)!==0x004e4942)fail();
 const binLength=view.getUint32(binHeader,true);if(binLength%4||binHeader+8+binLength!==bytes.byteLength)fail();
 const root=record(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(new Uint8Array(bytes,20,jsonLength))));
 // No loader extension, external resource or sparse allocation may bypass bounds.
 const inspect=(value:unknown,depth=0):void=>{if(depth>16)fail();if(Array.isArray(value)){if(value.length>1024)fail();value.forEach(v=>inspect(v,depth+1));}else if(value&&typeof value==='object')for(const [key,v]of Object.entries(value)){if(['extensions','extensionsUsed','extensionsRequired','uri','sparse','targets','children','matrix','textures','images','skins','animations','cameras'].includes(key))fail();inspect(v,depth+1);}};inspect(root);
 if(record(root.asset).version!=='2.0'||root.scene!==0)fail();
 const buffers=list(root.buffers,1),buffer=record(buffers[0]),length=integer(buffer.byteLength,1,binLength);if(binLength-length>3)fail();
 const views=list(root.bufferViews,512).map(v=>{const b=record(v);if(b.buffer!==0)fail();const offset=integer(b.byteOffset??0,0,length),size=integer(b.byteLength,1,length),stride=b.byteStride===undefined?undefined:integer(b.byteStride,4,252);if(offset+size>length||stride!==undefined&&stride%4)fail();return {offset,size,stride};});
 const accessors=list(root.accessors,512).map(v=>{const a=record(v),index=integer(a.bufferView,0,views.length-1),b=views[index]!,count=integer(a.count,1,60000),offset=integer(a.byteOffset??0,0,b.size),components=a.type==='VEC3'?3:a.type==='SCALAR'?1:fail(),bytes=a.componentType===5126?4:a.componentType===5123?2:a.componentType===5125?4:fail(),stride=b.stride??components*bytes;
  if(a.normalized!==undefined||stride<components*bytes||offset%bytes||(b.offset+offset)%bytes||offset+(count-1)*stride+components*bytes>b.size)fail();return {count,type:a.type,component:a.componentType};});
 const materials=list(root.materials,64);for(const value of materials){const m=record(value),p=record(m.pbrMetallicRoughness);const color=vector(p.baseColorFactor,4);if(color.some(c=>c<0||c>1)||color[3]!==1||m.alphaMode!==undefined&&m.alphaMode!=='OPAQUE'||m.doubleSided===true)fail();for(const k of ['roughnessFactor','metallicFactor'])if(typeof p[k]!=='number'||(p[k] as number)<0||(p[k] as number)>1)fail();}
 const meshes=list(root.meshes,64).map(value=>{const m=record(value),primitive=record(list(m.primitives,1)[0]),attributes=record(primitive.attributes);if((primitive.mode??4)!==4||Object.keys(attributes).some(k=>k!=='POSITION'&&k!=='NORMAL'))fail();
  const position=accessors[integer(attributes.POSITION,0,accessors.length-1)]!,normal=accessors[integer(attributes.NORMAL,0,accessors.length-1)]!,indices=accessors[integer(primitive.indices,0,accessors.length-1)]!;integer(primitive.material,0,materials.length-1);
  if(position.type!=='VEC3'||position.component!==5126||normal.type!=='VEC3'||normal.component!==5126||normal.count!==position.count||indices.type!=='SCALAR'||![5123,5125].includes(indices.component as number)||indices.count%3||position.count>indices.count)fail();return indices.count/3;});
 const nodes=list(root.nodes,64);let triangles=0;
 for(const value of nodes){const n=record(value),mesh=integer(n.mesh,0,meshes.length-1);triangles+=meshes[mesh]!;if(n.translation!==undefined)vector(n.translation,3);if(n.scale!==undefined&&vector(n.scale,3).some(x=>x<=0||x>20))fail();if(n.rotation!==undefined){const q=vector(n.rotation,4);if(Math.abs(q.reduce((s,x)=>s+x*x,0)-1)>1e-6)fail();}}
 const scene=record(list(root.scenes,1)[0]),sceneNodes=list(scene.nodes,64);if(sceneNodes.length!==nodes.length||new Set(sceneNodes).size!==nodes.length)fail();sceneNodes.forEach(n=>integer(n,0,nodes.length-1));
 if(triangles!==data.triangles)fail();
}

export async function decodeFurniture(data:FurnitureAssetData):Promise<DecodedFurniture>{
 inspectFurniture(data);
 const parsed=await new GLTFLoader().parseAsync(data.bytes,''),originalGeometries=new Set<THREE.BufferGeometry>(),originalMaterials=new Set<THREE.Material>();
 parsed.scenes.forEach(scene=>scene.traverse(node=>{if(node instanceof THREE.Mesh){originalGeometries.add(node.geometry);for(const m of Array.isArray(node.material)?node.material:[node.material])originalMaterials.add(m);}}));
 const geometries:THREE.BufferGeometry[]=[],materials=new Map<THREE.Material,THREE.MeshStandardMaterial>();
 const disposeOriginal=releaseOnce([...originalGeometries].map(g=>()=>g.dispose()).concat([...originalMaterials].map(m=>()=>m.dispose())));
 const disposeOwned=releaseOnce([()=>releaseOnce(geometries.map(g=>()=>g.dispose()))(),()=>releaseOnce([...materials.values()].map(m=>()=>m.dispose()))()]);
 try{
  parsed.scene.updateMatrixWorld(true);const primitives:DecodedFurniture['primitives'][number][]=[],bounds=new THREE.Box3();let triangles=0;
  parsed.scene.traverse(node=>{if(!(node instanceof THREE.Mesh))return;if(!(node.material instanceof THREE.MeshStandardMaterial))return fail();const sourceMaterial=node.material;
   const geometry=node.geometry.clone();geometries.push(geometry);geometry.applyMatrix4(node.matrixWorld);
   const position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal'),index=geometry.index;if(!position||!normal||!index)fail();
   const box=new THREE.Box3();for(let i=0;i<position.count;i++){const p=new THREE.Vector3().fromBufferAttribute(position,i),n=new THREE.Vector3().fromBufferAttribute(normal,i);if(![p.x,p.y,p.z,n.x,n.y,n.z].every(Number.isFinite)||Math.abs(n.length()-1)>1e-4)fail();box.expandByPoint(p);}
   for(let i=0;i<index.count;i++)if(!Number.isInteger(index.getX(i))||index.getX(i)<0||index.getX(i)>=position.count)fail();
   geometry.boundingBox=box;geometry.computeBoundingSphere();bounds.union(box);triangles+=index.count/3;
   let material=materials.get(sourceMaterial);if(!material){material=sourceMaterial.clone();materials.set(sourceMaterial,material);}primitives.push({name:node.name,geometry,material});
  });
  const expected=[-data.dims.w/2000,0,-data.dims.d/2000,data.dims.w/2000,data.dims.h/1000,data.dims.d/2000],actual=[...bounds.min.toArray(),...bounds.max.toArray()];
  if(primitives.length<1||primitives.length>64||triangles!==data.triangles||actual.some((n,i)=>Math.abs(n-expected[i]!)>1e-5))fail();
  const arrays=new Set<ArrayBufferLike>();for(const geometry of geometries){for(const attribute of Object.values(geometry.attributes))arrays.add(attribute instanceof THREE.InterleavedBufferAttribute?attribute.data.array.buffer:attribute.array.buffer);if(geometry.index)arrays.add(geometry.index.array.buffer);}
  disposeOriginal();
  return {primitives,dims:data.dims,triangles,byteLength:[...arrays].reduce((n,b)=>n+b.byteLength,0),dispose:disposeOwned};
 }catch(error){try{releaseOnce([disposeOwned,disposeOriginal])();}catch{/* Every owner was attempted; retain the original failure. */}throw error;}
}
