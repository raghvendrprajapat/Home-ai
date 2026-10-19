import type {Floor,Light} from '@gharplan/core-model';
import type {Bounds3} from './camera';
/** Bounded central shadow coverage; translated/elevated scenes keep the same sun direction. */
export function sunPlacement(bounds:Bounds3|null,floor:number){
 const target:[number,number,number]=bounds?[(bounds[0]+bounds[3])/2,floor,(bounds[2]+bounds[5])/2]:[0,floor,0],height=Math.max(12,bounds?bounds[4]-floor+6:12),radius=bounds?Math.hypot(bounds[3]-bounds[0],bounds[5]-bounds[2])/2:5,coverage=Math.max(5,Math.min(20,radius*1.25));return {target,position:[target[0]-6,target[1]+height,target[2]+8] as [number,number,number],coverage,partial:radius*1.25>20};
}
/** A point light hangs `height` mm above its own floor (FR-034), in Three metres (x,z,y). */
export function pointLightPosition(d:{readonly floors:readonly Readonly<Floor>[]},l:Pick<Light,'floorId'|'height'|'position'>):[number,number,number]{return [l.position.x/1000,((d.floors.find(f=>f.id===l.floorId)??d.floors[0]!).elevation+l.height)/1000,l.position.y/1000];}
