import type {Locale} from '../i18n/messages';
export interface CatalogAsset {
 readonly id:string;readonly version:number;readonly name_en:string;readonly name_hi:string;readonly category:string;readonly tags:readonly string[];
 readonly dims:Readonly<{w:number;d:number;h:number}>;
 readonly lods:readonly Readonly<{level:number;path:string;sha256:string;bytes:number;triangles:number}>[];
 readonly thumb:Readonly<{path:string;sha256:string;bytes:number;width:256;height:256}>;
}
export interface Catalog {readonly assets:readonly CatalogAsset[]}
const record=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('catalog-format');return v as Record<string,unknown>;};
const number=(v:unknown,min:number,max:number)=>typeof v==='number'&&Number.isInteger(v)&&v>=min&&v<=max;
const text=(v:unknown):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=500;
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export function parseCatalog(value:unknown):Catalog {
 const root=record(value);if(root.formatVersion!==1||!Array.isArray(root.assets)||root.assets.length>1000)throw Error('catalog-format');
 const seen=new Set<string>();
 const assets=root.assets.map(raw=>{
  const e=record(raw),d=record(e.dims),license=record(e.license),thumb=record(e.thumb),inspection=record(e.inspection),validation=record(inspection.validator);
  if(typeof e.id!=='string'||!/^a_[a-z0-9_]{1,36}$/.test(e.id)||!number(e.version,1,1000000)||!text(e.name_en)||!text(e.name_hi)||!text(e.category)||!Array.isArray(e.tags)||e.tags.length>30||!e.tags.every(text)||!hash(e.sourceSha256))throw Error('catalog-entry');
  const key=`${e.id}@${e.version}`;if(seen.has(key))throw Error('catalog-duplicate');seen.add(key);
  const source=`tools/asset-pipeline/sources/${e.id}-v${e.version}.json`;
  if(license.source!==source||license.url!==`https://github.com/raghvendrprajapat/Home-ai/blob/main/${source}`||license.type!=='project-original-app-use'||license.commercialUse!==true||license.redistributionInApp!==true||license.standaloneRedistribution!==false||!text(license.attribution)||typeof license.checkedOn!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(license.checkedOn)||!Number.isFinite(Date.parse(license.checkedOn))||new Date(license.checkedOn).toISOString().slice(0,10)!==license.checkedOn)throw Error('catalog-rights');
  if(![d.w,d.d,d.h].every(v=>number(v,1,20000))||validation.errors!==0||!number(validation.warnings,0,1000000))throw Error('catalog-dimensions');
  if(!hash(thumb.sha256)||thumb.path!==`blobs/${thumb.sha256}.svg`||!number(thumb.bytes,1,128*1024)||thumb.width!==256||thumb.height!==256)throw Error('catalog-thumbnail');
  if(!Array.isArray(e.lods)||e.lods.length!==2)throw Error('catalog-lods');
  const lods=e.lods.map((raw,index)=>{const l=record(raw);if(l.level!==index||!hash(l.sha256)||l.path!==`blobs/${l.sha256}.glb`||!number(l.bytes,28,2*1024*1024)||!number(l.triangles,1,index===0?20000:3000))throw Error('catalog-lod');return Object.freeze({level:index,path:l.path as string,sha256:l.sha256,bytes:l.bytes as number,triangles:l.triangles as number});});
  return Object.freeze({id:e.id,version:e.version as number,name_en:e.name_en,name_hi:e.name_hi,category:e.category,tags:Object.freeze([...e.tags]),dims:Object.freeze({w:d.w as number,d:d.d as number,h:d.h as number}),thumb:Object.freeze({path:thumb.path as string,sha256:thumb.sha256,bytes:thumb.bytes as number,width:256 as const,height:256 as const}),lods:Object.freeze(lods)});
 });return Object.freeze({assets:Object.freeze(assets)});
}
export function exactAsset(catalog:Catalog,id:string,version:number):CatalogAsset|undefined{return catalog.assets.find(e=>e.id===id&&e.version===version);}
export function latestAssets(catalog:Catalog):readonly CatalogAsset[]{const latest=new Map<string,CatalogAsset>();for(const asset of catalog.assets)if((latest.get(asset.id)?.version??0)<asset.version)latest.set(asset.id,asset);return [...latest.values()];}
export const assetName=(asset:CatalogAsset,locale:Locale):string=>locale==='hi'?asset.name_hi:asset.name_en;
export function searchAssets(assets:readonly CatalogAsset[],query:string,category:string,locale:Locale):readonly CatalogAsset[]{
 const normalize=(s:string)=>s.normalize('NFKC').toLocaleLowerCase(locale),terms=normalize(query).trim().split(/\s+/).filter(Boolean);
 const collator=new Intl.Collator(locale);return assets.filter(a=>{const haystack=normalize([a.name_en,a.name_hi,a.category,...a.tags].join(' '));return (!category||a.category===category)&&terms.every(t=>haystack.includes(t));}).sort((a,b)=>collator.compare(assetName(a,locale),assetName(b,locale))||a.id.localeCompare(b.id));
}
