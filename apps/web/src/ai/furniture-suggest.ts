import type {RoomType} from '@gharplan/core-model';
import type {CatalogAsset} from '../catalog/catalog';

/**
 * D73 AI furniture ideas. A provider (the offline stand-in now, a server model later) only proposes catalog IDs with
 * a reason. This module decides what is shown: unknown IDs, items that do not fit with a walkway, duplicates, items
 * already in the room and anything past the floor-area budget are dropped, so no model output can place nonsense.
 */
export const WALKWAY_MM=600;
/** Suggested footprints together may cover at most this share of the room's clear floor. */
export const FLOOR_SHARE=.5;
export const MAX_SUGGESTIONS=6;
export interface RoomBrief {readonly roomType:RoomType;readonly widthMm:number;readonly depthMm:number;readonly existingAssetIds:readonly string[]}
export type SuggestionReason=Readonly<{kind:'largest'|'fits'}>|Readonly<{kind:'text';en:string;hi:string}>;
export interface FurnitureSuggestion {readonly asset:CatalogAsset;readonly reason:SuggestionReason}
export interface AiProvider {
 /** 'stand-in' runs offline rules on the device; 'server' will call a hosted model through the app's server. */
 readonly kind:'stand-in'|'server';
 suggestFurniture(brief:RoomBrief,candidates:readonly CatalogAsset[],signal:AbortSignal):Promise<unknown>;
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
  budget-=area;taken.add(asset.id);out.push({asset,reason:reasonOf((entry as Record<string,unknown>).reason)});
 }
 return out;
}

/** The room's clear rectangle as integer mm, the floor area that furniture can actually use. */
export function roomBrief(roomType:RoomType,clearRect:readonly [number,number,number,number],existingAssetIds:readonly string[]):RoomBrief{
 return {roomType,widthMm:Math.floor(clearRect[2]-clearRect[0]),depthMm:Math.floor(clearRect[3]-clearRect[1]),existingAssetIds};
}
