import {describe,expect,it} from 'vitest';
import {parseProject} from '@gharplan/core-model';
import type {ProjectDoc} from '@gharplan/core-model';
import fixture from '../../../../docs/examples/sample-project.json';
import {LOW_WALL_MM,hungAboveCut,lowerWalls} from './cutaway';
import {buildScene} from './mesh';
import {SceneAdapter} from './scene';

// D76 low-wall overview. Claude-authored; expected values from the H.6 sample's numbers.
const parsed=parseProject(JSON.stringify(fixture));if(!parsed.ok)throw new Error('sample');
const sample=parsed.document as ProjectDoc;

describe('D76 low walls',()=>{
 it('lowers 3000 mm walls to 1000 mm, keeps door gaps up to the new top and closes windows (sill 900 >= 1000 - 150)',()=>{
  const low=lowerWalls(sample,LOW_WALL_MM);
  expect(LOW_WALL_MM).toBe(1000);expect(low.walls.map(w=>w.height)).toEqual(sample.walls.map(()=>1000));
  expect(low.openings.map(o=>[o.id,o.sill,o.height])).toEqual([['o_main_door',0,1000],['o_bed_door',0,1000]]);
  expect(low.roofs).toBeUndefined();
  expect(sample.walls.every(w=>w.height===3000)).toBe(true);expect(sample.openings).toHaveLength(4); // the drawing itself is untouched
 });
 it('keeps walls already below the cut and a window whose sill is low enough',()=>{
  const short={...sample,walls:sample.walls.map((w,i)=>i===0?{...w,height:800}:w),openings:sample.openings.map(o=>o.id==='o_win_bed'?{...o,sill:600}:o)};
  const low=lowerWalls(short,1000);
  expect(low.walls[0]!.height).toBe(800);expect(low.openings.find(o=>o.id==='o_win_bed')).toMatchObject({sill:600,height:400});
 });
 it('D77 leaves out raised pieces whose middle is above the cut and keeps floor-standing and table-top pieces',()=>{
  const piece=(elevation:number,h:number)=>({elevation,size:{w:500,d:500,h}});
  // Picture 1250–1900 (middle 1575) and window-length curtains 760–2305 (middle 1532.5) hang on cut-away wall.
  expect(hungAboveCut(piece(1250,650),1000)).toBe(true);expect(hungAboveCut(piece(760,1545),1000)).toBe(true);
  // A table lamp on a 520 mm bedside table (middle 745) and floor-length curtains (elevation 0) stay.
  expect(hungAboveCut(piece(520,450),1000)).toBe(false);expect(hungAboveCut(piece(0,2425),1000)).toBe(false);
  // The middle exactly at the cut stays; 1 mm higher is left out. Full walls (no cut) show everything.
  expect(hungAboveCut(piece(600,800),1000)).toBe(false);expect(hungAboveCut(piece(601,800),1000)).toBe(true);expect(hungAboveCut(piece(1250,650),undefined)).toBe(false);
 });
 it('D77 the 3D scene hides a picture-height piece only while the low walls are shown, and the drawing keeps it',()=>{
  const doc=structuredClone(sample);doc.furniture=doc.furniture.map((f,i)=>i===0?{...f,elevation:1300}:f);
  const raised=doc.furniture[0]!.id,adapter=new SceneAdapter('mid');
  const shown=()=>Object.fromEntries(adapter.group.children.filter(c=>c.userData.category==='furniture-placeholder').map(c=>[c.userData.entityId as string,c.visible]));
  try{
   adapter.apply(buildScene(doc),doc);expect(Object.values(shown()).every(Boolean)).toBe(true);
   adapter.setLowWalls(LOW_WALL_MM);adapter.apply(buildScene(lowerWalls(doc,LOW_WALL_MM)),doc);
   expect(shown()).toEqual(Object.fromEntries(doc.furniture.map(f=>[f.id,f.id!==raised])));
   adapter.setLowWalls(undefined);adapter.apply(buildScene(doc),doc);expect(Object.values(shown()).every(Boolean)).toBe(true);
   expect(doc.furniture[0]!.elevation).toBe(1300);
  }finally{adapter.dispose();}
 });
});
