import type { Command, PreviewResult, ProjectStore, ValidationIssue } from '@gharplan/core-model';
import { snapPointer } from './view2d';
import type { PlanDocument, Point2, Viewport } from './view2d';
export type DrawingMode = 'select' | 'wall' | 'rectangle';
export interface WallProperties { thickness: number; height: number }
/** L0 angle constraint, existing-junction acquisition, then one integer quantization. */
export function drawingTarget(document:PlanDocument,raw:Point2,view:Viewport,origin:Point2|null,orthogonal:boolean,disableSnap=false):Point2 {
 if(!raw.every(Number.isFinite))throw new Error('Invalid pointer coordinates.');
 const horizontal=origin&&Math.abs(raw[0]-origin[0])>=Math.abs(raw[1]-origin[1]);
 const point:Point2=orthogonal&&origin?(horizontal?[raw[0],origin[1]]:[origin[0],raw[1]]):raw;
 const candidates=orthogonal&&origin?{...document,junctions:document.junctions.filter(j=>horizontal?j.y===origin[1]:j.x===origin[0])}:document;
 if(disableSnap)return [Math.round(point[0]),Math.round(point[1])];
 const junction=candidates.junctions.map(j=>({j,distance:Math.hypot(j.x-point[0],j.y-point[1])})).filter(c=>c.distance<=250&&c.distance*view.scale<=12).sort((a,b)=>a.distance-b.distance||(a.j.id<b.j.id?-1:a.j.id>b.j.id?1:0))[0];
 if(junction)return snapPointer(candidates,point,view);
 const byId=new Map(document.junctions.map(j=>[j.id,j]));
 const wallTargets=document.walls.flatMap(w=>{
  const a=byId.get(w.a)!,b=byId.get(w.b)!,wallHorizontal=a.y===b.y;
  let target:Point2;
  if(orthogonal&&origin){if(Boolean(horizontal)===wallHorizontal)return [];target=horizontal?[a.x,origin[1]]:[origin[0],a.y];}
  else target=wallHorizontal?[Math.max(Math.min(a.x,b.x),Math.min(Math.max(a.x,b.x),point[0])),a.y]:[a.x,Math.max(Math.min(a.y,b.y),Math.min(Math.max(a.y,b.y),point[1]))];
  if(target[0]<Math.min(a.x,b.x)||target[0]>Math.max(a.x,b.x)||target[1]<Math.min(a.y,b.y)||target[1]>Math.max(a.y,b.y))return [];
  const distance=Math.hypot(target[0]-point[0],target[1]-point[1]);return distance<=250&&distance*view.scale<=8?[{id:w.id,target,distance}]:[];
 }).sort((a,b)=>a.distance-b.distance||(a.id<b.id?-1:a.id>b.id?1:0));
 const target=wallTargets[0]?.target??point;return [Math.round(target[0]),Math.round(target[1])];
}
export function drawingCommand(mode:Exclude<DrawingMode,'select'>,from:Point2,to:Point2,properties:WallProperties,generation:number):Command {
 const base={id:`draw_${crypto.randomUUID().replaceAll('-','')}`,baseGeneration:generation,...properties};
 return mode==='wall'?{...base,type:'AddWall',from,to}:{...base,type:'AddRectangle',x:Math.min(from[0],to[0]),y:Math.min(from[1],to[1]),width:Math.abs(to[0]-from[0]),depth:Math.abs(to[1]-from[1])};
}
export interface DrawingState { epoch:number; mode:DrawingMode; anchor:Point2|null; first:Point2|null; end:Point2|null; preview:PreviewResult|null; error:ValidationIssue|null; notice:'toolIdle'|'toolStarted'|'toolAdded'|'roomNamesCheck'|'dragChanged'; unresolved:Command|null }
/** Transient tool state; previews never write. All accepted segments go through ProjectStore. */
export class DrawingTool {
 private state:DrawingState={epoch:0,mode:'select',anchor:null,first:null,end:null,preview:null,error:null,notice:'toolIdle',unresolved:null};
 private listeners=new Set<()=>void>();private generation:number;private ownCommit=false;private unsubscribe:(()=>void)|null=null;
 properties:WallProperties={thickness:200,height:2700};
 constructor(private store:ProjectStore){this.generation=store.getSnapshot().localGeneration;}
 dispose(){this.unsubscribe?.();this.unsubscribe=null;this.listeners.clear();}
 getSnapshot=()=>this.state;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);const sync=()=>{const next=this.store.getSnapshot().localGeneration;if(next!==this.generation){this.generation=next;if(!this.ownCommit&&(this.state.anchor||this.state.preview||this.state.error||this.state.unresolved))this.clear(this.state.anchor||this.state.unresolved?'dragChanged':'toolIdle');}};sync();if(!this.unsubscribe)this.unsubscribe=this.store.subscribe(sync);return()=>{this.listeners.delete(listener);if(!this.listeners.size){this.unsubscribe?.();this.unsubscribe=null;}};};
 private publish(change:Partial<DrawingState>){this.state={...this.state,...change};for(const listener of this.listeners)listener();}
 clear(notice:DrawingState['notice']='toolIdle'){this.publish({epoch:this.state.epoch+1,anchor:null,first:null,end:null,preview:null,error:null,unresolved:null,notice});}
 setMode(mode:DrawingMode){this.clear();this.publish({mode});}
 start(point:Point2){if(this.state.mode==='select')return;this.publish({anchor:point,first:point,end:null,preview:null,error:null,unresolved:null,notice:'toolStarted'});}
 hover(point:Point2){if(!this.state.anchor||this.state.mode==='select')return;const command=drawingCommand(this.state.mode,this.state.anchor,point,this.properties,this.generation),preview=this.store.preview(command);this.publish({end:point,preview,error:preview.ok?null:preview.errors[0]??null});}
 point(point:Point2){if(this.state.mode==='select')return;if(!this.state.anchor){this.start(point);return;}this.commit(drawingCommand(this.state.mode,this.state.anchor,point,this.properties,this.generation));}
 rectangle(from:Point2,to:Point2){if(this.state.mode!=='rectangle')return;this.start(from);this.commit(drawingCommand('rectangle',from,to,this.properties,this.generation));}
 commit(command:Command){
  this.ownCommit=true;let result;try{result=this.store.execute(command);}finally{this.ownCommit=false;}
  if(!result.ok){this.publish({error:result.errors[0]??null,unresolved:['ambiguous-room','room-choice'].includes(result.errors[0]?.code??'')?command:null});return result;}
  this.generation=this.store.getSnapshot().localGeneration;
  const chaining=command.type==='AddWall'&&this.state.mode==='wall'&&this.state.anchor!==null;
  const end=command.type==='AddWall'?command.to:null,closed=end&&this.state.first&&end[0]===this.state.first[0]&&end[1]===this.state.first[1];
  this.publish({anchor:chaining&&!closed?end:null,first:closed||!chaining?null:this.state.first,end:null,preview:null,error:null,unresolved:null,notice:result.checkRoomNamesHint?'roomNamesCheck':'toolAdded'});return result;
 }
 resolve(roomId:string,point:Point2){const pending=this.state.unresolved;if(!pending)return;return this.commit({...pending,roomChoices:[{roomId,point}],baseGeneration:this.generation});}
}
