import {readFile} from 'node:fs/promises';
import {describe,expect,it} from 'vitest';
import {exactAsset,parseCatalog} from './catalog';

// D72 modern original designs, decoded from the shipped catalog files. Claude-authored checks: the expected colours
// and front/back parts are written by hand from the design intent, not read back from the generated models.
const catalog=parseCatalog(JSON.parse(await readFile(new URL('../../public/catalog/catalog.json',import.meta.url),'utf8')));
const {decodeFurniture}=await import('../render3d/furniture-decoder'),{mainFurnitureMaterial}=await import('../render3d/furniture-assets'),{Box3,Vector3}=await import('three');
const designs:{id:string;version:number;main:string;back?:string;front?:string}[]=[
 {id:'a_l0_sofa_3',version:2,main:'#868a90',back:'back-frame'},
 {id:'a_l0_sofa_2',version:2,main:'#868a90',back:'back-frame'},
 {id:'a_l0_sofa_l',version:1,main:'#868a90',back:'back-frame',front:'seat-chaise'},
 {id:'a_l0_armchair',version:2,main:'#427282',back:'back-frame'},
 {id:'a_l0_coffee_table',version:2,main:'#8a5a3a'},
 {id:'a_l0_side_table',version:2,main:'#c49a6c'},
 {id:'a_l0_tv_unit',version:1,main:'#e9e6df',front:'door-left'},
 {id:'a_l0_bookcase',version:2,main:'#c49a6c',back:'back'},
];
const channels=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));

describe('D72 modern furniture in the 3D decoder',()=>{
 it.each(designs)('$id@$version decodes to its declared size, faces −Z and recolours its upholstery/top as the main material',async design=>{
  const asset=exactAsset(catalog,design.id,design.version)!,lod=asset.lods[0]!;expect(asset).toBeDefined();
  const source=JSON.parse(await readFile(new URL(`../../../../tools/asset-pipeline/sources/${design.id}-v${design.version}.json`,import.meta.url),'utf8')) as {schemaVersion:number;parts:{name:string}[]};
  const file=await readFile(new URL('../../public/catalog/'+lod.path,import.meta.url)),bytes=file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength);
  const decoded=await decodeFurniture({id:asset.id,version:asset.version,lod:0,sha256:lod.sha256,bytes,dims:asset.dims,triangles:lod.triangles});
  try{
   expect(source.schemaVersion).toBe(3);expect(decoded.primitives.map(p=>p.name)).toEqual(source.parts.map(p=>p.name));
   expect(lod.triangles).toBeLessThanOrEqual(3000);
   const bounds=new Box3();for(const p of decoded.primitives)bounds.union(p.geometry.boundingBox!);
   expect(bounds.getSize(new Vector3()).toArray()).toEqual([asset.dims.w/1000,asset.dims.h/1000,asset.dims.d/1000].map(n=>expect.closeTo(n,5)));
   expect(bounds.min.y).toBeCloseTo(0,5);
   const centre=(name:string)=>decoded.primitives.find(p=>p.name===name)!.geometry.boundingBox!.getCenter(new Vector3()).z;
   if(design.back)expect(centre(design.back)).toBeGreaterThan(0);
   if(design.front)expect(centre(design.front)).toBeLessThan(0);
   const actual=channels(`#${mainFurnitureMaterial(decoded).color.getHexString()}`);
   channels(design.main).forEach((c,i)=>expect(Math.abs(actual[i]!-c)).toBeLessThanOrEqual(1));
  }finally{decoded.dispose();}
 });
});
