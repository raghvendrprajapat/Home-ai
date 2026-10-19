import type {FurnitureAssets} from './furniture-assets';
import { ResourcePool,releaseOnce } from './resources';
import type { Lease,Disposable } from './resources';
import { materialBatches,batchMaterialGroups } from './batches';
import type {QualityTier} from './quality';
import {SurfaceTextures} from './surface-textures';
import * as THREE from 'three';
import type { ProjectStore } from '@gharplan/core-model';
import type { MeshData, SceneBundle } from './types';

export function sameGeometry(a: MeshData, b: MeshData): boolean {
  const same = (x: ArrayLike<number>, y: ArrayLike<number>) => {
    if (x.length !== y.length) return false;
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
    return true;
  };
  return a.id === b.id && a.entityId === b.entityId && a.category === b.category && same(a.positions, b.positions) && same(a.normals, b.normals) && same(a.uv, b.uv);
}
export function sameMesh(a: MeshData, b: MeshData): boolean {
  return sameGeometry(a,b) &&
    a.groups.length === b.groups.length && a.groups.every((g, i) => g.start === b.groups[i]!.start && g.count === b.groups[i]!.count && g.materialId === b.groups[i]!.materialId);
}
export function bufferGeometry(data: MeshData): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  try{geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(data.uv, 2));
  data.groups.forEach((g, i) => geometry.addGroup(g.start, g.count, i));
  geometry.computeBoundingBox(); geometry.computeBoundingSphere(); return geometry;}catch(error){geometry.dispose();throw error;}
}
/** Unit cube with six independent faces; owner exists before attributes allocate. */
export function unitBoxGeometry():THREE.BufferGeometry{
  const geometry=new THREE.BufferGeometry();
  try{
    const faces=[[[1,0,0],[.5,-.5,.5],[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5]],
      [[-1,0,0],[-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5]],
      [[0,1,0],[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5]],
      [[0,-1,0],[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]],
      [[0,0,1],[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]],
      [[0,0,-1],[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]]];
    const positions:number[]=[],normals:number[]=[],uv:number[]=[];
    for(const [normal,...corners]of faces)for(const i of [0,1,2,0,2,3]){positions.push(...corners[i]!);normals.push(...normal!);uv.push(...[[0,0],[1,0],[1,1],[0,1]][i]!);}
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
  }catch(error){geometry.dispose();throw error;}
}
type SceneDocument=ReturnType<ProjectStore['getSnapshot']>['document'];
/** FR-034: the floor that owns a scene mesh or furniture item (openings follow their host wall). */
export function entityFloors(document:SceneDocument):(category:string,entityId:string)=>string|undefined{
  const walls=new Map(document.walls.map(w=>[w.id,w.floorId])),rooms=new Map(document.rooms.map(r=>[r.id,r.floorId])),openings=new Map(document.openings.map(o=>[o.id,walls.get(o.wallId)])),stairs=new Map((document.stairs??[]).map(s=>[s.id,s.floorId])),roofs=new Map((document.roofs??[]).map(r=>[r.id,r.floorId])),furniture=new Map(document.furniture.map(f=>[f.id,f.floorId]));
  return (category,id)=>(category==='wall'?walls:category==='floor'||category==='ceiling'?rooms:category==='threshold'?openings:category==='stair'?stairs:category==='roof'?roofs:furniture).get(id);
}
/** GPU adapter: reuses identical meshes/materials, disposes replaced/removed resources. */
export class SceneAdapter {
  group = new THREE.Group();
  furnitureAssets:FurnitureAssets|undefined;
  #meshes = new Map<string, { data: MeshData; mesh: THREE.Mesh }>();
  #materials = new Map<string, THREE.MeshStandardMaterial>();
  #furniture = new Map<string, THREE.Mesh>();
  #pool=new ResourcePool();
  #owners=new Map<THREE.Object3D,Lease<Disposable>[]>();
  #materialRoots=new Map<string,Lease<THREE.MeshStandardMaterial>>();
  #serial=0;#closed=false;
  #placeholder:THREE.MeshStandardMaterial;
  #ceiling:THREE.MeshStandardMaterial;
  #showCeilings=false;#tier:QualityTier='mid';#batches:THREE.Mesh[]=[];#hidden=new Set<string>();
  #instances:THREE.InstancedMesh|null=null;#instanceCount=0;
  #unitBox:THREE.BufferGeometry;#textures:SurfaceTextures|null=null;
  /** `textures` (D76): where the CC0 surface textures live and what to call when one arrives; never used on Low. */
  constructor(tier:QualityTier='mid',private onShader:(uniforms:Record<string,{value:unknown}>)=>void=()=>{},textures?:{baseUrl:URL;onReady:()=>void;load?:ConstructorParameters<typeof SurfaceTextures>[2]}){
    this.#tier=tier;if(tier!=='low'&&textures)this.#textures=new SurfaceTextures(textures.baseUrl,textures.onReady,textures.load);
    try{
      this.#placeholder=this.#pool.acquire('placeholder',()=>new THREE.MeshStandardMaterial({color:'#778d76',roughness:0.8})).value;
      this.#ceiling=this.#pool.acquire('ceiling',()=>new THREE.MeshStandardMaterial({color:'#f8f8f2',roughness:1,metalness:0,side:THREE.DoubleSide})).value;
      this.#unitBox=this.#pool.acquire('unit-box',unitBoxGeometry).value;
      this.#placeholder.onBeforeCompile=shader=>this.onShader(shader.uniforms);this.#ceiling.onBeforeCompile=shader=>this.onShader(shader.uniforms);
    }catch(error){this.#closed=true;this.#pool.close();throw error;}
  }
  get resourceStats(){return this.#pool.stats;}
  /** D76: textured materials in the scene and the GPU bytes of their images (0 on Low). */
  get textureStats():{texturedMaterials:number;textureBytes:number}{return this.#textures?.stats??{texturedMaterials:0,textureBytes:0};}
  /** Floors cut away above the active floor (D64): hidden, so neither drawn nor picked. */
  get hiddenFloors():ReadonlySet<string>{return this.#hidden;}
  #shown(category:string,floorId:unknown):boolean{return this.#tier!=='low'&&(category!=='ceiling'||this.#showCeilings)&&!this.#hidden.has(floorId as string);}
  #batchShown(batch:THREE.Mesh):boolean{return (!batch.userData.ceiling||this.#showCeilings)&&!this.#hidden.has(batch.userData.floorId as string);}
  #shared<T extends Disposable>(key:string,value:T):Lease<T>{return this.#pool.acquire(key,()=>value);}
  #geometry(geometry:THREE.BufferGeometry):Lease<THREE.BufferGeometry>{return this.#shared(`geometry:${++this.#serial}`,geometry);}
  #material(id:string,ceiling:boolean):Lease<THREE.MeshStandardMaterial>{const value=ceiling?this.#ceiling:this.#materials.get(id);if(!value)throw new Error('scene-material');return this.#shared(ceiling?'ceiling':`material:${id}`,value);}
  #release(mesh:THREE.Object3D):void{for(const lease of this.#owners.get(mesh)??[])lease.release();this.#owners.delete(mesh);}
  #own(mesh:THREE.Object3D,leases:Lease<Disposable>[]):void{this.#release(mesh);this.#owners.set(mesh,leases);}
  /** Acquire replacement material leases before releasing old ones; keep geometry's lease. */
  #rebind(mesh:THREE.Mesh,groups:MeshData['groups'],ceiling:boolean):void{
    const owned=this.#owners.get(mesh);if(!owned?.[0])throw Error('scene-owner');
    let end=0;for(const g of groups){if(!Number.isSafeInteger(g.start)||!Number.isSafeInteger(g.count)||g.start!==end||g.count<=0||g.count%3)throw Error('scene-binding-range');end+=g.count;}if(end!==mesh.geometry.getAttribute('position').count)throw Error('scene-binding-coverage');
    const next=groups.map(g=>this.#material(g.materialId,ceiling));
    mesh.geometry.clearGroups();groups.forEach((g,i)=>mesh.geometry.addGroup(g.start,g.count,i));mesh.material=next.map(l=>l.value);
    this.#owners.set(mesh,[owned[0],...next]);releaseOnce(owned.slice(1).map(l=>()=>l.release()))();
  }
  lastChanges = { replaced: [] as string[], kept: [] as string[], removed: [] as string[] };
  apply(bundle: SceneBundle, document: ReturnType<ProjectStore['getSnapshot']>['document']): void {
    if(this.#closed)throw new Error('scene-closed');
    try{this.#apply(bundle,document);}catch(error){this.group.visible=false;this.dispose();throw error;}
  }
  #apply(bundle:SceneBundle,document:ReturnType<ProjectStore['getSnapshot']>['document']):void{
    this.lastChanges = { replaced: [], kept: [], removed: [] };
    const wantedMaterials = new Set(document.materials.map(m => m.id));
    for (const m of document.materials) {
      let root=this.#materialRoots.get(m.id);if(!root){root=this.#pool.acquire(`material:${m.id}`,()=>{const material=new THREE.MeshStandardMaterial();material.onBeforeCompile=shader=>this.onShader(shader.uniforms);return material;});this.#materialRoots.set(m.id,root);}
      const material=root.value;
      material.color.set(m.baseColor); material.roughness = m.roughness; material.metalness = m.metalness;this.#textures?.apply(material,m);
      this.#materials.set(m.id, material);
    }
    const wanted = new Set(bundle.meshes.map(m => m.id)),floorOf=entityFloors(document);let structuralChange=false;
    for (const [id, entry] of this.#meshes) if (!wanted.has(id)) {structuralChange=true; this.group.remove(entry.mesh); this.#release(entry.mesh); this.#meshes.delete(id); this.lastChanges.removed.push(id); }
    for (const data of bundle.meshes) {
      const previous = this.#meshes.get(data.id);
      if (previous && sameMesh(previous.data, data)) { this.lastChanges.kept.push(data.id); continue; }
      // "replaced" tracks a changed mesh descriptor, as before; buffer identity is separate.
      if(previous&&sameGeometry(previous.data,data)){this.#rebind(previous.mesh,data.groups,data.category==='ceiling');this.#meshes.set(data.id,{data,mesh:previous.mesh});this.lastChanges.replaced.push(data.id);continue;}
      structuralChange=true;
      const geometryLease=this.#geometry(bufferGeometry(data)),materialLeases=data.groups.map(g=>this.#material(g.materialId,data.category==='ceiling')),geometry=geometryLease.value,materials=materialLeases.map(l=>l.value);
      const mesh=previous?.mesh??new THREE.Mesh(geometry,materials);
      this.#own(mesh,[geometryLease,...materialLeases]);if(!previous)this.group.add(mesh);
      mesh.geometry = geometry; mesh.material = materials;mesh.castShadow=true;mesh.receiveShadow=true; mesh.userData = { entityId: data.entityId, category: data.category };
      this.#meshes.set(data.id, { data, mesh }); this.lastChanges.replaced.push(data.id);
    }
    for(const {data,mesh}of this.#meshes.values()){mesh.userData.floorId=floorOf(data.category,data.entityId);mesh.visible=this.#shown(data.category,mesh.userData.floorId);}
    if(this.#tier==='low'&&(structuralChange||!this.#batches.length)){
      for(const batch of this.#batches){this.group.remove(batch);this.#release(batch);}this.#batches=[];
      const batches=materialBatches(bundle.meshes,m=>floorOf(m.category,m.entityId)),claimed=new Set<THREE.BufferGeometry>();
      try{for(const b of batches){const g=this.#geometry(b.geometry);claimed.add(b.geometry);const m=this.#material(b.materialId,b.ceiling),mesh=new THREE.Mesh(g.value,m.value);this.#own(mesh,[g,m]);mesh.userData={category:'structural-batch',ceiling:b.ceiling,floorId:b.floorId,entityRanges:b.ranges};mesh.visible=this.#batchShown(mesh);this.group.add(mesh);this.#batches.push(mesh);}}
      finally{releaseOnce(batches.filter(b=>!claimed.has(b.geometry)).map(b=>()=>b.geometry.dispose()))();}
    }else if(this.#tier==='low'&&this.lastChanges.replaced.length){
      for(const batch of this.#batches)this.#rebind(batch,batchMaterialGroups(batch.userData.entityRanges,bundle.meshes),batch.userData.ceiling===true);
    }
    for(const [id,material]of this.#materials)if(!wantedMaterials.has(id)){this.#textures?.forget(material);this.#materialRoots.get(id)?.release();this.#materialRoots.delete(id);this.#materials.delete(id);}
    this.refreshFurniture(document);
  }
  refreshFurniture(document:ReturnType<ProjectStore['getSnapshot']>['document']):void{
    const shown=this.#hidden.size?{...document,furniture:document.furniture.filter(f=>!this.#hidden.has(f.floorId))}:document;
    const loaded=this.furnitureAssets?.present(shown)??new Set<string>(),fallback=shown.furniture.filter(f=>!loaded.has(f.id));
    const instanced=this.#tier==='low'&&fallback.length>=3;
    if(this.#instances&&(!instanced||this.#instanceCount!==fallback.length)){this.group.remove(this.#instances);this.#release(this.#instances);this.#instances=null;}
    if(instanced&&!this.#instances){this.#instances=new THREE.InstancedMesh(this.#unitBox,this.#placeholder,fallback.length);this.#instanceCount=fallback.length;const instance=this.#instances;this.#own(instance,[this.#shared('unit-box',this.#unitBox),this.#shared('placeholder',this.#placeholder),this.#pool.acquire(`instances:${++this.#serial}`,()=>instance)]);this.group.add(instance);}
    const furniture = new Set(document.furniture.map(f => f.id));
    for (const [id, mesh] of this.#furniture) if (!furniture.has(id)) { this.group.remove(mesh);this.#release(mesh); this.#furniture.delete(id); }
    for (const item of document.furniture) {
      const mesh = this.#furniture.get(item.id) ?? new THREE.Mesh(this.#unitBox, this.#placeholder);
      if (!this.#furniture.has(item.id)) { this.#furniture.set(item.id, mesh);this.#own(mesh,[this.#shared('unit-box',this.#unitBox),this.#shared('placeholder',this.#placeholder)]); this.group.add(mesh); }
      mesh.scale.set(item.size.w / 1000, item.size.h / 1000, item.size.d / 1000);
      mesh.position.set(item.position.x / 1000, ((document.floors.find(f => f.id === item.floorId) ?? document.floors[0]!).elevation + item.elevation + item.size.h / 2) / 1000, item.position.y / 1000);
      mesh.visible=!instanced&&!loaded.has(item.id)&&!this.#hidden.has(item.floorId);mesh.castShadow=true;mesh.receiveShadow=true;
      mesh.rotation.y = -item.rotationDeg * Math.PI / 180; mesh.userData = { entityId: item.id, category: 'furniture-placeholder' };
    }
    if(this.#instances){fallback.forEach((item,i)=>{const mesh=this.#furniture.get(item.id)!;mesh.updateMatrix();this.#instances!.setMatrixAt(i,mesh.matrix);});this.#instances.instanceMatrix.needsUpdate=true;this.#instances.computeBoundingBox();this.#instances.computeBoundingSphere();this.#instances.userData={category:'furniture-instances',entityIds:fallback.map(f=>f.id)};}
  }
  setCeilingsVisible(visible:boolean):void{this.#showCeilings=visible;for(const {data,mesh}of this.#meshes.values())if(data.category==='ceiling')mesh.visible=this.#shown(data.category,mesh.userData.floorId);for(const mesh of this.#batches)if(mesh.userData.ceiling)mesh.visible=this.#batchShown(mesh);}
  /** Hide the floors above the active floor; `document` (the applied one) re-presents furniture. */
  setHiddenFloors(floorIds:ReadonlySet<string>,document:SceneDocument|null):void{
    if(this.#closed||floorIds.size===this.#hidden.size&&[...floorIds].every(id=>this.#hidden.has(id)))return;this.#hidden=new Set(floorIds);
    for(const {data,mesh}of this.#meshes.values())mesh.visible=this.#shown(data.category,mesh.userData.floorId);for(const mesh of this.#batches)mesh.visible=this.#batchShown(mesh);
    if(document)this.refreshFurniture(document);
  }
  mesh(id: string): THREE.Mesh | undefined { return this.#meshes.get(id)?.mesh; }
  dispose(): void {
    if(this.#closed)return;this.#closed=true;this.group.visible=false;
    try{this.#textures?.dispose();this.#pool.close();}finally{this.#owners.clear();this.#materialRoots.clear();this.#batches=[];this.#instances=null;this.#meshes.clear();this.#materials.clear();this.#furniture.clear();this.group.clear();}
  }
}
