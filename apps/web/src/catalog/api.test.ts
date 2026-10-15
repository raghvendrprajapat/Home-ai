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

it('REN-004/AST-003 real packaged GLB resolves exact pins, decodes grounded native dimensions and preserves the asymmetric front',async()=>{
 const {CatalogSource}=await import('./api'),{decodeFurniture}=await import('../render3d/furniture-decoder'),{Box3,Vector3}=await import('three');
 const model=await readFile(new URL('../../public/catalog/'+asset.lods[0]!.path,import.meta.url)),urls:string[]=[],api=new CatalogApi(base,async input=>{urls.push(String(input));return response(String(input).endsWith('.glb')?model:raw);}),source=new CatalogSource(api),progress:number[]=[];
 const data=await source.load('a_demo_table',1,0,new AbortController().signal,n=>progress.push(n)),decoded=await decodeFurniture(data);
 try{expect(data).toMatchObject({id:'a_demo_table',version:1,lod:0,triangles:72});expect(decoded.primitives).toHaveLength(6);expect(new Set(decoded.primitives.map(p=>p.material)).size).toBe(3);expect(decoded.byteLength).toBeGreaterThan(0);
 const bounds=new Box3();for(const p of decoded.primitives)bounds.union(p.geometry.boundingBox!);expect(bounds.getSize(new Vector3()).toArray()).toEqual([expect.closeTo(1.2,5),expect.closeTo(.75,5),expect.closeTo(.6,5)]);expect(bounds.min.y).toBeCloseTo(0,5);expect(bounds.getCenter(new Vector3()).x).toBeCloseTo(0,5);expect(bounds.getCenter(new Vector3()).z).toBeCloseTo(0,5);expect(decoded.primitives.find(p=>p.name==='front-drawer')!.geometry.boundingBox!.getCenter(new Vector3()).z).toBeCloseTo(-.29,5);expect(progress).toContain(model.length);
 }finally{decoded.dispose();decoded.dispose();}
 await expect(source.load('a_demo_table',2,0,new AbortController().signal,()=>{})).rejects.toMatchObject({code:'failed'});expect(urls).toEqual([base+'catalog.json',base+asset.lods[0]!.path]);
});
it('REN-004 model byte/hash truncation and invalid profiles fail before display, including accessor allocation bombs',async()=>{
 const {decodeFurniture,inspectFurniture}=await import('../render3d/furniture-decoder');
 const model=await readFile(new URL('../../public/catalog/'+asset.lods[0]!.path,import.meta.url));
 for(const body of [new Uint8Array(model).slice(0,-1),new Uint8Array(model).fill(0)])await expect(new CatalogApi(base,async()=>response(body)).model(asset,0,new AbortController().signal)).rejects.toMatchObject({code:'failed'});
 const data=await new CatalogApi(base,async()=>response(model)).model(asset,0,new AbortController().signal);
 const mutate=(edit:(root:Record<string,unknown>)=>void)=>{const v=new DataView(data.bytes),n=v.getUint32(12,true),root=JSON.parse(new TextDecoder().decode(new Uint8Array(data.bytes,20,n)));edit(root);let json=new TextEncoder().encode(JSON.stringify(root));const aligned=new Uint8Array(Math.ceil(json.length/4)*4);aligned.fill(32);aligned.set(json);json=aligned;const bin=new Uint8Array(data.bytes,20+n),bytes=new ArrayBuffer(20+json.length+bin.length),out=new DataView(bytes);out.setUint32(0,0x46546c67,true);out.setUint32(4,2,true);out.setUint32(8,bytes.byteLength,true);out.setUint32(12,json.length,true);out.setUint32(16,0x4e4f534a,true);new Uint8Array(bytes,20,json.length).set(json);new Uint8Array(bytes,20+json.length).set(bin);return {...data,bytes};};
 for(const edit of [(r:Record<string,unknown>)=>{(r.accessors as {count:number}[])[0]!.count=1e9;},(r:Record<string,unknown>)=>{r.images=[{uri:'unavailable.png'}];},(r:Record<string,unknown>)=>{(r.nodes as {children:number[]}[])[0]!.children=[0];},(r:Record<string,unknown>)=>{(r.bufferViews as {byteLength:number}[])[0]!.byteLength=1;},(r:Record<string,unknown>)=>{r.extensionsUsed=['unsupported'];}])expect(()=>inspectFurniture(mutate(edit))).toThrow();
 await expect(decodeFurniture({...data,dims:{...data.dims,w:data.dims.w+1}})).rejects.toThrow('furniture-profile');
});
it('REN-009 a throwing original GLTF disposer cannot suppress return and leak the baked clones',async()=>{
 const {decodeFurniture}=await import('../render3d/furniture-decoder'),{BufferGeometry,Material}=await import('three'),model=await readFile(new URL('../../public/catalog/'+asset.lods[0]!.path,import.meta.url)),data=await new CatalogApi(base,async()=>response(model)).model(asset,0,new AbortController().signal),counts=new Map<object,number>();let injected=false;
 const gs=vi.spyOn(BufferGeometry.prototype,'dispose').mockImplementation(function(this:InstanceType<typeof BufferGeometry>){counts.set(this,(counts.get(this)??0)+1);if(!injected){injected=true;throw Error('original-dispose');}}),ms=vi.spyOn(Material.prototype,'dispose').mockImplementation(function(this:InstanceType<typeof Material>){counts.set(this,(counts.get(this)??0)+1);});
 try{await expect(decodeFurniture(data)).rejects.toThrow('original-dispose');expect([...counts.keys()].filter(o=>o instanceof BufferGeometry).length).toBeGreaterThanOrEqual(7);expect([...counts.keys()].filter(o=>o instanceof Material).length).toBe(6);expect([...counts.values()].every(n=>n===1)).toBe(true);}finally{gs.mockRestore();ms.mockRestore();}
});
