import {expect,it} from 'vitest';
import fc from 'fast-check';
import fixture from '../../../../docs/examples/png-fixtures.json';
import {encodeBase64,decodeBase64,exportNativePng} from './native-png';
import type {NativePngIo} from './native-png';
const bytes=decodeBase64(fixture.base64),blob=()=>new Blob([bytes],{type:'image/png'});
async function checksum(){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');}
it('native PNG export is private cache/binary format with exact byte/hash receipt and cleanup',async()=>{
 let saved=0,removed=0;const hash=await checksum();const io:NativePngIo={write:async(path,data)=>{expect(path).toMatch(/^exports\/gharplan-[a-f0-9]{32}\.png$/);expect(data).toEqual(bytes);},read:async()=>bytes,remove:async()=>{removed++;},save:async req=>{saved++;expect(req.format).toBe('png');expect(req.sha256).toBe(hash);expect(req.bytes).toBe(75);return {verified:true,bytes:req.bytes,sha256:req.sha256};}};expect(await exportNativePng(blob(),io)).toMatchObject({verified:true,bytes:75});expect(saved).toBe(1);expect(removed).toBe(1);
});
it('cache corruption, cancellation, wrong receipt and invalid type never report verified PNG',async()=>{
 for(const mode of ['cache','cancel','receipt'] as const){let removed=0,calls=0;const io:NativePngIo={write:async()=>{},read:async()=>mode==='cache'?new Uint8Array(75):bytes,remove:async()=>{removed++;},save:async req=>{calls++;if(mode==='cancel')throw Object.assign(new Error('Cancelled'),{code:'EXPORT_CANCELLED'});return {verified:true,bytes:req.bytes,sha256:'0'.repeat(64)};}};await expect(exportNativePng(blob(),io)).rejects.toThrow();expect(removed).toBe(1);expect(calls).toBe(mode==='cache'?0:1);}
 await expect(exportNativePng(new Blob([bytes],{type:'application/json'}))).rejects.toThrow();
});
it('binary cache base64 roundtrip is bounded and rejects malformed strings',()=>{
 fc.assert(fc.property(fc.uint8Array({minLength:0,maxLength:100000}),data=>{expect(decodeBase64(encodeBase64(data))).toEqual(data);}),{seed:20261014,numRuns:100});for(const bad of ['abc','AA=A','A===','@@==','abc\n'])expect(()=>decodeBase64(bad)).toThrow();
});
it('cache I/O failure never reaches destination; failed or stalled cleanup cannot block a verified receipt',async()=>{
 let calls=0;const hash=await checksum(),base:NativePngIo={write:async()=>{},read:async()=>bytes,remove:async()=>{},save:async req=>{calls++;return {verified:true,bytes:req.bytes,sha256:hash};}};for(const action of ['write','read'] as const)await expect(exportNativePng(blob(),{...base,[action]:async()=>{throw new Error('Cache failed');}})).rejects.toThrow('Cache failed');expect(calls).toBe(0);expect(await exportNativePng(blob(),{...base,remove:()=>new Promise(()=>{})})).toMatchObject({verified:true});expect(await exportNativePng(blob(),{...base,remove:async()=>{throw new Error('Cleanup unavailable');}})).toMatchObject({verified:true});
});
