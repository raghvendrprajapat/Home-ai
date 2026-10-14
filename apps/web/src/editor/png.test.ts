import {expect,it} from 'vitest';
import fc from 'fast-check';
import fixture from '../../../../docs/examples/png-fixtures.json';
import {crc32,inspectPng,MAX_PNG_BYTES} from './png';
const bytes=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
it('Codex PNG fixture has independently generated CRC and exact2x2 envelope; invalid/truncated/oversized input rejects',()=>{
 const valid=bytes(fixture.base64);expect(crc32(new TextEncoder().encode(fixture.crcCheckText))).toBe(fixture.crcCheckValue);expect(inspectPng(valid)).toEqual({width:2,height:2});for(let n=0;n<valid.length;n++)expect(()=>inspectPng(valid.subarray(0,n))).toThrow();const changed=valid.slice();changed[45]=changed[45]!^1;expect(()=>inspectPng(changed)).toThrow();expect(()=>inspectPng(bytes(fixture.oversizedWidthBase64))).toThrow('png-budget');expect(()=>inspectPng(new Uint8Array(MAX_PNG_BYTES+1))).toThrow();expect(()=>inspectPng(Uint8Array.from([...valid,0]))).toThrow();
});
it('one-bit PNG mutations never pass envelope validation; input bytes are never altered',()=>{
 const valid=bytes(fixture.base64),original=valid.slice();fc.assert(fc.property(fc.integer({min:0,max:valid.length-1}),fc.integer({min:0,max:7}),(at,bit)=>{const mutated=valid.slice();mutated[at]=mutated[at]!^(1<<bit);expect(()=>inspectPng(mutated)).toThrow();expect(valid).toEqual(original);}),{seed:20261014,numRuns:200});
});
