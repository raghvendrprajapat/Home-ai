import {readFile} from 'node:fs/promises';
import {expect,it} from 'vitest';
import {Box3,Vector3} from 'three';
import {parseCatalog,exactAsset,latestAssets,searchAssets} from './catalog';
import {decodeFurniture} from '../render3d/furniture-decoder';
import {mainFurnitureMaterial} from '../render3d/furniture-assets';

// D91 catalog wave. Claude-authored builder checks (not independent fixtures): every expected value below is written by
// hand from the design intent, not read back from the generated sources or GLBs.
// Shape triangle arithmetic: box 12; 8-sided cylinder 32; 12-sided 48; 16-sided 64; 24-sided 96; rounded box with
// 1 segment 108, with 2 segments 300. Every source sets mergeByMaterial, so the decoder sees one primitive per colour and
// finish, named after the first part of that material. The model front is −Z (back > 0, front < 0).
type Design={id:string;category:string;dims:[number,number,number];triangles:number;names:string[];main:string;back?:string[];front?:string[]};
const designs:Design[]=[
 {id:'a_l0_diwan',category:'seating',dims:[1850,800,750],triangles:4*48+108+3*300+2*64,names:['leg-1','mattress','bolster-left'],main:'#c9a25e'},
 {id:'a_l0_baithak',category:'seating',dims:[1800,750,520],triangles:3*300+2*64,names:['gadda','masnad-left'],main:'#8c3b2e'},
 {id:'a_l0_shoe_bench',category:'seating',dims:[1000,350,480],triangles:12*12+300,names:['side-left','cushion'],main:'#c49a6c'},
 {id:'a_l0_rocking_chair',category:'seating',dims:[640,900,1000],triangles:2*96+8*48+5*108+2*300,names:['runner-left','seat-cushion'],main:'#8a5a3a'},
 {id:'a_l0_floor_cushion',category:'seating',dims:[600,600,170],triangles:300+2*12+64,names:['cushion','stitch-x'],main:'#b5653f'},
 // The fluted walnut panel stands against the back board; glass doors, handles, knobs and drawer fronts face the room.
 {id:'a_l0_media_wall',category:'storage',dims:[2400,450,2100],triangles:32*12+2*64,names:['carcass','plinth','panel','flute-1','vase-left'],main:'#e9e6df',back:['panel','flute-1']},
 {id:'a_l0_crockery_unit',category:'storage',dims:[1200,420,1950],triangles:17*12+4*48,names:['lower-carcass','plinth','glass-left','handle-lower-left'],main:'#9a6a43',front:['glass-left','handle-lower-left']},
 {id:'a_l0_wall_shelf',category:'storage',dims:[900,250,900],triangles:14*12+64,names:['bottom','book-1','book-2','book-3','vase'],main:'#c49a6c'},
 {id:'a_l0_kids_wardrobe',category:'storage',dims:[900,520,1500],triangles:6*12+4*64,names:['carcass','door-left','door-right','knob-door-left'],main:'#f3f0ea',front:['door-left','door-right','knob-door-left']},
 {id:'a_l0_pooja_unit',category:'storage',dims:[600,400,1200],triangles:12*12+2*48,names:['plinth','knob-left','niche-back'],main:'#a0683c',back:['niche-back'],front:['knob-left']},
 // Beds: headboard pad at the back, blanket at the foot. The pad is 40 mm thick with a 20 mm radius, so its two middle
 // depth rows coincide and it has (5·5+5·4+4·5)·2·2=260 triangles instead of 300.
 {id:'a_l0_storage_single_bed',category:'beds',dims:[1000,2050,900],triangles:5*12+260+2*300+108,names:['headboard','plinth','drawer-foot','pad','mattress','blanket'],main:'#8a5a3a',back:['pad'],front:['blanket']},
 {id:'a_l0_baby_cot',category:'beds',dims:[700,1300,950],triangles:11*12+18*32+2*300,names:['post-1','end-head','mattress'],main:'#d9b98f'},
 {id:'a_l0_kids_study_desk',category:'tables',dims:[900,500,1050],triangles:108+11*12,names:['top','panel-left','drawer-1','drawer-2'],main:'#f3f0ea',front:['drawer-1','drawer-2']},
 {id:'a_l0_folding_dining_table',category:'tables',dims:[1000,390,760],triangles:108+6*12+4*48,names:['top','leg-1'],main:'#b78a5b'},
 {id:'a_l0_computer_desk',category:'tables',dims:[1200,600,750],triangles:108+8*12,names:['top','panel-left','tray'],main:'#e9e6df',front:['tray']},
 // Wall pieces: the frame or rim is against the wall, the glass, face and hands face the room.
 {id:'a_l0_wall_mirror',category:'decor',dims:[600,30,600],triangles:2*96,names:['frame','glass'],main:'#b99b57',back:['frame'],front:['glass']},
 {id:'a_l0_wall_clock',category:'decor',dims:[350,40,350],triangles:2*96+6*12+64,names:['rim','face','hand-hour'],main:'#5b3a26',back:['rim'],front:['face','hand-hour']},
 {id:'a_l0_tall_plant',category:'decor',dims:[870,870,1700],triangles:2*96+64+6*32+48*48,names:['pot','soil','stem-1','frond-1-1-up','frond-1-1-out','frond-1-2-out'],main:'#3f6b3a'},
 {id:'a_l0_round_rug',category:'rugs',dims:[1500,1500,12],triangles:3*96,names:['border','field','medallion'],main:'#3e4f6e'},
 {id:'a_l0_runner_rug',category:'rugs',dims:[2400,750,12],triangles:7*12,names:['border','field','stripe-1','fringe-left'],main:'#b5653f'},
];
const catalog=parseCatalog(JSON.parse(await readFile(new URL('../../public/catalog/catalog.json',import.meta.url),'utf8')));
const raw=JSON.parse(await readFile(new URL('../../public/catalog/catalog.json',import.meta.url),'utf8')) as {assets:{id:string;version:number;license:{type:string;attribution:string;checkedOn:string;standaloneRedistribution:boolean}}[]};
const channels=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
async function decoded(id:string){const a=exactAsset(catalog,id,1)!;expect(a).toBeDefined();const l=a.lods[0]!,file=await readFile(new URL('../../public/catalog/'+l.path,import.meta.url));return decodeFurniture({id,version:1,lod:0,sha256:l.sha256,bytes:file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength),dims:a.dims,triangles:l.triangles});}

it('D91 adds twenty new version-1 items with English and Hindi names and a project-original rights record',()=>{
 expect(designs).toHaveLength(20);expect(new Set(designs.map(d=>d.id)).size).toBe(20);
 const latest=latestAssets(catalog);
 for(const d of designs){
  const a=exactAsset(catalog,d.id,1)!;expect(a,d.id).toBeDefined();expect(latest.find(x=>x.id===d.id)).toBe(a);expect(exactAsset(catalog,d.id,2)).toBeUndefined();
  expect(a.category).toBe(d.category);expect(a.name_hi).toMatch(/[ऀ-ॿ]/);expect(a.name_en).toMatch(/^[A-Z]/);expect(a.name_en).not.toBe(a.name_hi);
  const license=raw.assets.find(x=>x.id===d.id&&x.version===1)!.license;
  expect([d.id,license.type,license.checkedOn,license.standaloneRedistribution]).toEqual([d.id,'project-original-app-use','2026-10-27',false]);expect(license.attribution).toMatch(/Claude Code for GharPlan.*No third-party model or art/);
 }
});
it.each(designs)('D91 $id decodes to its nominal size on the floor, hand-counted triangles, one primitive per material, its main colour and front/back',async design=>{
 const a=exactAsset(catalog,design.id,1)!;expect([a.dims.w,a.dims.d,a.dims.h]).toEqual(design.dims);expect(a.lods[0]!.triangles).toBe(design.triangles);expect(design.triangles).toBeLessThanOrEqual(3000);
 const d=await decoded(design.id);try{
  expect(d.primitives.map(p=>p.name)).toEqual(design.names);expect(new Set(d.primitives.map(p=>p.material)).size).toBe(design.names.length);
  const bounds=new Box3();for(const p of d.primitives)bounds.union(p.geometry.boundingBox!);
  expect(bounds.getSize(new Vector3()).toArray()).toEqual([design.dims[0]/1000,design.dims[2]/1000,design.dims[1]/1000].map(n=>expect.closeTo(n,5)));
  expect(bounds.min.y).toBeCloseTo(0,6);expect(bounds.getCenter(new Vector3()).x).toBeCloseTo(0,6);expect(bounds.getCenter(new Vector3()).z).toBeCloseTo(0,6);
  const centre=(name:string)=>d.primitives.find(p=>p.name===name)!.geometry.boundingBox!.getCenter(new Vector3()).z;
  for(const name of design.back??[])expect([name,centre(name)>0]).toEqual([name,true]);
  for(const name of design.front??[])expect([name,centre(name)<0]).toEqual([name,true]);
  const actual=channels(`#${mainFurnitureMaterial(d).color.getHexString()}`);channels(design.main).forEach((c,i)=>expect(Math.abs(actual[i]!-c)).toBeLessThanOrEqual(1));
 }finally{d.dispose();}
});
it.each([
 ['दीवान','a_l0_diwan'],['मसनद','a_l0_baithak'],['झूलने','a_l0_rocking_chair'],['चौकोर','a_l0_floor_cushion'],['क्रॉकरी','a_l0_crockery_unit'],['स्टडी','a_l0_wall_shelf'],
 ['पूजा','a_l0_pooja_unit'],['पालना','a_l0_baby_cot'],['कंप्यूटर','a_l0_computer_desk'],['मोड़ने','a_l0_folding_dining_table'],['शीशा','a_l0_wall_mirror'],['घड़ी','a_l0_wall_clock'],['रनर','a_l0_runner_rug'],
])('D91 Hindi search %s finds only the specified new piece',(query,id)=>{
 expect(searchAssets(latestAssets(catalog),query!,'','hi').map(a=>a.id)).toEqual([id]);
});
it('D91 English search finds the new pieces by everyday words',()=>{
 const find=(q:string)=>searchAssets(latestAssets(catalog),q,'','en').map(a=>a.id).sort();
 expect(find('rocking')).toEqual(['a_l0_rocking_chair']);expect(find('diwan')).toEqual(['a_l0_diwan']);expect(find('crockery')).toEqual(['a_l0_crockery_unit','a_l0_low_cabinet']);expect(find('baby cot')).toEqual(['a_l0_baby_cot']);
 expect(find('mirror')).toEqual(['a_l0_dressing_table','a_l0_wall_mirror','a_l0_wardrobe_3']);expect(find('clock')).toEqual(['a_l0_wall_clock']);expect(find('runner')).toEqual(['a_l0_runner_rug']);
 expect(find('kids')).toEqual(['a_l0_kids_study_desk','a_l0_kids_wardrobe','a_l0_storage_single_bed']);
});
