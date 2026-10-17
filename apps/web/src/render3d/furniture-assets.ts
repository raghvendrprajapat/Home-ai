import * as THREE from 'three';
import {furnitureFinish} from '../editor/material-library';
import type {ProjectStore} from '@gharplan/core-model';
import type {FurnitureAssetSource} from './types';
import {decodeFurniture} from './furniture-decoder';
import type {DecodedFurniture} from './furniture-decoder';
import {ResourcePool,releaseOnce} from './resources';
import type {Lease} from './resources';

export interface FurnitureStatus {id:string;phase:'queued'|'loading'|'ready'|'error';received:number;total:number|undefined;retryable?:boolean;unsupportedFinish?:boolean;sizeMismatch?:boolean}
interface Entry {key:string;id:string;version:number;interests:Set<string>;phase:FurnitureStatus['phase'];received:number;total:number|undefined;controller:AbortController;bundle?:Lease<DecodedFurniture>|undefined}
interface Display {entry:Entry;ids:string[];group:THREE.Group;release():void}
type ProjectDoc=ReturnType<ProjectStore['getSnapshot']>['document'];
type Item=ProjectDoc['furniture'][number];
/** Grounded asset transform. Native glTF Y-up maps to plan elevation, front -Z. */
export function furnitureMatrix(item:Item,elevation:number,dims:DecodedFurniture['dims']):THREE.Matrix4{
 return new THREE.Matrix4().compose(new THREE.Vector3(item.position.x/1000,(elevation+item.elevation)/1000,item.position.y/1000),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-item.rotationDeg*Math.PI/180),new THREE.Vector3(item.size.w/dims.w,item.size.h/dims.h,item.size.d/dims.d));
}
/** Tiny native errors can magnify under a legacy per-axis transform. Compare
 * final rotated extrema with canonical dimensions, not a loose percentage. */
export function furnitureFits(item:Item,bundle:DecodedFurniture):boolean{
 const actual=new THREE.Box3();for(const primitive of bundle.primitives){if(!primitive.geometry.boundingBox)primitive.geometry.computeBoundingBox();actual.union(primitive.geometry.boundingBox!);}
 const d=bundle.dims,expected=new THREE.Box3(new THREE.Vector3(-d.w/2000,0,-d.d/2000),new THREE.Vector3(d.w/2000,d.h/1000,d.d/2000)),matrix=furnitureMatrix(item,0,d);actual.applyMatrix4(matrix);expected.applyMatrix4(matrix);
 return [...actual.min.toArray(),...actual.max.toArray()].every((n,i)=>Math.abs(n-[...expected.min.toArray(),...expected.max.toArray()][i]!)<=.001);
}
/** The material covering the largest total part volume; the first one wins a tie. */
export function mainFurnitureMaterial(bundle:DecodedFurniture):THREE.MeshStandardMaterial{
 const volume=new Map<THREE.MeshStandardMaterial,number>();for(const p of bundle.primitives){const size=p.geometry.boundingBox!.getSize(new THREE.Vector3());volume.set(p.material,(volume.get(p.material)??0)+size.x*size.y*size.z);}
 let best=bundle.primitives[0]!.material;for(const [material,v]of volume)if(v>volume.get(best)!)best=material;return best;
}
/** Current-document interests and last-displayed leases have different lifetimes.
 * Parse completion only requests presentation; it never acknowledges CPU state. */
export class FurnitureAssets {
 readonly group=new THREE.Group();#entries=new Map<string,Entry>();#displayed=new Map<string,Display>();#pool=new ResourcePool();#active=0;#closed=false;#session='';#bytes=0;#serial=0;#cleanupFailures=0;#document:ProjectDoc|undefined;
 constructor(private source:FurnitureAssetSource,private lod:0|1,private changed:()=>void,private onShader:(uniforms:Record<string,{value:unknown}>)=>void=()=>{},private decoder:typeof decodeFurniture=decodeFurniture,private budget=32*1024*1024){}
 get resourceStats(){return {...this.#pool.stats,bytes:this.#bytes,active:this.#active,displayed:this.#displayed.size,cleanupFailures:this.#cleanupFailures};}
 get renderingStats(){let meshes=0,instances=0,triangles=0;const ids=new Set<string>();this.group.traverse(node=>{if(!(node instanceof THREE.Mesh))return;meshes++;const count=node instanceof THREE.InstancedMesh?node.count:1;instances+=count;triangles+=(node.geometry.index?.count??node.geometry.getAttribute('position').count)/3*count;for(const id of node.userData.entityIds??[node.userData.entityId])if(typeof id==='string')ids.add(id);});return {meshes,instances,triangles,ids:[...ids]};}
 #key(item:Item){return `${item.assetId}@${item.assetVersion}:${this.lod}`;}
 #shows(entry:Entry){for(const display of this.#displayed.values())if(display.entry===entry)return true;return false;}
 #notify(){if(!this.#closed)this.changed();}
 #cleanup(steps:(()=>void)[]):void{try{releaseOnce(steps)();}catch{this.#cleanupFailures++;}}
 #collect():void{
  const releases:(()=>void)[]=[];
  for(const [key,entry]of this.#entries)if(!entry.interests.size&&!this.#shows(entry)){this.#entries.delete(key);releases.push(()=>entry.controller.abort());if(entry.bundle){const bundle=entry.bundle;entry.bundle=undefined;this.#bytes-=bundle.value.byteLength;releases.push(()=>bundle.release());}}
  this.#cleanup(releases);
 }
 observe(document:ProjectDoc,session:string):void{
  if(this.#closed)return;
  if(this.#session&&this.#session!==session){this.#cleanup([()=>this.#clearDisplay()]);for(const entry of this.#entries.values())entry.interests.clear();this.#collect();}this.#session=session;this.#document=document;
  for(const entry of this.#entries.values())entry.interests.clear();
  for(const item of document.furniture){const key=this.#key(item);let entry=this.#entries.get(key);if(!entry){entry={key,id:item.assetId,version:item.assetVersion,interests:new Set(),phase:'queued',received:0,total:undefined,controller:new AbortController()};this.#entries.set(key,entry);}entry.interests.add(item.id);}
  // Displayed decoded models survive pending/error CPU scenes. Undisplayed work
  // has no such lease and is cancelled immediately, not when the worker replies.
  for(const entry of this.#entries.values())if(!entry.interests.size&&!entry.bundle)entry.controller.abort();
  this.#collect();this.#pump();
 }
 #pump():void{
  if(this.#closed)return;
  for(const entry of this.#entries.values()){
   if(this.#active>=4)break;if(entry.phase!=='queued'||!entry.interests.size||entry.controller.signal.aborted)continue;
   entry.phase='loading';this.#active++;void this.#load(entry);
  }
 }
 async #load(entry:Entry):Promise<void>{
  let decoded:DecodedFurniture|undefined;
  const owned=()=>!this.#closed&&this.#entries.get(entry.key)===entry&&entry.interests.size>0&&!entry.controller.signal.aborted;
  try{
   const data=await this.source.load(entry.id,entry.version,this.lod,entry.controller.signal,(received,total)=>{if(owned()){entry.received=received;entry.total=total;this.#notify();}});
   if(!owned())return;
   if(data.id!==entry.id||data.version!==entry.version||data.lod!==this.lod||!/^[a-f0-9]{64}$/.test(data.sha256))throw Error('furniture-pin');
   // Unabortable GLTF parsing owns its concurrency slot until it settles.
   decoded=await this.decoder(data);
   if(!owned())return;if(this.#bytes+decoded.byteLength>this.budget)throw Error('furniture-residency');
   for(const primitive of decoded.primitives)primitive.material.onBeforeCompile=shader=>this.onShader(shader.uniforms);
   const value=decoded;entry.bundle=this.#pool.acquire(`decoded:${++this.#serial}`,()=>value);this.#bytes+=decoded.byteLength;decoded=undefined;entry.phase='ready';
  }catch{if(owned())entry.phase='error';}
  finally{this.#cleanup(decoded?[()=>decoded!.dispose()]:[]);this.#active--;this.#collect();this.#pump();this.#notify();}
 }
 getSnapshot():FurnitureStatus[]{return (this.#document?.furniture??[]).map(item=>{const e=this.#entries.get(this.#key(item)),unsupportedFinish=furnitureFinish(this.#document!,item)===undefined,sizeMismatch=!!e?.bundle&&!furnitureFits(item,e.bundle.value);return {id:item.id,phase:unsupportedFinish||sizeMismatch?'error':e?.phase??'error',received:e?.received??0,total:e?.total,retryable:!unsupportedFinish&&!sizeMismatch&&e?.phase==='error',unsupportedFinish,sizeMismatch};});}
 retry(id:string):void{
  const item=this.#document?.furniture.find(f=>f.id===id);if(!item||this.#closed)return;const old=this.#entries.get(this.#key(item));if(!old||old.phase!=='error'||this.#shows(old))return;
  old.controller.abort();if(old.bundle){const bundle=old.bundle;old.bundle=undefined;this.#bytes-=bundle.value.byteLength;this.#cleanup([()=>bundle.release()]);}
  this.#entries.set(old.key,{...old,phase:'queued',controller:new AbortController(),bundle:undefined,received:0,total:undefined});this.#pump();this.#notify();
 }
 #clearDisplay(){const displays=[...this.#displayed.values()];this.#displayed.clear();releaseOnce(displays.map(d=>()=>{this.group.remove(d.group);d.release();}))();}
 #build(entry:Entry,items:Item[],finish:string|null):Display{
  const bundle=entry.bundle!.value,group=new THREE.Group(),releases:(()=>void)[]=[];
  try{
   // A finish recolours a per-display clone of the main material; the shared decoded material is never changed.
   const main=mainFurnitureMaterial(bundle),tinted=finish?main.clone():undefined;
   if(tinted){tinted.color.set(finish!);tinted.onBeforeCompile=main.onBeforeCompile;releases.push(()=>tinted.dispose());}
   for(const decoded of bundle.primitives){const primitive=tinted&&decoded.material===main?{...decoded,material:tinted}:decoded;
    if(items.length>=3){const mesh=new THREE.InstancedMesh(primitive.geometry,primitive.material,items.length);const lease=this.#pool.acquire(`instances:${++this.#serial}`,()=>mesh);releases.push(()=>lease.release());mesh.userData={category:'furniture-model-instances',entityIds:items.map(i=>i.id)};mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);}
    else for(const item of items){const mesh=new THREE.Mesh(primitive.geometry,primitive.material);mesh.matrixAutoUpdate=false;mesh.userData={category:'furniture-model',entityId:item.id};mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);}
   }
   return {entry,ids:items.map(i=>i.id),group,release:releaseOnce(releases)};
  }catch(error){this.#cleanup(releases);group.clear();throw error;}
 }
 /** Called only for the applied, live CPU tag. Assemble each asset atomically. */
 present(document:ProjectDoc):Set<string>{
  // One display per asset and finish colour, so same-coloured copies still share instancing.
  if(this.#closed)return new Set();const wanted=new Map<string,{entry:Entry;finish:string|null;items:Item[]}>();
  for(const item of document.furniture){const entry=this.#entries.get(this.#key(item)),finish=furnitureFinish(document,item);if(entry?.phase==='ready'&&entry.bundle&&finish!==undefined&&furnitureFits(item,entry.bundle.value)){const key=`${entry.key}|${finish??''}`,group=wanted.get(key)??{entry,finish,items:[]};group.items.push(item);wanted.set(key,group);}}
  const next=new Map<string,Display>(),attached=new Set<string>();
  for(const [key,{entry,finish,items}]of wanted){const old=this.#displayed.get(key);let display:Display|undefined;
   try{display=old&&old.entry===entry&&old.ids.length===items.length&&old.ids.every((id,i)=>id===items[i]!.id)?old:this.#build(entry,items,finish);
    for(let p=0;p<entry.bundle!.value.primitives.length;p++){
     if(items.length>=3){const mesh=display.group.children[p] as THREE.InstancedMesh;items.forEach((item,i)=>mesh.setMatrixAt(i,furnitureMatrix(item,document.floors.find(f=>f.id===item.floorId)!.elevation,entry.bundle!.value.dims)));mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();}
     else items.forEach((item,i)=>{const mesh=display!.group.children[p*items.length+i]!;mesh.matrix.copy(furnitureMatrix(item,document.floors.find(f=>f.id===item.floorId)!.elevation,entry.bundle!.value.dims));mesh.matrixWorldNeedsUpdate=true;});
    }
    next.set(key,display);items.forEach(i=>attached.add(i.id));
   }catch{if(display&&display!==old)this.#cleanup([()=>display!.release()]);entry.phase='error';}
  }
  const releases:(()=>void)[]=[];for(const [key,display]of this.#displayed)if(next.get(key)!==display){this.group.remove(display.group);releases.push(()=>display.release());}this.#cleanup(releases);
  for(const [key,display]of next)if(this.#displayed.get(key)!==display)this.group.add(display.group);
  this.#displayed=next;this.#collect();return attached;
 }
 close():void{
  if(this.#closed)return;this.#closed=true;const entries=[...this.#entries.values()];this.#entries.clear();this.#bytes=0;this.#document=undefined;releaseOnce([()=>this.#clearDisplay(),...entries.map(e=>()=>e.controller.abort()),()=>this.#pool.close(),()=>this.group.clear()])();
 }
}
