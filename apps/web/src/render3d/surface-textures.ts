import * as THREE from 'three';
import type {MaterialDef} from '@gharplan/core-model';

/**
 * D76 M1: photographic CC0 surface textures (ambientCG; rights in docs/assets/texture-rights.json). Renderer-only: the
 * saved drawing keeps its solid colours, and the Low tier never loads textures. A texture set's `worldMm` is the real
 * width one image covers, so `repeat = uvScaleMm / worldMm` (mesh UVs are millimetres divided by `uvScaleMm`).
 */
export interface TextureSet {readonly id:string;readonly worldMm:number;readonly files:{readonly color:string;readonly normal:string;readonly roughness?:string};
  /** Colour map is a near-white detail multiplied with the paint colour (walls); otherwise it replaces the colour. */
  readonly tint:boolean;readonly normalScale:number}
export const TEXTURE_SETS:Readonly<Record<'wood_oak'|'tile_vitrified_600'|'marble_white'|'plaster',TextureSet>>={
 wood_oak:{id:'wood_oak',worldMm:1500,files:{color:'textures/wood_oak/color.jpg',normal:'textures/wood_oak/normal.jpg',roughness:'textures/wood_oak/roughness.jpg'},tint:false,normalScale:.6},
 tile_vitrified_600:{id:'tile_vitrified_600',worldMm:1200,files:{color:'textures/tile_vitrified_600/color.jpg',normal:'textures/tile_vitrified_600/normal.jpg',roughness:'textures/tile_vitrified_600/roughness.jpg'},tint:false,normalScale:1},
 marble_white:{id:'marble_white',worldMm:1500,files:{color:'textures/marble_white/color.jpg',normal:'textures/marble_white/normal.jpg',roughness:'textures/marble_white/roughness.jpg'},tint:false,normalScale:.4},
 plaster:{id:'plaster',worldMm:1200,files:{color:'textures/plaster/color.jpg',normal:'textures/plaster/normal.jpg'},tint:true,normalScale:.5},
};
/** Library floors by id, other wood/tile/marble materials by name; every other surface is paint over plaster. */
export function textureSetFor(material:Pick<MaterialDef,'id'|'name'>):TextureSet{
 const key=`${material.id} ${material.name}`.toLowerCase();
 if(material.id==='m_wood_laminate'||/wood|laminate|lakdi|लकड़ी/.test(key))return TEXTURE_SETS.wood_oak;
 if(material.id==='m_tile_vitrified'||/tile|vitrified|टाइल/.test(key))return TEXTURE_SETS.tile_vitrified_600;
 if(/marble|संगमरमर/.test(key))return TEXTURE_SETS.marble_white;
 return TEXTURE_SETS.plaster;
}
type Loader=(url:string)=>Promise<THREE.Texture>;
const imageBytes=(texture:THREE.Texture)=>{const image=texture.image as {width?:number;height?:number}|undefined;return image?.width&&image.height?Math.round(image.width*image.height*4*4/3):0;};

/** Loads each image once, gives every material its own repeat, and reports what is really on the GPU. */
export class SurfaceTextures {
 #base=new Map<string,Promise<THREE.Texture>>();#loaded=new Map<string,THREE.Texture>();#clones=new Map<THREE.MeshStandardMaterial,THREE.Texture[]>();
 #textured=new Set<THREE.MeshStandardMaterial>();#closed=false;
 constructor(private readonly baseUrl:URL,private readonly onReady:()=>void,private readonly load:Loader=url=>new THREE.TextureLoader().loadAsync(url)){}
 #texture(path:string):Promise<THREE.Texture>{
  let pending=this.#base.get(path);
  if(!pending){pending=this.load(new URL(path,this.baseUrl).href).then(texture=>{if(this.#closed){texture.dispose();throw new Error('textures-closed');}texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;this.#loaded.set(path,texture);return texture;});pending.catch(()=>this.#base.delete(path));this.#base.set(path,pending);}
  return pending;
 }
 /** Sets the material's colour/finish now and its maps when they arrive; a failed download keeps the plain colour. */
 apply(material:THREE.MeshStandardMaterial,def:MaterialDef):void{
  if(this.#closed)return;
  const set=textureSetFor(def),repeat=(def.uvScaleMm??1000)/set.worldMm,key=`${set.id}:${repeat}`;
  material.color.set(set.tint?def.baseColor:'#ffffff');if(material.roughnessMap)material.roughness=1;
  if(material.userData.textureKey===key)return;material.userData.textureKey=key;
  const files=[set.files.color,set.files.normal,set.files.roughness].filter((f):f is string=>!!f);
  void Promise.all(files.map(file=>this.#texture(file))).then(([color,normal,roughness])=>{
   if(this.#closed||material.userData.textureKey!==key)return;
   for(const old of this.#clones.get(material)??[])old.dispose();
   const own=(texture:THREE.Texture,colorSpace:THREE.ColorSpace)=>{const t=texture.clone();t.repeat.set(repeat,repeat);t.colorSpace=colorSpace;t.needsUpdate=true;return t;};
   const map=own(color!,THREE.SRGBColorSpace),normalMap=own(normal!,THREE.NoColorSpace),roughnessMap=roughness?own(roughness,THREE.NoColorSpace):null;
   material.map=map;material.normalMap=normalMap;material.normalScale.set(set.normalScale,set.normalScale);material.roughnessMap=roughnessMap;
   if(roughnessMap)material.roughness=1;material.needsUpdate=true;
   this.#clones.set(material,[map,normalMap,...roughnessMap?[roughnessMap]:[]]);this.#textured.add(material);this.onReady();
  },()=>{/* No texture: the material keeps its colour. */});
 }
 /** A material that left the scene gives back its clones. */
 forget(material:THREE.MeshStandardMaterial):void{for(const t of this.#clones.get(material)??[])t.dispose();this.#clones.delete(material);this.#textured.delete(material);}
 get stats():{texturedMaterials:number;textureBytes:number}{
  // Clones share their image source, so the GPU holds each image once.
  return {texturedMaterials:this.#textured.size,textureBytes:[...this.#loaded.values()].reduce((n,t)=>n+imageBytes(t),0)};
 }
 dispose():void{
  if(this.#closed)return;this.#closed=true;
  for(const textures of this.#clones.values())for(const t of textures)t.dispose();for(const t of this.#loaded.values())t.dispose();
  this.#clones.clear();this.#loaded.clear();this.#base.clear();this.#textured.clear();
 }
}
