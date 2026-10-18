import {describe,expect,it} from 'vitest';
import fc from 'fast-check';
import {createRoomsProject} from '@gharplan/core-model';
import {acceptSketch,readSketch} from './sketch';

// D73 AI-3 Claude-authored checks; expected rectangles are worked out by hand in docs/verification/d73-ai-furniture.md.
const build=(rooms:Parameters<typeof createRoomsProject>[0]['rooms'])=>{let n=0;return createRoomsProject({rooms,name:'Sketch',units:'metric',now:'2026-10-18T00:00:00Z',nextId:()=>`sk_${n++}`,roomName:t=>t});};
/** A white picture with black filled pixel rectangles [x0, y0, x1, y1] (inclusive). */
function picture(w:number,h:number,ink:readonly (readonly [number,number,number,number])[]){
 const data=new Uint8ClampedArray(w*h*4).fill(255);
 for(const [x0,y0,x1,y1] of ink)for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)data.set([0,0,0,255],(y*w+x)*4);
 return {width:w,height:h,data};
}
// 200 x 150 px at 10 m wide = 50 mm per pixel. Two-pixel lines: outline x 20..181, y 20..131.
const outline=[[20,20,181,21],[20,130,181,131],[20,20,21,131],[180,20,181,131]] as const;

describe('D73 acceptSketch',()=>{
 it('merges near edges onto one 50 mm line',()=>{
  // x edges -100 | 3990, 4110 -> 4050 | 7090 -> 7100; y edges -100, -90 -> -100 | 3110, 3120 -> 3100.
  expect(acceptSketch({rooms:[{x:-100,y:-100,width:4210,depth:3220,type:'living'},{x:3990,y:-90,width:3100,depth:3200,type:'bedroom'}]})).toEqual({rooms:[{x:-100,y:-100,width:4150,depth:3200,type:'living'},{x:4050,y:-100,width:3050,depth:3200,type:'bedroom'}],dropped:0});
 });
 it('drops overlaps, wrong sizes and malformed entries; unknown types become other',()=>{
  const out=acceptSketch([{x:0,y:0,width:4000,depth:4000,type:'garage'},{x:1000,y:1000,width:2000,depth:2000},{x:5000,y:0,width:1000,depth:3000},{x:5000,y:0,width:16000,depth:3000},{x:'5000',y:0,width:3000,depth:3000},null]);
  expect(out).toEqual({rooms:[{x:0,y:0,width:4000,depth:4000,type:'other'}],dropped:5});
  expect(acceptSketch('rooms')).toEqual({rooms:[],dropped:0});
  // A too-small shape is dropped before merging, so its edge at x 4200 cannot pull the good room's 4000 edge to 4100.
  expect(acceptSketch([{x:0,y:0,width:4000,depth:4000},{x:4200,y:0,width:500,depth:500}])).toEqual({rooms:[{x:0,y:0,width:4000,depth:4000,type:'other'}],dropped:1});
 });
 it('staggers the four-way crossing of an exact 2 x 2 grid by 150 mm so every room can be built',()=>{
  const grid=[[0,0],[3000,0],[0,3000],[3000,3000]].map(([x,y])=>({x:x!,y:y!,width:3000,depth:3000,type:'bedroom' as const}));
  const out=acceptSketch(grid);
  expect(out.rooms.map(r=>[r.x,r.y,r.width,r.depth])).toEqual([[0,0,3000,3000],[3000,0,3000,3150],[0,3000,3000,3000],[3000,3150,3000,2850]]);
  expect(build(out.rooms).skipped).toEqual([]);
  expect(build(grid).skipped).toEqual([2,3]);
 });
 it('property: any grid of 1-3 by 1-3 rooms of 2500-4500 mm builds with nothing skipped after acceptSketch',()=>{
  fc.assert(fc.property(fc.array(fc.integer({min:50,max:90}),{minLength:1,maxLength:3}),fc.array(fc.integer({min:50,max:90}),{minLength:1,maxLength:3}),(cols,rows)=>{
   const xs=cols.reduce<number[]>((a,c)=>[...a,a.at(-1)!+c*50],[0]),ys=rows.reduce<number[]>((a,c)=>[...a,a.at(-1)!+c*50],[0]);
   const rooms=rows.flatMap((_,j)=>cols.map((__,i)=>({x:xs[i]!,y:ys[j]!,width:xs[i+1]!-xs[i]!,depth:ys[j+1]!-ys[j]!,type:'other' as const})));
   const out=acceptSketch(rooms);
   expect(out.rooms).toHaveLength(rooms.length);
   expect(build(out.rooms).skipped).toEqual([]);
  }),{seed:20261018,numRuns:25});
 });
});

describe('D73 offline sketch reader',()=>{
 it('two rooms with an 800 mm door gap in the partition: the gap is closed and both rooms are found',()=>{
  // Partition x 100..101 with rows 40..55 left open (16 px = 800 mm). Thickening r = 500 / 50 = 10 px.
  // Left inside x 22..99, y 22..129 -> after thickening x 32..89, y 32..119 -> mm (32-10)*50-100 = 1000 .. (89+1+10)*50+100 = 5100.
  const rooms=readSketch(picture(200,150,[...outline,[100,20,101,39],[100,56,101,131]]),10000);
  expect(rooms).toEqual([{x:1000,y:1000,width:4100,depth:5600,type:'living'},{x:5000,y:1000,width:4100,depth:5600,type:'bedroom'}]);
  // Merged by the boundary onto the partition's ink centre, x 101 px = 5050 mm.
  expect(acceptSketch(rooms).rooms.map(r=>[r.x,r.width])).toEqual([[1000,4050],[5050,4050]]);
 });
 it('a 1600 mm gap is too wide to close, so the two rooms read as one',()=>{
  // Rows 40..71 open (32 px); thickening covers rows to 49 from above and from 62 below, leaving 50..61 open.
  expect(readSketch(picture(200,150,[...outline,[100,20,101,39],[100,72,101,131]]),10000)).toEqual([{x:1000,y:1000,width:8100,depth:5600,type:'living'}]);
 });
 it('an open outline has no enclosed room; bad input gives nothing',()=>{
  expect(readSketch(picture(200,150,outline.slice(0,3)),10000)).toEqual([]);
  expect(readSketch(picture(200,150,outline),1000)).toEqual([]);
  expect(readSketch({width:200,height:150,data:new Uint8ClampedArray(10)},10000)).toEqual([]);
 });
 it('room type guesses: largest living, under 4.5 m² bathroom, otherwise bedroom',()=>{
  // Partition x 150..151; a cross line y 70..71 east of it.
  // Left: inside x 22..149 -> thickened 32..139 -> mm 1000 .. (139+1+10)*50+100 = 7600, so 6600 x 5600.
  // Upper right: inside x 152..179, y 22..69 -> thickened x 162..169, y 32..59 -> 7500..9100 by 1000..3600: 1600 x 2600 = 4.16 m².
  // Lower right: inside y 72..129 -> thickened 82..119 -> 3500..6600: 1600 x 3100 = 4.96 m².
  const rooms=readSketch(picture(200,150,[...outline,[150,20,151,131],[150,70,181,71]]),10000);
  expect(rooms.map(r=>[r.x,r.y,r.width,r.depth,r.type])).toEqual([[1000,1000,6600,5600,'living'],[7500,1000,1600,2600,'bathroom'],[7500,3500,1600,3100,'bedroom']]);
 });
});
