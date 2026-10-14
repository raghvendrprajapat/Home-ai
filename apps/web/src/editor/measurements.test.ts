import {expect,it} from 'vitest';
import fc from 'fast-check';
import {formatLength,parseLength} from './measurements';
it('GEO-002 exact metric and decimal feet/inches are rounded once to the same4000mm',()=>{
 for(const input of ['4000','4000 mm','400 cm','4 m',"13' 1.48\"",'13 ft 1.48 in','13′ 1.48″'])expect(parseLength(input)).toBe(4000);
 expect(parseLength('3450')).toBe(3450);expect(parseLength('1 in')).toBe(25);expect(parseLength('0.5 mm')).toBe(1);expect(parseLength('1 ft')).toBe(305);
});
it('GEO-002 invalid, ambiguous and out-of-domain inputs reject rather than coerce',()=>{
 for(const input of ['', ' ', '0','-1','NaN','Infinity','0x100','1e3','1+2','4 meters','4 m junk',"1' 12\"",'200001 mm','.4 mm','true'])expect(()=>parseLength(input)).toThrow();
 expect(parseLength('-1.5 m',{coordinate:true})).toBe(-1500);expect(parseLength('0',{coordinate:true})).toBe(0);expect(()=>parseLength('100001',{coordinate:true})).toThrow();
});
it('GEO-007100 display switches and exact formatted roundtrips never change millimetres',()=>{
 fc.assert(fc.property(fc.integer({min:1,max:200000}),mm=>{for(let n=0;n<100;n++){const label=formatLength(mm,n%2?'imperial':'metric');expect(parseLength(label)).toBe(mm);}}),{seed:20261014,numRuns:200});
 expect(parseLength('2',{defaultUnit:'ft'})).toBe(610);expect(()=>formatLength(0.4,'metric')).toThrow();
});
