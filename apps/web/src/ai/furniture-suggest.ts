import type {RoomType} from '@gharplan/core-model';
import type {CatalogAsset} from '../catalog/catalog';
import type {LayoutRoom} from './layout';
import type {SketchPixels} from './sketch';

/**
 * D73 AI furniture ideas. A provider (the offline stand-in now, a server model later) only proposes catalog IDs with
 * a reason. This module decides what is shown: unknown IDs, items that do not fit with a walkway, duplicates, items
 * already in the room and anything past the floor-area budget are dropped, so no model output can place nonsense.
 */
export const WALKWAY_MM=600;
/** Suggested footprints together may cover at most this share of the room's clear floor. */
export const FLOOR_SHARE=.5;
export const MAX_SUGGESTIONS=6;
/** How big the suggested pieces should be. Without one, providers suggest the biggest that fits ("spacious"). */
export type SizePreference='compact'|'balanced'|'spacious';
export const SIZE_PREFERENCES:readonly SizePreference[]=['compact','balanced','spacious'];
export interface RoomBrief {readonly roomType:RoomType;readonly widthMm:number;readonly depthMm:number;readonly existingAssetIds:readonly string[];readonly size?:SizePreference}
export type SuggestionReason=Readonly<{kind:'largest'|'fits'}>|Readonly<{kind:'text';en:string;hi:string}>;
/**
 * One idea and the interchangeable pieces for the same place, biggest first, the shown asset among them. Every option
 * fits the room with a walkway and is not already in it; swapping still has to respect the floor budget.
 */
export interface FurnitureSuggestion {readonly asset:CatalogAsset;readonly reason:SuggestionReason;readonly options:readonly CatalogAsset[]}
export interface AiProvider {
 /** 'stand-in' runs offline rules on the device; 'server' will call a hosted model through the app's server. */
 readonly kind:'stand-in'|'server';
 suggestFurniture(brief:RoomBrief,candidates:readonly CatalogAsset[],signal:AbortSignal):Promise<unknown>;
 /** D73 AI-2: where each chosen item (or a smaller option of it) should stand, one or more layouts; checked by acceptLayouts. */
 suggestLayout(room:LayoutRoom,assets:readonly CatalogAsset[],signal:AbortSignal,options?:ReadonlyMap<string,readonly CatalogAsset[]>):Promise<unknown>;
 /** D73 AI-3: room rectangles read from a picture whose full width is realWidthMm; checked by acceptSketch. */
 planFromImage(image:SketchPixels,realWidthMm:number,signal:AbortSignal):Promise<unknown>;
}

/** True when the item, facing either pair of walls, fits with a walkway in front of it (width along the wall). */
export function fitsRoom(dims:Readonly<{w:number;d:number}>,widthMm:number,depthMm:number,walkway=WALKWAY_MM):boolean{
 return dims.w<=widthMm&&dims.d+walkway<=depthMm||dims.w<=depthMm&&dims.d+walkway<=widthMm;
}

const text=(v:unknown):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=300;
function reasonOf(value:unknown):SuggestionReason{
 if(value&&typeof value==='object'){const r=value as Record<string,unknown>;if(r.kind==='largest'||r.kind==='fits')return {kind:r.kind};if(r.kind==='text'&&text(r.en)&&text(r.hi))return {kind:'text',en:r.en,hi:r.hi};}
 return {kind:'fits'};
}

/** The trust boundary for any provider's answer. Order is kept; the result is at most MAX_SUGGESTIONS items. */
export function acceptSuggestions(raw:unknown,brief:RoomBrief,candidates:readonly CatalogAsset[]):FurnitureSuggestion[]{
 if(!Array.isArray(raw))return [];
 const byId=new Map(candidates.map(a=>[a.id,a])),taken=new Set(brief.existingAssetIds),out:FurnitureSuggestion[]=[];
 let budget=brief.widthMm*brief.depthMm*FLOOR_SHARE;
 for(const entry of raw.slice(0,50)){
  if(out.length>=MAX_SUGGESTIONS)break;
  if(!entry||typeof entry!=='object')continue;
  const id=(entry as Record<string,unknown>).assetId,asset=typeof id==='string'?byId.get(id):undefined;
  if(!asset||taken.has(asset.id)||!fitsRoom(asset.dims,brief.widthMm,brief.depthMm))continue;
  const area=asset.dims.w*asset.dims.d;if(area>budget)continue;
  budget-=area;taken.add(asset.id);out.push({asset,reason:reasonOf((entry as Record<string,unknown>).reason),options:[]});
 }
 // Options: known, fitting, not already in the room and not shown as another idea; kept in the provider's order
 // (biggest first), with the shown asset always included.
 const shown=new Set(out.map(s=>s.asset.id));
 return out.map(s=>{
  const listed=(raw as unknown[]).find(e=>e&&typeof e==='object'&&(e as Record<string,unknown>).assetId===s.asset.id) as Record<string,unknown>|undefined,ids=Array.isArray(listed?.options)?listed.options.slice(0,10):[];
  const options:CatalogAsset[]=[];
  for(const id of ids){const a=typeof id==='string'?byId.get(id):undefined;if(a&&!options.includes(a)&&(a===s.asset||!shown.has(a.id)&&!brief.existingAssetIds.includes(a.id)&&fitsRoom(a.dims,brief.widthMm,brief.depthMm)))options.push(a);}
  if(!options.includes(s.asset))options.unshift(s.asset);
  return {...s,options};
 });
}

/**
 * D73 "Show another option": the next option after the shown one (wrapping round) whose area keeps all ideas within the
 * floor budget, or undefined when no other option fits. The swapped idea's reason becomes "fits".
 */
export function swapSuggestion(list:readonly FurnitureSuggestion[],index:number,brief:RoomBrief):FurnitureSuggestion[]|undefined{
 const current=list[index];if(!current||current.options.length<2)return undefined;
 const area=(a:CatalogAsset)=>a.dims.w*a.dims.d,others=list.reduce((s,x,i)=>i===index?s:s+area(x.asset),0),budget=brief.widthMm*brief.depthMm*FLOOR_SHARE,at=current.options.indexOf(current.asset);
 for(let step=1;step<current.options.length;step++){
  const next=current.options[(at+step)%current.options.length]!;
  if(others+area(next)<=budget)return list.map((x,i)=>i===index?{...x,asset:next,reason:{kind:'fits'}}:x);
 }
 return undefined;
}

/** The room's clear rectangle as integer mm, the floor area that furniture can actually use. */
export function roomBrief(roomType:RoomType,clearRect:readonly [number,number,number,number],existingAssetIds:readonly string[]):RoomBrief{
 return {roomType,widthMm:Math.floor(clearRect[2]-clearRect[0]),depthMm:Math.floor(clearRect[3]-clearRect[1]),existingAssetIds};
}
