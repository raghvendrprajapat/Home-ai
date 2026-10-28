import type {Pixels} from './photo-prep';
import type {DirtyRect} from './mask';

/**
 * D86 Room photo AI, pure image helpers (no canvas, so they run in unit tests):
 * - the mask the AI receives: an 8-bit greyscale PNG at exactly the photo's size, WHITE = change, BLACK = keep
 *   (fal's convention for the edit model), the grey of a soft edge = its mask value;
 * - reading that PNG back (to finish a preview after the app was closed);
 * - the local composite: only pixels inside the mask take the AI result (blended by the soft mask); every pixel
 *   outside stays byte for byte the person's own photo, whatever the AI changed there.
 */
const CRC_TABLE=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
export function crc32(bytes:Uint8Array,start=0,end=bytes.length):number{let c=0xffffffff;for(let i=start;i<end;i++)c=CRC_TABLE[(c^bytes[i]!)&0xff]!^(c>>>8);return (c^0xffffffff)>>>0;}
const PNG_SIGNATURE=[137,80,78,71,13,10,26,10];
async function streamBytes(input:Uint8Array,stream:CompressionStream|DecompressionStream):Promise<Uint8Array>{
 const source=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(input);controller.close();}});
 const out=new Response(source.pipeThrough(stream as unknown as TransformStream<Uint8Array,Uint8Array>));
 return new Uint8Array(await out.arrayBuffer());
}
function chunk(type:string,data:Uint8Array):Uint8Array{
 const out=new Uint8Array(12+data.length),view=new DataView(out.buffer);
 view.setUint32(0,data.length);for(let i=0;i<4;i++)out[4+i]=type.charCodeAt(i);out.set(data,8);view.setUint32(8+data.length,crc32(out,4,8+data.length));
 return out;
}
/**
 * An 8-bit PNG from raw samples (filter 0 on every row), zlib-compressed by the browser. `channels` 1 = greyscale
 * (colour type 0), 4 = RGBA (colour type 6).
 */
export async function encodePng(samples:Uint8Array,width:number,height:number,channels:1|4):Promise<Blob>{
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||samples.length!==width*height*channels)throw new Error('mask-size');
 const row=width*channels,raw=new Uint8Array((row+1)*height);
 for(let y=0;y<height;y++)raw.set(samples.subarray(y*row,(y+1)*row),y*(row+1)+1);
 const header=new Uint8Array(13),view=new DataView(header.buffer);view.setUint32(0,width);view.setUint32(4,height);header[8]=8;header[9]=channels===4?6:0;
 const parts=[new Uint8Array(PNG_SIGNATURE),chunk('IHDR',header),chunk('IDAT',await streamBytes(raw,new CompressionStream('deflate'))),chunk('IEND',new Uint8Array(0))];
 return new Blob(parts as Uint8Array<ArrayBuffer>[],{type:'image/png'});
}
/** The mask as a greyscale PNG (colour type 0, 8 bits, filter 0 on every row), zlib-compressed by the browser. */
export const encodeMaskPng=(mask:Uint8Array,width:number,height:number):Promise<Blob>=>encodePng(mask,width,height,1);
/** Reads back a PNG written by encodeMaskPng (greyscale, 8 bits, filter 0); anything else gives null. */
export async function decodeMaskPng(bytes:Uint8Array):Promise<{width:number;height:number;mask:Uint8Array}|null>{
 try{
  if(bytes.length<45||PNG_SIGNATURE.some((b,i)=>bytes[i]!==b))return null;
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let at=8,width=0,height=0;const idat:Uint8Array[]=[];
  while(at+12<=bytes.length){
   const length=view.getUint32(at),type=String.fromCharCode(...bytes.subarray(at+4,at+8)),data=bytes.subarray(at+8,at+8+length);
   if(at+12+length>bytes.length||crc32(bytes,at+4,at+8+length)!==view.getUint32(at+8+length))return null;
   if(type==='IHDR'){width=view.getUint32(at+8);height=view.getUint32(at+12);if(data[8]!==8||data[9]!==0||data[12]!==0)return null;}
   else if(type==='IDAT')idat.push(data);else if(type==='IEND')break;
   at+=12+length;
  }
  if(width<1||height<1||width*height>50_000_000||!idat.length)return null;
  const joined=new Uint8Array(idat.reduce((n,d)=>n+d.length,0));let o=0;for(const d of idat){joined.set(d,o);o+=d.length;}
  const raw=await streamBytes(joined,new DecompressionStream('deflate'));
  if(raw.length!==(width+1)*height)return null;
  const mask=new Uint8Array(width*height);
  for(let y=0;y<height;y++){if(raw[y*(width+1)]!==0)return null;mask.set(raw.subarray(y*(width+1)+1,(y+1)*(width+1)),y*width);}
  return {width,height,mask};
 }catch{return null;}
}
/**
 * The AI result composited into the photo: out = photo × (255 − m)/255 + ai × m/255 per colour channel, rounded,
 * for pixels with mask m > 0; alpha and every pixel with m = 0 are copied from the photo unchanged.
 */
export function compositeInMask(photo:Pixels,ai:Pixels,mask:Uint8Array):Pixels&{changed:number}{
 if(ai.width!==photo.width||ai.height!==photo.height||mask.length!==photo.width*photo.height)throw new Error('composite-size');
 const out=new Uint8ClampedArray(photo.data),p=photo.data,a=ai.data;let changed=0;
 for(let i=0;i<mask.length;i++){
  const m=mask[i]!;if(!m)continue;const j=i*4;
  for(let c=0;c<3;c++)out[j+c]=Math.round((p[j+c]!*(255-m)+a[j+c]!*m)/255);
  if(out[j]!==p[j]||out[j+1]!==p[j+1]||out[j+2]!==p[j+2])changed++;
 }
 return {width:photo.width,height:photo.height,data:out,changed};
}
/**
 * A tap-to-select answer (any mask image the browser decoded, scaled to the photo) as a hard selection: pixels whose
 * brightness is at least half count as chosen. Returns the bounding box and its bytes, or undefined when empty.
 */
export function selectionFromImage(rgba:Uint8ClampedArray,width:number,height:number):{box:DirtyRect;data:Uint8Array}|undefined{
 let x0=width,y0=height,x1=-1,y1=-1;
 const on=(i:number)=>rgba[i*4+3]!>=128&&(rgba[i*4]!+rgba[i*4+1]!+rgba[i*4+2]!)>=384;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(on(y*width+x)){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;y1=y;}
 if(x1<0)return undefined;
 const box={x0,y0,x1:x1+1,y1:y1+1},w=box.x1-box.x0,data=new Uint8Array(w*(box.y1-box.y0));
 for(let y=box.y0;y<box.y1;y++)for(let x=box.x0;x<box.x1;x++)if(on(y*width+x))data[(y-box.y0)*w+x-box.x0]=255;
 return {box,data};
}
