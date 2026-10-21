import {readFile} from 'node:fs/promises';
import {expect,it} from 'vitest';
import {Box3,Vector3} from 'three';
import {parseCatalog,exactAsset,latestAssets,searchAssets} from './catalog';
import {decodeFurniture} from '../render3d/furniture-decoder';
import {mainFurnitureMaterial} from '../render3d/furniture-assets';

// Codex-authored design checks. Nominal values are specified here, not read from the generated source/GLB.
// Shape triangle arithmetic: box12; 12-sided cylinder48; 24-sided cylinder96; rounded(seg2)300.
const designs=[
 ['a_l0_cane_lounge_chair',[760,800,900],4*48+3*300+22*12,3,'be9466'],
 ['a_l0_compact_recliner',[900,1000,1040],4*48+5*300+2*12,3,'7f8f87'],
 ['a_l0_storage_ottoman',[750,750,450],4*96,3,'52696a'],
 ['a_l0_nesting_table',[950,650,480],2*96+7*48,3,'30373b'],
 ['a_l0_round_dining_table',[1100,1100,750],4*96,2,'b78a5b'],
 ['a_l0_compact_almirah',[900,500,1800],2*48+11*12,3,'e7e3d9'],
] as const;
const catalog=parseCatalog(JSON.parse(await readFile(new URL('../../public/catalog/catalog.json',import.meta.url),'utf8')));
it.each([
 ['बेंत','a_l0_cane_lounge_chair'],['रिक्लाइनर','a_l0_compact_recliner'],['ओटोमन','a_l0_storage_ottoman'],
 ['नेस्टिंग','a_l0_nesting_table'],['पेडेस्टल','a_l0_round_dining_table'],['दो-दरवाज़े','a_l0_compact_almirah'],
])('D83 Hindi search %s finds the specified original piece', (query,id)=>{
 expect(searchAssets(latestAssets(catalog),query!,'','hi').map(a=>a.id)).toEqual([id]);
});
async function decoded(id:string,version:number){const a=exactAsset(catalog,id,version)!;expect(a).toBeDefined();const l=a.lods[0]!,file=await readFile(new URL('../../public/catalog/'+l.path,import.meta.url));return decodeFurniture({id,version,lod:0,sha256:l.sha256,bytes:file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength),dims:a.dims,triangles:l.triangles});}

it.each(designs)('D83 %s has specified nominal bounds, grounding, triangle arithmetic and bounded materials',async(id,dims,triangles,materials,main)=>{
 const a=exactAsset(catalog,id,1)!;expect([a.dims.w,a.dims.d,a.dims.h]).toEqual(dims);expect(a.lods[0]!.triangles).toBe(triangles);expect(triangles).toBeLessThanOrEqual(3000);
 const d=await decoded(id,1);try{
  expect(d.primitives).toHaveLength(materials);expect(new Set(d.primitives.map(p=>p.material)).size).toBe(materials);const bounds=new Box3();for(const p of d.primitives)bounds.union(p.geometry.boundingBox!);
  const size=bounds.getSize(new Vector3());expect(size.toArray()).toEqual([dims[0]/1000,dims[2]/1000,dims[1]/1000].map(n=>expect.closeTo(n,5)));expect(bounds.min.y).toBeCloseTo(0,6);expect(bounds.getCenter(new Vector3()).x).toBeCloseTo(0,6);expect(bounds.getCenter(new Vector3()).z).toBeCloseTo(0,6);
  expect(mainFurnitureMaterial(d).color.getHexString()).toBe(main);
 }finally{d.dispose();}
});

it.each(['king_bed','queen_bed','double_bed'])('D83 %s v3 packs the exact v2 geometry into five material meshes; historical v2 still decodes',async name=>{
 const id=`a_l0_${name}`,old=await decoded(id,2),next=await decoded(id,3);
 const vertices=(d:Awaited<ReturnType<typeof decoded>>)=>d.primitives.flatMap(p=>{const pos=p.geometry.getAttribute('position'),normal=p.geometry.getAttribute('normal'),index=p.geometry.index;return Array.from({length:index?.count??pos.count},(_,i)=>{const n=index?index.getX(i):i;return [pos.getX(n),pos.getY(n),pos.getZ(n),normal.getX(n),normal.getY(n),normal.getZ(n),p.material.color.getHexString()].join(',');});}).sort();
 try{expect(next.primitives).toHaveLength(5);expect(old.primitives).toHaveLength(10);expect(vertices(next)).toEqual(vertices(old));expect(exactAsset(catalog,id,3)!.dims).toEqual(exactAsset(catalog,id,2)!.dims);expect(mainFurnitureMaterial(next).color.getHexString()).toBe('b5a690');}finally{old.dispose();next.dispose();}
});
