import fc from 'fast-check';
import {describe,expect,it} from 'vitest';
import {AI_MAX_LONG,AI_MIN_PIXELS,aiSize,alphaMaskRgba,base64Bytes,encodeAlphaMaskPng} from './ai-prep';
import {publicEnvProblems,testModeConfig} from './test-mode';

const inflate=async(data:Uint8Array)=>new Uint8Array(await new Response(new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
// D92 AI test mode, pure preparation maths. Claude-authored builder tests with hand-worked values and properties.
describe('AI size (multiples of 16, long side ≤ 1536, ≥ 655 360 pixels, ≤ 3:1)',()=>{
 it('hand-worked examples',()=>{
  expect(aiSize(1536,1024)).toEqual({width:1536,height:1024});
  // 4:3 working photo 1365 × 1024: 1365/16 = 85.3 → 1360, 1024 stays.
  expect(aiSize(1365,1024)).toEqual({width:1360,height:1024});
  // 16:9 phone photo at working size 1536 × 864 (already multiples of 16).
  expect(aiSize(1536,864)).toEqual({width:1536,height:864});
  // A small 640 × 480 photo is enlarged to the minimum: s = √(655360/307200) = 1.4606 → 934.8 × 701.1 → 928 × 704 = 653 312 < min → 944 × 704.
  expect(aiSize(640,480)).toEqual({width:944,height:704});
  expect(aiSize(1536,512)).toEqual({width:1536,height:512});
  expect(aiSize(1600,500)).toBeNull();
  expect(aiSize(0,10)).toBeNull();
  // A smaller long-side target is honoured unless it would go below the minimum.
  expect(aiSize(1536,1024,1305)).toEqual({width:1312,height:864});
  expect(aiSize(1536,1024,100)).toEqual({width:992,height:672});
 });
 it('property: every accepted shape gives a valid size close to the photo shape',()=>{
  fc.assert(fc.property(fc.integer({min:32,max:1536}),fc.integer({min:32,max:1536}),fc.integer({min:64,max:1536}),(w,h,maxLong)=>{
   const size=aiSize(w,h,maxLong),ratio=w/h;
   if(ratio>3||ratio<1/3)return size===null;
   if(!size)return false;
   const {width,height}=size;
   return width%16===0&&height%16===0&&Math.max(width,height)<=AI_MAX_LONG&&width*height>=AI_MIN_PIXELS&&Math.max(width,height)<=3*Math.min(width,height)
    &&Math.abs(width/height/ratio-1)<=.04;
  }),{numRuns:5000});
 });
});

describe('alpha mask (transparent = edit)',()=>{
 it('at the same size: alpha 0 exactly where our mask is non-zero (soft edges included), 255 elsewhere, colour black',()=>{
  fc.assert(fc.property(fc.integer({min:1,max:24}),fc.integer({min:1,max:24}),fc.infiniteStream(fc.integer({min:0,max:255})),(w,h,values)=>{
   const it=values[Symbol.iterator](),mask=Uint8Array.from({length:w*h},()=>{const v=it.next().value as number;return v<128?0:v;});
   const rgba=alphaMaskRgba(mask,w,h,w,h);
   for(let i=0;i<w*h;i++){if(rgba[i*4]||rgba[i*4+1]||rgba[i*4+2])return false;if(rgba[i*4+3]!==(mask[i]?0:255))return false;}
   return true;
  }),{numRuns:300});
 });
 it('resized: an AI pixel is transparent when any working pixel it covers is chosen, so a 1-px line survives shrinking',()=>{
  const W=10,H=4,mask=new Uint8Array(W*H);mask[1*W+7]=255;// one pixel at (7, 1)
  const out=alphaMaskRgba(mask,W,H,5,2);// each AI pixel covers 2 × 2
  expect(Array.from({length:10},(_,i)=>out[i*4+3])).toEqual([255,255,255,0,255, 255,255,255,255,255]);
  const up=alphaMaskRgba(Uint8Array.from([0,255]),2,1,4,2);// enlarging: each working pixel covers 2 × 2 AI pixels
  expect(Array.from({length:8},(_,i)=>up[i*4+3])).toEqual([255,255,0,0,255,255,0,0]);
 });
 it('PNG bytes: 8-bit RGBA (colour type 6) of exactly the AI size with the expected samples',async()=>{
  const mask=Uint8Array.from([0,200,0,0, 0,0,0,255]),blob=await encodeAlphaMaskPng(mask,4,2,4,2),bytes=new Uint8Array(await blob.arrayBuffer());
  expect(blob.type).toBe('image/png');
  const view=new DataView(bytes.buffer);
  expect([view.getUint32(16),view.getUint32(20),bytes[24],bytes[25]]).toEqual([4,2,8,6]);
  const idatLength=view.getUint32(33),raw=await inflate(bytes.subarray(41,41+idatLength));
  expect(raw.length).toBe((4*4+1)*2);
  const alpha=[...[0,1].flatMap(y=>[0,1,2,3].map(x=>raw[y*17+1+x*4+3]))];
  expect(alpha).toEqual([255,0,255,255,255,255,255,0]);
 });
 it('base64 helper refuses anything that is not plain base64',()=>{
  expect(base64Bytes('/9j/')).toEqual(Uint8Array.from([255,216,255]));
  for(const bad of ['', 'abc', 'ab$=', null, 12])expect(base64Bytes(bad)).toBeNull();
 });
});

describe('test-mode configuration and the build guard',()=>{
 it('is off unless VITE_ROOM_AI_TEST_MODE=1; web uses its own /api, Android needs an https VITE_API_BASE_URL',()=>{
  expect(testModeConfig({},false,'https://a.vercel.app')).toBeNull();
  expect(testModeConfig({VITE_ROOM_AI_TEST_MODE:'true'},false,'https://a.vercel.app')).toBeNull();
  expect(testModeConfig({VITE_ROOM_AI_TEST_MODE:'1'},false,'https://a.vercel.app')).toEqual({base:'https://a.vercel.app/api'});
  expect(testModeConfig({VITE_ROOM_AI_TEST_MODE:'1'},true,'https://localhost')).toBeNull();
  expect(testModeConfig({VITE_ROOM_AI_TEST_MODE:'1',VITE_API_BASE_URL:'https://a.vercel.app/'},true,'https://localhost')).toEqual({base:'https://a.vercel.app/api'});
  expect(testModeConfig({VITE_ROOM_AI_TEST_MODE:'1',VITE_API_BASE_URL:'https://a.vercel.app/api'},true,'https://localhost')).toEqual({base:'https://a.vercel.app/api'});
  for(const bad of ['http://a.vercel.app','https://u:p@a.vercel.app','https://a.vercel.app/?x=1','not a url'])expect(testModeConfig({VITE_ROOM_AI_TEST_MODE:'1',VITE_API_BASE_URL:bad},true,'https://localhost'),bad).toBeNull();
 });
 it('refuses VITE_ variables named like server secrets or holding OpenAI/fal-looking keys; allows the public flags',()=>{
  expect(publicEnvProblems({VITE_ROOM_AI_TEST_MODE:'1',VITE_API_BASE_URL:'https://a.vercel.app',VITE_SUPABASE_ANON_KEY:'sb_publishable_x',VITE_FALLBACK_LANG:'en',OPENAI_API_KEY:'sk-server-only-is-fine'})).toEqual([]);
  const names=(env:Record<string,string>)=>publicEnvProblems(env).map(p=>p.split(':')[0]);
  expect(names({VITE_OPENAI_API_KEY:'x',VITE_FAL_KEY:'x',VITE_FAL:'x',VITE_AI_ACCESS_CODE:'x',VITE_ROOM_ACCESS_CODE:'x'})).toEqual(['VITE_OPENAI_API_KEY','VITE_FAL_KEY','VITE_FAL','VITE_AI_ACCESS_CODE','VITE_ROOM_ACCESS_CODE']);
  expect(names({VITE_SOMETHING:'sk-proj-abcdefghijklmnop',VITE_OTHER:'0a1b2c3d-0000-4000-8000-000000000001:0123456789abcdef0123456789abcdef'})).toEqual(['VITE_SOMETHING','VITE_OTHER']);
  // The message names the variable but never repeats its value.
  expect(publicEnvProblems({VITE_X:'sk-proj-abcdefghijklmnop'}).join(' ')).not.toContain('sk-proj');
 });
});
