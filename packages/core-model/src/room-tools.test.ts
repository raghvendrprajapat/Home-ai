import { expect, it } from 'vitest';
import fc from 'fast-check';
import sample from '../../../docs/examples/sample-project.json';
import { createBlankProject, parseProject, ProjectStore, serializeProject } from './index';
function blank() { let n=0;return new ProjectStore(createBlankProject({name:'Codex room tools',units:'metric',now:'2026-10-13T00:00:00Z',nextId:()=>`tools_${n++}`}), 'room_tools', {now:()=> '2026-10-13T00:00:00Z'}); }
function rectangle(store:ProjectStore,width=4000,depth=3000) {return store.execute({id:'rectangle_command',baseGeneration:store.getSnapshot().localGeneration,type:'AddRectangle',x:0,y:0,width,depth,thickness:200,height:3000});}
it('GEO-011 attached thick stub preserves enclosing room identity, properties and analytic area; undo exact',()=>{
 const store=blank();expect(rectangle(store).ok).toBe(true);const room=store.getSnapshot().document.rooms[0]!;
 expect(store.execute({id:'name_room',baseGeneration:1,type:'UpdateRoom',roomId:room.id,properties:{name:'Living',type:'living',ceilingHeight:2800}}).ok).toBe(true);
 const before=serializeProject(store.getSnapshot().document);
 expect(store.execute({id:'thick_stub',baseGeneration:2,type:'AddWall',from:[2000,0],to:[2000,2000],thickness:1000,height:3000}).ok).toBe(true);
 expect(store.getSnapshot().document.rooms[0]).toMatchObject({id:room.id,name:'Living',type:'living',ceilingHeight:2800});expect(store.getSnapshot().derived.faces[0]!.clearAreaMm2).toBe(8240000);
 expect(store.undo()).toBe(true);expect(serializeProject(store.getSnapshot().document)).toBe(before);
});
it('GEO-011 random attached stubs preserve enclosing identities even below overlap threshold; analytic footprint subtraction',()=>{
 fc.assert(fc.property(fc.integer({min:4000,max:8000}),fc.integer({min:3000,max:6000}),fc.integer({min:500,max:1800}),(width,depth,length)=>{
  const store=blank();expect(rectangle(store,width,depth).ok).toBe(true);const before=store.getSnapshot(),room=before.document.rooms[0]!;
  const result=store.execute({id:'random_stub',baseGeneration:1,type:'AddWall',from:[Math.floor(width/2),0],to:[Math.floor(width/2),length],thickness:1000,height:3000});expect(result.ok,JSON.stringify(result)).toBe(true);
  expect(store.getSnapshot().document.rooms[0]!.id).toBe(room.id);expect(store.getSnapshot().derived.faces[0]!.clearAreaMm2).toBe((width-200)*(depth-200)-1000*(length+400));expect(store.undo()).toBe(true);expect(store.getSnapshot().document).toEqual(before.document);
 }),{seed:20261013,numRuns:100});
});
it('GEO-011 explicit inside-point choice resolves ambiguous split with exact inherited properties and undo',()=>{
 const store=blank();expect(rectangle(store).ok).toBe(true);const room=store.getSnapshot().document.rooms[0]!;
 expect(store.execute({id:'name_room',baseGeneration:1,type:'UpdateRoom',roomId:room.id,properties:{name:'Kitchen',type:'kitchen'}}).ok).toBe(true);const before=store.getSnapshot();
 const split={id:'split_room',baseGeneration:2,type:'AddWall' as const,from:[2010,0] as const,to:[2010,3000] as const,thickness:200,height:3000};
 expect(store.execute(split).ok).toBe(false);expect(store.getSnapshot()).toBe(before);
 for(const choice of [{roomId:'unknown',point:[500,500] as const},{roomId:room.id,point:[2010,500] as const},{roomId:room.id,point:[500.4,500] as const}]){expect(store.execute({...split,roomChoices:[choice]}).ok).toBe(false);expect(store.getSnapshot()).toBe(before);}
 const result=store.execute({...split,roomChoices:[{roomId:room.id,point:[500,500]}]});expect(result.ok).toBe(true);if(!result.ok)throw Error('split failed');expect(result.checkRoomNamesHint).toBe(true);
 const after=store.getSnapshot();expect(after.document.rooms).toHaveLength(2);expect(after.derived.faces.map(f=>f.clearAreaMm2).sort((a,b)=>a-b)).toEqual([5012000,5068000]);
 const kept=after.derived.faces.find(f=>f.roomId===room.id)!;expect(kept.clearRect[2]).toBe(1910);expect(after.document.rooms.every(r=>r.name==='Kitchen'&&r.type==='kitchen')).toBe(true);
 expect(store.undo()).toBe(true);expect(store.getSnapshot().document).toEqual(before.document);expect(store.redo()).toBe(true);expect(store.getSnapshot().document).toEqual(after.document);
});
it('GEO-011 room choices accept internal clear partition seams and reject true polygon boundaries',()=>{
 fc.assert(fc.property(fc.constantFrom(1500,2500),fc.integer({min:2501,max:2899}),(x,y)=>{const store=blank();expect(rectangle(store).ok).toBe(true);const roomId=store.getSnapshot().document.rooms[0]!.id,before=store.getSnapshot(),stub={id:'chosen_stub',baseGeneration:1,type:'AddWall' as const,from:[2000,0] as const,to:[2000,2000] as const,thickness:1000,height:3000};
  expect(store.execute({...stub,roomChoices:[{roomId,point:[100,y]}]}).ok).toBe(false);expect(store.getSnapshot()).toBe(before);
  const result=store.execute({...stub,roomChoices:[{roomId,point:[x,y]}]});expect(result.ok,JSON.stringify(result)).toBe(true);expect(store.getSnapshot().document.rooms[0]!.id).toBe(roomId);expect(store.getSnapshot().derived.faces[0]!.clearAreaMm2).toBe(8240000);
 }),{seed:20261013,numRuns:100});
});
it('GEO-004 adjoining rectangle reuses different materials, original wall IDs/orientation and openings',()=>{
 const parsed=parseProject(JSON.stringify(sample));if(!parsed.ok)throw Error('sample');const store=new ProjectStore(parsed.document,'adjoining');const before=store.getSnapshot();
 // Adjoin the exterior left side; extending north at the partition would make an unsupported X.
 const added=store.execute({id:'adjacent_room',baseGeneration:0,type:'AddRectangle',x:-3000,y:0,width:3000,depth:5000,thickness:230,height:3000});expect(added.ok,JSON.stringify(added)).toBe(true);
 const shared=before.document.walls.find(w=>w.a==='j6'&&w.b==='j1')!;expect(shared).toBeTruthy();
 const {rev:oldRev,...originalWall}=shared;const {rev:newRev,...keptWall}=store.getSnapshot().document.walls.find(w=>w.id===shared.id)!;expect(newRev).toBeGreaterThanOrEqual(oldRev);expect(keptWall).toEqual(originalWall);
 const openingGeometry=(openings:typeof before.document.openings)=>openings.map(o=>{const {rev,...properties}=o;void rev;return properties;});expect(openingGeometry(store.getSnapshot().document.openings)).toEqual(openingGeometry(before.document.openings));expect(store.getSnapshot().document.rooms).toHaveLength(3);
 expect(store.undo()).toBe(true);expect(store.getSnapshot().document).toEqual(before.document);
 const invalid=store.execute({id:'bad_adjacent',baseGeneration:2,type:'AddRectangle',x:-3000,y:0,width:3000,depth:5000,thickness:200,height:3000});expect(invalid.ok).toBe(false);expect(store.getSnapshot().document).toEqual(before.document);
 const x=store.execute({id:'x_adjoining',baseGeneration:2,type:'AddRectangle',x:0,y:-3000,width:4500,depth:3000,thickness:230,height:3000});expect(x.ok).toBe(false);if(!x.ok)expect(x.errors[0]?.code).toBe('x-junction');expect(store.getSnapshot().document).toEqual(before.document);
});
it('GEO-010 analytic rectangles keep exact area and one atomic undo across integer dimensions',()=>{
 fc.assert(fc.property(fc.integer({min:300,max:8000}),fc.integer({min:300,max:8000}),(w,d)=>{const store=blank(),before=store.getSnapshot();expect(rectangle(store,w,d).ok).toBe(true);expect(store.getSnapshot().derived.faces[0]!.clearAreaMm2).toBe((w-200)*(d-200));expect(store.undo()).toBe(true);expect(store.getSnapshot().document).toEqual(before.document);expect(store.undo()).toBe(false);}),{seed:20261013,numRuns:200});
});
it('rectangle NaN/fractional/out-of-domain/too small and unsupported identity choices reject atomically',()=>{
 const store=blank(),before=store.getSnapshot(),base={id:'bad_rectangle',baseGeneration:0,type:'AddRectangle' as const,x:0,y:0,width:4000,depth:3000,thickness:200,height:3000};
 for(const properties of [{width:NaN},{width:4000.4},{x:100001},{width:299},{depth:200,thickness:1000},{width:300,depth:300,thickness:1000}]){expect(store.execute({...base,...properties}).ok).toBe(false);expect(store.getSnapshot()).toBe(before);}
 expect(store.execute({id:'bad_choice',baseGeneration:0,type:'RenameProject',name:'Changed',roomChoices:[]}).ok).toBe(false);expect(store.getSnapshot()).toBe(before);
});
