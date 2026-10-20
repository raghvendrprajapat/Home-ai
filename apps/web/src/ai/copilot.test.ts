import {describe,expect,it} from 'vitest';
import {ProjectStore,serializeProject} from '@gharplan/core-model';
import type {ProjectDoc} from '@gharplan/core-model';
import sample from '../../../../docs/examples/sample-project.json';
import {acceptIntent,allWallSides,findRoom,libraryMaterial,PAINT_MATERIAL,roomWallSides,standInCopilot,surfaceCommand} from './copilot';

// D76 M3 Claude-authored checks. Expected sides are hand-derived from the fixture: plan Y points south, so the left
// side of an east-going wall faces north. Living = x 0–4500, Bedroom = x 4500–8000, y 0–5000; w7 is the partition
// j2(4500,0)→j5(4500,5000), whose left side faces east (the bedroom).
const setup=()=>new ProjectStore(structuredClone(sample) as ProjectDoc,'copilot_test');
const sides=(list:readonly {id:string;side?:string}[])=>list.map(t=>`${t.id}:${t.side}`).sort();

describe('D76 Copilot actions',()=>{
 it('finds the wall sides that face into each room',()=>{
  const snapshot=setup().getSnapshot();
  expect(sides(roomWallSides(snapshot,'r_bed'))).toEqual(['w2:right','w3:right','w4:right','w7:left']);
  expect(sides(roomWallSides(snapshot,'r_living'))).toEqual(['w1:right','w5:right','w6:right','w7:right']);
  expect(roomWallSides(snapshot,'r_missing')).toEqual([]);
  expect(allWallSides(snapshot.document)).toHaveLength(14);
 });
 it('finds rooms by type, prefers the selected one, and treats a hall as a living room',()=>{
  const snapshot=setup().getSnapshot();
  expect(findRoom(snapshot,{type:'bedroom',text:'bedroom'})?.id).toBe('r_bed');
  expect(findRoom(snapshot,{type:'living',text:'living room'})?.id).toBe('r_living');
  expect(findRoom(snapshot,{type:'kitchen',text:'kitchen'})).toBeUndefined();
 });
 it('uses the drawing\'s own definition of a material it already has, else the library one',()=>{
  const doc=setup().getSnapshot().document;
  expect(libraryMaterial(doc,'m_wood_laminate')).toBe(doc.materials.find(m=>m.id==='m_wood_laminate'));
  expect(libraryMaterial(doc,PAINT_MATERIAL.beige)).toMatchObject({id:'m_paint_beige',baseColor:'#e6d5b8'});
  expect(()=>libraryMaterial(doc,'m_unknown')).toThrow('copilot-material');
 });
 it('paints the whole floor beige with one command and one Undo, and a repeat changes nothing',()=>{
  const store=setup(),before=serializeProject(store.getSnapshot().document);
  const command=surfaceCommand(store.getSnapshot(),allWallSides(store.getSnapshot().document),libraryMaterial(store.getSnapshot().document,'m_paint_beige'),'c1')!;
  expect(store.execute(command).ok).toBe(true);
  expect(store.getSnapshot().document.walls.every(w=>w.leftMaterial==='m_paint_beige'&&w.rightMaterial==='m_paint_beige')).toBe(true);
  expect(surfaceCommand(store.getSnapshot(),allWallSides(store.getSnapshot().document),libraryMaterial(store.getSnapshot().document,'m_paint_beige'),'c2')).toBeNull();
  store.undo();expect(serializeProject(store.getSnapshot().document)).toBe(before);
 });
 it('only sends the surfaces that still need the change',()=>{
  const snapshot=setup().getSnapshot();
  // The bedroom floor is already wood laminate in the fixture; the living room is tile.
  const command=surfaceCommand(snapshot,[{kind:'floor',id:'r_living'},{kind:'floor',id:'r_bed'}],libraryMaterial(snapshot.document,'m_wood_laminate'),'c3');
  expect(command).toMatchObject({type:'ApplySurfaceMaterials',targets:[{kind:'floor',id:'r_living'}]});
 });
 it.each([
  [{kind:'template',template:'3bhk'}],[{kind:'paintWalls',colour:'purple',room:null}],[{kind:'floor',finish:'carpet',room:null}],
  [{kind:'furnish',room:{type:'garage',text:'garage'}}],[{kind:'deleteAll'}],[null],['2bhk'],[[{kind:'help'}]],
 ])('a model answer outside the known intents becomes help: %j',raw=>expect(acceptIntent(raw)).toEqual({kind:'help'}));
 it('accepts well-formed answers unchanged',async()=>{
  expect(acceptIntent({kind:'paintWalls',colour:'beige',room:{type:'bedroom',text:'bedroom'}})).toEqual({kind:'paintWalls',colour:'beige',room:{type:'bedroom',text:'bedroom'}});
  expect(acceptIntent(await standInCopilot.read('living room mein wooden floor',new AbortController().signal))).toEqual({kind:'floor',finish:'wood',room:{type:'living',text:'living room'}});
 });
});
