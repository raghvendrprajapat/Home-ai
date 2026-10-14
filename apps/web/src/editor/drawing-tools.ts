import type { Command, PreviewResult, ProjectStore, ValidationIssue } from '@gharplan/core-model';
import { resolveSnap } from './snapping';
import type { PlanDocument, Point2, Viewport } from './view2d';
export type DrawingMode = 'select' | 'wall' | 'rectangle';
export interface WallProperties { thickness: number; height: number }
/** L0 angle constraint, existing-junction acquisition, then one integer quantization. */
export function drawingTarget(document:PlanDocument,raw:Point2,view:Viewport,origin:Point2|null,orthogonal:boolean,disableSnap=false):Point2 {
 return resolveSnap(document,raw,view,{origin,orthogonal,disabled:disableSnap}).point;
}
export function drawingCommand(mode:Exclude<DrawingMode,'select'>,from:Point2,to:Point2,properties:WallProperties,generation:number):Command {
 const base={id:`draw_${crypto.randomUUID().replaceAll('-','')}`,baseGeneration:generation,...properties};
 return mode==='wall'?{...base,type:'AddWall',from,to}:{...base,type:'AddRectangle',x:Math.min(from[0],to[0]),y:Math.min(from[1],to[1]),width:Math.abs(to[0]-from[0]),depth:Math.abs(to[1]-from[1])};
}
export interface DrawingState { snappingEnabled:boolean; epoch:number; mode:DrawingMode; anchor:Point2|null; first:Point2|null; end:Point2|null; preview:PreviewResult|null; error:ValidationIssue|null; notice:'toolIdle'|'toolStarted'|'toolAdded'|'roomNamesCheck'|'dragChanged'; unresolved:Command|null }
/** Transient tool state; previews never write. All accepted segments go through ProjectStore. */
export class DrawingTool {
 private state:DrawingState={snappingEnabled:true,epoch:0,mode:'select',anchor:null,first:null,end:null,preview:null,error:null,notice:'toolIdle',unresolved:null};
 private listeners=new Set<()=>void>();private generation:number;private ownCommit=false;private unsubscribe:(()=>void)|null=null;
 properties:WallProperties={thickness:200,height:2700};
 constructor(private store:ProjectStore){this.generation=store.getSnapshot().localGeneration;}
 dispose(){this.unsubscribe?.();this.unsubscribe=null;this.listeners.clear();}
 getSnapshot=()=>this.state;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);const sync=()=>{const next=this.store.getSnapshot().localGeneration;if(next!==this.generation){this.generation=next;if(!this.ownCommit&&(this.state.anchor||this.state.preview||this.state.error||this.state.unresolved))this.clear(this.state.anchor||this.state.unresolved?'dragChanged':'toolIdle');}};sync();if(!this.unsubscribe)this.unsubscribe=this.store.subscribe(sync);return()=>{this.listeners.delete(listener);if(!this.listeners.size){this.unsubscribe?.();this.unsubscribe=null;}};};
 private publish(change:Partial<DrawingState>){this.state={...this.state,...change};for(const listener of this.listeners)listener();}
 clear(notice:DrawingState['notice']='toolIdle'){this.publish({epoch:this.state.epoch+1,anchor:null,first:null,end:null,preview:null,error:null,unresolved:null,notice});}
 setSnapping(enabled:boolean){this.clear();this.publish({snappingEnabled:enabled});}
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
