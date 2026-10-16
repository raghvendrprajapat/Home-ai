import {readFile} from 'node:fs/promises';
import {it,expect} from 'vitest';
import {exactAsset,latestAssets,parseCatalog,searchAssets} from './catalog';
const raw=JSON.parse(await readFile(new URL('../../public/catalog/catalog.json',import.meta.url),'utf8'));
it('FR-016 actual packaged original metadata is admitted as owned immutable dimensions and exact versions',()=>{
 const catalog=parseCatalog(raw),a=catalog.assets[0]!;expect(a.id).toBe('a_demo_table');expect(a.dims).toEqual({w:1200,d:600,h:750});expect(a.thumb.width).toBe(256);expect(Object.isFrozen(a.dims)).toBe(true);expect(exactAsset(catalog,a.id,1)).toBe(a);expect(exactAsset(catalog,a.id,2)).toBeUndefined();
 const changed=structuredClone(raw);changed.assets[0].dims.w=9999;expect(a.dims.w).toBe(1200);
});
it('FR-016 rejects malformed metadata, unknown formats, duplicate pins, invalid rights and non-local hashed references',()=>{
 const cases:((d:typeof raw)=>void)[]=[d=>{d.formatVersion=2;},d=>{d.assets.push(d.assets[0]);},d=>{d.assets[0].version=.4;},d=>{d.assets[0].dims.w=.4;},d=>{d.assets[0].dims.h=0;},d=>{d.assets[0].license.commercialUse=false;},d=>{d.assets[0].license.redistributionInApp=false;},d=>{d.assets[0].license.checkedOn='2026-02-31';},d=>{d.assets[0].thumb.path='https://example.com/image.svg';},d=>{d.assets[0].thumb.sha256='bad';},d=>{d.assets[0].thumb.bytes=128*1024+1;},d=>{d.assets[0].thumb.height=128;},d=>{d.assets[0].lods[1].triangles=3001;},d=>{d.assets[0].lods[0].path='blobs/../asset.glb';},d=>{d.assets[0].inspection.validator.errors=1;},d=>{delete d.assets[0].name_hi;}];
 for(const change of cases){const doc=structuredClone(raw);change(doc);expect(()=>parseCatalog(doc)).toThrow(/catalog-/);}
 for(const bad of [null,[],{},'not catalog',{formatVersion:1,assets:[null]},{formatVersion:1,assets:new Array(1001).fill(raw.assets[0])}])expect(()=>parseCatalog(bad)).toThrow();
});
it('FR-016 latest browsing is separate from exact saved pins and normalized English/Hindi search is deterministic',()=>{
 // Isolate the unchanged pilot ID for this two-version regression; production breadth is checked separately.
 const doc={...structuredClone(raw),assets:[structuredClone(raw.assets.find((a:{id:string})=>a.id==='a_demo_table'))]},newer=structuredClone(doc.assets[0]);newer.version=2;newer.name_hi='मूल मेज़';newer.dims.w=1400;newer.license.source='tools/asset-pipeline/sources/a_demo_table-v2.json';newer.license.url='https://github.com/raghvendrprajapat/Home-ai/blob/main/'+newer.license.source;doc.assets.push(newer);const catalog=parseCatalog(doc),list=latestAssets(catalog);expect(list).toHaveLength(1);expect(list[0]!.dims.w).toBe(1400);expect(exactAsset(catalog,'a_demo_table',1)!.dims.w).toBe(1200);
 expect(searchAssets(list,'ORIGINAL desk','tables','en')).toEqual(list);expect(searchAssets(list,'मेज़','','hi')).toEqual(list);expect(searchAssets(list,'desk','beds','en')).toEqual([]);expect(searchAssets(list,'bed','','en')).toEqual([]);expect(searchAssets(list,'   ','','hi')).toEqual(list);expect(catalog.assets.map(a=>a.version)).toEqual([1,2]);
});

it('PH4-T05 production starter catalog contains30distinct exact-pinned original assets across eight useful categories',()=>{
 const catalog=parseCatalog(raw),list=latestAssets(catalog);expect(list).toHaveLength(30);expect(new Set(list.map(a=>a.id)).size).toBe(30);const counts=Object.fromEntries([...new Set(list.map(a=>a.category))].map(c=>[c,list.filter(a=>a.category===c).length]));expect(counts).toEqual({tables:7,seating:6,beds:5,storage:6,kitchen:3,bathroom:1,decor:1,rugs:1});for(const a of list){expect(a.version).toBe(1);expect(exactAsset(catalog,a.id,1)).toBe(a);expect(a.name_en).not.toBe(a.name_hi);expect(a.lods.every(l=>l.triangles<=3000&&l.bytes<=2*1024*1024)).toBe(true);}expect(searchAssets(list,'sofa','','en')).toHaveLength(2);expect(searchAssets(list,'bed','','en')).toHaveLength(5);expect(searchAssets(list,'मेज़','','hi')).toHaveLength(7);
});
