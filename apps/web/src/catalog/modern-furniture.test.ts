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
 {id:'a_l0_coffee_table',version:3,main:'#8a5a3a'},
 {id:'a_l0_side_table',version:2,main:'#c49a6c'},
 {id:'a_l0_tv_unit',version:1,main:'#e9e6df',front:'door-left'},
 {id:'a_l0_bookcase',version:2,main:'#c49a6c',back:'back'},
 // Bedroom: beds recolour the upholstered base and headboard; the headboard is at the back, the blanket at the foot.
 {id:'a_l0_king_bed',version:2,main:'#b5a690',back:'headboard',front:'blanket'},
 {id:'a_l0_queen_bed',version:2,main:'#b5a690',back:'headboard',front:'blanket'},
 {id:'a_l0_double_bed',version:2,main:'#b5a690',back:'headboard',front:'blanket'},
 {id:'a_l0_single_bed',version:2,main:'#b5a690',back:'headboard',front:'blanket'},
 {id:'a_l0_wardrobe_2',version:2,main:'#ecebe7',front:'door-1'},
 {id:'a_l0_wardrobe_3',version:2,main:'#8a5a3a',front:'door-1'},
 {id:'a_l0_wardrobe_sliding',version:1,main:'#8a5a3a',front:'panel-front'},
 {id:'a_l0_nightstand',version:1,main:'#8a5a3a',front:'drawer-top'},
 {id:'a_l0_dressing_table',version:2,main:'#ecebe7',back:'mirror-frame',front:'drawer-left'},
 {id:'a_l0_study_desk',version:3,main:'#ecebe7',front:'drawer-1'},
 {id:'a_l0_drawers',version:2,main:'#c49a6c',front:'drawer-1'},
 // Dining and storage: sets recolour their wood (table and chair frames outweigh the cushions); chairs face the table.
 {id:'a_l0_dining_chair',version:2,main:'#c8b9a3',back:'back',front:'seat'},
 {id:'a_l0_dining_4',version:2,main:'#8a5a3a'},
 {id:'a_l0_dining_6',version:2,main:'#8a5a3a'},
 {id:'a_l0_dining_set_4',version:2,main:'#8a5a3a',back:'chair-back-1-back',front:'chair-front-1-seat'},
 {id:'a_l0_dining_set_6',version:2,main:'#8a5a3a',back:'chair-back-1-back',front:'chair-front-1-seat'},
 {id:'a_l0_console_table',version:3,main:'#8a5a3a'},
 {id:'a_l0_shoe_rack',version:2,main:'#ecebe7',front:'door-left'},
 {id:'a_l0_bench',version:2,main:'#c8b9a3'},
 {id:'a_l0_stool',version:2,main:'#c9a23f'},
 {id:'a_l0_rug',version:2,main:'#b5653f'},
 {id:'a_l0_planter',version:2,main:'#4f7d4a'},
 {id:'a_l0_low_cabinet',version:3,main:'#8a5a3a',front:'door-1'},
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

// Audit (2026-10-19): part boxes from the latest sources. Every part must rest on the floor through touching parts, and
// a dining set's chairs face the table: each backrest is outside the tabletop and no table leg passes through a seat.
type Part={name:string;center:number[];size:number[]};
type Range=readonly [number,number];
const box=(p:Part)=>p.center.map((c,i)=>[c-p.size[i]!/2,c+p.size[i]!/2] as const) as unknown as readonly [Range,Range,Range];
const overlap=(a:Part,b:Part,eps:number)=>box(a).every(([lo,hi],i)=>lo<box(b)[i]![1]+eps&&box(b)[i]![0]<hi+eps);
const latest=[...new Map(catalog.assets.map(a=>[a.id,a])).values()].map(a=>catalog.assets.filter(b=>b.id===a.id).sort((x,y)=>y.version-x.version)[0]!);
const sources=await Promise.all(latest.map(async a=>({id:a.id,version:a.version,...JSON.parse(await readFile(new URL(`../../../../tools/asset-pipeline/sources/${a.id}-v${a.version}.json`,import.meta.url),'utf8')) as {schemaVersion:number;parts:Part[]}})));
const modern=sources.filter(s=>s.schemaVersion===3);

describe('D72 modern furniture parts',()=>{
 it('covers the modern designs, including the corrected versions',()=>{
  expect(modern.map(s=>`${s.id}@${s.version}`)).toEqual(expect.arrayContaining(['a_l0_dining_set_6@2','a_l0_dining_set_4@2','a_l0_dressing_table@2','a_l0_console_table@3','a_l0_coffee_table@3','a_l0_low_cabinet@3','a_l0_study_desk@3']));
 });
 it.each(modern.map(s=>[`${s.id}@${s.version}`,s] as const))('%s has no floating part',(_,source)=>{
  const resting=new Set(source.parts.filter(p=>box(p)[1][0]===0).map(p=>p.name));
  for(let grew=true;grew;){grew=false;for(const p of source.parts)if(!resting.has(p.name)&&source.parts.some(q=>resting.has(q.name)&&overlap(p,q,0.5))){resting.add(p.name);grew=true;}}
  expect(source.parts.map(p=>p.name).filter(n=>!resting.has(n))).toEqual([]);
 });
 it.each(modern.filter(s=>s.id.startsWith('a_l0_dining_set_')).map(s=>[`${s.id}@${s.version}`,s] as const))('%s chairs face the table and clear its legs',(_,source)=>{
  const top=source.parts.find(p=>p.name==='top')!,[tx,,tz]=box(top),legs=source.parts.filter(p=>/^leg-\d$/.test(p.name));
  const backs=source.parts.filter(p=>/^chair-.*-back$/.test(p.name)),seats=source.parts.filter(p=>/^chair-.*-seat$/.test(p.name));
  expect(backs).toHaveLength(seats.length);
  for(const back of backs){const [bx,,bz]=box(back),outside=bx[0]>=tx[1]||bx[1]<=tx[0]||bz[0]>=tz[1]||bz[1]<=tz[0];expect(outside,back.name).toBe(true);}
  for(const seat of seats)for(const leg of legs)expect(overlap(seat,leg,0),`${seat.name} / ${leg.name}`).toBe(false);
 });
});
