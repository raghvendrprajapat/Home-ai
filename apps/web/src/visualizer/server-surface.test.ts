// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import type {AiJobStatus,AiSubmitBody,RoomAiApi} from '../cloud/api';
import {encodeMaskPng} from './ai-image';
import type {Pixels} from './photo-prep';
import {createRoomAi,giveConsent,hasConsent,loadPending,PENDING_MAX_AGE_MS,POLL_TIMEOUT_MS,RoomAiError,savePending,Waker} from './server-surface';
import type {AiCodec,AiHints,AiSurfaceRequest} from './server-surface';

// D86 Claude-authored builder tests of the AI provider flow with a fake server (no network, no canvas).
const USER='0a1b2c3d-0000-4000-8000-000000000001',W=4,H=2;
const photo:Pixels={width:W,height:H,data:Uint8ClampedArray.from({length:W*H*4},(_,i)=>i%4===3?255:40+i)};
const aiImage:Pixels={width:W,height:H,data:new Uint8ClampedArray(W*H*4).fill(222)};
const mask=Uint8Array.from([255,255,0,0, 0,128,0,0]);
type Calls={uploads:string[];submits:AiSubmitBody[];reserves:string[];polls:number;removed:string[][];segments:number};
function fakeApi(opts:{reserve?:Awaited<ReturnType<RoomAiApi['reserve']>>;statuses?:AiJobStatus[];submit?:Awaited<ReturnType<RoomAiApi['submit']>>;upload?:Awaited<ReturnType<RoomAiApi['upload']>>;download?:Record<string,Blob>}={}){
 const calls:Calls={uploads:[],submits:[],reserves:[],polls:0,removed:[],segments:0},statuses=[...opts.statuses??['running','succeeded']];
 const api:RoomAiApi={
  quota:async()=>({ok:true,enabled:true,paused:false,segmentPaused:false,previewsPerMonth:3,previewsLeft:2,segmentsLeft:20}),
  reserve:async id=>{calls.reserves.push(id);return opts.reserve??{ok:true,jobId:'job-1',status:'reserved'};},
  upload:async path=>{calls.uploads.push(path);return opts.upload??{ok:true};},
  submit:async body=>{calls.submits.push(body);return opts.submit??{ok:true,jobId:'job-1',status:'running'};},
  segment:async()=>{calls.segments++;return {ok:true,mask:new Blob(['png'],{type:'image/png'})};},
  job:async()=>{calls.polls++;const status=statuses.length>1?statuses.shift()!:statuses[0]!;return {ok:true,status,outputPath:status==='succeeded'?`${USER}/results/job-1.jpg`:null};},
  download:async path=>opts.download?opts.download[path]??null:new Blob(['jpeg'],{type:'image/jpeg'}),
  remove:async paths=>{calls.removed.push(paths);},
 };
 return {api,calls};
}
const codec:AiCodec={jpeg:async()=>new Blob(['jpeg'],{type:'image/jpeg'}),maskPng:encodeMaskPng,decode:async()=>aiImage};
const hints=(over:Partial<AiHints>={}):AiHints=>({clientJobId:'pAAAAAAAAAAAAAAAAAAAAAAA',label:'Paint - sky blue',colour:'#bcd7ea',surface:'wall',kind:'paint',references:[],...over});
const request=(over:Partial<AiHints>={}):AiSurfaceRequest=>({photo,mask,plane:null,material:{kind:'paint',rgb:[1,2,3]},ai:hints(over)});
/** A waker whose waits finish at once (polling delays are tested separately). */
class Instant extends Waker{override wait(_ms:number,signal:AbortSignal){return signal.aborted?Promise.reject(new DOMException('x','AbortError')):Promise.resolve();}}
afterEach(()=>{vi.useRealTimers();localStorage.clear();});

describe('AI preview flow',()=>{
 it('reserve → upload photo, mask, references into <user>/<clientJobId>/ → submit → poll → download → local composite',async()=>{
  const {api,calls}=fakeApi({statuses:['running','running','succeeded']}),phases:string[]=[],jobs:string[]=[];
  const ai=createRoomAi({api,userId:USER,codec,waker:new Instant()});
  const out=await ai.provider.render(request({kind:'pattern',colour:null,references:[photo,photo],onPhase:p=>phases.push(p),onJob:j=>jobs.push(j)}),new AbortController().signal);
  const folder=`${USER}/pAAAAAAAAAAAAAAAAAAAAAAA`;
  expect(calls.uploads).toEqual([`${folder}/photo.jpg`,`${folder}/mask.png`,`${folder}/ref-1.jpg`,`${folder}/ref-2.jpg`]);
  expect(calls.submits).toEqual([{clientJobId:'pAAAAAAAAAAAAAAAAAAAAAAA',surface:'wall',material:{kind:'pattern',label:'Paint - sky blue',colour:null},files:{photo:`${folder}/photo.jpg`,mask:`${folder}/mask.png`,references:[`${folder}/ref-1.jpg`,`${folder}/ref-2.jpg`]}}]);
  expect(calls.polls).toBe(3);
  expect(phases).toEqual(['reserving','uploading','sending','waiting','finishing']);
  expect(jobs).toEqual(['job-1']);
  // Inside the mask: the AI pixel (m = 255) or the blend (m = 128); outside: the person's own photo, byte for byte.
  for(let i=0;i<W*H;i++)for(let c=0;c<4;c++){
   const p=photo.data[i*4+c]!,o=out.data[i*4+c]!;
   if(c===3||mask[i]===0)expect(o).toBe(p);else if(mask[i]===255)expect(o).toBe(222);else expect(o).toBe(Math.round((p*127+222*128)/255));
  }
  expect(calls.removed).toEqual([[`${folder}/mask.png`,`${USER}/results/job-1.jpg`]]);
 });
 it('a second tap with the same clientJobId never uploads or submits again: it follows the same job',async()=>{
  const {api,calls}=fakeApi({reserve:{ok:true,jobId:'job-1',status:'running'}});
  await createRoomAi({api,userId:USER,codec,waker:new Instant()}).provider.render(request(),new AbortController().signal);
  expect(calls.uploads).toEqual([]);expect(calls.submits).toEqual([]);expect(calls.reserves).toEqual(['pAAAAAAAAAAAAAAAAAAAAAAA']);
 });
 it('cap reached, previews used up, signed out: refused before anything is uploaded',async()=>{
  for(const [code,expected] of [['AI_PAUSED','AI_PAUSED'],['AI_DISABLED','AI_PAUSED'],['NO_PREVIEWS_LEFT','NO_PREVIEWS_LEFT'],['NOT_SIGNED_IN','NOT_SIGNED_IN']] as const){
   const {api,calls}=fakeApi({reserve:{ok:false,code}});
   const error=await createRoomAi({api,userId:USER,codec,waker:new Instant()}).provider.render(request(),new AbortController().signal).then(()=>null as unknown as RoomAiError,(e:unknown)=>e as RoomAiError);
   expect(error).toBeInstanceOf(RoomAiError);expect((error as RoomAiError).code).toBe(expected);expect((error as RoomAiError).again).toBe(false);
   expect(calls.uploads).toEqual([]);
  }
 });
 it('a network failure while uploading may be retried with the same job; the server refunding says so',async()=>{
  const failing=fakeApi({upload:{ok:false,code:'NETWORK'}});
  const error=await createRoomAi({api:failing.api,userId:USER,codec,waker:new Instant()}).provider.render(request(),new AbortController().signal).then(()=>null as unknown as RoomAiError,(e:unknown)=>e as RoomAiError);
  expect([error.code,error.again]).toEqual(['NETWORK',true]);
  expect(failing.calls.submits).toEqual([]);
  for(const [statuses,code] of [[['refunded'],'REFUNDED'],[['running','failed'],'FAILED']] as const){
   const {api}=fakeApi({statuses:[...statuses]});
   const e=await createRoomAi({api,userId:USER,codec,waker:new Instant()}).provider.render(request(),new AbortController().signal).then(()=>null as unknown as RoomAiError,(x:unknown)=>x as RoomAiError);
   expect([e.code,e.again]).toEqual([code,false]);
  }
  const provider=fakeApi({submit:{ok:false,code:'PROVIDER_FAILED'}});
  expect((await createRoomAi({api:provider.api,userId:USER,codec,waker:new Instant()}).provider.render(request(),new AbortController().signal).then(()=>null as unknown as RoomAiError,(x:unknown)=>x as RoomAiError)).code).toBe('REFUNDED');
 });
 it('gives up waiting after about 3 minutes with TIMEOUT (the same job can be followed again)',async()=>{
  vi.useFakeTimers({toFake:['setTimeout','clearTimeout']});
  const {api,calls}=fakeApi({statuses:['running']});let t=0;
  const ai=createRoomAi({api,userId:USER,codec:{...codec,maskPng:async()=>new Blob(['png'],{type:'image/png'})},now:()=>t});
  const pending=ai.provider.render(request(),new AbortController().signal).then(()=>null as unknown as RoomAiError,(e:unknown)=>e as RoomAiError);
  // Fake clock: each 1 s step moves both the timers and the provider's clock.
  for(let i=0;i<400&&t<=POLL_TIMEOUT_MS+1000;i++){t+=1000;await vi.advanceTimersByTimeAsync(1000);}
  const error=await pending;
  expect([error.code,error.again]).toEqual(['TIMEOUT',true]);
  // Backoff: 2, 2, 3, 3, 4, 5, then 6 s → about 33 checks in 3 minutes, never a tight loop.
  expect(calls.polls).toBeGreaterThan(20);expect(calls.polls).toBeLessThan(45);
 });
 it('the waker ends a wait early (the app came back to the front) and cancelling stops waiting',async()=>{
  const waker=new Waker(),controller=new AbortController(),started=Date.now();
  const wait=waker.wait(60_000,controller.signal);waker.wake();await wait;
  expect(Date.now()-started).toBeLessThan(1000);
  const cancelled=waker.wait(60_000,controller.signal);controller.abort();
  await expect(cancelled).rejects.toMatchObject({name:'AbortError'});
 });
});

describe('finishing a preview after the app was closed',()=>{
 it('uses the mask kept on the server and composites it the same way',async()=>{
  const maskBlob=await encodeMaskPng(mask,W,H),{api}=fakeApi({statuses:['succeeded'],download:{[`${USER}/pAAAAAAAAAAAAAAAAAAAAAAA/mask.png`]:maskBlob,[`${USER}/results/job-1.jpg`]:new Blob(['jpeg'])}});
  const ai=createRoomAi({api,userId:USER,codec,waker:new Instant()});
  const out=await ai.finishEarlier({jobId:'job-1',clientJobId:'pAAAAAAAAAAAAAAAAAAAAAAA',photoKey:'room.jpg:1:2',createdAt:0},photo,new AbortController().signal);
  expect(out.data[0]).toBe(222);expect(out.data[8]).toBe(photo.data[8]);
  const wrong=fakeApi({statuses:['succeeded'],download:{[`${USER}/pAAAAAAAAAAAAAAAAAAAAAAA/mask.png`]:await encodeMaskPng(new Uint8Array(9),3,3)}});
  await expect(createRoomAi({api:wrong.api,userId:USER,codec,waker:new Instant()}).finishEarlier({jobId:'job-1',clientJobId:'pAAAAAAAAAAAAAAAAAAAAAAA',photoKey:'k',createdAt:0},photo,new AbortController().signal)).rejects.toMatchObject({code:'RESULT'});
 });
 it('pending records and consent are kept per account on this device',()=>{
  expect(loadPending(USER)).toBeNull();
  savePending(USER,{jobId:'job-1',clientJobId:'c',photoKey:'k',createdAt:1000});
  expect(loadPending(USER,2000)).toEqual({jobId:'job-1',clientJobId:'c',photoKey:'k',createdAt:1000});
  expect(loadPending(USER,1000+PENDING_MAX_AGE_MS)).toBeNull();
  expect(loadPending('someone-else',2000)).toBeNull();
  savePending(USER,null);expect(loadPending(USER,2000)).toBeNull();
  expect(hasConsent(USER)).toBe(false);giveConsent(USER,new Date('2026-10-26T00:00:00Z'));
  expect(hasConsent(USER)).toBe(true);expect(hasConsent('someone-else')).toBe(false);
  expect(localStorage.getItem(`gharplan.roomAi.consent.v1.${USER}`)).toBe('2026-10-26T00:00:00.000Z');
 });
});

describe('tap to select (AI)',()=>{
 it('uploads the photo once per session, returns the selection, and the daily limit is reported',async()=>{
  const rgba=new Uint8ClampedArray(W*H*4);rgba.set([255,255,255,255],(1*W+2)*4);
  const {api,calls}=fakeApi(),ai=createRoomAi({api,userId:USER,codec:{...codec,decode:async()=>({width:W,height:H,data:rgba})},waker:new Instant()});
  expect(await ai.segment(photo,[2.4,1.2],new AbortController().signal)).toEqual({box:{x0:2,y0:1,x1:3,y1:2},data:Uint8Array.from([255])});
  await ai.segment(photo,[0,0],new AbortController().signal);
  expect(calls.uploads).toHaveLength(1);expect(calls.uploads[0]).toMatch(new RegExp(`^${USER}/s[0-9a-f]{23}/photo\\.jpg$`));
  expect(calls.segments).toBe(2);
  ai.close();expect(calls.removed).toEqual([[calls.uploads[0]]]);
  const limited=fakeApi();limited.api.segment=async()=>({ok:false,code:'SEGMENT_LIMIT'});
  await expect(createRoomAi({api:limited.api,userId:USER,codec,waker:new Instant()}).segment(photo,[1,1],new AbortController().signal)).rejects.toMatchObject({code:'SEGMENT_LIMIT'});
 });
});
