import {describe,expect,it} from 'vitest';
import fc from 'fast-check';
import {GROUT_SHARE,luminance,referenceLuminance,renderSurface,shadeBlurRadius,shadeFactor,SHADE_MAX,smoothLuminance} from './surface-engine';
import type {SurfaceEditRequest} from './surface-engine';
import {fillQuad} from './mask';
import type {Quad} from './homography';
import type {Pixels} from './photo-prep';
import {standInSurface} from './surface-provider';

// D85 Claude-authored builder tests for the offline engine; expected colours are worked out by hand in comments.
const image=(w:number,h:number,rgb:(x:number,y:number)=>readonly [number,number,number]):Pixels=>{const data=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const [r,g,b]=rgb(x,y);data.set([r,g,b,255],(y*w+x)*4);}return {width:w,height:h,data};};
const px=(p:Pixels,x:number,y:number)=>Array.from(p.data.subarray((y*p.width+x)*4,(y*p.width+x)*4+4));
const maskOf=(w:number,h:number,on:(x:number,y:number)=>number)=>{const m=new Uint8Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++)m[y*w+x]=on(x,y);return m;};
const paint=(rgb:readonly [number,number,number])=>({kind:'paint',rgb} as const);

describe('D85 surface engine',()=>{
 it('luminance of a grey is the grey itself; shading is the light ratio, clamped',()=>{
  for(const g of [0,1,77,128,200,255])expect(luminance(g,g,g)).toBe(g);
  expect(shadeFactor(100,100)).toBe(1);expect(shadeFactor(200,100)).toBe(SHADE_MAX);expect(shadeFactor(150,100)).toBe(1.5);expect(shadeFactor(50,100)).toBe(.5);
  expect(shadeFactor(255,50)).toBe(1.8);expect(shadeFactor(0,100)).toBe(.2);expect(shadeFactor(30,0)).toBe(1);
 });
 it('pixels outside the mask stay byte-identical and the alpha channel is never touched',()=>{
  // A colourful photo; only the left half (x < 6) is chosen.
  const photo=image(12,9,(x,y)=>[(x*37+y*11)%256,(x*5+y*90)%256,(x*120+y*3)%256]),mask=maskOf(12,9,x=>x<6?255:0);
  for(let i=3;i<photo.data.length;i+=8)photo.data[i]=200+(i%50);
  const out=renderSurface({photo,mask,plane:null,material:paint([10,200,90])});
  for(let y=0;y<9;y++)for(let x=0;x<12;x++){if(x>=6)expect(px(out,x,y)).toEqual(px(photo,x,y));expect(px(out,x,y)[3]).toBe(px(photo,x,y)[3]);}
  expect(out.data).not.toBe(photo.data);
 });
 it('property: whatever the photo, mask and colour, unmasked pixels never change',()=>{
  fc.assert(fc.property(fc.uint8Array({minLength:6*5*4,maxLength:6*5*4}),fc.uint8Array({minLength:30,maxLength:30}),fc.tuple(fc.nat(255),fc.nat(255),fc.nat(255)),(bytes,mask,rgb)=>{
   const photo={width:6,height:5,data:new Uint8ClampedArray(bytes)},before=photo.data.slice(),out=renderSurface({photo,mask,plane:null,material:paint(rgb)});
   for(let i=0;i<30;i++)if(!mask[i])expect(Array.from(out.data.subarray(i*4,i*4+4))).toEqual(Array.from(before.subarray(i*4,i*4+4)));
   expect(photo.data).toEqual(before);
  }),{numRuns:150});
 });
 it('an evenly lit area takes the chosen colour exactly',()=>{
  const photo=image(8,8,()=>[128,128,128]),out=renderSurface({photo,mask:maskOf(8,8,()=>255),plane:null,material:paint([200,100,50])});
  for(let y=0;y<8;y++)for(let x=0;x<8;x++)expect(px(out,x,y)).toEqual([200,100,50,255]);
 });
 it('keeps the light: a shadow at half the light stays at half, a lit patch at 1.5× stays at 1.5×',()=>{
  // Per row: 2 px at luminance 50, 4 px at 100, 2 px at 150. The lower median is 100, so the shading is 0.5, 1 and 1.5:
  // colour (60, 90, 120) becomes (30, 45, 60), (60, 90, 120) and (90, 135, 180).
  const photo=image(8,8,x=>x<2?[50,50,50]:x<6?[100,100,100]:[150,150,150]),mask=maskOf(8,8,()=>255);
  expect(referenceLuminance(photo,mask)).toBe(100);
  const out=renderSurface({photo,mask,plane:null,material:paint([60,90,120])});
  expect(px(out,0,3)).toEqual([30,45,60,255]);expect(px(out,3,3)).toEqual([60,90,120,255]);expect(px(out,7,3)).toEqual([90,135,180,255]);
  // Brighter than 1.8× the reference is clamped: 255/100 → 1.8, so 100 becomes 180.
  const bright=image(3,1,x=>x<2?[100,100,100]:[255,255,255]);
  expect(px(renderSurface({photo:bright,mask:Uint8Array.from([255,255,255]),plane:null,material:paint([100,100,100])}),2,0)).toEqual([180,180,180,255]);
 });
 it('patterns use smoothed light: a thin dark line in the old floor does not print through, while paint keeps it',()=>{
  // 64×64 grey 128 with a dark 1 px line (28) at x = 32. Smoothing radius max(2, round(0.64)) = 2: a 5×5 average gives
  // (4·128 + 28)/5 = 108 on and next to the line → shading 108/128 = 0.84375 → 200 becomes 168.75 → 169.
  // Paint uses the pixel itself: 28/128 = 0.21875 → 43.75 → 44.
  expect(shadeBlurRadius(64,64)).toBe(2);
  const photo=image(64,64,x=>x===32?[28,28,28]:[128,128,128]),mask=maskOf(64,64,()=>255),tile=image(2,2,()=>[200,200,200]);
  const tiled=renderSurface({photo,mask,plane:null,material:{kind:'pattern',texture:tile,sizePx:16,rotate:0,grout:null}});
  expect(px(tiled,32,10)).toEqual([169,169,169,255]);expect(px(tiled,30,0)).toEqual([169,169,169,255]);expect(px(tiled,29,10)).toEqual([200,200,200,255]);
  expect(px(renderSurface({photo,mask,plane:null,material:paint([200,200,200])}),32,10)).toEqual([44,44,44,255]);
  // Only chosen pixels are averaged: a dark sofa (20) left of the chosen floor does not darken the floor's edge.
  const sofa=image(64,8,x=>x<32?[20,20,20]:[128,128,128]),right=maskOf(64,8,x=>x>=32?255:0);
  expect(smoothLuminance(sofa,right,{x0:32,y0:0,x1:64,y1:8},2).every(v=>v===128)).toBe(true);
  expect(px(renderSurface({photo:sofa,mask:right,plane:null,material:{kind:'pattern',texture:tile,sizePx:16,rotate:0,grout:null}}),32,4)).toEqual([200,200,200,255]);
 });
 it('soft mask edges blend: alpha 128 moves the pixel 128/255 of the way to the new colour',()=>{
  // Reference: the strong (≥ 128) pixels are all grey 100 → shading 1. New colour 255 from 100: 100 + 155·128/255 = 177.8 → 178.
  const photo=image(4,1,()=>[100,100,100]),out=renderSurface({photo,mask:Uint8Array.from([255,128,0,1]),plane:null,material:paint([255,255,255])});
  expect(px(out,0,0)).toEqual([255,255,255,255]);expect(px(out,1,0)).toEqual([178,178,178,255]);expect(px(out,2,0)).toEqual([100,100,100,255]);expect(px(out,3,0)).toEqual([101,101,101,255]);
 });
 it('the reference light is the lower median of the strongly chosen pixels',()=>{
  const photo=image(4,1,x=>{const g=[10,20,30,250][x]!;return [g,g,g];});
  expect(referenceLuminance(photo,Uint8Array.from([255,255,255,255]))).toBe(20);
  expect(referenceLuminance(photo,Uint8Array.from([0,0,255,40]))).toBe(30);// weak pixels are ignored while strong ones exist
  expect(referenceLuminance(photo,Uint8Array.from([0,0,0,40]))).toBe(250);
  expect(referenceLuminance(photo,new Uint8Array(4))).toBe(0);
 });
 // A 4×4 texture with a different colour in every texel.
 const texture=image(4,4,(x,y)=>[x*60+10,y*60+10,(x+y)*25]);
 it('a flat pattern repeats exactly every pattern size, across and down',()=>{
  const photo=image(40,40,()=>[128,128,128]),out=renderSurface({photo,mask:maskOf(40,40,()=>255),plane:null,material:{kind:'pattern',texture,sizePx:16,rotate:0,grout:null}});
  for(let y=0;y<40;y++)for(let x=0;x+16<40;x++)expect(px(out,x+16,y)).toEqual(px(out,x,y));
  for(let y=0;y+16<40;y++)for(let x=0;x<40;x++)expect(px(out,x,y+16)).toEqual(px(out,x,y));
  // Within one repeat it is not flat: texel columns differ.
  expect(px(out,2,2)).not.toEqual(px(out,10,2));
  // Pixel (2, 2) sits at texel (2.5/16·4, 2.5/16·4) = (0.625, 0.625): bilinear between texels 0 and 1 at 0.125 → red 10 + 60·0.125 = 17.5 → 18.
  expect(px(out,2,2)[0]).toBe(18);
 });
 it('a quarter turn swaps the pattern axes',()=>{
  const photo=image(16,16,()=>[128,128,128]),mask=maskOf(16,16,()=>255);
  const flat=renderSurface({photo,mask,plane:null,material:{kind:'pattern',texture,sizePx:16,rotate:0,grout:null}}),turned=renderSurface({photo,mask,plane:null,material:{kind:'pattern',texture,sizePx:16,rotate:90,grout:null}});
  // Turned (x, y) samples the flat pattern at (y, −x − 1 + 16) = (y, 15 − x).
  for(let y=0;y<16;y++)for(let x=0;x<16;x++)expect(px(turned,x,y)).toEqual(px(flat,y,15-x));
 });
 it('grout lines take the grout colour at the start of every repeat',()=>{
  const photo=image(32,32,()=>[128,128,128]),out=renderSurface({photo,mask:maskOf(32,32,()=>255),plane:null,material:{kind:'pattern',texture,sizePx:16,rotate:0,grout:[230,220,200]}});
  // Joint width max(1, 16 · 0.03) = 1 px: columns and rows 0 and 16.
  expect(Math.max(1,16*GROUT_SHARE)).toBe(1);
  for(const x of [0,16])for(let y=0;y<32;y++)expect(px(out,x,y)).toEqual([230,220,200,255]);
  for(const y of [0,16])expect(px(out,7,y)).toEqual([230,220,200,255]);
  expect(px(out,7,7)).not.toEqual([230,220,200,255]);
 });
 it('on a four-corner plane that is a plain rectangle, the pattern matches the flat pattern',()=>{
  const photo=image(32,16,()=>[128,128,128]),mask=maskOf(32,16,()=>255),plane:Quad=[[0,0],[32,0],[32,16],[0,16]];
  const material={kind:'pattern',texture,sizePx:8,rotate:0,grout:null} as const,flat=renderSurface({photo,mask,plane:null,material}),onPlane=renderSurface({photo,mask,plane,material});
  for(let i=0;i<flat.data.length;i++)expect(Math.abs(onPlane.data[i]!-flat.data[i]!)).toBeLessThanOrEqual(1);
 });
 it('a picture fills the four-corner quad once, in perspective, and nothing outside it',()=>{
  // Picture 20×20 with quadrants red | green over blue | white. Quad: the trapezoid (0,0),(40,0),(30,20),(10,20),
  // where by hand x = 10(4u + 2v)/(v + 1), y = 40v/(v + 1).
  const picture=image(20,20,(x,y)=>y<10?(x<10?[255,0,0]:[0,255,0]):(x<10?[0,0,255]:[255,255,255]));
  const photo=image(44,24,()=>[128,128,128]),plane:Quad=[[0,0],[40,0],[30,20],[10,20]],mask=new Uint8Array(44*24);fillQuad(mask,44,24,plane);
  const out=renderSurface({photo,mask,plane,material:{kind:'picture',image:picture}});
  // (12, 5): centre y 5.5 → v = 5.5/34.5 = 0.159; x 12.5 → u = (1.25(1 + v) − 2v)/4 = 0.283 → top-left (red).
  expect(px(out,12,5)).toEqual([255,0,0,255]);
  // (26, 5): u = (2.65·1.159 − 0.319)/4 = 0.688 → top-right (green).
  expect(px(out,26,5)).toEqual([0,255,0,255]);
  // (16, 17): v = 17.5/22.5 = 0.778; u = (1.65·1.778 − 1.556)/4 = 0.344 → bottom-left (blue).
  expect(px(out,16,17)).toEqual([0,0,255,255]);
  // (24, 17): u = (2.45·1.778 − 1.556)/4 = 0.700 → bottom-right (white).
  expect(px(out,24,17)).toEqual([255,255,255,255]);
  // The diagonal crossing (20, 13.3) is the picture centre: the horizontal colour seam is at y = 40/3, not at y = 10.
  expect(px(out,20,12)[2]).toBe(0);expect(px(out,20,14)[2]).toBe(255);
  for(let y=0;y<24;y++)for(let x=0;x<44;x++)if(!mask[y*44+x])expect(px(out,x,y)).toEqual([128,128,128,255]);
 });
 it('a picture without four corners is refused, and an empty mask changes nothing',()=>{
  const photo=image(4,4,()=>[9,9,9]);
  expect(()=>renderSurface({photo,mask:maskOf(4,4,()=>255),plane:null,material:{kind:'picture',image:photo}})).toThrow('surface-needs-corners');
  expect(renderSurface({photo,mask:new Uint8Array(16),plane:null,material:paint([1,2,3])}).data).toEqual(photo.data);
  expect(()=>renderSurface({photo,mask:new Uint8Array(3),plane:null,material:paint([1,2,3])})).toThrow('surface-size');
 });
});

describe('D85 stand-in provider',()=>{
 it('renders the same pixels as the engine, in slices, and can be cancelled',async()=>{
  const photo=image(64,48,(x,y)=>[x*4,y*5,100]),request:SurfaceEditRequest={photo,mask:maskOf(64,48,(x,y)=>x>8&&y>4?255:0),plane:null,material:paint([200,180,160])};
  const result=await standInSurface.render(request,new AbortController().signal);
  expect(standInSurface.kind).toBe('stand-in');expect(result.data).toEqual(renderSurface(request).data);expect(result.changed).toBeGreaterThan(0);
  const stop=new AbortController();stop.abort();await expect(standInSurface.render(request,stop.signal)).rejects.toMatchObject({name:'AbortError'});
 });
 it('performance on this machine: a full 1536×1024 area (paint, and a perspective pattern) is measured and reported',async()=>{
  const w=1536,h=1024,photo=image(w,h,(x,y)=>[(x*7)%256,(y*3)%256,(x+y)%256]),mask=new Uint8Array(w*h).fill(255);
  const plane:Quad=[[300,200],[1300,150],[1450,980],[120,1000]],tile=image(256,256,(x,y)=>[(x*3)%256,(y*5)%256,128]);
  const times:Record<string,number>={};
  for(const [name,material,quad] of [['paint',paint([210,190,170]),null],['pattern+plane',{kind:'pattern',texture:tile,sizePx:120,rotate:0,grout:[220,220,220]},plane]] as const){
   const t0=performance.now();renderSurface({photo,mask,plane:quad,material});times[`sync ${name}`]=Math.round(performance.now()-t0);
   const r=await standInSurface.render({photo,mask,plane:quad,material},new AbortController().signal);times[`sliced ${name}`]=Math.round(r.ms);
  }
  // Reported in the test output for the D85 notes; the bound only catches a pathological slowdown, not phone speed.
  console.info(`D85 engine timings (ms, 1536x1024, all pixels chosen): ${JSON.stringify(times)}`);
  for(const v of Object.values(times))expect(v).toBeLessThan(10000);
 },30000);
});
