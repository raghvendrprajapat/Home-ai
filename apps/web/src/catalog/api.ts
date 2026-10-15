import {parseCatalog} from './catalog';
import type {Catalog,CatalogAsset} from './catalog';
export interface Progress {received:number;total:number|undefined}
export class CatalogFailure extends Error {constructor(readonly code:'failed'|'cancelled'|'timeout'){super(`catalog-${code}`);}}
/** Settles ownership even if an injected/defective operation ignores abort. */
function abortable<T>(promise:Promise<T>,signal:AbortSignal):Promise<T>{
 if(signal.aborted){void promise.catch(()=>{});return Promise.reject(new CatalogFailure('cancelled'));}
 return new Promise((resolve,reject)=>{
  const cancel=()=>{signal.removeEventListener('abort',cancel);reject(new CatalogFailure('cancelled'));};signal.addEventListener('abort',cancel,{once:true});
  promise.then(value=>{signal.removeEventListener('abort',cancel);resolve(value);},error=>{signal.removeEventListener('abort',cancel);reject(error);});
 });
}
export class CatalogApi {
 constructor(readonly base:URL,private fetcher:typeof fetch=fetch){}
 private async bytes(path:string,limit:number,signal:AbortSignal,onProgress:(p:Progress)=>void,expected?:{bytes:number;sha256:string}):Promise<Uint8Array<ArrayBuffer>>{
  if(signal.aborted)throw new CatalogFailure('cancelled');
  const owner=new AbortController();let timedOut=false;
  const cancel=()=>owner.abort();signal.addEventListener('abort',cancel,{once:true});
  const timeout=setTimeout(()=>{timedOut=true;owner.abort();},15000);
  try{
   const response=await abortable(this.fetcher.call(globalThis,new URL(path,this.base),{signal:owner.signal,credentials:'omit',referrerPolicy:'no-referrer'}),owner.signal);
   if(!response.ok||!response.body)throw new CatalogFailure('failed');
   const length=Number(response.headers.get('content-length')),total=expected?.bytes??(!response.headers.get('content-encoding')&&Number.isInteger(length)&&length>0?length:undefined);
   if(total!==undefined&&total>limit)throw new CatalogFailure('failed');
   const reader=response.body.getReader(),chunks:Uint8Array[]=[];let received=0,complete=false;
   try{
    onProgress({received,total});
    for(;;){const result=await abortable(reader.read(),owner.signal);if(result.done){complete=true;break;}if(!(result.value instanceof Uint8Array))throw new CatalogFailure('failed');received+=result.value.byteLength;if(received>limit)throw new CatalogFailure('failed');chunks.push(result.value);onProgress({received,total});}
   }finally{if(!complete)void reader.cancel().catch(()=>{});reader.releaseLock();}
   if(!received||expected&&received!==expected.bytes)throw new CatalogFailure('failed');
   const bytes=new Uint8Array(received);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
   if(expected){const digest=await abortable(crypto.subtle.digest('SHA-256',bytes.buffer),owner.signal),hash=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');if(hash!==expected.sha256)throw new CatalogFailure('failed');}
   if(owner.signal.aborted)throw new CatalogFailure('cancelled');return bytes;
  }catch(error){if(signal.aborted)throw new CatalogFailure('cancelled');if(timedOut)throw new CatalogFailure('timeout');throw error instanceof CatalogFailure?error:new CatalogFailure('failed');}
  finally{clearTimeout(timeout);signal.removeEventListener('abort',cancel);owner.abort();}
 }
 async catalog(signal:AbortSignal,onProgress:(p:Progress)=>void=()=>{}):Promise<Catalog>{
  const bytes=await this.bytes('catalog.json',2*1024*1024,signal,onProgress);
  if(signal.aborted)throw new CatalogFailure('cancelled');
  try{return parseCatalog(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));}catch{throw new CatalogFailure('failed');}
 }
 async thumbnail(asset:CatalogAsset,signal:AbortSignal,onProgress:(p:Progress)=>void=()=>{}):Promise<Blob>{
  if(!/^[a-f0-9]{64}$/.test(asset.thumb.sha256)||asset.thumb.path!==`blobs/${asset.thumb.sha256}.svg`)throw new CatalogFailure('failed');
  const bytes=await this.bytes(asset.thumb.path,128*1024,signal,onProgress,asset.thumb);if(signal.aborted)throw new CatalogFailure('cancelled');return new Blob([bytes.buffer],{type:'image/svg+xml'});
 }
}
