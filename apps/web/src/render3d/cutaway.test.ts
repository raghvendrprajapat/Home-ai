import {describe,expect,it} from 'vitest';
import {parseProject} from '@gharplan/core-model';
import type {ProjectDoc} from '@gharplan/core-model';
import fixture from '../../../../docs/examples/sample-project.json';
import {LOW_WALL_MM,lowerWalls} from './cutaway';

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
});
