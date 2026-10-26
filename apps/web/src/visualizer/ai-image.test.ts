import {describe,expect,it} from 'vitest';
import fc from 'fast-check';
import {compositeInMask,crc32,decodeMaskPng,encodeMaskPng,selectionFromImage} from './ai-image';
import {MaskHistory} from './mask';
import type {Pixels} from './photo-prep';

// D86 Claude-authored builder tests (not independent fixtures). Expected values are analytic: published CRC-32 check
// values, the PNG layout from the PNG specification, and the blend formula written out by hand.
const enc=new TextEncoder();
async function inflate(bytes:Uint8Array):Promise<Uint8Array>{return new Uint8Array(await new Response(new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());}
/** Splits a PNG into chunks by hand (independent of decodeMaskPng). */
function chunks(png:Uint8Array){
 const view=new DataView(png.buffer,png.byteOffset,png.byteLength),out:{type:string;data:Uint8Array;crc:number}[]=[];
 for(let at=8;at<png.length;){const n=view.getUint32(at);out.push({type:String.fromCharCode(...png.subarray(at+4,at+8)),data:png.subarray(at+8,at+8+n),crc:view.getUint32(at+8+n)});at+=12+n;}
 return out;
}

describe('CRC-32',()=>{
 it('matches the published check values',()=>{
  expect(crc32(enc.encode('123456789'))).toBe(0xcbf43926);
  expect(crc32(enc.encode('IEND'))).toBe(0xae426082);
  expect(crc32(new Uint8Array(0))).toBe(0);
 });
});

describe('mask PNG for the AI (white = change, black = keep)',()=>{
 it('is an 8-bit greyscale PNG at exactly the photo size, rows unfiltered, values = mask bytes',async()=>{
  const w=5,h=3,mask=new Uint8Array(w*h);mask[0]=255;mask[7]=255;mask[8]=128;mask[14]=255;
  const png=new Uint8Array(await (await encodeMaskPng(mask,w,h)).arrayBuffer());
  expect([...png.subarray(0,8)]).toEqual([137,80,78,71,13,10,26,10]);
  const list=chunks(png);
  expect(list.map(c=>c.type)).toEqual(['IHDR','IDAT','IEND']);
  const ihdr=new DataView(list[0]!.data.buffer,list[0]!.data.byteOffset,13);
  expect([ihdr.getUint32(0),ihdr.getUint32(4),list[0]!.data[8],list[0]!.data[9],list[0]!.data[10],list[0]!.data[11],list[0]!.data[12]]).toEqual([5,3,8,0,0,0,0]);
  for(const c of list){const typed=new Uint8Array(4+c.data.length);typed.set(enc.encode(c.type));typed.set(c.data,4);expect(c.crc).toBe(crc32(typed));}
  const raw=await inflate(list[1]!.data);
  // Row y starts with filter byte 0, then pixels x = 0..4: index 7 = (2,1), 8 = (3,1), 14 = (4,2).
  expect([...raw]).toEqual([0,255,0,0,0,0, 0,0,0,255,128,0, 0,0,0,0,0,255]);
  const blob=await encodeMaskPng(mask,w,h);expect(blob.type).toBe('image/png');
 });
 it('round-trips through decodeMaskPng and refuses anything else',async()=>{
  const w=37,h=11,mask=Uint8Array.from({length:w*h},(_,i)=>i*7%256);
  const png=new Uint8Array(await (await encodeMaskPng(mask,w,h)).arrayBuffer());
  expect(await decodeMaskPng(png)).toEqual({width:w,height:h,mask});
  const broken=png.slice();broken[40]=broken[40]!^1;
  expect(await decodeMaskPng(broken)).toBeNull();
  expect(await decodeMaskPng(png.subarray(0,30))).toBeNull();
  await expect(encodeMaskPng(new Uint8Array(3),2,2)).rejects.toThrow('mask-size');
 });
});

const pixels=(w:number,h:number,data:number[]):Pixels=>({width:w,height:h,data:Uint8ClampedArray.from(data)});
describe('local composite',()=>{
 it('m = 255 takes the AI pixel, m = 0 keeps the photo, a soft edge blends by hand formula, alpha is the photo\'s',()=>{
  const photo=pixels(3,1,[10,20,30,255, 100,100,100,200, 200,0,50,255]),ai=pixels(3,1,[250,240,230,1, 0,0,0,9, 9,9,9,9]);
  const out=compositeInMask(photo,ai,Uint8Array.from([255,0,51]));
  // (200·204 + 9·51)/255 = 41259/255 = 161.8 → 162; (0·204 + 9·51)/255 = 1.8 → 2; (50·204 + 9·51)/255 = 41.8 → 42.
  expect([...out.data]).toEqual([250,240,230,255, 100,100,100,200, 162,2,42,255]);
  expect(out.changed).toBe(2);
  expect(()=>compositeInMask(photo,pixels(1,1,[0,0,0,0]),new Uint8Array(3))).toThrow('composite-size');
 });
 it('property: every pixel outside the mask is byte-identical to the photo, whatever the AI returned',()=>{
  fc.assert(fc.property(fc.integer({min:1,max:12}),fc.integer({min:1,max:12}),fc.integer(),(w,h,seed)=>{
   let x=seed|0;const rnd=()=>{x=(x*1103515245+12345)&0x7fffffff;return x>>16&255;};
   const n=w*h,photo=pixels(w,h,Array.from({length:n*4},rnd)),ai=pixels(w,h,Array.from({length:n*4},rnd)),mask=Uint8Array.from({length:n},()=>{const v=rnd();return v<128?0:v;});
   const out=compositeInMask(photo,ai,mask);
   for(let i=0;i<n;i++){
    if(out.data[i*4+3]!==photo.data[i*4+3])return false;
    for(let c=0;c<3;c++){
     const p=photo.data[i*4+c]!,a=ai.data[i*4+c]!,o=out.data[i*4+c]!;
     if(mask[i]===0&&o!==p)return false;
     if(mask[i]===255&&o!==a)return false;
     if(o<Math.min(p,a)||o>Math.max(p,a))return false;
    }
   }
   return true;
  }));
 });
});

describe('tap-to-select answer',()=>{
 it('bright opaque pixels become a hard selection in their bounding box',()=>{
  const w=4,h=3,rgba=new Uint8ClampedArray(w*h*4);
  const set=(x:number,y:number,v:number,a=255)=>{const i=(y*w+x)*4;rgba[i]=rgba[i+1]=rgba[i+2]=v;rgba[i+3]=a;};
  set(1,1,255);set(2,1,200);set(2,2,127);set(3,0,255,0);set(0,0,90);
  expect(selectionFromImage(rgba,w,h)).toEqual({box:{x0:1,y0:1,x1:3,y1:2},data:Uint8Array.from([255,255])});
  expect(selectionFromImage(new Uint8ClampedArray(16),2,2)).toBeUndefined();
 });
 it('is added to the area as one undoable union step that only ever adds',()=>{
  const h=new MaskHistory(4,3);h.apply({kind:'quad',quad:[[0,0],[1,0],[1,1],[0,1]]});
  const before=new Uint8Array(h.mask);
  h.apply({kind:'union',box:{x0:1,y0:1,x1:3,y1:3},data:Uint8Array.from([255,0,128,255])});
  expect([...h.mask]).toEqual([255,0,0,0, 0,255,0,0, 0,128,255,0]);
  expect(h.plane()).toEqual([[0,0],[1,0],[1,1],[0,1]]);
  h.undo();expect(h.mask).toEqual(before);
  h.redo();expect(h.mask[5]).toBe(255);
  // A box outside the photo or with the wrong byte count changes nothing.
  const kept=new Uint8Array(h.mask);
  h.apply({kind:'union',box:{x0:3,y0:2,x1:5,y1:3},data:Uint8Array.from([255,255])});
  h.apply({kind:'union',box:{x0:0,y0:0,x1:2,y1:1},data:Uint8Array.from([255])});
  expect(h.mask).toEqual(kept);
 });
});
