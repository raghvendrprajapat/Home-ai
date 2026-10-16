import type {AsyncTag,Command,MaterialDef,ProjectStore,SurfaceMaterialTarget} from '@gharplan/core-model';
import type {FootprintPiece,Rect} from '@gharplan/geometry';
type Document=ReturnType<ProjectStore['getSnapshot']>['document'];
export type SurfaceTarget=SurfaceMaterialTarget;
export interface SurfaceStrip {rect:Rect;side:'left'|'right';materialId:string;color:string}
export type Cardinal='north'|'south'|'east'|'west';
export function wallSideDirection(document:Document,id:string,side:'left'|'right'):Cardinal{
 const w=document.walls.find(w=>w.id===id),a=document.junctions.find(j=>j.id===w?.a),b=document.junctions.find(j=>j.id===w?.b);if(!w||!a||!b||a.x!==b.x&&a.y!==b.y||a.x===b.x&&a.y===b.y)throw Error('surface-wall');
 const left:Cardinal=a.y===b.y?b.x>a.x?'north':'south':b.y>a.y?'east':'west';return side==='left'?left:({north:'south',south:'north',east:'west',west:'east'} as const)[left];
}
export function materialColor(document:Document,id:string):string{return document.materials.find(m=>m.id===id)?.baseColor??'#778d76';}
/** Side-finish strips clip existing accepted footprints; never change wall solids.
 * Screen plan Y points south, so left of east is north and left of south is east. */
export function wallSurfaceStrips(document:Document,piece:FootprintPiece):SurfaceStrip[]{
 const w=document.walls.find(w=>w.id===piece.ownerId),a=document.junctions.find(j=>j.id===w?.a),b=document.junctions.find(j=>j.id===w?.b);if(!w||!a||!b)throw Error('surface-wall');
 const direction=wallSideDirection(document,w.id,'left'),[x0,y0,x1,y1]=piece.rect,vertical=a.x===b.x,cut=Math.max(vertical?x0:y0,Math.min(vertical?x1:y1,vertical?a.x:a.y)),low:Rect=vertical?[x0,y0,cut,y1]:[x0,y0,x1,cut],high:Rect=vertical?[cut,y0,x1,y1]:[x0,cut,x1,y1],leftLow=direction==='north'||direction==='west';
 return ([{rect:low,side:leftLow?'left':'right'},{rect:high,side:leftLow?'right':'left'}] as const).filter(p=>p.rect[2]>p.rect[0]&&p.rect[3]>p.rect[1]).map(p=>{const materialId=p.side==='left'?w.leftMaterial:w.rightMaterial;return {...p,materialId,color:materialColor(document,materialId)};});
}
export function surfaceMaterialId(document:Document,target:SurfaceTarget):string|undefined{return target.kind==='wall'?document.walls.find(w=>w.id===target.id)?.[target.side==='left'?'leftMaterial':'rightMaterial']:document.rooms.find(r=>r.id===target.id)?.floorMaterial;}
export interface SurfacePaintIntent {readonly tag:AsyncTag;readonly target:SurfaceTarget;readonly material:MaterialDef;readonly commandId:string}
export function beginSurfacePaint(store:ProjectStore,target:SurfaceTarget,material:MaterialDef):SurfacePaintIntent{
 const document=store.getSnapshot().document;if(!surfaceMaterialId(document,target))throw Error('surface-target');return Object.freeze({tag:Object.freeze({...store.asyncTag()}),target:Object.freeze({...target}),material:Object.freeze({...material}),commandId:`paint_${crypto.randomUUID().replaceAll('-','')}`});
}
export function currentSurfacePaint(store:ProjectStore,intent:SurfacePaintIntent,target:SurfaceTarget):boolean{const a=store.asyncTag(),b=intent.tag,t=intent.target;return a.projectId===b.projectId&&a.sessionId===b.sessionId&&a.localGeneration===b.localGeneration&&a.dependencyHash===b.dependencyHash&&target.kind===t.kind&&target.id===t.id&&(target.kind!=='wall'||t.kind==='wall'&&target.side===t.side);}
export function surfacePaintCommand(intent:SurfacePaintIntent):Command{return {type:'ApplySurfaceMaterial',id:intent.commandId,baseGeneration:intent.tag.localGeneration,target:intent.target,material:intent.material};}
