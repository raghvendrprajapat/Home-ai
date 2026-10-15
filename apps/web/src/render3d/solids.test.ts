import {expect,it} from 'vitest';
import fc from 'fast-check';
import type {ProjectDoc} from '@gharplan/core-model';
import sample from '../../../../docs/examples/sample-project.json';
import {buildWallSolids} from './solids';
const fixture=sample as ProjectDoc;
const single=(length=5000,thickness=115,height=3000):ProjectDoc=>{
 const d=structuredClone(fixture);d.junctions=[{id:'a',floorId:'f0',x:0,y:0},{id:'b',floorId:'f0',x:length,y:0}];d.walls=[{...d.walls[0]!,id:'wall',a:'a',b:'b',thickness,height}];d.rooms=[];d.furniture=[];d.openings=[];return d;
};
const volume=(d:ProjectDoc)=>buildWallSolids(d).boxes.reduce((sum,b)=>sum+(b.hi[0]-b.lo[0])*(b.hi[1]-b.lo[1])*(b.hi[2]-b.lo[2]),0);
it('shared solid height bands conserve analytic volume with disjoint door/window voids',()=>{
 const d=single();d.openings=[{...fixture.openings[0]!,id:'door',wallId:'wall',offset:1500,width:900,height:2100,sill:0},{...fixture.openings[2]!,id:'window',wallId:'wall',offset:3500,width:1000,height:1200,sill:900}];
 expect(volume(d)).toBe((5115*3000-900*2100-1000*1200)*115);
 const s=buildWallSolids(d);expect(s.faces.some(f=>f.axis===1&&f.at===900)).toBe(true);expect(s.faces.some(f=>f.axis===1&&f.at===2100)).toBe(true);
 const before=JSON.stringify(d);buildWallSolids(d);expect(JSON.stringify(d)).toBe(before);
});
it('random free-wall caps/thickness/openings preserve exact mm³ under reversal and 3D translation',()=>{
 fc.assert(fc.property(fc.integer({min:3000,max:9000}),fc.integer({min:50,max:1000}),fc.integer({min:2200,max:6000}),fc.integer({min:-20000,max:20000}),(length,t,height,offset)=>{
  const d=single(length,t,height);d.openings=[{...fixture.openings[2]!,wallId:'wall',offset:1500,width:1000,height:1200,sill:900}];
  const expected=((length+t)*height-1200000)*t;expect(volume(d)).toBe(expected);
  const sides=buildWallSolids(d).longitudinalSides;expect(sides).toHaveLength(8);
  for(const side of sides){expect(side.axis).toBe(2);expect(side.at).toBe(side.sign*t/2);if(side.rect[1]===900)expect([[ -t/2,1000],[2000,length+t/2]]).toContainEqual([side.rect[0],side.rect[2]]);else{expect(side.rect[0]).toBe(-t/2);expect(side.rect[2]).toBe(length+t/2);}}
  [d.walls[0]!.a,d.walls[0]!.b]=[d.walls[0]!.b,d.walls[0]!.a];d.openings[0]!.offset=length-1500;
  for(const j of d.junctions){j.x+=offset;j.y-=offset;}d.floors[0]!.elevation=offset;
  expect(volume(d)).toBe(expected);
 }),{seed:20261015,numRuns:150});
});
it('host opening never subtracts the perpendicular T solid, including unequal-height caps',()=>{
 const d=single(4000,200,3000);d.junctions.push({id:'middle',floorId:'f0',x:2000,y:0},{id:'end',floorId:'f0',x:2000,y:2000});
 d.walls=[{...d.walls[0]!,b:'middle'},{...d.walls[0]!,id:'right',a:'middle'}, {...d.walls[0]!,id:'stub',a:'middle',b:'end',height:1500}];
 d.openings=[{...fixture.openings[0]!,wallId:'wall',offset:1500,width:1000,height:2100,sill:0}];
 const s=buildWallSolids(d);
 // Union ownership may split this interval at the host junction; test both sides.
 for(const x of [1950,2050])expect(s.boxes.some(b=>b.lo[0]<x&&b.hi[0]>x&&b.lo[2]<=0&&b.hi[2]>0&&b.lo[1]<=500&&b.hi[1]>500)).toBe(true);
 expect(s.boxes.some(b=>b.ownerId==='stub'&&b.hi[1]>1500)).toBe(false);
 expect(s.faces.some(f=>f.axis===1&&f.at===1500&&f.sign===1)).toBe(true);
 const hostSides=s.longitudinalSides.filter(f=>f.ownerId==='wall'&&f.axis===2&&f.sign===1);
 expect(hostSides.map(f=>[f.rect[1],f.rect[3],f.rect[0],f.rect[2]])).toEqual([[0,1500,-100,1000],[0,1500,2000,2100],[1500,2100,-100,1000],[2100,3000,-100,2000]]);
});
