import {readFile} from 'node:fs/promises';
import {it,expect,vi,afterEach} from 'vitest';
import {CatalogApi} from './api';
import {parseCatalog} from './catalog';
const raw=await readFile(new URL('../../public/catalog/catalog.json',import.meta.url),'utf8'),catalog=parseCatalog(JSON.parse(raw)),asset=catalog.assets[0]!,svg=await readFile(new URL('../../public/catalog/'+asset.thumb.path,import.meta.url));
const base=new URL('https://fixture.invalid/catalog/');
const response=(body:string|Uint8Array)=>new Response(body instanceof Uint8Array?new Uint8Array(body).buffer:body);
afterEach(()=>vi.useRealTimers());
it('UX-007 actual packaged manifest/SVG bytes pass bounded progress/hash/size checks without rewriting metadata',async()=>{
 const urls:string[]=[],fetcher:typeof fetch=async input=>{urls.push(String(input));return response(String(input).endsWith('.svg')?svg:raw);},api=new CatalogApi(base,fetcher),progress:number[]=[];
 const loaded=await api.catalog(new AbortController().signal,p=>progress.push(p.received));expect(loaded).toEqual(catalog);const blob=await api.thumbnail(asset,new AbortController().signal,p=>progress.push(p.received));expect(blob.type).toBe('image/svg+xml');expect(new Uint8Array(await blob.arrayBuffer())).toEqual(new Uint8Array(svg));expect(urls).toEqual([base+'catalog.json',base+asset.thumb.path]);expect(progress).toContain(svg.length);
});
it('UX-007 wrong hash, truncation, oversize, failed status, invalid UTF8/JSON and unknown schema remain explicit failures',async()=>{
 const modified=new Uint8Array(svg);modified[modified.length-1]=modified[modified.length-1]!^1;
 for(const body of [modified,new Uint8Array(svg).slice(0,-1),new Uint8Array(128*1024+1)]){const api=new CatalogApi(base,async()=>response(body));await expect(api.thumbnail(asset,new AbortController().signal)).rejects.toMatchObject({code:'failed'});}
 for(const make of [()=>new Response('',{status:503}),()=>new Response(null,{status:200}),()=>response('broken JSON'),()=>response(new Uint8Array([0xff])),()=>response(JSON.stringify({...JSON.parse(raw),formatVersion:2})),()=>response(' '.repeat(2*1024*1024+1))])await expect(new CatalogApi(base,async()=>make()).catalog(new AbortController().signal)).rejects.toMatchObject({code:'failed'});
});
it('UX-007 abort settles noncooperative fetch immediately, releases timeout and ignores its eventual response/progress',async()=>{
 vi.useFakeTimers();let resolve!:(r:Response)=>void;const fetcher=vi.fn(()=>new Promise<Response>(r=>{resolve=r;})),api=new CatalogApi(base,fetcher),owner=new AbortController(),progress=vi.fn(),result=api.catalog(owner.signal,progress).catch(error=>error);owner.abort();expect(await result).toMatchObject({code:'cancelled'});expect(vi.getTimerCount()).toBe(0);resolve(response(raw));await Promise.resolve();await Promise.resolve();expect(progress).not.toHaveBeenCalled();
 const cancelled=new AbortController();cancelled.abort();await expect(api.catalog(cancelled.signal)).rejects.toMatchObject({code:'cancelled'});expect(fetcher).toHaveBeenCalledTimes(1);
});
it('UX-007 noncooperative pending response and stalled body both time out without leaked timers',async()=>{
 vi.useFakeTimers();const stalled=new CatalogApi(base,()=>new Promise(()=>{})),result=stalled.catalog(new AbortController().signal).catch(error=>error);await vi.advanceTimersByTimeAsync(15000);expect(await result).toMatchObject({code:'timeout'});expect(vi.getTimerCount()).toBe(0);
 const cancelled=vi.fn(),stream=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(new TextEncoder().encode('{'));},cancel:cancelled}),api=new CatalogApi(base,async()=>new Response(stream)),pending=api.catalog(new AbortController().signal).catch(error=>error);await vi.advanceTimersByTimeAsync(15000);expect(await pending).toMatchObject({code:'timeout'});expect(cancelled).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);
});
it('UX-007 cancellation between fetch creation and abort ownership handles late rejection without publishing',async()=>{
 const owner=new AbortController(),api=new CatalogApi(base,()=>{owner.abort();return Promise.reject(Error('late injected fetch rejection'));});await expect(api.catalog(owner.signal)).rejects.toMatchObject({code:'cancelled'});
});

it('UX-007 fetch keeps the browser global receiver rather than the API instance',async()=>{
 const fetcher:typeof fetch=function(this:unknown){expect(this).toBe(globalThis);return Promise.resolve(response(raw));};expect(await new CatalogApi(base,fetcher).catalog(new AbortController().signal)).toEqual(catalog);
});
