import { expect,it } from 'vitest';
import fc from 'fast-check';
import { createBlankProject,parseProject,ProjectStore } from '@gharplan/core-model';
import sample from '../../../../docs/examples/sample-project.json';
import { boxContains,polygonContains,segmentDistance,PickIndex,PickCycle } from './hit-test';
import { worldToScreen } from './view2d';
function demo(){const parsed=parseProject(JSON.stringify(sample));if(!parsed.ok)throw new Error('Invalid fixture');return new ProjectStore(parsed.document,'pick-tests');}
it('segment picking has analytic endpoint/perpendicular distance, direction and translation invariance',()=>{
  expect(segmentDistance([500,300],[0,0],[1000,0])).toBe(300);expect(segmentDistance([-300,400],[0,0],[1000,0])).toBe(500);expect(segmentDistance([3,4],[0,0],[0,0])).toBe(5);
  fc.assert(fc.property(fc.integer({min:1,max:100000}),fc.integer({min:-100000,max:100000}),fc.integer({min:-100000,max:100000}),(width,x,y)=>{
    const expected=x<0?Math.hypot(x,y):x>width?Math.hypot(x-width,y):Math.abs(y);
    expect(segmentDistance([x,y],[0,0],[width,0])).toBeCloseTo(expected,8);expect(segmentDistance([x+27,y-33],[width+27,-33],[27,-33])).toBeCloseTo(expected,8);
  }),{seed:20261013,numRuns:500});
});
it('rotated furniture is picked by its oriented box, including37degrees and exact boundaries',()=>{
  expect(boxContains([999,50],[0,0],100,2000,90)).toBe(true);expect(boxContains([1001,0],[0,0],100,2000,90)).toBe(false);expect(boxContains([0,51],[0,0],100,2000,90)).toBe(false);
  fc.assert(fc.property(fc.integer({min:10,max:10000}),fc.integer({min:10,max:10000}),fc.double({min:0,max:360,noNaN:true}),(width,depth,angle)=>{
    const r=angle*Math.PI/180,toWorld=(x:number,y:number):[number,number]=>[1000+x*Math.cos(r)-y*Math.sin(r),-2000+x*Math.sin(r)+y*Math.cos(r)];
    expect(boxContains(toWorld(width/2,depth/2),[1000,-2000],width,depth,angle)).toBe(true);
    expect(boxContains(toWorld(width/2+1,0),[1000,-2000],width,depth,angle)).toBe(false);
  }),{seed:20261013,numRuns:500});
});
it('clear-room polygon picking includes boundaries, concavity and reversed winding',()=>{
  const l:[[number,number],...Array<[number,number]>]=[[0,0],[4,0],[4,1],[1,1],[1,4],[0,4]];
  expect(polygonContains([3,3],l)).toBe(false);expect(polygonContains([1,3],l)).toBe(true);expect(polygonContains([0.5,3],l)).toBe(true);
  fc.assert(fc.property(fc.integer({min:1,max:10000}),fc.integer({min:1,max:10000}),fc.integer({min:-10000,max:20000}),fc.integer({min:-10000,max:20000}),(width,height,x,y)=>{
    const rectangle:[[number,number],...Array<[number,number]>]=[[0,0],[width,0],[width,height],[0,height]];
    const expected=x>=0&&x<=width&&y>=0&&y<=height;expect(polygonContains([x,y],rectangle)).toBe(expected);expect(polygonContains([x,y],[...rectangle].reverse())).toBe(expected);
  }),{seed:20261013,numRuns:500});
});
it('priority: handles then openings then topmost furniture then wall then clear room, at1x/4x and negative grid cells',()=>{
  const store=demo(),snapshot=store.getSnapshot();
  // Codex analytic synthetic overlaps: legal bounded data; no accepted fixture edited.
  const parsed=parseProject(JSON.stringify(snapshot.document));if(!parsed.ok)throw new Error('Invalid test source');const doc=parsed.document,wall=doc.walls[0]!,a=doc.junctions.find(j=>j.id===wall.a)!,b=doc.junctions.find(j=>j.id===wall.b)!,length=Math.hypot(b.x-a.x,b.y-a.y),centre:[number,number]=[a.x+(b.x-a.x)/length*1000,a.y+(b.y-a.y)/length*1000];
  doc.openings=[{...doc.openings[0]!,id:'overlap_opening',wallId:wall.id,offset:1000,width:600}];
  doc.furniture=[{...doc.furniture[0]!,id:'lower',position:{x:centre[0],y:centre[1]},size:{w:1000,d:1000,h:1000},rotationDeg:37},{...doc.furniture[0]!,id:'upper',position:{x:centre[0],y:centre[1]},size:{w:1000,d:1000,h:1000},rotationDeg:37}];
  const index=new PickIndex({...snapshot,document:doc});
  for(const scale of [0.05,0.2]){const view={x:-123,y:456,scale},picks=index.picks(worldToScreen(centre,view),view,false);expect(picks.slice(0,4)).toEqual([{kind:'opening',id:'overlap_opening'},{kind:'furniture',id:'upper'},{kind:'furniture',id:'lower'},{kind:'wall',id:wall.id}]);}
  expect(index.picks(worldToScreen([a.x,a.y],{x:0,y:0,scale:0.1}),{x:0,y:0,scale:0.1},true)[0]).toEqual({kind:'junction',id:a.id});
  const negative={...snapshot,document:{...doc,furniture:[{...doc.furniture[0]!,id:'negative',position:{x:-1500,y:-1500}}]}};
  expect(new PickIndex(negative).picks([-150,-150],{x:0,y:0,scale:0.1},false)[0]).toEqual({kind:'furniture',id:'negative'});
});
it('oversized room index fallback retains its exact clear face instead of silently omitting it',()=>{
  let id=0;const doc=createBlankProject({name:'Large analytic room',units:'metric',now:'2026-10-13T00:00:00Z',nextId:()=>`wide_${id++}`,floorName:'Floor',materialName:'Material'}),store=new ProjectStore(doc,'large-pick');
  expect(store.execute({id:'large',baseGeneration:0,type:'AddRectangle',x:-90000,y:-90000,width:180000,depth:180000,thickness:50,height:2700}).ok).toBe(true);
  const snapshot=store.getSnapshot();expect(snapshot.derived.faces[0]!.clearAreaMm2).toBe(32382002500);expect(new PickIndex(snapshot).picks([0,0],{x:0,y:0,scale:0.1},false)).toEqual([{kind:'room',id:snapshot.document.rooms[0]!.id}]);
});
it('index query matches analytic room membership across random camera positions/scales and refuses invalid viewports',()=>{
  const store=demo(),snapshot=store.getSnapshot(),index=new PickIndex(snapshot);
  fc.assert(fc.property(fc.integer({min:300,max:4000}),fc.integer({min:300,max:4500}),fc.double({min:0.001,max:1,noNaN:true}),fc.integer({min:-1000,max:1000}),(x,y,scale,offset)=>{
    const view={x:offset,y:-offset,scale},picks=index.picks(worldToScreen([x,y],view),view,false);
    expect(picks.some(p=>p.kind==='room'&&p.id==='r_living')).toBe(true);
  }),{seed:20261013,numRuns:500});
  for(const scale of [0,NaN,Infinity,0.0001,2])expect(()=>index.picks([0,0],{x:0,y:0,scale},false)).toThrow('Invalid pick viewport');
});
it('overlap cycling reaches every entity once, resets on movement/time and never returns a renderer node',()=>{
  const cycle=new PickCycle(),picks=[{kind:'junction' as const,id:'j'},{kind:'wall' as const,id:'w'},{kind:'room' as const,id:'r'}];
  expect([0,100,200,300].map(now=>cycle.next(picks,[10,10],now)?.id)).toEqual(['j','w','r','j']);expect(cycle.next(picks,[20,10],350)?.id).toBe('j');expect(cycle.next(picks,[20,10],2000)?.id).toBe('j');cycle.clear();expect(cycle.next([],[10,10],2100)).toBeNull();
  fc.assert(fc.property(fc.integer({min:1,max:30}),count=>{const c=new PickCycle(),items=Array.from({length:count},(_,i)=>({kind:'wall' as const,id:`w${i}`}));expect(Array.from({length:count},(_,i)=>c.next(items,[0,0],i*10)?.id)).toEqual(items.map(p=>p.id));}),{seed:20261013,numRuns:100});
});
