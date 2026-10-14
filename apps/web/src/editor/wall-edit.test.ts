import {expect,it} from 'vitest';
import fc from 'fast-check';
import {createBlankProject,ProjectStore} from '@gharplan/core-model';
import {wallLengthCommand} from './wall-edit';
function setup(){let n=0;const store=new ProjectStore(createBlankProject({name:'Codex wall precision',units:'metric',now:'2026-10-14T00:00:00Z',nextId:()=>`length_test_${n++}`}), 'wall_edit');expect(store.execute({id:'rectangle',baseGeneration:0,type:'AddRectangle',x:0,y:0,width:4000,depth:3000,thickness:200,height:2700}).ok).toBe(true);return store;}
it('GEO-002 type3450 stores exact centreline3450 and linked rectangle clear area; preview/undo stay atomic',()=>{
 const store=setup(),before=store.getSnapshot(),wall=before.document.walls.find(w=>{const a=before.document.junctions.find(j=>j.id===w.a)!,b=before.document.junctions.find(j=>j.id===w.b)!;return a.y===0&&b.y===0;})!;
 const command=wallLengthCommand(before.document,wall.id,3450,'b',1);expect(store.preview(command).ok).toBe(true);expect(store.getSnapshot()).toBe(before);expect(store.execute(command).ok).toBe(true);expect(store.getSnapshot().derived.faces[0]!.clearAreaMm2).toBe(9100000);expect(store.getSnapshot().document.rooms[0]!.id).toBe(before.document.rooms[0]!.id);expect(store.undo()).toBe(true);expect(store.getSnapshot().document).toEqual(before.document);
});
it('GEO-004 endpoint groups stay joined with exact requested length for both orientations and chosen ends',()=>{
 fc.assert(fc.property(fc.integer({min:1000,max:6000}),fc.constantFrom('a','b','both') ,fc.boolean(),(requested,end,reverse)=>{
  const store=setup();let before=store.getSnapshot(),wall=before.document.walls[0]!;
  if(reverse){expect(store.execute({id:'reverse',baseGeneration:1,type:'ReverseWall',wallId:wall.id}).ok).toBe(true);before=store.getSnapshot();wall=before.document.walls[0]!;}
  const length=end==='both'?requested-requested%2:requested,oldA=before.document.junctions.find(j=>j.id===wall.a)!,oldB=before.document.junctions.find(j=>j.id===wall.b)!;
  const command=wallLengthCommand(before.document,wall.id,length,end,before.localGeneration);expect(store.execute(command).ok).toBe(true);const after=store.getSnapshot(),a=after.document.junctions.find(j=>j.id===wall.a)!,b=after.document.junctions.find(j=>j.id===wall.b)!;
  expect(Math.abs(a.x-b.x)+Math.abs(a.y-b.y)).toBe(length);if(end==='a')expect([b.x,b.y]).toEqual([oldB.x,oldB.y]);if(end==='b')expect([a.x,a.y]).toEqual([oldA.x,oldA.y]);if(end==='both')expect([a.x+b.x,a.y+b.y]).toEqual([oldA.x+oldB.x,oldA.y+oldB.y]);expect(store.undo()).toBe(true);expect(store.getSnapshot().document).toEqual(before.document);
 }),{seed:20261014,numRuns:100});
});
it('odd symmetric shifts and invalid lengths reject instead of inventing fractional canonical coordinates',()=>{
 const store=setup(),before=store.getSnapshot(),wall=before.document.walls[0]!;
 for(const length of [0,9,NaN,Infinity,200001,3450.4])expect(()=>wallLengthCommand(before.document,wall.id,length,'b',1)).toThrow();expect(()=>wallLengthCommand(before.document,wall.id,3451,'both',1)).toThrow('symmetric-integer');expect(store.getSnapshot()).toBe(before);
});
it('vertical normal/reversed endpoint choices preserve analytic area and exact undo',()=>{
 for(const reverse of [false,true])for(const end of ['a','b','both'] as const){const store=setup();let before=store.getSnapshot();const id=before.document.walls.find(w=>{const a=before.document.junctions.find(j=>j.id===w.a)!,b=before.document.junctions.find(j=>j.id===w.b)!;return a.x===b.x;})!.id;
  if(reverse){expect(store.execute({id:'reverse_vertical',baseGeneration:1,type:'ReverseWall',wallId:id}).ok).toBe(true);before=store.getSnapshot();}
  expect(store.execute(wallLengthCommand(before.document,id,3450,end,before.localGeneration)).ok).toBe(true);expect(store.getSnapshot().derived.faces[0]!.clearAreaMm2).toBe(12350000);expect(store.undo()).toBe(true);expect(store.getSnapshot().document).toEqual(before.document);
 }
});
it('shortening below a hosted door interval rejects preview and command without deleting the opening or adding history',()=>{
 const store=setup(),id=store.getSnapshot().document.walls[0]!.id;expect(store.execute({id:'door_guard',baseGeneration:1,type:'AddOpening',opening:{id:'precision_door',wallId:id,kind:'door',assetId:'door_asset',offset:3000,width:600,height:2100,sill:0,flipX:false,flipY:false}}).ok).toBe(true);const before=store.getSnapshot(),command=wallLengthCommand(before.document,id,3200,'b',2);
 expect(store.preview(command).ok).toBe(false);expect(store.execute(command).ok).toBe(false);expect(store.getSnapshot()).toBe(before);expect(store.getSnapshot().document.openings).toHaveLength(1);expect(store.undo()).toBe(true);expect(store.getSnapshot().document.openings).toHaveLength(0);expect(store.getSnapshot().document.walls).toHaveLength(4);
});
