import type {CameraPreset,ProjectStore} from '@gharplan/core-model';
export type Vec3=[number,number,number];
export interface CameraPose {position:Vec3;target:Vec3}
export type Bounds3=[number,number,number,number,number,number];
export const BOOKMARK_TOLERANCE=.003;
export const MIN_DISTANCE=1,MAX_DISTANCE=200,MAX_POLAR=85*Math.PI/180;
const finite=(v:readonly number[])=>v.length===3&&v.every(Number.isFinite);
/** Transient metres in Three axes. Canonical bookmark mm use plan X/Y/Z. */
export function clampOrbit(pose:CameraPose,bounds:Bounds3|null,floor:number):CameraPose{
 if(!finite(pose.position)||!finite(pose.target)||!Number.isFinite(floor))throw new Error('camera-pose');
 const limit=bounds??[-1000,floor,-1000,1000,floor+20,1000];if(!limit.every(Number.isFinite))throw new Error('camera-bounds');
 const target=pose.target.map((v,i)=>Math.max(limit[i]!,Math.min(limit[i+3]!,v))) as Vec3;target[1]=Math.max(floor,target[1]);
 let dx=pose.position[0]-pose.target[0],dy=pose.position[1]-pose.target[1],dz=pose.position[2]-pose.target[2];let distance=Math.hypot(dx,dy,dz);
 if(![dx,dy,dz,distance].every(Number.isFinite))throw new Error('camera-pose');
 if(distance<1e-9){dx=0;dy=1;dz=1;distance=Math.SQRT2;}
 const radius=Math.max(MIN_DISTANCE,Math.min(MAX_DISTANCE,distance)),polar=Math.max(.01,Math.min(MAX_POLAR,Math.acos(Math.max(-1,Math.min(1,dy/distance))))),angle=Math.atan2(dx,dz);
 return {target,position:[target[0]+radius*Math.sin(polar)*Math.sin(angle),target[1]+radius*Math.cos(polar),target[2]+radius*Math.sin(polar)*Math.cos(angle)]};
}
/** Transient nanometre precision avoids sub-ULP orbit drift across renderer recreation. */
export function stablePose(pose:CameraPose):CameraPose{
 const stable=(v:Vec3):Vec3=>v.map(n=>Number(n.toFixed(12))||0) as Vec3;
 return {position:stable(pose.position),target:stable(pose.target)};
}
export function fitPose(bounds:Bounds3,aspect:number,fovDeg=45):{pose:CameraPose;capped:boolean}{
 if(!bounds.every(Number.isFinite)||!Number.isFinite(aspect)||aspect<=0)throw new Error('camera-bounds');
 const target:Vec3=[(bounds[0]+bounds[3])/2,(bounds[1]+bounds[4])/2,(bounds[2]+bounds[5])/2],radius=Math.hypot(bounds[3]-bounds[0],bounds[4]-bounds[1],bounds[5]-bounds[2])/2;
 const vertical=fovDeg*Math.PI/360,horizontal=Math.atan(Math.tan(vertical)*aspect),distance=Math.max(2,radius/Math.sin(Math.min(vertical,horizontal))*1.15);
 const norm=Math.hypot(.45,.65,.65),pose=clampOrbit({target,position:[target[0]+distance*.45/norm,target[1]+distance*.65/norm,target[2]+distance*.65/norm]},bounds,bounds[1]);return {pose,capped:distance>MAX_DISTANCE};
}
export function bookmarkPose(bookmark:Readonly<Omit<CameraPreset,'position'|'target'>>&{position:readonly number[];target:readonly number[]}):CameraPose{
 if(bookmark.mode!=='orbit'||!finite(bookmark.position)||!finite(bookmark.target))throw new Error('camera-bookmark');
 const convert=(v:readonly number[]):Vec3=>[v[0]!/1000,v[2]!/1000,v[1]!/1000];const pose={position:convert(bookmark.position),target:convert(bookmark.target)},distance=Math.hypot(...pose.position.map((v,i)=>v-pose.target[i]!));
 if(distance<MIN_DISTANCE-BOOKMARK_TOLERANCE||distance>MAX_DISTANCE+BOOKMARK_TOLERANCE)throw new Error('camera-bookmark');return pose;
}
export function encodeBookmark(pose:CameraPose,name:string):Omit<CameraPreset,'id'>{
 if(!finite(pose.position)||!finite(pose.target))throw new Error('camera-pose');
 const convert=(v:Vec3)=>[Math.round(v[0]*1000),Math.round(v[2]*1000),Math.round(v[1]*1000)];const position=convert(pose.position),target=convert(pose.target);
 if([...position,...target].some(v=>!Number.isSafeInteger(v)||Math.abs(v)>1_000_000))throw new Error('camera-save-range');return {name,mode:'orbit',position,target};
}

/** Opening focus follows the actual wall-hosted void even without a catalog mesh. */
export function openingBounds(d:ReturnType<ProjectStore['getSnapshot']>['document'],id:string):Bounds3|null{
 const o=d.openings.find(o=>o.id===id);if(!o)return null;const w=d.walls.find(w=>w.id===o.wallId)!,a=d.junctions.find(j=>j.id===w.a)!,b=d.junctions.find(j=>j.id===w.b)!,length=Math.hypot(b.x-a.x,b.y-a.y),tx=(b.x-a.x)/length,tz=(b.y-a.y)/length,x=(a.x+tx*o.offset)/1000,z=(a.y+tz*o.offset)/1000,hx=(Math.abs(tx)*o.width+Math.abs(tz)*w.thickness)/2000,hz=(Math.abs(tz)*o.width+Math.abs(tx)*w.thickness)/2000,y=(d.floors[0]!.elevation+o.sill)/1000;return [x-hx,y,z-hz,x+hx,y+o.height/1000,z+hz];
}
