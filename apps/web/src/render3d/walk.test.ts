import {describe,expect,it} from 'vitest';
import fc from 'fast-check';
import {ProjectStore} from '@gharplan/core-model';
import type {ProjectDoc} from '@gharplan/core-model';
import sample from '../../../../docs/examples/sample-project.json';
import {advance,buildWalkWorld,isPassage,moveCircle,NO_INPUT,walkPose,walkStart,WALK} from './walk';
import type {WalkState,WalkWorld} from './walk';

// FR-026 walk mode. Claude-authored analytic/property tests (not independent fixtures); REN-002.
// H.6 geometry: outer walls 230 mm (half 115), partition w7 at x=4500 is 115 mm (faces x 4442.5..4557.5).
// Capsule radius 250: a centre can reach a wall face no closer than 250 mm.
const R=WALK.radius,STEPS=[16,33,250];
const open:WalkWorld={rects:[],limit:[-1e6,-1e6,1e6,1e6]};
function worldOf(mutate:(doc:ProjectDoc)=>void=()=>{}){
 const doc=structuredClone(sample) as ProjectDoc;mutate(doc);const snap=new ProjectStore(doc,'walk_test').getSnapshot();
 return {snap,world:buildWalkWorld(snap.document,snap.derived.footprints)};
}
const at=(x:number,y:number,yaw:number):WalkState=>({x,y,yaw,pitch:0,eye:WALK.eye});
function run(world:WalkWorld,start:WalkState,forward:number,dt:number,frames:number,strafe=0){
 let s=start;const path=[s];for(let i=0;i<frames;i++){s=advance(s,{...NO_INPUT,forward,strafe},dt,world);path.push(s);}return path;
}
const EAST=Math.PI/2,NORTH=0,SOUTH=Math.PI;

describe('FR-026 walk collision (REN-002)',()=>{
 it('a 50 mm wall is never crossed at 16, 33 or 250 ms frames; the centre stops exactly one radius from the face',()=>{
  const thin:WalkWorld={rects:[[4975,-5000,5025,5000]],limit:[-9000,-9000,9000,9000]};
  for(const dt of STEPS){
   const path=run(thin,at(0,0,EAST),1,dt,400);
   for(const p of path)expect(p.x).toBeLessThanOrEqual(4975-R+1e-6);
   expect(path.at(-1)!.x).toBeCloseTo(4975-R,6);expect(path.at(-1)!.y).toBeCloseTo(0,9);
  }
 });
 it('a long stall cannot tunnel: sub-steps cover any single move, and a frame is capped at 250 ms',()=>{
  const thin:WalkWorld={rects:[[4975,-5000,5025,5000]],limit:[-9000,-9000,9000,9000]};
  const [x]=moveCircle(thin,[4000,0],[20000,0]);expect(x).toBeCloseTo(4725,6);
  expect(advance(at(0,0,EAST),{...NO_INPUT,forward:1},10_000,open).x).toBeCloseTo(WALK.speed*0.25,6);
 });
 it('walking diagonally into a wall slides along it',()=>{
  // The wall is much longer than any simulated path (300 frames of 250 ms is about 74 m northward), so no end is reachable.
  const wall:WalkWorld={rects:[[4975,-1e6,5025,1e6]],limit:[-9000,-2e6,9000,2e6]};
  for(const dt of STEPS){const path=run(wall,at(0,0,Math.PI/4),1,dt,300);
   expect(path.at(-1)!.x).toBeCloseTo(4725,6);for(let i=1;i<path.length;i++)expect(path[i]!.y).toBeLessThanOrEqual(path[i-1]!.y+1e-9);expect(path.at(-1)!.y).toBeLessThan(-1000);}
 });
 it('exterior and interior sample walls block at their exact analytic stop lines; windows never pass',()=>{
  const {world}=worldOf();
  // Interior partition face is x=4442.5 on the living side: centre stops at 4192.5. y=3000 has no door.
  for(const dt of STEPS)expect(run(world,at(2000,3000,EAST),1,dt,400).at(-1)!.x).toBeCloseTo(4442.5-R,6);
  // Top wall inner face y=115 -> 365. x=2250 is the middle of the 1500 mm living window: still a wall.
  for(const dt of STEPS)expect(run(world,at(2250,2000,NORTH),1,dt,400).at(-1)!.y).toBeCloseTo(115+R,6);
  // Bottom wall inner face y=4885 -> 4635. x=1000 is away from the main door.
  for(const dt of STEPS)expect(run(world,at(1000,3000,SOUTH),1,dt,400).at(-1)!.y).toBeCloseTo(4885-R,6);
 });
 it('a 900 mm bedroom door and the 1000 mm main door are passages at every frame size',()=>{
  const {world}=worldOf();
  // Bedroom door: wall w7 from j2 (4500,0), offset 1000, width 900 -> gap y 550..1450, centre y=1000.
  for(const dt of STEPS){const end=run(world,at(2000,1000,EAST),1,dt,400).at(-1)!;expect(end.x).toBeGreaterThan(4557.5+R);}
  // Main door: wall w5 from j5 (4500,5000) toward j6 (0,5000), offset 1500, width 1000 -> gap x 2500..3500, centre 3000.
  for(const dt of STEPS){const end=run(world,at(3000,3000,SOUTH),1,dt,400).at(-1)!;expect(end.y).toBeGreaterThan(5000+115+R);}
 });
 it('a door narrower than 2 x radius + 50 mm, a low lintel, and a raised sill are not passages',()=>{
  expect(WALK.radius*2+WALK.doorMargin).toBe(550);
  const door=(doc:ProjectDoc)=>doc.openings.find(o=>o.id==='o_bed_door')!;
  const blocked=4442.5-R;
  for(const [label,mutate,passes] of [
   ['540 mm wide',(d:ProjectDoc)=>{door(d).width=540;},false],
   ['550 mm wide',(d:ProjectDoc)=>{door(d).width=550;},true],
   ['height 1799',(d:ProjectDoc)=>{door(d).height=1799;},false],
   ['height 1800',(d:ProjectDoc)=>{door(d).height=1800;},true],
  ] as const){
   const {world,snap}=worldOf(mutate);const o=door(snap.document as ProjectDoc);expect(isPassage(o),label).toBe(passes);
   for(const dt of STEPS){const end=run(world,at(2000,1000,EAST),1,dt,400).at(-1)!;
    if(passes)expect(end.x,label).toBeGreaterThan(4557.5+R);else expect(end.x,label).toBeCloseTo(blocked,6);}
  }
 });
 it('windows and openings with a sill are never passages',()=>{
  const {snap}=worldOf();const window=snap.document.openings.find(o=>o.kind==='window')!;
  expect(isPassage(window)).toBe(false);expect(isPassage({...window,kind:'opening',sill:100,height:2100,width:1000} as never)).toBe(false);
  expect(isPassage({...window,kind:'opening',sill:0,height:2100,width:1000} as never)).toBe(true);
 });
 it('property: random walking in a closed 10 m x 6 m room never leaves the clear area at any frame size',()=>{
  const room:WalkWorld={rects:[[-115,-115,10115,115],[-115,5885,10115,6115],[-115,-115,115,6115],[9885,-115,10115,6115]],limit:[-9000,-9000,19000,15000]};
  fc.assert(fc.property(fc.array(fc.record({f:fc.integer({min:-1,max:1}),s:fc.integer({min:-1,max:1}),t:fc.integer({min:-1,max:1}),dt:fc.constantFrom(16,33,250)}),{minLength:50,maxLength:300}),moves=>{
   let s=at(5000,3000,0);
   for(const m of moves){s=advance(s,{...NO_INPUT,forward:m.f,strafe:m.s,turn:m.t},m.dt,room);
    expect(s.x).toBeGreaterThanOrEqual(115+R-1e-6);expect(s.x).toBeLessThanOrEqual(9885-R+1e-6);expect(s.y).toBeGreaterThanOrEqual(115+R-1e-6);expect(s.y).toBeLessThanOrEqual(5885-R+1e-6);}
  }),{seed:20261017,numRuns:200});
 });
 it('a start inside a wall is pushed out through the nearest face',()=>{
  const wall:WalkWorld={rects:[[0,0,1000,100]],limit:[-9000,-9000,9000,9000]};
  const [x,y]=moveCircle(wall,[500,30],[0,0]);expect(x).toBeCloseTo(500,9);expect(y).toBeCloseTo(-R,9);
 });
 it('invalid numbers are rejected rather than moving the camera',()=>{
  expect(()=>moveCircle(open,[Number.NaN,0],[1,1])).toThrow();expect(()=>advance(at(0,0,0),{...NO_INPUT,forward:Number.NaN},16,open)).toThrow();expect(()=>advance(at(0,0,0),NO_INPUT,Number.POSITIVE_INFINITY,open)).toThrow();
 });
});

describe('FR-026 walk controller and camera pose',()=>{
 it('forward is plan north at yaw 0 and east at yaw 90; right strafes follow',()=>{
  const dt=100,d=WALK.speed*dt/1000;
  const a=advance(at(0,0,NORTH),{...NO_INPUT,forward:1},dt,open);expect([a.x,a.y]).toEqual([expect.closeTo(0,9),expect.closeTo(-d,9)]);
  const b=advance(at(0,0,EAST),{...NO_INPUT,forward:1},dt,open);expect([b.x,b.y]).toEqual([expect.closeTo(d,9),expect.closeTo(0,9)]);
  const c=advance(at(0,0,NORTH),{...NO_INPUT,strafe:1},dt,open);expect([c.x,c.y]).toEqual([expect.closeTo(d,9),expect.closeTo(0,9)]);
  const e=advance(at(0,0,EAST),{...NO_INPUT,strafe:1},dt,open);expect([e.x,e.y]).toEqual([expect.closeTo(0,9),expect.closeTo(d,9)]);
 });
 it('diagonal input is normalised so it is not faster than straight walking',()=>{
  const s=advance(at(0,0,NORTH),{...NO_INPUT,forward:1,strafe:1},100,open);expect(Math.hypot(s.x,s.y)).toBeCloseTo(WALK.speed*0.1,6);
 });
 it('looking clamps pitch to 80 degrees, wraps yaw into 0..2pi, and keyboard turning is rate based',()=>{
  const up=advance(at(0,0,0),{...NO_INPUT,lookY:-1e6},16,open);expect(up.pitch).toBeCloseTo(WALK.maxPitch,9);
  const down=advance(at(0,0,0),{...NO_INPUT,lookY:1e6},16,open);expect(down.pitch).toBeCloseTo(-WALK.maxPitch,9);
  const turned=advance(at(0,0,0.01),{...NO_INPUT,lookX:-10},16,open);expect(turned.yaw).toBeGreaterThanOrEqual(0);expect(turned.yaw).toBeLessThan(2*Math.PI);
  expect(advance(at(0,0,0),{...NO_INPUT,turn:1},100,open).yaw).toBeCloseTo(WALK.turnRate*0.1,9);
 });
 it('eye height steps by 100 mm and stays within 1000..2000 mm',()=>{
  let s=at(0,0,0);for(let i=0;i<20;i++)s=advance(s,{...NO_INPUT,eyeStep:1},16,open);expect(s.eye).toBe(2000);
  for(let i=0;i<20;i++)s=advance(s,{...NO_INPUT,eyeStep:-1},16,open);expect(s.eye).toBe(1000);
 });
 it('the camera pose maps plan axes to Three axes: eye above the floor, yaw 0 looks along -Z, yaw 90 along +X',()=>{
  const p=walkPose({x:2000,y:3000,yaw:0,pitch:0,eye:1600},150);
  expect(p.position).toEqual([2,1.75,3]);expect(p.target[0]).toBeCloseTo(2,9);expect(p.target[1]).toBeCloseTo(1.75,9);expect(p.target[2]).toBeCloseTo(2,9);
  const q=walkPose({x:0,y:0,yaw:EAST,pitch:0,eye:1600},0);expect(q.target[0]).toBeCloseTo(1,9);expect(q.target[2]).toBeCloseTo(0,9);
  const t=walkPose({x:0,y:0,yaw:0,pitch:WALK.maxPitch,eye:1600},0);expect(t.target[1]-t.position[1]).toBeCloseTo(Math.sin(WALK.maxPitch),9);
 });
 it('walking starts in the middle of the largest room (sample living clear area), facing north, with the standard eye height',()=>{
  const {snap,world}=worldOf();
  // Living clear rectangle x 115..4442.5, y 115..4885 is the larger room: centre (2278.75, 2500).
  const s=walkStart(snap,world)!;expect(s.x).toBeCloseTo(2278.75,6);expect(s.y).toBeCloseTo(2500,6);expect([s.yaw,s.pitch,s.eye]).toEqual([0,0,1600]);
  const empty=new ProjectStore({...(structuredClone(sample) as ProjectDoc),rooms:[],walls:[],junctions:[],openings:[],furniture:[]},'walk_empty').getSnapshot();
  expect(walkStart(empty,buildWalkWorld(empty.document,empty.derived.footprints))).toBeNull();
 });
});
