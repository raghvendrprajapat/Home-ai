import type {Command,ProjectStore} from '@gharplan/core-model';
import {WallSolidsCache} from '../render3d/solids';
import {alignFurnitureBack,furnitureCollisions} from './furniture-spatial';
import type {BackAlignment,FurnitureCollisions} from './furniture-spatial';
import {furnitureGestureCommand} from './furniture-gesture';
import type {FurnitureGestureIntent} from './furniture-gesture';
import type {Point2} from './view2d';
type Document=ReturnType<ProjectStore['getSnapshot']>['document'];
type Item=Document['furniture'][number];
export type FurnitureAdvisory=({available:true;overlap:boolean}&FurnitureCollisions)|{available:false;overlap:false};
/** Optional assistance must never throw through editing or reject a deliberate overlap. */
export class FurnitureAdvisories {
 constructor(private cache:Pick<WallSolidsCache,'get'>=new WallSolidsCache()){}
 check(document:Document,item:Item):FurnitureAdvisory {
  try{const flags=furnitureCollisions(document,item,this.cache.get(document));return {...flags,available:true,overlap:!!(flags.wallIds.length||flags.furnitureIds.length)};}catch{return {available:false,overlap:false};}
 }
 align(document:Document,item:Item,maxDistanceMm=200,previousKey?:string):{available:boolean;alignment:BackAlignment|null}{
  try{return {available:true,alignment:alignFurnitureBack(document,item,this.cache.get(document),maxDistanceMm,previousKey)};}catch{return {available:false,alignment:null};}
 }
 gesture(document:Document,intent:FurnitureGestureIntent,to:Point2,free:boolean,grid:number,scale:number,previousKey:string|null):{command:Command;snap:BackAlignment|null;available:boolean}{
  const fallback=furnitureGestureCommand(intent,to,free,grid);
  if(intent.mode!=='move'||free||to[0]===intent.pointer[0]&&to[1]===intent.pointer[1])return {command:fallback,snap:null,available:true};
  const item=document.furniture.find(f=>f.id===intent.id);
  if(!item||!Number.isFinite(scale)||scale<=0)return {command:fallback,snap:null,available:false};
  // Test the unquantized grab-offset candidate before the grid gets a chance to move it.
  const candidate={...item,position:{x:intent.centre[0]+to[0]-intent.pointer[0],y:intent.centre[1]+to[1]-intent.pointer[1]}};
  const held=previousKey?this.align(document,candidate,Math.min(12/scale,250),previousKey):null;
  const chosen=held?.alignment?.key===previousKey?held:this.align(document,candidate,Math.min(8/scale,200));
  const snap=chosen?.alignment??null;
  return {command:snap?{id:intent.commandId,baseGeneration:intent.tag.localGeneration,type:'UpdateFurniture',furnitureId:intent.id,properties:{position:snap.position}}:fallback,snap,available:chosen?.available??true};
 }
}
