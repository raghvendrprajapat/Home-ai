import {assertScenePixels} from './three-image';

/** D89: file names, the optional watermark and the checked encoding of an HD picture of the 3D view. */
export type PictureFormat='png'|'jpeg';
const two=(n:number)=>String(n).padStart(2,'0');
/** `gharplan-<project>-<YYYY-MM-DD>-<W>x<H>.<ext>`; letters and digits of any script (Hindi names too) survive, other runs become '-'. */
export function pictureFileName(projectName:string,date:Date,width:number,height:number,format:PictureFormat):string{
 const slug=Array.from(projectName.normalize('NFC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu,'-').replace(/^-+|-+$/g,'')).slice(0,40).join('').replace(/-+$/,'')||'design';
 const day=Number.isFinite(date.getTime())?`${date.getFullYear()}-${two(date.getMonth()+1)}-${two(date.getDate())}`:'undated';
 return `gharplan-${slug}-${day}-${width}x${height}.${format==='jpeg'?'jpg':'png'}`;
}
/** Small "GharPlan" mark in the bottom-right corner, scaled with the picture's short side. */
export function watermarkLayout(width:number,height:number):{fontSize:number;x:number;y:number}{
 const fontSize=Math.max(14,Math.round(Math.min(width,height)*0.026)),pad=Math.round(fontSize*0.9);return {fontSize,x:width-pad,y:height-pad};
}
export function drawWatermark(context:CanvasRenderingContext2D,width:number,height:number):void{
 const {fontSize,x,y}=watermarkLayout(width,height);context.save();
 try{context.font=`600 ${fontSize}px sans-serif`;context.textAlign='right';context.textBaseline='alphabetic';context.shadowColor='rgba(0,0,0,.35)';context.shadowBlur=Math.round(fontSize*0.3);context.fillStyle='rgba(255,255,255,.82)';context.fillText('GharPlan',x,y);}
 finally{context.restore();}
}
/** Real dimensions from the encoded bytes: PNG IHDR or the JPEG start-of-frame marker. */
export function encodedSize(bytes:Uint8Array):{format:PictureFormat;width:number;height:number}{
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(bytes.length>=24&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)&&String.fromCharCode(...bytes.subarray(12,16))==='IHDR')return {format:'png',width:view.getUint32(16),height:view.getUint32(20)};
 if(bytes.length>=4&&bytes[0]===0xff&&bytes[1]===0xd8){
  let at=2;while(at+4<=bytes.length){if(bytes[at]!==0xff)break;const marker=bytes[at+1]!;if(marker===0xff){at++;continue;}if(marker===0xd8||marker===0x01||marker>=0xd0&&marker<=0xd7){at+=2;continue;}const length=view.getUint16(at+2);
   if(marker>=0xc0&&marker<=0xcf&&marker!==0xc4&&marker!==0xc8&&marker!==0xcc){if(at+9>bytes.length)break;return {format:'jpeg',width:view.getUint16(at+7),height:view.getUint16(at+5)};}
   if(length<2)break;at+=2+length;}
 }
 throw new Error('image-encode');
}
function probe(source:CanvasImageSource,width:number,height:number,generation:number):void{
 const c=document.createElement('canvas');c.width=c.height=32;try{const ctx=c.getContext('2d');if(!ctx)throw new Error('image-context');ctx.drawImage(source,0,0,width,height,0,0,32,32);assertScenePixels({width:32,height:32,rgba:ctx.getImageData(0,0,32,32).data,generation});}finally{c.width=c.height=0;}
}
/** Web downloads may be large; the Android save keeps the verified 10 MB PNG budget (checked again by the native save). */
export const MAX_PICTURE_BYTES=48*1024*1024;
/** Checks the rendered pixels are a scene (not a flat clear colour), adds the optional mark, encodes and verifies the file. */
export async function encodeHdPicture(canvas:HTMLCanvasElement,options:{format:PictureFormat;watermark:boolean;generation:number;maxBytes?:number;signal?:AbortSignal}):Promise<{blob:Blob;width:number;height:number}>{
 const {width,height}=canvas,type=options.format==='jpeg'?'image/jpeg':'image/png';probe(canvas,width,height,options.generation);
 if(options.watermark){const ctx=canvas.getContext('2d');if(!ctx)throw new Error('image-context');drawWatermark(ctx,width,height);}
 const blob=await new Promise<Blob>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('image-timeout')),30000);try{canvas.toBlob(b=>{clearTimeout(timer);if(b&&b.size>0&&b.size<=(options.maxBytes??MAX_PICTURE_BYTES)&&b.type===type)resolve(b);else reject(new Error('image-encode'));},type,0.92);}catch(e){clearTimeout(timer);reject(e);}});
 if(options.signal?.aborted)throw new Error('capture-cancelled');
 const info=encodedSize(new Uint8Array(await blob.arrayBuffer()));if(info.format!==options.format||info.width!==width||info.height!==height)throw new Error('image-dimensions');
 let bitmap:ImageBitmap|undefined;
 try{bitmap=await new Promise<ImageBitmap>((resolve,reject)=>{let expired=false;const timer=setTimeout(()=>{expired=true;reject(new Error('image-timeout'));},15000);createImageBitmap(blob).then(b=>{clearTimeout(timer);if(expired)b.close();else resolve(b);},e=>{clearTimeout(timer);reject(e);});});
  if(bitmap.width!==width||bitmap.height!==height)throw new Error('image-dimensions');probe(bitmap,width,height,options.generation);}
 finally{bitmap?.close();}
 if(options.signal?.aborted)throw new Error('capture-cancelled');
 return {blob,width,height};
}
