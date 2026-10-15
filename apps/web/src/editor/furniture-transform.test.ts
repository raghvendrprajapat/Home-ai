import {it,expect} from 'vitest';
import fc from 'fast-check';
import {ProjectStore,serializeProject} from '@gharplan/core-model';
import type {ProjectDoc} from '@gharplan/core-model';
import sample from '../../../../docs/examples/sample-project.json';
import {furnitureCommand,furnitureDraft,coordinateLabel} from './furniture-transform';
const store=()=>new ProjectStore(structuredClone(sample) as ProjectDoc,'furniture_test');
it('SYNC-003 exact measured move/37degree/uniform1.5/raise is one command and exact Undo/Redo',()=>{
 const model=store(),before=serializeProject(model.getSnapshot().document),id=model.getSnapshot().document.furniture[0]!.id,original=model.getSnapshot().document.furniture[0]!;
 const draft={...furnitureDraft(model.getSnapshot(),id),x:'1.2 m',y:'150 cm',elevation:'300 mm',rotation:'37',scale:'1.5'};const command=furnitureCommand(model.getSnapshot(),id,draft);expect(serializeProject(model.getSnapshot().document)).toBe(before);expect(model.execute(command).ok).toBe(true);expect(model.getSnapshot().localGeneration).toBe(1);
 const item=model.getSnapshot().document.furniture.find(f=>f.id===id)!;expect(item.position).toEqual({x:1200,y:1500});expect(item.elevation).toBe(300);expect(item.rotationDeg).toBe(37);expect(item.size).toEqual({w:original.size.w*1.5,d:original.size.d*1.5,h:original.size.h*1.5});const after=serializeProject(model.getSnapshot().document);model.undo();expect(serializeProject(model.getSnapshot().document)).toBe(before);model.redo();expect(serializeProject(model.getSnapshot().document)).toBe(after);
});
it('unchanged furniture input makes no command mutation/history, invalid/stale inputs leave complete model unchanged',()=>{
 const model=store(),snapshot=model.getSnapshot(),id=snapshot.document.furniture[0]!.id,base=furnitureDraft(snapshot,id),before=serializeProject(snapshot.document);
 const result=model.execute(furnitureCommand(snapshot,id,base));expect(result).toMatchObject({ok:true,changed:false});expect(model.getSnapshot().canUndo).toBe(false);
 for(const [field,value]of [['x','NaN'],['y','1e3'],['elevation','-1 mm'],['elevation','6001 mm'],['rotation','Infinity'],['scale','0'],['scale','0x2'],['scale','1.0000001']]as const){expect(()=>furnitureCommand(snapshot,id,{...base,[field]:value})).toThrow();expect(serializeProject(model.getSnapshot().document)).toBe(before);}
 for(const scale of ['0.000001']){const command=furnitureCommand(snapshot,id,{...base,scale});expect(model.execute(command).ok).toBe(false);expect(serializeProject(model.getSnapshot().document)).toBe(before);}
 const large=store(),largeId=large.getSnapshot().document.furniture[0]!.id;expect(large.execute({id:'large_dimensions',baseGeneration:0,type:'UpdateFurniture',furnitureId:largeId,properties:{size:{w:20000,d:1000,h:1000}}}).ok).toBe(true);const largeSnapshot=large.getSnapshot(),largeBefore=serializeProject(largeSnapshot.document);expect(large.execute(furnitureCommand(largeSnapshot,largeId,{...furnitureDraft(largeSnapshot,largeId),scale:'100'})).ok).toBe(false);expect(serializeProject(large.getSnapshot().document)).toBe(largeBefore);
 const stale=furnitureCommand(snapshot,id,{...base,rotation:'90'});model.execute(furnitureCommand(snapshot,id,{...base,rotation:'37'}));const current=serializeProject(model.getSnapshot().document);expect(model.execute(stale).ok).toBe(false);expect(serializeProject(model.getSnapshot().document)).toBe(current);
});
it('decimal scale half ties round exactly once to integer mm, with signed coordinate and rotation normalization',()=>{
 const model=store(),id=model.getSnapshot().document.furniture[0]!.id;model.execute({id:'set_small',baseGeneration:0,type:'UpdateFurniture',furnitureId:id,properties:{size:{w:45,d:75,h:105}}});const snapshot=model.getSnapshot(),draft={...furnitureDraft(snapshot,id),x:'-500 mm',rotation:'-90',scale:'0.7'},command=furnitureCommand(snapshot,id,draft);expect(command).toMatchObject({properties:{position:{x:-500,y:snapshot.document.furniture[0]!.position.y},rotationDeg:270,size:{w:32,d:53,h:74}}});
 expect(coordinateLabel(-500,'metric')).toBe('-500 mm');expect(coordinateLabel(-500,'imperial')).toMatch(/^-.* ft$/);
});
it('uniform3/2 dimension rounding satisfies independent integer arithmetic at every generated size',()=>{
 fc.assert(fc.property(fc.integer({min:10,max:6000}),fc.integer({min:10,max:6000}),fc.integer({min:10,max:6000}),(w,d,h)=>{
  const model=store(),id=model.getSnapshot().document.furniture[0]!.id;model.execute({id:'dimensions',baseGeneration:0,type:'UpdateFurniture',furnitureId:id,properties:{size:{w,d,h}}});const snapshot=model.getSnapshot(),command=furnitureCommand(snapshot,id,{...furnitureDraft(snapshot,id),scale:'1.5'});expect(command).toMatchObject({properties:{size:{w:Math.floor((3*w+1)/2),d:Math.floor((3*d+1)/2),h:Math.floor((3*h+1)/2)}}});
 }),{numRuns:100,seed:305});
});
