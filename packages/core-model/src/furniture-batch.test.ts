import {describe,expect,it} from 'vitest';
import fc from 'fast-check';
import sample from '../../../docs/examples/sample-project.json';
import {MAX_FURNITURE_BATCH,ProjectStore,serializeProject} from './index';
import type {Command,FurnitureItem,ProjectDoc} from './index';

// D73 AI-2 Claude-authored checks: a suggested layout is added by one atomic command with exact one-step undo.
const setup=()=>new ProjectStore(structuredClone(sample) as ProjectDoc,'batch_session');
const item=(id:string,x:number,y:number,rotationDeg=0):Omit<FurnitureItem,'rev'>=>({id,floorId:'f0',assetId:'a_l0_nightstand',assetVersion:1,position:{x,y},elevation:0,rotationDeg,size:{w:450,d:400,h:520},materialOverrides:{}});
const batch=(furniture:readonly Omit<FurnitureItem,'rev'>[],id='layout_1'):Command=>({id,baseGeneration:0,type:'AddFurnitureBatch',furniture});

describe('D73 AddFurnitureBatch',()=>{
 it('adds every item in order with rev 0, and one undo restores the exact document',()=>{
  const store=setup(),before=serializeProject(store.getSnapshot().document),count=store.getSnapshot().document.furniture.length;
  expect(store.execute(batch([item('fu_a',5000,400,180),item('fu_b',7500,400,180),item('fu_c',6000,4500)])).ok).toBe(true);
  const after=store.getSnapshot().document.furniture;
  expect(after).toHaveLength(count+3);
  expect(after.slice(-3).map(f=>[f.id,f.position.x,f.position.y,f.rotationDeg,f.rev])).toEqual([['fu_a',5000,400,180,0],['fu_b',7500,400,180,0],['fu_c',6000,4500,0,0]]);
  expect(store.undo()).toBe(true);
  expect(serializeProject(store.getSnapshot().document)).toBe(before);
  expect(store.getSnapshot().canUndo).toBe(false);
  expect(store.redo()).toBe(true);expect(store.getSnapshot().document.furniture).toHaveLength(count+3);
 });
 it('rejects the whole batch, leaving the model unchanged, when any item is invalid',()=>{
  const store=setup(),before=store.getSnapshot(),existing=before.document.furniture[0]!.id;
  const bad:Command[]=[
   batch([]),
   batch(Array.from({length:MAX_FURNITURE_BATCH+1},(_,i)=>item(`fu_n${i}`,5000+i*10,400))),
   batch([item('fu_a',5000,400),item('fu_a',6000,400)]), // repeated ID
   batch([item('fu_a',5000,400),item(existing,6000,400)]), // ID already used
   batch([item('fu_a',5000,400),item('fu_b',6000.5,400)]), // fractional mm
   batch([item('fu_a',5000,400),item('fu_b',100001,400)]), // outside the drawing limits
   batch([item('fu_a',5000,400),{...item('fu_b',6000,400),floorId:'missing'}]),
   batch([item('fu_a',5000,400),{...item('fu_b',6000,400),materialOverrides:{main:'missing_material'}}]),
   batch([item('fu_a',5000,400),null as unknown as Omit<FurnitureItem,'rev'>]),
   {id:'layout_x',baseGeneration:0,type:'AddFurnitureBatch',furniture:'fu_a'} as unknown as Command,
  ];
  for(const command of bad){expect(store.execute(command).ok).toBe(false);expect(store.getSnapshot()).toBe(before);}
 });
 it(`property: any 1–${MAX_FURNITURE_BATCH} valid items add exactly once and undo exactly`,()=>{
  fc.assert(fc.property(fc.array(fc.record({x:fc.integer({min:-90000,max:90000}),y:fc.integer({min:-90000,max:90000}),r:fc.constantFrom(0,90,180,270)}),{minLength:1,maxLength:MAX_FURNITURE_BATCH}),points=>{
   const store=setup(),before=serializeProject(store.getSnapshot().document),count=store.getSnapshot().document.furniture.length;
   expect(store.execute(batch(points.map((p,i)=>item(`fu_p${i}`,p.x,p.y,p.r)))).ok).toBe(true);
   const added=store.getSnapshot().document.furniture.slice(count);
   expect(added.map(f=>[f.position.x,f.position.y,f.rotationDeg])).toEqual(points.map(p=>[p.x,p.y,p.r]));
   expect(store.undo()).toBe(true);expect(serializeProject(store.getSnapshot().document)).toBe(before);
  }),{seed:20261018,numRuns:60});
 });
});
