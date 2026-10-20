import {describe,expect,it} from 'vitest';
import fc from 'fast-check';
import sample from '../../../docs/examples/sample-project.json';
import {MAX_SURFACE_BATCH,ProjectStore,serializeProject} from './index';
import type {Command,MaterialDef,ProjectDoc,SurfaceMaterialTarget} from './index';

// D76 M3 Claude-authored checks: Copilot paints many surfaces with one atomic command and one exact Undo step.
// Expected values come from the fixture by hand: 7 walls (w1–w7), 2 rooms, 5 materials.
const setup=()=>new ProjectStore(structuredClone(sample) as ProjectDoc,'surface_batch');
const beige:MaterialDef={id:'m_paint_beige',name:'Paint - beige',baseColor:'#e6d5b8',roughness:.8,metalness:0};
const paint=(targets:readonly SurfaceMaterialTarget[],material=beige,id='paint_all'):Command=>({id,baseGeneration:0,type:'ApplySurfaceMaterials',targets,material});
const everySide=['w1','w2','w3','w4','w5','w6','w7'].flatMap(id=>(['left','right'] as const).map(side=>({kind:'wall' as const,id,side})));

describe('D76 ApplySurfaceMaterials',()=>{
 it('paints all 14 wall sides, adds the material once, and one Undo restores the exact document',()=>{
  const store=setup(),before=serializeProject(store.getSnapshot().document);
  expect(store.execute(paint(everySide)).ok).toBe(true);
  const doc=store.getSnapshot().document;
  expect(doc.walls.every(w=>w.leftMaterial==='m_paint_beige'&&w.rightMaterial==='m_paint_beige')).toBe(true);
  expect(doc.materials.filter(m=>m.id==='m_paint_beige')).toEqual([beige]);
  expect(doc.materials).toHaveLength(6);
  // Paint is a binding change: rooms (boundaries) and openings keep their revisions.
  expect(doc.rooms.map(r=>r.rev)).toEqual((sample as ProjectDoc).rooms.map(r=>r.rev));
  expect(store.undo()).toBe(true);
  expect(serializeProject(store.getSnapshot().document)).toBe(before);
  expect(store.getSnapshot().canUndo).toBe(false);
 });
 it('mixes floors and wall sides in one step',()=>{
  const store=setup();
  expect(store.execute(paint([{kind:'floor',id:'r_living'},{kind:'wall',id:'w7',side:'left'}],(sample as ProjectDoc).materials.find(m=>m.id==='m_wood_laminate')!)).ok).toBe(true);
  const doc=store.getSnapshot().document;
  expect(doc.rooms.find(r=>r.id==='r_living')!.floorMaterial).toBe('m_wood_laminate');
  expect(doc.walls.find(w=>w.id==='w7')!.leftMaterial).toBe('m_wood_laminate');
  expect(doc.materials).toHaveLength(5);
 });
 it('rejects the whole command, leaving the model unchanged, when any target or the material is invalid',()=>{
  const store=setup(),before=store.getSnapshot();
  const bad:Command[]=[
   paint([]),
   paint(Array.from({length:MAX_SURFACE_BATCH+1},()=>everySide[0]!)),
   paint([everySide[0]!,everySide[0]!]), // the same side twice
   paint([...everySide,{kind:'wall',id:'missing',side:'left'}]),
   paint([{kind:'floor',id:'r_missing'}]),
   paint([{kind:'wall',id:'w1',side:'top'} as unknown as SurfaceMaterialTarget]),
   paint(everySide,{...beige,id:'m_paint_white'}), // an existing ID with another definition
   {id:'paint_x',baseGeneration:0,type:'ApplySurfaceMaterials',targets:'w1',material:beige} as unknown as Command,
  ];
  for(const command of bad){
   const result=store.execute(command);
   expect(result.ok).toBe(false);
   expect(store.getSnapshot()).toBe(before);
  }
 });
 it('property: any non-empty set of distinct sides is painted exactly, everything else is untouched, and Undo is exact',()=>{
  fc.assert(fc.property(fc.subarray(everySide,{minLength:1}),chosen=>{
   const store=setup(),before=serializeProject(store.getSnapshot().document),original=(sample as ProjectDoc).walls;
   expect(store.execute(paint(chosen)).ok).toBe(true);
   for(const w of store.getSnapshot().document.walls)for(const side of ['left','right'] as const){
    const picked=chosen.some(t=>t.id===w.id&&t.side===side),old=original.find(o=>o.id===w.id)!;
    expect(w[side==='left'?'leftMaterial':'rightMaterial']).toBe(picked?'m_paint_beige':old[side==='left'?'leftMaterial':'rightMaterial']);
   }
   store.undo();
   expect(serializeProject(store.getSnapshot().document)).toBe(before);
  }),{numRuns:60});
 });
});
