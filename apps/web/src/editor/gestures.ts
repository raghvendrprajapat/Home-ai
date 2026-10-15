import { screenToWorld, MIN_SCALE, MAX_SCALE } from './view2d';
import type { Point2, Viewport } from './view2d';
export type GesturePhase = 'idle' | 'pending' | 'drag' | 'pan' | 'pinch' | 'blocked';
export interface DragMotion { pointerId: number; point: Point2; delta: Point2 }
export interface GestureStep { phase: GesturePhase; view?: Viewport; drag?: DragMotion; commit?: DragMotion; tap?: Point2; cancelEdit?: boolean }
const distance = (a: Point2,b:Point2)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
/** Preserve the initial world midpoint at the moving finger midpoint, even at a zoom clamp. */
export function pinchView(view:Viewport, original:readonly [Point2,Point2], current:readonly [Point2,Point2]):Viewport {
  const initialDistance=distance(original[0],original[1]);if(initialDistance<1)return view;
  const middle:Point2=[(original[0][0]+original[1][0])/2,(original[0][1]+original[1][1])/2], anchor=screenToWorld(middle,view);
  const scale=Math.max(MIN_SCALE,Math.min(MAX_SCALE,view.scale*distance(current[0],current[1])/initialDistance));
  return {scale,x:(current[0][0]+current[1][0])/2-anchor[0]*scale,y:(current[0][1]+current[1][1])/2-anchor[1]*scale};
}
/** Pure pointer arbitration. It never calls the canonical model or owns a browser timer. */
export class PlanGestures {
  phase:GesturePhase='idle';
  private pointers=new Map<number,{point:Point2;touch:boolean}>();
  private primary=0;private start:Point2=[0,0];private at=0;private initial:Viewport={x:0,y:0,scale:1};
  private pair:readonly [number,number]|null=null;private originalPair:readonly [Point2,Point2]=[[0,0],[0,0]];
  hasTouch(){return [...this.pointers.values()].some(p=>p.touch);}
  has(id:number){return this.pointers.has(id);}
  ids(){return [...this.pointers.keys()];}
  private motion():DragMotion {const p=this.pointers.get(this.primary)!.point;return {pointerId:this.primary,point:p,delta:[p[0]-this.start[0],p[1]-this.start[1]]};}
  begin(id:number,touch:boolean,point:Point2,view:Viewport,handle:boolean,now:number):GestureStep {
    if(this.pointers.has(id))return {phase:this.phase};
    this.pointers.set(id,{point,touch});
    if(this.pointers.size>1){
      if(this.pointers.size===2&&[...this.pointers.values()].every(p=>p.touch)&&this.phase!=='blocked'){
        this.pair=this.ids() as [number,number];this.originalPair=this.pair.map(i=>this.pointers.get(i)!.point) as [Point2,Point2];this.initial=view;this.phase='pinch';
      }else this.phase='blocked';
      return {phase:this.phase,cancelEdit:true};
    }
    this.primary=id;this.start=point;this.initial=view;this.at=now;this.phase=handle?(touch?'pending':'drag'):'pan';
    return {phase:this.phase};
  }
  hold(now:number):GestureStep {
    if(this.phase==='pending'&&now-this.at>=150)this.phase='drag';
    return this.phase==='drag'?{phase:this.phase,drag:this.motion()}:{phase:this.phase};
  }
  move(id:number,point:Point2,now:number):GestureStep {
    const pointer=this.pointers.get(id);if(!pointer)return {phase:this.phase};pointer.point=point;
    if(this.phase==='pinch'&&this.pair){const current=this.pair.map(i=>this.pointers.get(i)!.point) as [Point2,Point2];return {phase:this.phase,view:pinchView(this.initial,this.originalPair,current)};}
    if(id!==this.primary||this.phase==='blocked')return {phase:this.phase};
    // Motion before the hold chooses panning; motion after it chooses editing.
    if(this.phase==='pending'){if(now-this.at>=150)this.phase='drag';else if(distance(this.start,point)>6)this.phase='pan';}
    const motion=this.motion();
    if(this.phase==='pan')return {phase:this.phase,view:{...this.initial,x:this.initial.x+motion.delta[0],y:this.initial.y+motion.delta[1]}};
    return this.phase==='drag'?{phase:this.phase,drag:motion}:{phase:this.phase};
  }
  end(id:number,point:Point2,now:number):GestureStep {
    if(!this.has(id))return {phase:this.phase};
    const step=this.move(id,point,now),phase=this.phase;
    const moved=id===this.primary?distance(this.start,point):Infinity;
    this.pointers.delete(id);this.pair=null;
    this.phase=this.pointers.size?'blocked':'idle';
    if(phase==='pinch'||phase==='blocked')return {phase:this.phase,cancelEdit:true};
    if(phase==='drag'&&moved>3&&step.drag)return {phase:this.phase,commit:step.drag};
    return {phase:this.phase,...(moved<=3?{tap:point}:{}),...(step.view?{view:step.view}:{}),cancelEdit:true};
  }
  cancel():GestureStep {this.phase=this.pointers.size?'blocked':'idle';this.pair=null;return {phase:this.phase,cancelEdit:true};}
  clear(){this.pointers.clear();this.phase='idle';this.pair=null;}
}
