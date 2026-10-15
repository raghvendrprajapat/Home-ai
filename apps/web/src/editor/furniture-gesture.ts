import type {AsyncTag,Command,ProjectStore} from '@gharplan/core-model';
import type {Point2} from './view2d';
type Snapshot=ReturnType<ProjectStore['getSnapshot']>;
export interface FurnitureGestureIntent {
 readonly id:string;readonly mode:'move'|'rotate';readonly tag:AsyncTag;
 readonly centre:Point2;readonly rotation:number;readonly pointer:Point2;readonly commandId:string;
}
const sameTag=(a:AsyncTag,b:AsyncTag)=>a.projectId===b.projectId&&a.sessionId===b.sessionId&&a.localGeneration===b.localGeneration&&a.dependencyHash===b.dependencyHash;
export function beginFurnitureGesture(store:ProjectStore,id:string,mode:FurnitureGestureIntent['mode'],pointer:Point2):FurnitureGestureIntent{
 const item=store.getSnapshot().document.furniture.find(f=>f.id===id);
 if(!item||!pointer.every(Number.isFinite)||mode==='rotate'&&Math.hypot(pointer[0]-item.position.x,pointer[1]-item.position.y)<1)throw Error('furniture-gesture');
 return Object.freeze({id,mode,tag:Object.freeze({...store.asyncTag()}),centre:Object.freeze([item.position.x,item.position.y]) as Point2,rotation:item.rotationDeg,pointer:Object.freeze([...pointer]) as Point2,commandId:`gesture_${crypto.randomUUID().replaceAll('-','')}`});
}
export function currentFurnitureGesture(store:ProjectStore,intent:FurnitureGestureIntent):boolean{return sameTag(store.asyncTag(),intent.tag);}
/** Raw preview positions may be fractional; the command is quantized once.
 * Grid is the sole furniture-centre candidate. Wall centreline/junction targets
 * belong to wall tools; back-edge wall-face candidates are a separate stage. */
export function furnitureGestureCommand(intent:FurnitureGestureIntent,point:Point2,free:boolean,grid:number):Command{
 if(!point.every(Number.isFinite)||!Number.isInteger(grid)||grid<1||grid>1000)throw Error('furniture-gesture');
 let properties:Extract<Command,{type:'UpdateFurniture'}>['properties'];
 if(point[0]===intent.pointer[0]&&point[1]===intent.pointer[1])return {id:intent.commandId,baseGeneration:intent.tag.localGeneration,type:'UpdateFurniture',furnitureId:intent.id,properties:{}};
 if(intent.mode==='move'){
  const step=free?1:grid,round=(value:number)=>Math.round(value/step)*step;
  properties={position:{x:round(intent.centre[0]+point[0]-intent.pointer[0]),y:round(intent.centre[1]+point[1]-intent.pointer[1])}};
 }else{
  if(Math.hypot(point[0]-intent.centre[0],point[1]-intent.centre[1])<1)throw Error('furniture-gesture');
  const start=Math.atan2(intent.pointer[1]-intent.centre[1],intent.pointer[0]-intent.centre[0]),end=Math.atan2(point[1]-intent.centre[1],point[0]-intent.centre[0]);
  const raw=intent.rotation+(end-start)*180/Math.PI,angle=free?raw:Math.round(raw/15)*15;
  properties={rotationDeg:((angle%360)+360)%360};
 }
 return {id:intent.commandId,baseGeneration:intent.tag.localGeneration,type:'UpdateFurniture',furnitureId:intent.id,properties};
}
export function furnitureStepCommand(snapshot:Snapshot,id:string,step:{dx?:number;dy?:number;rotation?:number}):Command{
 const item=snapshot.document.furniture.find(f=>f.id===id);if(!item)throw Error('furniture-selection');
 const dx=step.dx??0,dy=step.dy??0,rotation=step.rotation??0;if(![dx,dy,rotation].every(Number.isInteger)||Math.abs(dx)>100||Math.abs(dy)>100||Math.abs(rotation)>15)throw Error('furniture-step');
 return {id:`furniture_${crypto.randomUUID().replaceAll('-','')}`,baseGeneration:snapshot.localGeneration,type:'UpdateFurniture',furnitureId:id,properties:rotation?{rotationDeg:((item.rotationDeg+rotation)%360+360)%360}:{position:{x:item.position.x+dx,y:item.position.y+dy}}};
}
