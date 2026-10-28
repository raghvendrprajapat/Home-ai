import {compositeInMask,selectionFromImage} from './ai-image';
import {aiSize,base64Bytes,encodeAlphaMaskPng,UPLOAD_LIMITS} from './ai-prep';
import type {DirtyRect} from './mask';
import type {Pixels} from './photo-prep';
import type {SurfaceEditRequest} from './surface-engine';
import type {SurfaceEditProvider,SurfaceEditResult} from './surface-provider';

/**
 * D92 AI test mode: the 'server' SurfaceEditProvider for the owner with the private AI code (no account, no
 * database). One AI preview = ONE POST to /api/room-ai/edit (the app's own Vercel Function, which holds the OpenAI
 * key): the photo stretched to an OpenAI size (PNG), our mask as an alpha PNG of exactly that size (transparent =
 * change), at most 3 compressed reference pictures and the material fields. The answer (a JPEG) is scaled back to
 * the working size and composited on the device ONLY inside our own mask, so every pixel outside it stays the
 * person's photo byte for byte. Nothing is ever retried automatically (each call may cost the owner money).
 */
export type TestAiProblem='NEED_CODE'|'WRONG_CODE'|'NOT_SET_UP'|'ORIGIN'|'BUSY'|'BUDGET'|'BLOCKED'|'TOO_BIG'|'SHAPE'|'RUNNING'|'NETWORK'|'TIMEOUT'|'FAILED'|'RESULT'|'UNEXPECTED';
export class TestAiError extends Error{readonly code:TestAiProblem;constructor(code:TestAiProblem){super(`room-ai-test:${code}`);this.name='TestAiError';this.code=code;}}
export type TestPhase='preparing'|'uploading'|'waiting'|'finishing';
export interface TestAiHints {
 /** English label for the fixed server prompt, for example "Sky blue". */
 readonly label:string;
 readonly colour:string|null;
 readonly surface:'wall'|'floor'|'other';
 readonly kind:'paint'|'pattern'|'picture';
 readonly references:readonly Pixels[];
 /** `percent` is given while uploading (0–100). */
 onPhase?(phase:TestPhase,percent?:number):void;
}
export type TestAiRequest=SurfaceEditRequest&{readonly test?:TestAiHints};
export interface TestSurfaceProvider extends SurfaceEditProvider {readonly kind:'server';render(request:TestAiRequest,signal:AbortSignal):Promise<SurfaceEditResult>}
/** Browser image work, replaced by fakes in tests. */
export interface TestCodec {
 /** The pixels stretched to exactly width × height, as PNG. */
 png(pixels:Pixels,width:number,height:number):Promise<Blob>;
 jpeg(pixels:Pixels,quality:number):Promise<Blob>;
 /** Decodes an image and draws it scaled to exactly width × height. */
 decode(blob:Blob,width:number,height:number):Promise<Pixels>;
}
export interface TransportAnswer {readonly status:number;readonly body:unknown}
/** One POST of form data; `onUpload` reports the sent fraction (0–1) where the browser can tell. */
export interface Transport {post(url:string,form:FormData,headers:Readonly<Record<string,string>>,signal:AbortSignal,onUpload?:(fraction:number)=>void):Promise<TransportAnswer>}
/** Network failure → TypeError-like rejection; abort → AbortError. */
export const fetchTransport=(fetcher:typeof fetch=(input,init)=>fetch(input,init)):Transport=>({async post(url,form,headers,signal,onUpload){
 const response=await fetcher(url,{method:'POST',body:form,headers,signal,credentials:'omit',cache:'no-store'});
 onUpload?.(1);
 const body:unknown=await response.json().catch(()=>null);
 return {status:response.status,body};
}});
const parseJson=(text:string):unknown=>{try{return JSON.parse(text) as unknown;}catch{return null;}};
/** XMLHttpRequest, because only it reports upload progress; falls back to fetch where it is missing. */
export const xhrTransport:Transport={post(url,form,headers,signal,onUpload){
 if(typeof XMLHttpRequest==='undefined')return fetchTransport().post(url,form,headers,signal,onUpload);
 return new Promise((resolve,reject)=>{
  const xhr=new XMLHttpRequest(),abort=()=>xhr.abort();
  xhr.open('POST',url);xhr.responseType='text';xhr.withCredentials=false;
  for(const [k,v] of Object.entries(headers))xhr.setRequestHeader(k,v);
  xhr.upload.onprogress=event=>{if(event.lengthComputable&&event.total>0)onUpload?.(event.loaded/event.total);};
  xhr.upload.onload=()=>onUpload?.(1);
  xhr.onload=()=>{signal.removeEventListener('abort',abort);resolve({status:xhr.status,body:parseJson(xhr.responseText)});};
  xhr.onerror=()=>{signal.removeEventListener('abort',abort);reject(new TypeError('network'));};
  xhr.onabort=()=>{signal.removeEventListener('abort',abort);reject(new DOMException('Room photo preview cancelled.','AbortError'));};
  if(signal.aborted){reject(new DOMException('Room photo preview cancelled.','AbortError'));return;}
  signal.addEventListener('abort',abort,{once:true});
  xhr.send(form);
 });
}};

/** The client waits a little longer than the server's own 280 s limit for OpenAI. */
export const EDIT_TIMEOUT_MS=295_000,SEGMENT_TIMEOUT_MS=125_000,PROGRESS_FALLBACK_MS=2500,MAX_REFERENCES=3,CODE_HEADER='X-Room-AI-Code';
const STATUS:Readonly<Record<number,TestAiProblem>>={401:'WRONG_CODE',402:'BUDGET',403:'ORIGIN',413:'TOO_BIG',422:'BLOCKED',429:'BUSY',503:'NOT_SET_UP',504:'TIMEOUT'};
/** The problem for a server answer that was not a success. */
export function problemForStatus(status:number,body:unknown):TestAiProblem{
 const code=body&&typeof body==='object'?(body as {code?:unknown}).code:null;
 if(code==='WRONG_CODE'||code==='NOT_SET_UP'||code==='BUSY'||code==='BUDGET'||code==='BLOCKED'||code==='TOO_BIG'||code==='TIMEOUT'||code==='ORIGIN')return code;
 return STATUS[status]??(status===400?'UNEXPECTED':'FAILED');
}
const aborted=()=>new DOMException('Room photo preview cancelled.','AbortError');
const check=(signal:AbortSignal)=>{if(signal.aborted)throw aborted();};

export interface TestAiOptions {
 /** For example https://example.vercel.app/api (testModeConfig). */
 readonly base:string;
 readonly codec:TestCodec;
 readonly transport:Transport;
 /** The access code kept on this device, or null (then NEED_CODE). */
 readonly code:()=>string|null;
 readonly editTimeoutMs?:number;
 readonly segmentTimeoutMs?:number;
 /** How long to wait for a first upload-progress event before showing the wait message. */
 readonly progressFallbackMs?:number;
 readonly now?:()=>number;
}
export interface TestAi {
 readonly provider:TestSurfaceProvider;
 /** Tap to select (AI): the selection around one point, or null when nothing was found. */
 segment(photo:Pixels,point:readonly [number,number],signal:AbortSignal):Promise<{box:DirtyRect;data:Uint8Array}|null>;
}

/** Sends one request with a time limit joined to the caller's cancel; maps every failure to a TestAiError. */
async function send(transport:Transport,url:string,form:FormData,code:string,signal:AbortSignal,ms:number,onUpload?:(fraction:number)=>void):Promise<Record<string,unknown>>{
 const controller=new AbortController();let timedOut=false;
 const timer=setTimeout(()=>{timedOut=true;controller.abort();},ms),stop=()=>controller.abort();
 signal.addEventListener('abort',stop,{once:true});
 let answer:TransportAnswer;
 try{answer=await transport.post(url,form,{[CODE_HEADER]:code},controller.signal,onUpload);}
 catch{
  if(signal.aborted)throw aborted();
  if(timedOut)throw new TestAiError('TIMEOUT');
  throw new TestAiError('NETWORK');
 }finally{clearTimeout(timer);signal.removeEventListener('abort',stop);}
 check(signal);
 const body=answer.body&&typeof answer.body==='object'?answer.body as Record<string,unknown>:null;
 if(answer.status!==200||!body||body.ok!==true)throw new TestAiError(problemForStatus(answer.status,body));
 return body;
}

export function createTestAi(options:TestAiOptions):TestAi{
 const {codec,transport}=options,now=options.now??(()=>performance.now());
 const base=options.base.replace(/\/+$/,'');let running=false;
 const needCode=()=>{const code=options.code();if(!code)throw new TestAiError('NEED_CODE');return code;};
 /** A reference as JPEG under the per-file limit (quality 0.85, then 0.7). */
 const referenceJpeg=async(pixels:Pixels):Promise<Blob>=>{
  for(const quality of [.85,.7]){const blob=await codec.jpeg(pixels,quality);if(blob.size<=UPLOAD_LIMITS.reference)return blob;}
  throw new TestAiError('TOO_BIG');
 };
 const provider:TestSurfaceProvider={kind:'server',async render(request,signal){
  const hints=request.test,started=now();
  if(!hints||hints.references.length>MAX_REFERENCES)throw new TestAiError('UNEXPECTED');
  if(hints.kind==='picture'&&hints.references.length<1)throw new TestAiError('UNEXPECTED');
  if(running)throw new TestAiError('RUNNING');
  const code=needCode(),photo=request.photo;
  let size=aiSize(photo.width,photo.height);if(!size)throw new TestAiError('SHAPE');
  running=true;
  try{
   hints.onPhase?.('preparing');
   const references:Blob[]=[];
   for(const r of hints.references){references.push(await referenceJpeg(r));check(signal);}
   // The room is a PNG (OpenAI: the edited image and its mask have the same format). A busy photo can be large as
   // PNG, so the size steps down (never below OpenAI's minimum) until everything fits the upload limit.
   let room:Blob|null=null,mask:Blob|null=null;
   const refBytes=references.reduce((n,b)=>n+b.size,0);
   for(let tries=0;tries<8&&size;tries++){
    mask=await encodeAlphaMaskPng(request.mask,photo.width,photo.height,size.width,size.height);check(signal);
    room=await codec.png(photo,size.width,size.height);check(signal);
    const budget=Math.min(UPLOAD_LIMITS.room,UPLOAD_LIMITS.total-refBytes-mask.size-16_384);
    if(room.size<=budget&&mask.size<=UPLOAD_LIMITS.mask)break;
    const smaller=aiSize(photo.width,photo.height,Math.floor(Math.max(size.width,size.height)*.85));
    room=null;if(!smaller||smaller.width===size.width&&smaller.height===size.height)break;size=smaller;
   }
   if(!room||!mask||!size)throw new TestAiError('TOO_BIG');
   const form=new FormData();
   form.append('room',room,'room.png');form.append('mask',mask,'mask.png');
   references.forEach((r,i)=>form.append('reference',r,`reference-${i+1}.jpg`));
   form.append('kind',hints.kind);form.append('surface',hints.surface);form.append('label',hints.label.slice(0,200));
   if(hints.colour)form.append('colour',hints.colour);
   hints.onPhase?.('uploading',0);
   // Browsers report upload progress many times a second; where none arrives (some WebViews), the wait message is
   // shown after a short pause instead of a "0 %" that never moves.
   let waiting=false;
   const toWaiting=()=>{if(!waiting){waiting=true;hints.onPhase?.('waiting');}};
   const fallback=setTimeout(toWaiting,options.progressFallbackMs??PROGRESS_FALLBACK_MS);
   let body:Record<string,unknown>;
   try{
    body=await send(transport,`${base}/room-ai/edit`,form,code,signal,options.editTimeoutMs??EDIT_TIMEOUT_MS,fraction=>{
     clearTimeout(fallback);if(waiting)return;if(fraction>=1)toWaiting();else hints.onPhase?.('uploading',Math.max(0,Math.min(99,Math.round(fraction*100))));
    });
   }finally{clearTimeout(fallback);}
   hints.onPhase?.('finishing');
   const bytes=base64Bytes(body.image);
   if(!bytes||bytes[0]!==0xff||bytes[1]!==0xd8)throw new TestAiError('RESULT');
   let ai:Pixels;try{ai=await codec.decode(new Blob([bytes as Uint8Array<ArrayBuffer>],{type:'image/jpeg'}),photo.width,photo.height);}catch{throw new TestAiError('RESULT');}
   check(signal);
   const out=compositeInMask(photo,ai,request.mask);
   return {...out,ms:now()-started};
  }finally{running=false;}
 }};
 return {
  provider,
  async segment(photo,point,signal){
   const code=needCode();
   let room:Blob|null=null;
   for(const quality of [.85,.7]){const blob=await codec.jpeg(photo,quality);check(signal);if(blob.size<=UPLOAD_LIMITS.segmentRoom){room=blob;break;}}
   if(!room)throw new TestAiError('TOO_BIG');
   const form=new FormData();form.append('room',room,'room.jpg');form.append('x',String(Math.round(point[0])));form.append('y',String(Math.round(point[1])));
   const body=await send(transport,`${base}/room-ai/segment`,form,code,signal,options.segmentTimeoutMs??SEGMENT_TIMEOUT_MS);
   const bytes=base64Bytes(body.mask);if(!bytes)throw new TestAiError('RESULT');
   let pixels:Pixels;try{pixels=await codec.decode(new Blob([bytes as Uint8Array<ArrayBuffer>],{type:'image/png'}),photo.width,photo.height);}catch{throw new TestAiError('RESULT');}
   check(signal);
   return selectionFromImage(pixels.data,photo.width,photo.height)??null;
  },
 };
}
