import { expect, it } from 'vitest';
import fc from 'fast-check';
import { createBlankProject, ProjectStore, serializeProject } from '@gharplan/core-model';
import { DrawingTool, drawingCommand, drawingTarget } from './drawing-tools';
function setup(){let id=0;const store=new ProjectStore(createBlankProject({name:'Codex drawing tools',units:'metric',now:'2026-10-13T00:00:00Z',nextId:()=>`draw_test_${id++}`}), 'tools_test',{now:()=> '2026-10-13T00:00:00Z'}),tool=new DrawingTool(store);const unsubscribe=tool.subscribe(()=>{});return {store,tool,unsubscribe};}
it('GEO-001 wall chain closes once with analytic carpet area, preview writes nothing and Done adds no history',()=>{
 const {store,tool}=setup(),empty=store.getSnapshot();tool.setMode('wall');tool.point([0,0]);tool.hover([4000,0]);expect(store.getSnapshot()).toBe(empty);expect(tool.getSnapshot().preview?.ok).toBe(true);
 for(const point of [[4000,0],[4000,3000],[0,3000],[0,0]] as const)tool.point(point);
 expect(store.getSnapshot().document.walls).toHaveLength(4);expect(store.getSnapshot().derived.faces[0]!.clearAreaMm2).toBe(10640000);expect(tool.getSnapshot().anchor).toBeNull();const after=store.getSnapshot();tool.clear();expect(store.getSnapshot()).toBe(after);
 for(let n=0;n<4;n++)expect(store.undo()).toBe(true);expect(store.getSnapshot().document).toEqual(empty.document);expect(store.undo()).toBe(false);tool.dispose();
});
it('GEO-010 rectangle drag direction is normalized with exact centreline geometry and one undo',()=>{
 const {store,tool}=setup();tool.setMode('rectangle');const before=serializeProject(store.getSnapshot().document);tool.rectangle([4000,3000],[0,0]);expect(store.getSnapshot().derived.faces[0]!.clearAreaMm2).toBe(10640000);expect(store.undo()).toBe(true);expect(serializeProject(store.getSnapshot().document)).toBe(before);expect(store.undo()).toBe(false);tool.dispose();
});
it('raw orthogonal projection stays on one axis, rounds once and respects integer domain for bounded inputs',()=>{
 const {store,tool}=setup(),doc=store.getSnapshot().document;
 // Quarter-mm offsets remain exactly representable after adding domain-sized origins.
 fc.assert(fc.property(fc.integer({min:-90000,max:90000}),fc.integer({min:-90000,max:90000}),fc.integer({min:-4000,max:4000}),fc.integer({min:-4000,max:4000}),(x,y,dx4,dy4)=>{const dx=dx4/4,dy=dy4/4,end=drawingTarget(doc,[x+dx,y+dy],{x:0,y:0,scale:.1},[x,y],true,true);expect(end.every(Number.isSafeInteger)).toBe(true);expect(end[0]===x||end[1]===y).toBe(true);expect(Math.abs(dx)>=Math.abs(dy)?end[1]:end[0]).toBe(Math.abs(dx)>=Math.abs(dy)?y:x);}),{seed:20261013,numRuns:500});
 // Sub-ULP addition can erase an original delta; the actual pointer input defines the axis.
 expect(drawingTarget(doc,[32768,999.9999999999965],{x:0,y:0,scale:.1},[33768,0],true,true)).toEqual([32768,0]);
 fc.assert(fc.property(fc.double({min:-1000,max:1000,noNaN:true}),fc.double({min:-1000,max:1000,noNaN:true}),(dx,dy)=>{const end=drawingTarget(doc,[33768+dx,dy],{x:0,y:0,scale:.1},[33768,0],true,true);expect(end.every(Number.isSafeInteger)).toBe(true);expect(end[0]===33768||end[1]===0).toBe(true);}),{seed:20261013,numRuns:500});
 const c=drawingCommand('rectangle',[300,500],[100,100],{thickness:50,height:2700},0);expect(c).toMatchObject({x:100,y:100,width:200,depth:400});expect(()=>drawingTarget(doc,[NaN,0],{x:0,y:0,scale:.1},null,false)).toThrow();tool.dispose();
});
it('invalid diagonal/X candidate, cancellation and stale external history never commit hidden drafts',()=>{
 const {store,tool}=setup();tool.setMode('wall');tool.point([0,0]);const before=store.getSnapshot();tool.point([100,100]);expect(store.getSnapshot()).toBe(before);expect(tool.getSnapshot().error).toBeTruthy();tool.clear();expect(tool.getSnapshot().anchor).toBeNull();expect(store.getSnapshot()).toBe(before);
 tool.point([0,0]);tool.point([4000,0]);tool.hover([4000,3000]);expect(store.undo()).toBe(true);expect(tool.getSnapshot().anchor).toBeNull();expect(tool.getSnapshot().preview).toBeNull();expect(store.getSnapshot().document.walls).toHaveLength(0);tool.dispose();
});
it('invalid explicit room point keeps the resolution form available for a corrected retry',()=>{
 const {store,tool}=setup();tool.setMode('rectangle');tool.rectangle([0,0],[4000,3000]);const room=store.getSnapshot().document.rooms[0]!;tool.setMode('wall');tool.point([2010,0]);tool.point([2010,3000]);expect(tool.getSnapshot().unresolved).not.toBeNull();const before=store.getSnapshot();expect(tool.resolve(room.id,[2010,500])?.ok).toBe(false);expect(store.getSnapshot()).toBe(before);expect(tool.getSnapshot().unresolved).not.toBeNull();expect(tool.resolve(room.id,[500,500])?.ok).toBe(true);expect(store.getSnapshot().document.rooms).toHaveLength(2);tool.dispose();
});
it('3D unsubscribe, external undo and 2D resubscribe refresh tool generation before a pointer command',()=>{
 const {store,tool,unsubscribe}=setup();tool.setMode('rectangle');tool.rectangle([0,0],[4000,3000]);tool.setMode('select');unsubscribe();expect(store.undo()).toBe(true);const resubscribe=tool.subscribe(()=>{});tool.setMode('wall');tool.point([0,0]);tool.point([4000,0]);expect(store.getSnapshot().document.walls).toHaveLength(1);expect(tool.getSnapshot().error).toBeNull();resubscribe();tool.dispose();
});
it('standalone measured wall never seeds the active rectangle tool or a new wall chain',()=>{
 const {store,tool}=setup();tool.setMode('rectangle');tool.clear();expect(tool.commit(drawingCommand('wall',[0,0],[4000,0],tool.properties,0))?.ok).toBe(true);expect(tool.getSnapshot().anchor).toBeNull();const before=store.getSnapshot();tool.point([0,3000]);expect(store.getSnapshot()).toBe(before);expect(store.getSnapshot().document.rooms).toHaveLength(0);tool.dispose();
});
it('GEO-003 basic wall endpoint acquisition creates a T with integer projection; Shift and world cap remain strict',()=>{
 const {store,tool}=setup();expect(tool.commit(drawingCommand('wall',[0,0],[4000,0],tool.properties,0))?.ok).toBe(true);const doc=store.getSnapshot().document;
 fc.assert(fc.property(fc.integer({min:500,max:3500}),fc.integer({min:-75,max:75}),(x,dy)=>{expect(drawingTarget(doc,[x+2,dy],{x:0,y:0,scale:.1},[x,-1000],true)).toEqual([x,0]);}),{seed:20261013,numRuns:200});
 expect(drawingTarget(doc,[2000,10],{x:0,y:0,scale:.1},[2000,-1000],true,true)).toEqual([2000,10]);expect(drawingTarget(doc,[2000,251],{x:0,y:0,scale:.001},[2000,-1000],true)).toEqual([2000,251]);
 tool.setMode('wall');tool.point([2000,-1000]);tool.point(drawingTarget(doc,[2002,30],{x:0,y:0,scale:.1},[2000,-1000],true));expect(store.getSnapshot().document.walls).toHaveLength(3);expect(store.getSnapshot().document.junctions.filter(j=>j.x===2000&&j.y===0)).toHaveLength(1);tool.dispose();
});
it('an ordinary model change while no draft exists does not report a cancelled drag',()=>{
 const {store,tool}=setup();expect(store.execute({id:'rename_idle',baseGeneration:0,type:'RenameProject',name:'Renamed'}).ok).toBe(true);expect(tool.getSnapshot().notice).toBe('toolIdle');expect(tool.getSnapshot().error).toBeNull();tool.setMode('wall');tool.point([0,0]);expect(store.execute({id:'rename_draft',baseGeneration:1,type:'RenameProject',name:'New name'}).ok).toBe(true);expect(tool.getSnapshot().notice).toBe('dragChanged');expect(tool.getSnapshot().anchor).toBeNull();tool.dispose();
});
