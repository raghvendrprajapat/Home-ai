import type { ProjectStore } from '@gharplan/core-model';
import { screenToWorld } from './view2d';
import type { Point2, Viewport } from './view2d';
type Snapshot=ReturnType<ProjectStore['getSnapshot']>;
export type PickKind='junction'|'opening'|'furniture'|'wall'|'room';
export interface Pick {kind:PickKind;id:string}
type Bounds=readonly [number,number,number,number];
interface Entry {pick:Pick;bounds:Bounds;order:number;test(point:Point2,padding:number):boolean}
export function segmentDistance(point:Point2,a:Point2,b:Point2):number {
  const dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;
  const t=length?Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/length)):0;
  return Math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dy);
}
export function boxContains(point:Point2,centre:Point2,width:number,depth:number,angle:number):boolean {
  const r=angle*Math.PI/180,dx=point[0]-centre[0],dy=point[1]-centre[1];
  return Math.abs(dx*Math.cos(r)+dy*Math.sin(r))<=width/2+1e-8&&Math.abs(-dx*Math.sin(r)+dy*Math.cos(r))<=depth/2+1e-8;
}
export function polygonContains(point:Point2,polygon:readonly Point2[]):boolean {
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[i]!,b=polygon[j]!;
    if(segmentDistance(point,a,b)<1e-8)return true;
    if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
/** Generation-owned 1m hash. Oversized bounds use a full candidate fallback, never disappear. */
export class PickIndex {
  private cells=new Map<string,Entry[]>();private broad:Entry[]=[];
  readonly generation:number;readonly projectId:string;
  constructor(snapshot:Snapshot){
    this.generation=snapshot.localGeneration;this.projectId=snapshot.document.id;
    const doc=snapshot.document,junctions=new Map(doc.junctions.map(j=>[j.id,j]));let totalCells=0;
    const add=(entry:Entry)=>{
      const [left,top,right,bottom]=entry.bounds.map(n=>Math.floor(n/1000)) as [number,number,number,number],count=(right-left+1)*(bottom-top+1);
      if(count>4096||totalCells+count>100000){this.broad.push(entry);return;}totalCells+=count;
      for(let x=left;x<=right;x++)for(let y=top;y<=bottom;y++){const key=`${x}:${y}`,list=this.cells.get(key)??[];list.push(entry);this.cells.set(key,list);}
    };
    for(const j of doc.junctions)add({pick:{kind:'junction',id:j.id},order:0,bounds:[j.x,j.y,j.x,j.y],test:(p,padding)=>Math.hypot(p[0]-j.x,p[1]-j.y)<=padding});
    for(const [i,o] of doc.openings.entries()){
      const wall=doc.walls.find(w=>w.id===o.wallId)!,a=junctions.get(wall.a)!,b=junctions.get(wall.b)!,length=Math.hypot(b.x-a.x,b.y-a.y),dx=(b.x-a.x)/length,dy=(b.y-a.y)/length;
      const centre:Point2=[a.x+dx*o.offset,a.y+dy*o.offset],horizontal=a.y===b.y,width=horizontal?o.width:wall.thickness,depth=horizontal?wall.thickness:o.width;
      add({pick:{kind:'opening',id:o.id},order:-i,bounds:[centre[0]-width/2,centre[1]-depth/2,centre[0]+width/2,centre[1]+depth/2],test:p=>boxContains(p,centre,width,depth,0)});
    }
    for(const [i,f] of doc.furniture.entries()){
      const r=f.rotationDeg*Math.PI/180,halfX=(Math.abs(Math.cos(r))*f.size.w+Math.abs(Math.sin(r))*f.size.d)/2,halfY=(Math.abs(Math.sin(r))*f.size.w+Math.abs(Math.cos(r))*f.size.d)/2;
      add({pick:{kind:'furniture',id:f.id},order:-i,bounds:[f.position.x-halfX,f.position.y-halfY,f.position.x+halfX,f.position.y+halfY],test:p=>boxContains(p,[f.position.x,f.position.y],f.size.w,f.size.d,f.rotationDeg)});
    }
    for(const wall of doc.walls){const a=junctions.get(wall.a)!,b=junctions.get(wall.b)!,half=wall.thickness/2;
      add({pick:{kind:'wall',id:wall.id},order:0,bounds:[Math.min(a.x,b.x)-half,Math.min(a.y,b.y)-half,Math.max(a.x,b.x)+half,Math.max(a.y,b.y)+half],test:(p,padding)=>segmentDistance(p,[a.x,a.y],[b.x,b.y])<=half+padding});}
    for(const face of snapshot.derived.faces){const polygons=face.clearPolygons,points=polygons.flat();
      add({pick:{kind:'room',id:face.roomId},order:0,bounds:[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))],test:p=>polygons.some(polygon=>polygonContains(p,polygon))});}
  }
  picks(screen:Point2,view:Viewport,touch:boolean):Pick[]{
    if(!Number.isFinite(view.scale)||view.scale<0.001||view.scale>1||!screen.every(Number.isFinite)||![view.x,view.y].every(Number.isFinite))throw new Error('Invalid pick viewport.');
    const p=screenToWorld(screen,view),radius=(touch?24:14)/view.scale,candidates=new Set(this.broad);
    const left=Math.floor((p[0]-radius)/1000),right=Math.floor((p[0]+radius)/1000),top=Math.floor((p[1]-radius)/1000),bottom=Math.floor((p[1]+radius)/1000);
    for(let x=left;x<=right;x++)for(let y=top;y<=bottom;y++)for(const entry of this.cells.get(`${x}:${y}`)??[])candidates.add(entry);
    const rank:Record<PickKind,number>={junction:0,opening:1,furniture:2,wall:3,room:4};
    return [...candidates].filter(e=>e.test(p,e.pick.kind==='junction'?radius:4/view.scale)).sort((a,b)=>rank[a.pick.kind]-rank[b.pick.kind]||(a.pick.kind==='junction'&&b.pick.kind==='junction'?Math.hypot(p[0]-a.bounds[0],p[1]-a.bounds[1])-Math.hypot(p[0]-b.bounds[0],p[1]-b.bounds[1]):0)||a.order-b.order||(a.pick.id<b.pick.id?-1:a.pick.id>b.pick.id?1:0)).map(e=>e.pick);
  }
}
export class PickCycle {
  private signature='';private point:Point2=[Infinity,Infinity];private at=-Infinity;private index=-1;
  next(picks:readonly Pick[],point:Point2,now:number):Pick|null {
    const signature=picks.map(p=>`${p.kind}:${p.id}`).join('|');
    const repeat=signature===this.signature&&now-this.at<=1000&&Math.hypot(point[0]-this.point[0],point[1]-this.point[1])<=4;
    this.index=repeat?(this.index+1)%Math.max(1,picks.length):0;this.signature=signature;this.point=point;this.at=now;return picks[this.index]??null;
  }
  clear(){this.signature='';this.at=-Infinity;this.index=-1;}
}
