import type {AsyncTag,Command,ProjectStore} from '@gharplan/core-model';
import type {FurnitureDraft} from './furniture-transform';
import {furnitureAngle,scaledFurnitureSize} from './furniture-transform';
import {parseLength} from './measurements';
import type {Point2} from './view2d';
export interface PlacementAsset {readonly id:string;readonly version:number;readonly dims:Readonly<{w:number;d:number;h:number}>}
export interface PlacementIntent {readonly id:string;readonly tag:Readonly<AsyncTag>;readonly floorId:string;readonly asset:PlacementAsset;readonly centre:Point2}
export function beginPlacement(store:ProjectStore,asset:PlacementAsset,centre:Point2,id=`fu_${crypto.randomUUID().replaceAll('-','')}`):PlacementIntent{
 if(!/^[A-Za-z0-9_-]{2,40}$/.test(id)||!/^a_[a-z0-9_]{1,36}$/.test(asset.id)||!Number.isSafeInteger(asset.version)||asset.version<1||![asset.dims.w,asset.dims.d,asset.dims.h].every(n=>Number.isSafeInteger(n)&&n>0&&n<=20000))throw Error('placement-asset');
 // Far-panned centres remain editable invalid drafts, never silently clamped.
 return Object.freeze({id,tag:Object.freeze({...store.asyncTag()}),floorId:store.getSnapshot().document.floors[0]!.id,asset:Object.freeze({id:asset.id,version:asset.version,dims:Object.freeze({...asset.dims})}),centre:Object.freeze([Math.round(centre[0]),Math.round(centre[1])] as const)});
}
export function placementDraft(intent:PlacementIntent):FurnitureDraft{return {x:`${intent.centre[0]} mm`,y:`${intent.centre[1]} mm`,elevation:'0 mm',rotation:'0',scale:'1'};}
export function currentPlacement(store:ProjectStore,intent:PlacementIntent):boolean{
 const now=store.asyncTag(),tag=intent.tag;return now.projectId===tag.projectId&&now.sessionId===tag.sessionId&&now.localGeneration===tag.localGeneration&&now.dependencyHash===tag.dependencyHash;
}
export function placementCommand(store:ProjectStore,intent:PlacementIntent,draft:FurnitureDraft):Extract<Command,{type:'AddFurniture'}>{
 if(!currentPlacement(store,intent))throw Error('placement-stale');
 const elevation=parseLength(draft.elevation,{coordinate:true,maximum:6000});if(elevation<0)throw Error('furniture-number');
 return {id:`place_${intent.id}`,baseGeneration:intent.tag.localGeneration,type:'AddFurniture',furniture:{id:intent.id,floorId:intent.floorId,assetId:intent.asset.id,assetVersion:intent.asset.version,position:{x:parseLength(draft.x,{coordinate:true}),y:parseLength(draft.y,{coordinate:true})},elevation,rotationDeg:furnitureAngle(draft.rotation),size:scaledFurnitureSize(intent.asset.dims,draft.scale),materialOverrides:{}}};
}
