import type {AiJobStatus,AiQuota,CloudCode,CloudFailure,RoomAiApi} from '../cloud/api';
import {compositeInMask,decodeMaskPng,selectionFromImage} from './ai-image';
import type {DirtyRect} from './mask';
import type {Pixels} from './photo-prep';
import type {SurfaceEditRequest} from './surface-engine';
import type {SurfaceEditProvider,SurfaceEditResult} from './surface-provider';

/**
 * D86 Room photo AI: the 'server' SurfaceEditProvider. Only for a signed-in person with cloud set up; the offline
 * stand-in stays the default. One AI preview:
 *   reserve (idempotent per clientJobId: a second tap with the same id never pays twice) → upload the working-size
 *   photo (JPEG), the mask (PNG, white = change) and at most 3 small reference pictures into <user id>/<clientJobId>/
 *   with the person's own session → room-ai-submit → poll the job (backoff, about 3 minutes, woken early when the app
 *   comes back to the front) → download the result as a Blob → scale it to the working size → composite it on the
 *   device inside the same mask, so every pixel outside the chosen area stays the person's own photo, byte for byte.
 * Nothing is ever retried automatically after money may have been spent; the person decides.
 */
export type AiPhase='reserving'|'uploading'|'sending'|'waiting'|'finishing';
/** What went wrong, in the words the view needs. `again` = trying again keeps the same clientJobId (cannot pay twice). */
export type AiProblem='NOT_SIGNED_IN'|'NO_PREVIEWS_LEFT'|'AI_PAUSED'|'SEGMENT_LIMIT'|'NETWORK'|'REFUNDED'|'FAILED'|'TIMEOUT'|'RESULT'|'UNEXPECTED';
export class RoomAiError extends Error{constructor(readonly code:AiProblem,readonly again=false){super(`room-ai:${code}`);this.name='RoomAiError';}}
export interface AiHints {
 readonly clientJobId:string;
 /** English label for the fixed server prompt, for example "Paint - sky blue". */
 readonly label:string;
 readonly colour:string|null;
 readonly surface:'wall'|'floor'|'other';
 readonly kind:'paint'|'pattern'|'picture';
 readonly references:readonly Pixels[];
 onPhase?(phase:AiPhase):void;
 onJob?(jobId:string):void;
}
export type AiSurfaceRequest=SurfaceEditRequest&{readonly ai?:AiHints};
/** A SurfaceEditProvider of kind 'server' whose requests carry the AI hints. */
export interface ServerSurfaceProvider extends SurfaceEditProvider {readonly kind:'server';render(request:AiSurfaceRequest,signal:AbortSignal):Promise<SurfaceEditResult>}
/** Browser image work, replaced by fakes in tests. */
export interface AiCodec {
 jpeg(pixels:Pixels):Promise<Blob>;
 maskPng(mask:Uint8Array,width:number,height:number):Promise<Blob>;
 /** Decodes an image and draws it scaled to exactly width × height. */
 decode(blob:Blob,width:number,height:number):Promise<Pixels>;
}
/** Wakes sleeping polls early (the app came back to the front). */
export class Waker{
 #listeners=new Set<()=>void>();
 wake():void{for(const l of [...this.#listeners])l();}
 wait(ms:number,signal:AbortSignal):Promise<void>{
  return new Promise((resolve,reject)=>{
   const done=()=>{clearTimeout(timer);this.#listeners.delete(done);signal.removeEventListener('abort',stop);resolve();};
   const stop=()=>{clearTimeout(timer);this.#listeners.delete(done);reject(new DOMException('Room photo preview cancelled.','AbortError'));};
   const timer=setTimeout(done,ms);this.#listeners.add(done);
   if(signal.aborted)stop();else signal.addEventListener('abort',stop,{once:true});
  });
 }
}
/** Seconds between status checks: quick at first, then every 6 s. */
export const POLL_DELAYS_MS=[2000,2000,3000,3000,4000,5000,6000] as const;
export const POLL_TIMEOUT_MS=180_000,MAX_REFERENCES=3;
const aborted=()=>new DOMException('Room photo preview cancelled.','AbortError');
const check=(signal:AbortSignal)=>{if(signal.aborted)throw aborted();};

/** A fresh idempotency key: 24 URL-safe characters. */
export const newClientJobId=(prefix='p'):string=>`${prefix}${crypto.randomUUID().replaceAll('-','').slice(0,23)}`;
export function problemFor(code:CloudCode):RoomAiError{
 switch(code){
  case 'NOT_SIGNED_IN':return new RoomAiError('NOT_SIGNED_IN');
  case 'NO_PREVIEWS_LEFT':return new RoomAiError('NO_PREVIEWS_LEFT');
  case 'AI_PAUSED':case 'AI_DISABLED':case 'AI_UNAVAILABLE':return new RoomAiError('AI_PAUSED');
  case 'SEGMENT_LIMIT':return new RoomAiError('SEGMENT_LIMIT');
  case 'NETWORK':return new RoomAiError('NETWORK',true);
  case 'UPLOAD_MISSING':case 'PROVIDER_FAILED':case 'ALREADY_DONE':return new RoomAiError('REFUNDED');
  default:return new RoomAiError('UNEXPECTED');
 }
}
const settled=(status:AiJobStatus)=>status==='succeeded'||status==='failed'||status==='refunded';

export interface PendingAi {readonly jobId:string;readonly clientJobId:string;readonly photoKey:string;readonly createdAt:number}
export interface RoomAiOptions {
 readonly api:RoomAiApi;readonly userId:string;readonly codec:AiCodec;readonly waker?:Waker;
 readonly timeoutMs?:number;readonly now?:()=>number;
}
export interface RoomAi {
 readonly provider:ServerSurfaceProvider;
 quota():Promise<AiQuota|null>;
 /** Tap to select (AI): the selection around one point as a mask union step. The photo is uploaded once per session. */
 segment(photo:Pixels,point:readonly [number,number],signal:AbortSignal):Promise<{box:DirtyRect;data:Uint8Array}|null>;
 /** Finishes a preview started before the visualizer was closed, using the mask kept on the server. */
 finishEarlier(pending:PendingAi,photo:Pixels,signal:AbortSignal):Promise<SurfaceEditResult>;
 /** Best-effort removal of this session's uploaded photo (the daily cleanup removes it after 7 days anyway). */
 close():void;
}

export function createRoomAi(options:RoomAiOptions):RoomAi{
 const {api,userId,codec}=options,waker=options.waker??new Waker(),now=options.now??(()=>performance.now()),timeoutMs=options.timeoutMs??POLL_TIMEOUT_MS;
 const session=newClientJobId('s'),sessionFolder=`${userId}/${session}`;let sessionPhoto:Pixels|null=null;
 const fail=(answer:CloudFailure)=>problemFor(answer.code);

 /** Polls until the job is settled, with backoff, at most timeoutMs. */
 async function poll(jobId:string,signal:AbortSignal):Promise<{status:AiJobStatus;outputPath:string|null}>{
  const started=now();
  for(let i=0;;i++){
   check(signal);
   const job=await api.job(jobId);
   if(job.ok&&settled(job.status))return job;
   if(!job.ok&&job.code!=='NETWORK')throw fail(job);
   if(now()-started>=timeoutMs)throw new RoomAiError('TIMEOUT',true);
   await waker.wait(Math.min(POLL_DELAYS_MS[Math.min(i,POLL_DELAYS_MS.length-1)]!,Math.max(0,timeoutMs-(now()-started))),signal);
  }
 }
 /** Downloads the result, scales it to the photo and composites it inside the mask; then removes the server copies. */
 async function finish(jobId:string,clientJobId:string,photo:Pixels,mask:Uint8Array,signal:AbortSignal,started:number,onPhase?:(phase:AiPhase)=>void):Promise<SurfaceEditResult>{
  const job=await poll(jobId,signal);
  if(job.status==='refunded')throw new RoomAiError('REFUNDED');
  if(job.status==='failed'||!job.outputPath)throw new RoomAiError('FAILED');
  onPhase?.('finishing');
  const blob=await api.download(job.outputPath);check(signal);
  if(!blob)throw new RoomAiError('RESULT',true);
  let ai:Pixels;try{ai=await codec.decode(blob,photo.width,photo.height);}catch{throw new RoomAiError('RESULT',true);}
  check(signal);
  const out=compositeInMask(photo,ai,mask);
  void api.remove([`${userId}/${clientJobId}/mask.png`,job.outputPath]);
  return {...out,ms:now()-started};
 }
 const provider:RoomAi['provider']={kind:'server',async render(request,signal){
  const hints=request.ai,started=now();
  if(!hints)throw new RoomAiError('UNEXPECTED');
  if(hints.references.length>MAX_REFERENCES)throw new RoomAiError('UNEXPECTED');
  hints.onPhase?.('reserving');
  const reserved=await api.reserve(hints.clientJobId,'edit');check(signal);
  if(!reserved.ok)throw fail(reserved);
  hints.onJob?.(reserved.jobId);
  if(reserved.status==='refunded')throw new RoomAiError('REFUNDED');
  if(reserved.status==='failed')throw new RoomAiError('FAILED');
  if(reserved.status==='reserved'){
   // Uploaded one at a time: only one encoded file is held in memory at once on a budget phone.
   hints.onPhase?.('uploading');
   const folder=`${userId}/${hints.clientJobId}`,references=hints.references.map((_,i)=>`${folder}/ref-${i+1}.jpg`);
   const files:[string,()=>Promise<Blob>][]=[[`${folder}/photo.jpg`,()=>codec.jpeg(request.photo)],[`${folder}/mask.png`,()=>codec.maskPng(request.mask,request.photo.width,request.photo.height)],
    ...hints.references.map((r,i):[string,()=>Promise<Blob>]=>[references[i]!,()=>codec.jpeg(r)])];
   for(const [path,make] of files){
    let blob:Blob;try{blob=await make();}catch{throw new RoomAiError('UNEXPECTED');}
    check(signal);const sent=await api.upload(path,blob);check(signal);
    if(!sent.ok)throw sent.code==='NOT_SIGNED_IN'?fail(sent):new RoomAiError('NETWORK',true);
   }
   hints.onPhase?.('sending');
   const submitted=await api.submit({clientJobId:hints.clientJobId,surface:hints.surface,material:{kind:hints.kind,label:hints.label,colour:hints.colour},files:{photo:`${folder}/photo.jpg`,mask:`${folder}/mask.png`,references}});
   check(signal);
   if(!submitted.ok)throw fail(submitted);
   if(submitted.status==='refunded')throw new RoomAiError('REFUNDED');
   if(submitted.status==='failed')throw new RoomAiError('FAILED');
  }
  hints.onPhase?.('waiting');
  return finish(reserved.jobId,hints.clientJobId,request.photo,request.mask,signal,started,hints.onPhase);
 }};
 return {
  provider,
  async quota(){const q=await api.quota();return q.ok?{enabled:q.enabled,paused:q.paused,segmentPaused:q.segmentPaused,previewsPerMonth:q.previewsPerMonth,previewsLeft:q.previewsLeft,segmentsLeft:q.segmentsLeft}:null;},
  async segment(photo,point,signal){
   const path=`${sessionFolder}/photo.jpg`;
   if(sessionPhoto!==photo){
    let blob:Blob;try{blob=await codec.jpeg(photo);}catch{throw new RoomAiError('UNEXPECTED');}
    check(signal);const sent=await api.upload(path,blob);check(signal);
    if(!sent.ok)throw sent.code==='NOT_SIGNED_IN'?fail(sent):new RoomAiError('NETWORK');
    sessionPhoto=photo;
   }
   const answer=await api.segment({clientJobId:newClientJobId('t'),photo:path,x:Math.round(point[0]),y:Math.round(point[1])});check(signal);
   if(!answer.ok){const problem=fail(answer);throw problem.code==='NETWORK'?new RoomAiError('NETWORK'):problem;}
   let pixels:Pixels;try{pixels=await codec.decode(answer.mask,photo.width,photo.height);}catch{throw new RoomAiError('RESULT');}
   return selectionFromImage(pixels.data,photo.width,photo.height)??null;
  },
  async finishEarlier(pending,photo,signal){
   const started=now(),job=await poll(pending.jobId,signal);
   if(job.status!=='succeeded')throw new RoomAiError(job.status==='refunded'?'REFUNDED':'FAILED');
   const maskBlob=await api.download(`${userId}/${pending.clientJobId}/mask.png`);check(signal);
   const mask=maskBlob?await decodeMaskPng(new Uint8Array(await maskBlob.arrayBuffer())):null;
   if(!mask||mask.width!==photo.width||mask.height!==photo.height)throw new RoomAiError('RESULT');
   return finish(pending.jobId,pending.clientJobId,photo,mask.mask,signal,started);
  },
  close(){if(sessionPhoto){sessionPhoto=null;void api.remove([`${sessionFolder}/photo.jpg`]);}},
 };
}

/** Per device and per account: the preview still being made, so it can be finished after the app comes back. */
const pendingKey=(userId:string)=>`gharplan.roomAi.pending.${userId}`;
export const PENDING_MAX_AGE_MS=7*24*60*60*1000;
export function loadPending(userId:string,at=Date.now()):PendingAi|null{
 try{
  const v=JSON.parse(localStorage.getItem(pendingKey(userId))??'null') as Partial<PendingAi>|null;
  if(!v||typeof v.jobId!=='string'||typeof v.clientJobId!=='string'||typeof v.photoKey!=='string'||typeof v.createdAt!=='number')return null;
  return at-v.createdAt<PENDING_MAX_AGE_MS?v as PendingAi:null;
 }catch{return null;}
}
export function savePending(userId:string,pending:PendingAi|null):void{
 try{if(pending)localStorage.setItem(pendingKey(userId),JSON.stringify(pending));else localStorage.removeItem(pendingKey(userId));}catch{/* only this page remembers it */}
}
/** D86 consent, versioned, per device and account. */
export const CONSENT_VERSION=1;
const consentKey=(userId:string)=>`gharplan.roomAi.consent.v${CONSENT_VERSION}.${userId}`;
export function hasConsent(userId:string):boolean{try{return !!localStorage.getItem(consentKey(userId));}catch{return false;}}
export function giveConsent(userId:string,at=new Date()):void{try{localStorage.setItem(consentKey(userId),at.toISOString());}catch{/* asked again next time */}}
