import fc from 'fast-check';
import {describe,expect,it,vi} from 'vitest';
import type {Pixels} from './photo-prep';
import {createTestAi,fetchTransport,problemForStatus,TestAiError} from './test-surface';
import type {TestAiHints,TestAiRequest,TestCodec,Transport} from './test-surface';

// D92 AI test mode, client provider flow against a mocked fetch (no network, no canvas). Claude-authored builder tests.
const W=40,H=30,BASE='https://app.example.test/api',CODE='owner-code-2026';
const photo:Pixels={width:W,height:H,data:Uint8ClampedArray.from({length:W*H*4},(_,i)=>i%4===3?255:(i*7)%256)};
const aiPixels:Pixels={width:W,height:H,data:new Uint8ClampedArray(W*H*4).fill(222)};
const JPEG=new Uint8Array([0xff,0xd8,0xff,0xe0,1,2,3]),JPEG_B64=btoa(String.fromCharCode(...JPEG));
const maskOf=(w=W,h=H)=>{const m=new Uint8Array(w*h);for(let y=5;y<15;y++)for(let x=10;x<25;x++)m[y*w+x]=y===5?128:255;return m;};
function codec(over:Partial<TestCodec>={}):TestCodec&{pngSizes:[number,number][];decoded:Blob[]}{
 const pngSizes:[number,number][]=[],decoded:Blob[]=[];
 return {pngSizes,decoded,png:async(_p,w,h)=>{pngSizes.push([w,h]);return new Blob([new Uint8Array(1000)],{type:'image/png'});},jpeg:async()=>new Blob([new Uint8Array(500)],{type:'image/jpeg'}),
  decode:async(blob,w,h)=>{decoded.push(blob);return w===W&&h===H?aiPixels:{width:w,height:h,data:new Uint8ClampedArray(w*h*4).fill(222)};},...over};
}
const hints=(over:Partial<TestAiHints>={}):TestAiHints=>({label:'Sky blue',colour:'#bcd7ea',surface:'wall',kind:'paint',references:[],...over});
const request=(over:Partial<TestAiHints>={},mask=maskOf()):TestAiRequest=>({photo,mask,plane:null,material:{kind:'paint',rgb:[1,2,3]},test:hints(over)});
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
function setup(answers:((url:string,init:RequestInit)=>Response|Promise<Response>)[],opts:{code?:string|null;codec?:ReturnType<typeof codec>;editTimeoutMs?:number}={}){
 const calls:{url:string;init:RequestInit}[]=[];
 const fetcher=vi.fn(async(input:RequestInfo|URL,init:RequestInit={})=>{calls.push({url:String(input),init});const a=answers.shift();if(!a)throw new Error('unexpected fetch');return a(String(input),init);}) as unknown as typeof fetch;
 const c=opts.codec??codec();
 const ai=createTestAi({base:`${BASE}/`,codec:c,transport:fetchTransport(fetcher),code:()=>opts.code===undefined?CODE:opts.code,...opts.editTimeoutMs?{editTimeoutMs:opts.editTimeoutMs}:{}});
 return {ai,calls,codec:c};
}
const signal=()=>new AbortController().signal;

describe('AI test mode preview',()=>{
 it('ONE POST to /api/room-ai/edit with the code header and form fields; the answer is composited only inside the mask',async()=>{
  const {ai,calls,codec:c}=setup([()=>reply({ok:true,image:JPEG_B64,width:1024,height:768})]),phases:string[]=[];
  const out=await ai.provider.render(request({kind:'pattern',colour:null,label:'Oak',references:[photo],onPhase:p=>phases.push(p)}),signal());
  expect(calls).toHaveLength(1);
  expect(calls[0]!.url).toBe(`${BASE}/room-ai/edit`);
  expect(calls[0]!.init.method).toBe('POST');
  expect((calls[0]!.init.headers as Record<string,string>)['X-Room-AI-Code']).toBe(CODE);
  expect(calls[0]!.init.credentials).toBe('omit');
  const form=calls[0]!.init.body as FormData;
  expect([...form.keys()]).toEqual(['room','mask','reference','kind','surface','label']);
  expect([form.get('kind'),form.get('surface'),form.get('label'),form.get('colour')]).toEqual(['pattern','wall','Oak',null]);
  // 40 × 30 is enlarged to OpenAI's minimum: s = √(655360/1200) = 23.37 → 934.8 × 701.1 → 944 × 704.
  expect(c.pngSizes).toEqual([[944,704]]);
  const maskFile=form.get('mask') as File,bytes=new Uint8Array(await maskFile.arrayBuffer()),view=new DataView(bytes.buffer);
  expect([maskFile.type,view.getUint32(16),view.getUint32(20),bytes[25]]).toEqual(['image/png',944,704,6]);
  expect(phases).toEqual(['preparing','uploading','waiting','finishing']);
  expect(c.decoded).toHaveLength(1);
  expect(c.decoded[0]!.type).toBe('image/jpeg');
  const m=maskOf();
  for(let i=0;i<W*H;i++)for(let k=0;k<4;k++){
   const expected=m[i]?k===3?photo.data[i*4+3]:Math.round((photo.data[i*4+k]!*(255-m[i]!)+222*m[i]!)/255):photo.data[i*4+k];
   if(out.data[i*4+k]!==expected)throw new Error(`pixel ${i} channel ${k}`);
  }
 });
 it('property: whatever the AI returns, pixels outside our mask stay byte-for-byte the photo',async()=>{
  await fc.assert(fc.asyncProperty(fc.uint8Array({minLength:W*H,maxLength:W*H}),fc.integer({min:0,max:255}),async(rawMask,fill)=>{
   const mask=rawMask.map(v=>v<160?0:v),noisy:Pixels={width:W,height:H,data:new Uint8ClampedArray(W*H*4).fill(fill)};
   const {ai}=setup([()=>reply({ok:true,image:JPEG_B64})],{codec:codec({decode:async()=>noisy})});
   const out=await ai.provider.render(request({},mask),signal());
   for(let i=0;i<W*H;i++)if(!mask[i])for(let k=0;k<4;k++)if(out.data[i*4+k]!==photo.data[i*4+k])return false;
   return true;
  }),{numRuns:60});
 });
 it('no code → NEED_CODE without any request; 401 → WRONG_CODE',async()=>{
  const none=setup([],{code:null});
  await expect(none.ai.provider.render(request(),signal())).rejects.toMatchObject({code:'NEED_CODE'});
  expect(none.calls).toHaveLength(0);
  const wrong=setup([()=>reply({ok:false,code:'WRONG_CODE'},401)]);
  await expect(wrong.ai.provider.render(request(),signal())).rejects.toMatchObject({code:'WRONG_CODE'});
 });
 it('server answers map to clear problems and nothing is retried',async()=>{
  const cases:[number,unknown,string][]=[[503,{ok:false,code:'NOT_SET_UP'},'NOT_SET_UP'],[429,{ok:false,code:'BUSY'},'BUSY'],[422,{ok:false,code:'BLOCKED'},'BLOCKED'],
   [402,{ok:false,code:'BUDGET'},'BUDGET'],[413,null,'TOO_BIG'],[504,{ok:false,code:'TIMEOUT'},'TIMEOUT'],[502,{ok:false,code:'PROVIDER_FAILED'},'FAILED'],[500,'<html>',`FAILED`],[400,{ok:false,code:'INVALID_REQUEST'},'UNEXPECTED'],[403,{ok:false,code:'ORIGIN'},'ORIGIN']];
  for(const [status,body,code] of cases){
   const {ai,calls}=setup([()=>reply(body,status)]);
   await expect(ai.provider.render(request(),signal()),String(status)).rejects.toMatchObject({code});
   expect(calls).toHaveLength(1);
  }
  expect(problemForStatus(418,null)).toBe('FAILED');
  const net=setup([()=>{throw new TypeError('Failed to fetch');}]);
  await expect(net.ai.provider.render(request(),signal())).rejects.toMatchObject({code:'NETWORK'});
  expect(net.calls).toHaveLength(1);
  const bad=setup([()=>reply({ok:true,image:btoa('not jpeg')})]);
  await expect(bad.ai.provider.render(request(),signal())).rejects.toMatchObject({code:'RESULT'});
 });
 it('cancel aborts the upload (AbortError, not a problem); a slow server ends in TIMEOUT',async()=>{
  const hang=(_url:string,init:RequestInit)=>new Promise<Response>((_,reject)=>{init.signal!.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')));});
  const {ai}=setup([hang]),controller=new AbortController();
  const running=ai.provider.render(request(),controller.signal);
  await vi.waitFor(()=>{expect(controller.signal.aborted).toBe(false);});
  setTimeout(()=>controller.abort(),5);
  await expect(running).rejects.toMatchObject({name:'AbortError'});
  const slow=setup([hang],{editTimeoutMs:20});
  await expect(slow.ai.provider.render(request(),signal())).rejects.toMatchObject({code:'TIMEOUT'});
 });
 it('one preview at a time (a double tap never sends twice); shape and reference rules',async()=>{
  let release:(r:Response)=>void=()=>undefined;
  const {ai,calls}=setup([()=>new Promise<Response>(r=>{release=r;})]);
  const first=ai.provider.render(request(),signal());
  await expect(ai.provider.render(request(),signal())).rejects.toMatchObject({code:'RUNNING'});
  await vi.waitFor(()=>expect(calls).toHaveLength(1));
  release(reply({ok:true,image:JPEG_B64}));await first;
  expect(calls).toHaveLength(1);
  const wide:Pixels={width:400,height:100,data:new Uint8ClampedArray(400*100*4)};
  await expect(setup([]).ai.provider.render({...request(),photo:wide,mask:new Uint8Array(400*100)},signal())).rejects.toMatchObject({code:'SHAPE'});
  await expect(setup([]).ai.provider.render(request({references:[photo,photo,photo,photo]}),signal())).rejects.toBeInstanceOf(TestAiError);
  await expect(setup([]).ai.provider.render(request({kind:'picture'}),signal())).rejects.toBeInstanceOf(TestAiError);
 });
 it('a room PNG over the upload budget steps the size down; too big at the minimum size → TOO_BIG without a request',async()=>{
  const sizes:[number,number][]=[];
  const shrinking=codec({png:async(_p,w,h)=>{sizes.push([w,h]);return new Blob([new Uint8Array(w*h>800_000?3_500_000:1000)]);}});
  const big:Pixels={width:1536,height:1024,data:new Uint8ClampedArray(1536*1024*4)};
  const {ai,calls}=setup([()=>reply({ok:true,image:JPEG_B64})],{codec:shrinking});
  await ai.provider.render({...request(),photo:big,mask:new Uint8Array(1536*1024)},signal());
  expect(sizes).toEqual([[1536,1024],[1312,864],[1120,736],[992,672]]);
  expect(calls).toHaveLength(1);
  const huge=setup([],{codec:codec({png:async()=>new Blob([new Uint8Array(3_500_000)])})});
  await expect(huge.ai.provider.render({...request(),photo:big,mask:new Uint8Array(1536*1024)},signal())).rejects.toMatchObject({code:'TOO_BIG'});
  expect(huge.calls).toHaveLength(0);
 });
});

describe('AI test mode progress',()=>{
 it('upload percent while sending, then the wait message; without any progress event the wait message comes after the pause',async()=>{
  const phases:string[]=[];
  const progress:Transport={async post(_u,_f,_h,_s,onUpload){onUpload?.(.25);onUpload?.(.5);onUpload?.(1);return {status:200,body:{ok:true,image:JPEG_B64}};}};
  const ai=createTestAi({base:BASE,codec:codec(),transport:progress,code:()=>CODE});
  await ai.provider.render(request({onPhase:(p,pct)=>phases.push(pct===undefined?p:`${p} ${pct}`)}),signal());
  expect(phases).toEqual(['preparing','uploading 0','uploading 25','uploading 50','waiting','finishing']);
  const silent:Transport={post:()=>new Promise(r=>setTimeout(()=>r({status:200,body:{ok:true,image:JPEG_B64}}),60))},quiet:string[]=[];
  await createTestAi({base:BASE,codec:codec(),transport:silent,code:()=>CODE,progressFallbackMs:10}).provider.render(request({onPhase:p=>quiet.push(p)}),signal());
  expect(quiet).toEqual(['preparing','uploading','waiting','finishing']);
 });
});

describe('AI test mode tap to select',()=>{
 it('POSTs the photo and the point to /api/room-ai/segment and returns the selection',async()=>{
  const maskPixels:Pixels={width:W,height:H,data:new Uint8ClampedArray(W*H*4)};
  for(let y=2;y<6;y++)for(let x=3;x<9;x++)maskPixels.data.set([255,255,255,255],(y*W+x)*4);
  const {ai,calls}=setup([()=>reply({ok:true,mask:btoa('png')})],{codec:codec({decode:async()=>maskPixels})});
  const selection=await ai.segment(photo,[4.4,3.6],signal());
  expect(calls[0]!.url).toBe(`${BASE}/room-ai/segment`);
  const form=calls[0]!.init.body as FormData;
  expect([form.get('x'),form.get('y'),(form.get('room') as File).type]).toEqual(['4','4','image/jpeg']);
  expect(selection?.box).toEqual({x0:3,y0:2,x1:9,y1:6});
  expect(selection?.data.every(v=>v===255)).toBe(true);
  const empty=setup([()=>reply({ok:true,mask:btoa('png')})],{codec:codec({decode:async()=>({width:W,height:H,data:new Uint8ClampedArray(W*H*4)})})});
  expect(await empty.ai.segment(photo,[1,1],signal())).toBeNull();
  await expect(setup([()=>reply({ok:false,code:'WRONG_CODE'},401)]).ai.segment(photo,[1,1],signal())).rejects.toMatchObject({code:'WRONG_CODE'});
  await expect(setup([],{code:null}).ai.segment(photo,[1,1],signal())).rejects.toMatchObject({code:'NEED_CODE'});
 });
});

describe('transport',()=>{
 it('fetchTransport reads JSON and survives a non-JSON body',async()=>{
  const t:Transport=fetchTransport((async()=>new Response('<html>',{status:502})) as unknown as typeof fetch);
  expect(await t.post('https://x.test/api',new FormData(),{},signal())).toEqual({status:502,body:null});
 });
});
