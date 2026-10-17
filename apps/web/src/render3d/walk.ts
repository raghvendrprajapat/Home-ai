import type {ProjectStore} from '@gharplan/core-model';
import type {Vec3} from './camera';
type Snapshot=ReturnType<ProjectStore['getSnapshot']>;
type Doc=Snapshot['document'];
/** Axis-aligned plan rectangle in integer-or-float mm: [minX,minY,maxX,maxY]. */
export type Rect=readonly [number,number,number,number];
export type Vec2=readonly [number,number];

/** FR-026 / §F.7. All lengths are plan millimetres; angles are radians, yaw clockwise from plan north. */
export const WALK={
 radius:250,              // capsule radius (adjustable later)
 eye:1600,eyeMin:1000,eyeMax:2000,eyeStep:100,
 head:1800,               // a door must clear this height
 doorMargin:50,           // passage width >= 2 x radius + margin
 speed:1400,              // mm per second
 turnRate:Math.PI*0.8,    // rad per second for keyboard/joystick turning
 lookSensitivity:0.004,   // rad per pixel of drag
 maxPitch:80*Math.PI/180,
 maxFrameMs:250,          // a longer stall advances only this much time
} as const;

export interface WalkWorld {rects:readonly Rect[];limit:Rect}
export interface WalkState {x:number;y:number;yaw:number;pitch:number;eye:number}
/** forward/strafe/turn are -1..1; lookX/lookY are drag pixels since the last frame; eyeStep is -1, 0 or 1 presses. */
export interface WalkInput {forward:number;strafe:number;turn:number;lookX:number;lookY:number;eyeStep:number}
export const NO_INPUT:WalkInput={forward:0,strafe:0,turn:0,lookX:0,lookY:0,eyeStep:0};

const clamp=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v));
const finite=(...v:number[])=>v.every(Number.isFinite);

/** A door or archway is a passage only if the capsule fits through and clears the lintel. Windows never are. */
export function isPassage(o:Doc['openings'][number]):boolean {
 return o.kind!=='window'&&o.sill===0&&o.height>=WALK.head&&o.width>=2*WALK.radius+WALK.doorMargin;
}

/**
 * Collision obstacles are the derived wall footprint pieces. Each passable opening cuts a gap of
 * exactly its width out of the footprint pieces of its host wall; every other opening stays solid.
 */
export function buildWalkWorld(doc:Doc,footprints:readonly {ownerId:string;rect:Rect}[]):WalkWorld {
 const junction=new Map(doc.junctions.map(j=>[j.id,j])),gaps=new Map<string,{axis:0|1;lo:number;hi:number}[]>();
 for(const o of doc.openings){
  if(!isPassage(o))continue;const wall=doc.walls.find(w=>w.id===o.wallId),a=wall&&junction.get(wall.a),b=wall&&junction.get(wall.b);if(!wall||!a||!b)continue;
  const axis:0|1=a.y===b.y?0:1,start=axis===0?a.x:a.y,end=axis===0?b.x:b.y,centre=start+Math.sign(end-start)*o.offset;
  gaps.set(wall.id,[...(gaps.get(wall.id)??[]),{axis,lo:centre-o.width/2,hi:centre+o.width/2}]);
 }
 const rects:Rect[]=[];
 for(const piece of footprints){
  let parts:Rect[]=[piece.rect];
  for(const gap of gaps.get(piece.ownerId)??[]){
   const next:Rect[]=[];
   for(const r of parts){
    const lo=gap.axis===0?r[0]:r[1],hi=gap.axis===0?r[2]:r[3];
    if(gap.hi<=lo||gap.lo>=hi){next.push(r);continue;}
    if(gap.lo>lo)next.push(gap.axis===0?[r[0],r[1],gap.lo,r[3]]:[r[0],r[1],r[2],gap.lo]);
    if(gap.hi<hi)next.push(gap.axis===0?[gap.hi,r[1],r[2],r[3]]:[r[0],gap.hi,r[2],r[3]]);
   }
   parts=next;
  }
  rects.push(...parts);
 }
 const xs=footprints.flatMap(f=>[f.rect[0],f.rect[2]]),ys=footprints.flatMap(f=>[f.rect[1],f.rect[3]]),pad=5000;
 const limit:Rect=xs.length?[Math.min(...xs)-pad,Math.min(...ys)-pad,Math.max(...xs)+pad,Math.max(...ys)+pad]:[-pad,-pad,pad,pad];
 return {rects,limit};
}

/** Push a circle out of every overlapping rectangle (touching is allowed). */
function resolve(world:WalkWorld,x:number,y:number,r:number):Vec2 {
 for(let pass=0;pass<8;pass++){
  let moved=false;
  for(const [x0,y0,x1,y1] of world.rects){
   if(x<x0-r||x>x1+r||y<y0-r||y>y1+r)continue;
   const cx=clamp(x,x0,x1),cy=clamp(y,y0,y1),dx=x-cx,dy=y-cy,d2=dx*dx+dy*dy;
   if(d2>=r*r-1e-6)continue;
   if(d2>1e-12){const d=Math.sqrt(d2);x=cx+dx/d*r;y=cy+dy/d*r;}
   else{ // centre inside the rectangle: leave through the nearest face
    const m=Math.min(x-x0,x1-x,y-y0,y1-y);
    if(m===x-x0)x=x0-r;else if(m===x1-x)x=x1+r;else if(m===y-y0)y=y0-r;else y=y1+r;
   }
   moved=true;
  }
  if(!moved)break;
 }
 const [lx0,ly0,lx1,ly1]=world.limit;return [clamp(x,lx0,lx1),clamp(y,ly0,ly1)];
}

/**
 * Swept circle motion. The path is cut into sub-steps no longer than half the radius, so a circle can
 * never jump over a wall of any thickness, however long the frame. Sliding along walls falls out of the push-out.
 */
export function moveCircle(world:WalkWorld,from:Vec2,delta:Vec2,radius:number=WALK.radius):Vec2 {
 if(!finite(from[0],from[1],delta[0],delta[1],radius)||radius<=0)throw new Error('walk-input');
 const steps=Math.max(1,Math.ceil(Math.hypot(delta[0],delta[1])/(radius/2)));
 let x=from[0],y=from[1];
 for(let i=0;i<steps;i++){[x,y]=resolve(world,x+delta[0]/steps,y+delta[1]/steps,radius);}
 return [x,y];
}

/** Advance one frame. A frame longer than maxFrameMs only advances maxFrameMs of walking. */
export function advance(state:WalkState,input:WalkInput,dtMs:number,world:WalkWorld):WalkState {
 if(!finite(state.x,state.y,state.yaw,state.pitch,state.eye,dtMs,input.forward,input.strafe,input.turn,input.lookX,input.lookY,input.eyeStep))throw new Error('walk-input');
 const dt=clamp(dtMs,0,WALK.maxFrameMs)/1000;
 const yaw=state.yaw+(clamp(input.turn,-1,1)*WALK.turnRate*dt+input.lookX*WALK.lookSensitivity),pitch=clamp(state.pitch-input.lookY*WALK.lookSensitivity,-WALK.maxPitch,WALK.maxPitch);
 let f=clamp(input.forward,-1,1),s=clamp(input.strafe,-1,1);const length=Math.hypot(f,s);if(length>1){f/=length;s/=length;}
 // Forward is (sin yaw, -cos yaw); right is (cos yaw, sin yaw), in plan axes (X east, Y south).
 const distance=WALK.speed*dt,dx=(Math.sin(yaw)*f+Math.cos(yaw)*s)*distance,dy=(-Math.cos(yaw)*f+Math.sin(yaw)*s)*distance;
 const [x,y]=moveCircle(world,[state.x,state.y],[dx,dy]);
 return {x,y,yaw:((yaw%(2*Math.PI))+2*Math.PI)%(2*Math.PI),pitch,eye:clamp(state.eye+Math.sign(input.eyeStep)*WALK.eyeStep,WALK.eyeMin,WALK.eyeMax)};
}

/** Transient Three pose in metres: plan (x,y) -> Three (x,z), eye above the floor, looking along yaw/pitch. */
export function walkPose(state:WalkState,floorElevationMm:number):{position:Vec3;target:Vec3} {
 const position:Vec3=[state.x/1000,(floorElevationMm+state.eye)/1000,state.y/1000],c=Math.cos(state.pitch);
 return {position,target:[position[0]+Math.sin(state.yaw)*c,position[1]+Math.sin(state.pitch),position[2]-Math.cos(state.yaw)*c]};
}

/** Start in the middle of the largest room, facing plan north. Null when nothing can be walked yet. */
export function walkStart(snapshot:Snapshot,world:WalkWorld):WalkState|null {
 let best:Rect|null=null,area=0;
 for(const face of snapshot.derived.faces)for(const r of face.clearRects){const a=(r[2]-r[0])*(r[3]-r[1]);if(a>area){area=a;best=r as Rect;}}
 if(!best)return null;
 const [x,y]=moveCircle(world,[(best[0]+best[2])/2,(best[1]+best[3])/2],[0,0]);
 return {x,y,yaw:0,pitch:0,eye:WALK.eye};
}
