/** Bounded PNG envelope validation before decoding or native transport. Not a CAD project format. */
export const MAX_PNG_BYTES=10*1024*1024,MAX_PNG_EDGE=2048;
const magic=[137,80,78,71,13,10,26,10];
const crcTable=Uint32Array.from({length:256},(_,value)=>{let crc=value;for(let n=0;n<8;n++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);return crc>>>0;});
export function crc32(bytes:Uint8Array):number {let crc=0xffffffff;for(const byte of bytes)crc=(crc>>>8)^crcTable[(crc^byte)&255]!;return (crc^0xffffffff)>>>0;}
export function inspectPng(bytes:Uint8Array):{width:number;height:number} {
 if(bytes.length<57||bytes.length>MAX_PNG_BYTES||!magic.every((v,i)=>bytes[i]===v))throw new Error('invalid-png');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let at=8,chunks=0,width=0,height=0,data=false,ended=false;
 while(at<bytes.length){if(++chunks>4096||at+12>bytes.length)throw new Error('invalid-png');const size=view.getUint32(at),end=at+12+size;if(end>bytes.length)throw new Error('invalid-png');const type=String.fromCharCode(...bytes.subarray(at+4,at+8));if(!/^[A-Za-z]{4}$/.test(type)||crc32(bytes.subarray(at+4,at+8+size))!==view.getUint32(at+8+size))throw new Error('invalid-png');
  if(chunks===1){if(type!=='IHDR'||size!==13)throw new Error('invalid-png');width=view.getUint32(at+8);height=view.getUint32(at+12);if(width<1||height<1||width>MAX_PNG_EDGE||height>MAX_PNG_EDGE||width*height>4000000||bytes[at+16]!==8||![2,6].includes(bytes[at+17]!)||bytes[at+18]!==0||bytes[at+19]!==0||bytes[at+20]!==0)throw new Error('png-budget');}
  else if(type==='IHDR')throw new Error('invalid-png');
  if(type==='IDAT'){if(size===0)throw new Error('invalid-png');data=true;}
  if(type==='IEND'){if(size!==0||!data||end!==bytes.length)throw new Error('invalid-png');ended=true;}
  at=end;
 }
 if(!ended)throw new Error('invalid-png');return {width,height};
}
