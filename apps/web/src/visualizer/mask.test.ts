import {describe,expect,it} from 'vitest';
import fc from 'fast-check';
import {decodeMask,encodeMask,fillQuad,insideQuad,maskBounds,MaskHistory,rasterize,strokeSegment} from './mask';
import type {MaskOp} from './mask';
import type {Quad} from './homography';

// D85 Claude-authored builder tests; expected pixels are counted by hand.
const at=(m:Uint8Array,w:number,x:number,y:number)=>m[y*w+x];
const RECT:Quad=[[2,2],[6,2],[6,5],[2,5]];

describe('D85 mask raster',()=>{
 it('a brush dot is solid inside r − ½, half at distance r and empty beyond r + ½',()=>{
  const m=new Uint8Array(21*21);strokeSegment(m,21,21,'brush',3,[10.5,10.5],[10.5,10.5]);
  expect(at(m,21,10,10)).toBe(255);expect(at(m,21,12,10)).toBe(255);// distance 2
  expect(at(m,21,13,10)).toBe(128);// distance 3: coverage ½ → round(127.5)
  expect(at(m,21,14,10)).toBe(0);expect(at(m,21,0,0)).toBe(0);
  // The eraser takes coverage away: the same dot clears the centre; at distance 3 it allows at most 255 − 128 = 127.
  strokeSegment(m,21,21,'erase',3,[10.5,10.5],[10.5,10.5]);expect(at(m,21,10,10)).toBe(0);expect(at(m,21,12,10)).toBe(0);expect(at(m,21,13,10)).toBe(127);
 });
 it('a stroke covers the whole segment, not only its ends',()=>{
  const m=new Uint8Array(40*10),dirty=strokeSegment(m,40,10,'brush',2,[5.5,5.5],[30.5,5.5]);
  for(let x=5;x<=30;x++)expect(at(m,40,x,5)).toBe(255);
  expect(at(m,40,18,8)).toBe(0);// 3 px from the line
  expect(dirty).toEqual({x0:2,y0:2,x1:34,y1:9});
 });
 it('the four-corner fill takes exactly the pixels whose centres are inside',()=>{
  const m=new Uint8Array(10*8);fillQuad(m,10,8,RECT);
  let n=0;for(let y=0;y<8;y++)for(let x=0;x<10;x++){const inside=x>=2&&x<=5&&y>=2&&y<=4;expect(at(m,10,x,y)).toBe(inside?255:0);n+=inside?1:0;}
  expect(n).toBe(12);expect(maskBounds(m,10,8)).toEqual({x0:2,y0:2,x1:6,y1:5});expect(maskBounds(new Uint8Array(4),2,2)).toBeUndefined();
  expect(insideQuad(RECT,4,3)).toBe(true);expect(insideQuad(RECT,7,3)).toBe(false);
 });
});

describe('D85 mask history',()=>{
 const w=30,h=20,dot:MaskOp={kind:'brush',radius:3,points:[[5,5]]},quad:MaskOp={kind:'quad',quad:[[10,2],[25,2],[25,15],[10,15]]};
 it('Undo and Redo walk back and forth; the plane is the newest quad since the last Clear',()=>{
  const hist=new MaskHistory(w,h);expect(hist.isEmpty()).toBe(true);expect(hist.canUndo).toBe(false);
  hist.apply(dot);const afterDot=hist.mask.slice();hist.apply(quad);const afterQuad=hist.mask.slice();
  expect(hist.plane()).toEqual(quad.quad);
  expect(hist.undo()).toBe(true);expect(hist.mask).toEqual(afterDot);expect(hist.plane()).toBeNull();
  expect(hist.redo()).toBe(true);expect(hist.mask).toEqual(afterQuad);expect(hist.plane()).toEqual(quad.quad);
  hist.apply({kind:'clear'});expect(hist.isEmpty()).toBe(true);expect(hist.plane()).toBeNull();
  hist.undo();expect(hist.mask).toEqual(afterQuad);expect(hist.plane()).toEqual(quad.quad);
  // A new step after Undo drops the redo steps.
  hist.undo();hist.apply({kind:'erase',radius:2,points:[[5,5]]});expect(hist.canRedo).toBe(false);expect(hist.size).toBe(2);
 });
 it('a stroke already drawn live is recorded without drawing it twice and undoes like any step',()=>{
  const hist=new MaskHistory(w,h),op:MaskOp={kind:'brush',radius:2,points:[[3,3],[12,3]]};
  rasterize(hist.mask,w,h,op);const drawn=hist.mask.slice();hist.apply(op,true);expect(hist.mask).toEqual(drawn);
  hist.undo();expect(hist.isEmpty()).toBe(true);hist.redo();expect(hist.mask).toEqual(drawn);
 });
 it('keeps at most maxOps undo steps; older steps are baked into the base',()=>{
  const hist=new MaskHistory(w,h,3),ops:MaskOp[]=[dot,quad,{kind:'brush',radius:2,points:[[2,18]]},{kind:'erase',radius:2,points:[[12,4]]},{kind:'brush',radius:1,points:[[28,1]]}];
  const states:Uint8Array[]=[];for(const op of ops){hist.apply(op);states.push(hist.mask.slice());}
  let undone=0;while(hist.undo())undone++;
  expect(undone).toBe(3);expect(hist.mask).toEqual(states[1]);expect(hist.plane()).toEqual(quad.quad);
 });
 it('property: Undo then Redo of any step sequence restores the exact mask',()=>{
  const point=fc.tuple(fc.double({min:-5,max:35,noNaN:true}),fc.double({min:-5,max:25,noNaN:true}));
  const op:fc.Arbitrary<MaskOp>=fc.oneof(
   fc.record({kind:fc.constantFrom('brush' as const,'erase' as const),radius:fc.double({min:1,max:8,noNaN:true}),points:fc.array(point,{minLength:1,maxLength:4})}),
   fc.constant({kind:'clear'} as const),
   fc.constant({kind:'quad',quad:[[4,4],[20,3],[22,16],[3,15]]} as const));
  fc.assert(fc.property(fc.array(op,{minLength:1,maxLength:12}),fc.nat(12),(list,back)=>{
   const hist=new MaskHistory(w,h,40);for(const o of list)hist.apply(o);const final=hist.mask.slice(),plane=hist.plane();
   const n=Math.min(back,list.length);for(let i=0;i<n;i++)hist.undo();for(let i=0;i<n;i++)hist.redo();
   expect(hist.mask).toEqual(final);expect(hist.plane()).toEqual(plane);
  }),{numRuns:120});
 });
});

// D87 Claude-authored builder tests.
describe('D87 saved masks',()=>{
 it('runs: value byte then a base-128 length, decoded byte for byte',()=>{
  // 3 zeros, 1 × 128, 200 × 255: 200 = 72 + 1·128 → bytes 200, 1 (72 | 128 = 200).
  const m=new Uint8Array([0,0,0,128,...new Array<number>(200).fill(255)]);
  expect(Array.from(encodeMask(m))).toEqual([0,3,128,1,255,200,1]);
  expect(decodeMask(encodeMask(m),m.length)).toEqual(m);
  expect(encodeMask(new Uint8Array(0)).length).toBe(0);expect(decodeMask(new Uint8Array(0),0)).toEqual(new Uint8Array(0));
  // A full 1536×1024 empty mask is one run: value 0 and 1 572 864 = 3 base-128 digits.
  expect(encodeMask(new Uint8Array(1536*1024)).length).toBe(4);
 });
 it('refuses damaged data: too short, too long, a zero run or a cut length',()=>{
  expect(()=>decodeMask(Uint8Array.from([0,3]),4)).toThrow('mask-data');
  expect(()=>decodeMask(Uint8Array.from([0,5]),4)).toThrow('mask-data');
  expect(()=>decodeMask(Uint8Array.from([0,0,9,4]),4)).toThrow('mask-data');
  expect(()=>decodeMask(Uint8Array.from([0,128]),4)).toThrow('mask-data');
 });
 it('property: any mask survives encode → decode exactly',()=>{
  fc.assert(fc.property(fc.uint8Array({maxLength:3000}),fc.array(fc.tuple(fc.integer({min:0,max:255}),fc.integer({min:1,max:400})),{maxLength:20}),(noise,runs)=>{
   const m=Uint8Array.from([...noise,...runs.flatMap(([v,n])=>new Array<number>(n).fill(v))]);
   expect(decodeMask(encodeMask(m),m.length)).toEqual(m);
  }),{numRuns:300});
 });
 it('a loaded mask and plane are the new start: undo cannot go before them, Clear then Undo brings them back',()=>{
  const h=new MaskHistory(10,8),saved=new Uint8Array(80);saved.fill(255,20,40);saved[41]=77;
  expect(h.canClear).toBe(false);h.load(saved,RECT);expect(h.canClear).toBe(true);
  expect(h.mask).toEqual(saved);expect(h.plane()).toEqual(RECT);expect(h.canUndo).toBe(false);expect(h.canRedo).toBe(false);
  h.apply({kind:'clear'});expect(h.isEmpty()).toBe(true);expect(h.plane()).toBeNull();
  h.undo();expect(h.mask).toEqual(saved);expect(h.plane()).toEqual(RECT);
  expect(()=>h.load(new Uint8Array(3),null)).toThrow('mask-size');
 });
 it('redraw drops a live stroke that was never recorded',()=>{
  const h=new MaskHistory(21,21);h.apply({kind:'brush',radius:2,points:[[5,5]]});const kept=new Uint8Array(h.mask);
  strokeSegment(h.mask,21,21,'brush',3,[15,15],[18,18]);expect(h.mask).not.toEqual(kept);
  h.redraw();expect(h.mask).toEqual(kept);
 });
});
