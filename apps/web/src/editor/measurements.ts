/** Strict measured input; one final conversion to canonical integer millimetres. */
export type LengthUnit='mm'|'cm'|'m'|'ft'|'in';
const factor:Record<LengthUnit,number>={mm:1,cm:10,m:1000,ft:304.8,in:25.4};
const decimal='(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
export function parseLength(text:string,options:{defaultUnit?:LengthUnit;coordinate?:boolean;maximum?:number}={}):number {
 if(typeof text!=='string'||text.length>80)throw new Error('invalid-length');
 const value=text.trim().toLowerCase().replaceAll('′',"'").replaceAll('″','"');
 const pair=new RegExp(`^(${decimal})\\s*(?:'|ft|feet|foot)\\s*(${decimal})\\s*(?:"|in|inch|inches)$`).exec(value);
 let mm:number;
 if(pair){const inches=Number(pair[2]);if(inches>=12)throw new Error('invalid-length');mm=Number(pair[1])*304.8+inches*25.4;}
 else {
  const single=new RegExp(`^([+-]?${decimal})\\s*(mm|cm|m|ft|in|'|")?$`).exec(value);
  if(!single)throw new Error('invalid-length');
  const suffix=single[2],unit=suffix==="'"?'ft':suffix==='"'?'in':(suffix??options.defaultUnit??'mm') as LengthUnit;
  mm=Number(single[1])*factor[unit];
 }
 const rounded=Math.round(mm),maximum=options.maximum??(options.coordinate?100000:200000);
 if(!Number.isFinite(mm)||!Number.isSafeInteger(rounded)||Math.abs(mm)>maximum||(!options.coordinate&&rounded<=0))throw new Error('invalid-length');
 return Object.is(rounded,-0)?0:rounded;
}
export function formatLength(mm:number,units:'metric'|'imperial'):string {
 if(!Number.isSafeInteger(mm)||mm<0||mm>200000)throw new Error('invalid-length');
 return units==='metric'?`${mm} mm`:`${(Math.floor(mm/304.8*100000)/100000).toFixed(5)} ft`;
}
