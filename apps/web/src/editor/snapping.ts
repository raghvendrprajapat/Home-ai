import type { PlanDocument, Point2, Viewport } from './view2d';
export type SnapKind='junction'|'wall'|'guide-x'|'guide-y'|'grid';
export interface SnapTarget {kind:SnapKind;key:string;point:Point2;priority:number;acquirePx:number;guide?:{axis:'x'|'y';value:number};gridStep?:number}
export interface SnapOptions {origin?:Point2|null;orthogonal?:boolean;excludeId?:string;disabled?:boolean;grid?:boolean;previous?:SnapTarget|null}
export interface SnapResult {point:Point2;target:SnapTarget|null;gridStep:number}
const distance=(a:Point2,b:Point2)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const stable=(a:string,b:string)=>a<b?-1:a>b?1:0;
export function snapGridStep(scale:number):number {if(!Number.isFinite(scale)||scale<=0)throw new Error('invalid-scale');return [10,50,100,500,1000].find(step=>step*scale>=4)??1000;}
/** Recomputed candidates let held wall/guide snaps slide on their unconstrained axis. */
export function resolveSnap(document:PlanDocument,raw:Point2,view:Viewport,options:SnapOptions={}):SnapResult {
 if(!raw.every(Number.isFinite)||!Number.isFinite(view.scale)||view.scale<.001||view.scale>1)throw new Error('invalid-pointer');
 const origin=options.origin,locked=options.orthogonal&&origin?(Math.abs(raw[0]-origin[0])>=Math.abs(raw[1]-origin[1])?'y':'x'):null;
 const point:Point2=locked==='y'?[raw[0],origin![1]]:locked==='x'?[origin![0],raw[1]]:raw,step=snapGridStep(view.scale);
 const quantize=(p:Point2):Point2=>[Math.round(p[0]),Math.round(p[1])];
 if(options.disabled)return {point:quantize(point),target:null,gridStep:step};
 const candidates:SnapTarget[]=[],fits=(p:Point2)=>locked==='x'?p[0]===origin![0]:locked==='y'?p[1]===origin![1]:true;
 for(const j of document.junctions){if(j.id===options.excludeId)continue;const p:Point2=[j.x,j.y];if(fits(p))candidates.push({kind:'junction',key:`junction:${j.id}`,point:p,priority:1,acquirePx:12});
  if(locked!=='x')candidates.push({kind:'guide-x',key:`guide-x:${j.id}`,point:[j.x,point[1]],priority:3,acquirePx:6,guide:{axis:'x',value:j.x}});
  if(locked!=='y')candidates.push({kind:'guide-y',key:`guide-y:${j.id}`,point:[point[0],j.y],priority:3,acquirePx:6,guide:{axis:'y',value:j.y}});
 }
 const index=new Map(document.junctions.map(j=>[j.id,j]));
 for(const wall of document.walls){if(options.excludeId&&(wall.a===options.excludeId||wall.b===options.excludeId))continue;const a=index.get(wall.a)!,b=index.get(wall.b)!,horizontal=a.y===b.y;let target:Point2;
  if(locked){if((locked==='y')===horizontal)continue;target=locked==='y'?[a.x,point[1]]:[point[0],a.y];}
  else target=horizontal?[Math.max(Math.min(a.x,b.x),Math.min(Math.max(a.x,b.x),point[0])),a.y]:[a.x,Math.max(Math.min(a.y,b.y),Math.min(Math.max(a.y,b.y),point[1]))];
  if(target[0]<Math.min(a.x,b.x)||target[0]>Math.max(a.x,b.x)||target[1]<Math.min(a.y,b.y)||target[1]>Math.max(a.y,b.y))continue;
  candidates.push({kind:'wall',key:`wall:${wall.id}`,point:target,priority:2,acquirePx:8});
 }
 if(options.grid!==false){const grid:Point2=[locked==='x'?point[0]:Math.round(point[0]/step)*step,locked==='y'?point[1]:Math.round(point[1]/step)*step];
  const candidate=(p:Point2):SnapTarget=>({kind:'grid',key:`grid:${p[0]}:${p[1]}:${step}`,point:p,priority:5,acquirePx:Math.max(4,Math.SQRT2*step*view.scale/2),gridStep:step});
  candidates.push(candidate(grid));if(options.previous?.kind==='grid'&&options.previous.gridStep===step&&fits(options.previous.point))candidates.push(candidate(options.previous.point));
 }
 const within=(target:SnapTarget,multiple:number)=>distance(target.point,point)<=250&&distance(target.point,point)*view.scale<=target.acquirePx*multiple;
 const acquired=candidates.filter(c=>within(c,1)).sort((a,b)=>a.priority-b.priority||distance(a.point,point)-distance(b.point,point)||stable(a.key,b.key));
 const prior=options.previous?candidates.find(c=>c.key===options.previous!.key):undefined,best=acquired[0];
 const target=prior&&within(prior,1.5)&&(!best||best.priority>=prior.priority)?prior:best??null;
 return {point:quantize(target?.point??point),target,gridStep:step};
}
