import {it,expect} from 'vitest';
import fc from 'fast-check';
import {ProjectStore,parseProject} from '@gharplan/core-model';
import type {ProjectDoc} from '@gharplan/core-model';
import sample from '../../../../docs/examples/sample-project.json';
import {beginFurnitureGesture,currentFurnitureGesture,furnitureGestureCommand,furnitureGroupMembers,furnitureStepCommand} from './furniture-gesture';
const store=()=>new ProjectStore(structuredClone(sample) as ProjectDoc,'gesture_test');
it('SYNC-003 off-centre pointer keeps grab offset, quantizes once, previews never edit and one final command undoes exact JSON',()=>{
 const s=store(),before=JSON.stringify(s.getSnapshot().document),f=s.getSnapshot().document.furniture[0]!,pointer=[f.position.x+123.4,f.position.y-67.8] as const,intent=beginFurnitureGesture(s,f.id,'move',pointer),target=[pointer[0]+234.49,pointer[1]-99.51] as const;
 const command=furnitureGestureCommand(intent,target,true,100);expect(command).toMatchObject({properties:{position:{x:f.position.x+234,y:f.position.y-100}}});expect(s.preview(command).ok).toBe(true);expect(JSON.stringify(s.getSnapshot().document)).toBe(before);expect(s.execute(command).ok).toBe(true);expect(currentFurnitureGesture(s,intent)).toBe(false);expect(s.getSnapshot().localGeneration).toBe(1);s.undo();expect(JSON.stringify(s.getSnapshot().document)).toBe(before);expect(s.getSnapshot().canUndo).toBe(false);s.redo();const parsed=parseProject(JSON.stringify(s.getSnapshot().document));expect(parsed.ok).toBe(true);if(parsed.ok)expect(parsed.document.furniture[0]!.position).toEqual({x:f.position.x+234,y:f.position.y-100});
});
it('GEO-016 grid/free commands have integer coordinates and analytic displacement for arbitrary fractional pointer previews',()=>{
 const s=store(),f=s.getSnapshot().document.furniture[0]!,intent=beginFurnitureGesture(s,f.id,'move',[f.position.x+123.25,f.position.y-47.5]);fc.assert(fc.property(fc.integer({min:-5000,max:5000}),fc.integer({min:-5000,max:5000}),fc.constantFrom(10,50,100,500,1000),(dx,dy,grid)=>{const target=[intent.pointer[0]+dx+.25,intent.pointer[1]+dy-.25] as const,command=furnitureGestureCommand(intent,target,true,grid),snap=furnitureGestureCommand(intent,target,false,grid);if(command.type!=='UpdateFurniture'||snap.type!=='UpdateFurniture')throw Error('type');expect(command.properties.position).toEqual({x:f.position.x+dx,y:f.position.y+dy});expect(Math.abs(snap.properties.position!.x%grid)).toBe(0);expect(Math.abs(snap.properties.position!.y%grid)).toBe(0);}),{numRuns:100,seed:431});
});
it('SYNC-003 absolute15degree rotation and free359→1 wrap use initial-relative angle; near-centre and nonfinite candidates reject',()=>{
 const s=store(),f=s.getSnapshot().document.furniture[0]!,c=f.position,point=(angle:number)=>[c.x+500*Math.cos(angle*Math.PI/180),c.y+500*Math.sin(angle*Math.PI/180)] as const,intent=beginFurnitureGesture(s,f.id,'rotate',point(359)),free=furnitureGestureCommand(intent,point(1),true,100),snap=furnitureGestureCommand(intent,point(16),false,100);
 expect(free).toMatchObject({properties:{rotationDeg:expect.closeTo((f.rotationDeg+2)%360,8)}});expect(snap).toMatchObject({properties:{rotationDeg:Math.round((f.rotationDeg+17)/15)*15%360}});expect(()=>furnitureGestureCommand(intent,[c.x,c.y],true,100)).toThrow();expect(()=>beginFurnitureGesture(s,f.id,'rotate',[c.x,c.y])).toThrow();expect(()=>furnitureGestureCommand(intent,[NaN,0],true,100)).toThrow();expect(s.getSnapshot().canUndo).toBe(false);
});
it('rotation follows analytic initial pointer delta modulo360 for arbitrary whole-degree angles',()=>{
 const s=store(),f=s.getSnapshot().document.furniture[0]!,c=f.position,point=(angle:number)=>[c.x+1000*Math.cos(angle*Math.PI/180),c.y+1000*Math.sin(angle*Math.PI/180)] as const;fc.assert(fc.property(fc.integer({min:0,max:359}),fc.integer({min:1,max:359}),(start,delta)=>{const intent=beginFurnitureGesture(s,f.id,'rotate',point(start)),command=furnitureGestureCommand(intent,point(start+delta),true,100);if(command.type!=='UpdateFurniture')throw Error('type');expect(command.properties.rotationDeg).toBeCloseTo((f.rotationDeg+delta)%360,8);}),{numRuns:100,seed:432});
});
it('stationary off-grid hold is a true no-op; invalid final release cannot use an earlier valid preview',()=>{
 const s=store(),f=s.getSnapshot().document.furniture[0]!,pointer=[f.position.x+123,f.position.y+87] as const,intent=beginFurnitureGesture(s,f.id,'move',pointer),before=JSON.stringify(s.getSnapshot().document);expect(s.execute(furnitureGestureCommand(intent,pointer,false,1000))).toMatchObject({ok:true,changed:false});expect(s.getSnapshot().canUndo).toBe(false);expect(s.preview(furnitureGestureCommand(intent,[pointer[0]+100,pointer[1]],true,100)).ok).toBe(true);expect(s.execute(furnitureGestureCommand(intent,[200000,pointer[1]],true,100)).ok).toBe(false);expect(JSON.stringify(s.getSnapshot().document)).toBe(before);expect(s.getSnapshot().canUndo).toBe(false);
});
it('captured4domain ownership rejects replaced project/session or generation; key/button steps each undo once',()=>{
 const s=store(),f=s.getSnapshot().document.furniture[0]!,intent=beginFurnitureGesture(s,f.id,'move',[f.position.x,f.position.y]),before=JSON.stringify(s.getSnapshot().document);expect(currentFurnitureGesture(s,intent)).toBe(true);const other=new ProjectStore(structuredClone(sample) as ProjectDoc,'different_session');expect(currentFurnitureGesture(other,intent)).toBe(false);expect(s.execute(furnitureStepCommand(s.getSnapshot(),f.id,{dx:10})).ok).toBe(true);expect(currentFurnitureGesture(s,intent)).toBe(false);s.undo();expect(JSON.stringify(s.getSnapshot().document)).toBe(before);expect(s.execute(furnitureStepCommand(s.getSnapshot(),f.id,{rotation:-15})).ok).toBe(true);expect(s.getSnapshot().document.furniture[0]!.rotationDeg).toBe((f.rotationDeg+345)%360);s.undo();expect(JSON.stringify(s.getSnapshot().document)).toBe(before);expect(()=>furnitureStepCommand(s.getSnapshot(),f.id,{dx:101})).toThrow();
});
// FR-019 3D group gestures. Claude-authored analytic checks (not independent fixtures).
// Sofa (1300,4300) + tv grouped; combined box x 300..3150, y 200..4750 -> turn pivot (1725, 2475).
const grouped=()=>{const doc=structuredClone(sample) as ProjectDoc;for(const f of doc.furniture)if(f.id==='fu_sofa'||f.id==='fu_tv')f.groupId='group_1';return new ProjectStore(doc,'gesture_group');};
it('FR-019 group move gives every member the touched item\'s grid-snapped delta; without the group option it stays a single-item edit',()=>{
 const s=grouped(),intent=beginFurnitureGesture(s,'fu_sofa','move',[1000,4000],{group:true});expect(intent.group).toEqual(['fu_sofa','fu_tv']);expect(intent.centre).toEqual([1300,4300]);
 // Pointer +130/-70: sofa target 1430 -> 1450, 4230 -> 4250 on a 50 mm grid, so delta (150, -50); free keeps (130, -70).
 expect(furnitureGestureCommand(intent,[1130,3930],false,50)).toMatchObject({type:'MoveFurniture',furnitureIds:['fu_sofa','fu_tv'],dx:150,dy:-50});
 expect(furnitureGestureCommand(intent,[1130,3930],true,50)).toMatchObject({type:'MoveFurniture',dx:130,dy:-70});
 const result=s.execute(furnitureGestureCommand(intent,[1130,3930],false,50));expect(result.ok).toBe(true);
 const at=(id:string)=>s.getSnapshot().document.furniture.find(f=>f.id===id)!.position;expect(at('fu_sofa')).toEqual({x:1450,y:4250});expect(at('fu_tv')).toEqual({x:2400,y:350});
 const single=beginFurnitureGesture(grouped(),'fu_sofa','move',[1000,4000]);expect(single.group).toBeUndefined();expect(furnitureGestureCommand(single,[1130,3930],false,50)).toMatchObject({type:'UpdateFurniture',furnitureId:'fu_sofa'});
});
it('FR-019 group turn measures the drag about the group pivot and sends a 15-degree-step (or free) delta',()=>{
 const s=grouped(),intent=beginFurnitureGesture(s,'fu_sofa','rotate',[2725,2475],{group:true});expect(intent.centre).toEqual([1725,2475]);
 // From pivot+(1000,0) to pivot+(0,1000) is +90 degrees (clockwise on screen); 1000/1000 at 40 degrees snaps to 45.
 expect(furnitureGestureCommand(intent,[1725,3475],false,50)).toMatchObject({type:'RotateFurniture',furnitureIds:['fu_sofa','fu_tv'],deltaDeg:90});
 const p40:[number,number]=[1725+1000*Math.cos(40*Math.PI/180),2475+1000*Math.sin(40*Math.PI/180)];
 expect(furnitureGestureCommand(intent,p40,false,50)).toMatchObject({deltaDeg:45});
 const free=furnitureGestureCommand(intent,p40,true,50) as {deltaDeg:number};expect(free.deltaDeg).toBeCloseTo(40,9);
 expect(s.execute(furnitureGestureCommand(intent,[1725,3475],false,50)).ok).toBe(true);
 expect(s.getSnapshot().document.furniture.find(f=>f.id==='fu_sofa')!.position).toEqual({x:-100,y:2050}); // same hand values as the D58 +90 turn
 expect(()=>beginFurnitureGesture(grouped(),'fu_sofa','rotate',[1725.5,2475],{group:true})).toThrow(); // too close to the pivot
});
it('FR-019 a lone leftover group member and an ungrouped item have no group',()=>{
 const doc=structuredClone(sample) as ProjectDoc;doc.furniture.find(f=>f.id==='fu_sofa')!.groupId='group_9';
 expect(furnitureGroupMembers(doc,'fu_sofa')).toBeNull();expect(furnitureGroupMembers(doc,'fu_tv')).toBeNull();
 expect(beginFurnitureGesture(new ProjectStore(doc,'lone'),'fu_sofa','move',[0,0],{group:true}).group).toBeUndefined();
});
