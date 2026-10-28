import {inspectPng,MAX_PNG_BYTES} from '../editor/png';
import type {CapturedPixels} from '../render3d/capture';
export function copyFramebuffer(source:HTMLCanvasElement):Uint8ClampedArray{
 const c=document.createElement('canvas');c.width=source.width;c.height=source.height;
 try{const ctx=c.getContext('2d');if(!ctx)throw new Error('image-context');ctx.drawImage(source,0,0);return ctx.getImageData(0,0,c.width,c.height).data;}finally{c.width=c.height=0;}
}
/** Require visible scene variation before watermark; a flat opaque clear buffer is not a success. */
export function assertScenePixels(image:CapturedPixels):void{
 if(!Number.isSafeInteger(image.width)||!Number.isSafeInteger(image.height)||image.width<1||image.height<1||Math.max(image.width,image.height)>2048||image.width*image.height>4_000_000||image.rgba.length!==image.width*image.height*4)throw new Error('image-budget');
 const lo=[255,255,255],hi=[0,0,0];let opaque=0;const pixels=image.width*image.height,step=Math.max(1,Math.floor(pixels/4096));for(let p=0;p<pixels;p+=step){const i=p*4;if(image.rgba[i+3]!<250)continue;opaque++;for(let c=0;c<3;c++){lo[c]=Math.min(lo[c]!,image.rgba[i+c]!);hi[c]=Math.max(hi[c]!,image.rgba[i+c]!);}}
 if(opaque<2||!hi.some((v,i)=>v-lo[i]!>6))throw new Error('image-blank');
}
export async function encodeThreeImage(source:CapturedPixels,edge:1000|2000,name:string,watermark=true):Promise<{blob:Blob;width:number;height:number}>{
 assertScenePixels(source);if(Math.min(source.width,source.height)<64)throw new Error('image-budget');const ratio=Math.min(1,edge/Math.max(source.width,source.height)),width=Math.max(1,Math.round(source.width*ratio)),height=Math.max(1,Math.round(source.height*ratio)),raw=document.createElement('canvas'),canvas=document.createElement('canvas');raw.width=source.width;raw.height=source.height;canvas.width=width;canvas.height=height;
 let bitmap:ImageBitmap|undefined;
 try{
  const rc=raw.getContext('2d'),ctx=canvas.getContext('2d');if(!rc||!ctx)throw new Error('image-context');rc.putImageData(new ImageData(new Uint8ClampedArray(source.rgba),source.width,source.height),0,0);ctx.drawImage(raw,0,0,width,height);raw.width=raw.height=0;
  if(watermark){ctx.fillStyle='rgba(255,255,255,.88)';ctx.fillRect(0,Math.max(0,height-40),width,40);ctx.fillStyle='#263c31';ctx.font='16px sans-serif';ctx.fillText(`GharPlan · ${name.slice(0,60)}`,12,height-14,Math.max(1,width-24));}
  const blob=await new Promise<Blob>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('image-timeout')),8000);try{canvas.toBlob(b=>{clearTimeout(timer);if(b&&b.size>0&&b.size<=MAX_PNG_BYTES)resolve(b);else reject(new Error('image-encode'));},'image/png');}catch(e){clearTimeout(timer);reject(e);}});
  const info=inspectPng(new Uint8Array(await blob.arrayBuffer()));if(info.width!==width||info.height!==height)throw new Error('image-dimensions');
  bitmap=await new Promise<ImageBitmap>((resolve,reject)=>{let expired=false;const timer=setTimeout(()=>{expired=true;reject(new Error('image-timeout'));},8000);createImageBitmap(blob).then(b=>{clearTimeout(timer);if(expired)b.close();else resolve(b);},e=>{clearTimeout(timer);reject(e);});});if(bitmap.width!==width||bitmap.height!==height)throw new Error('image-dimensions');
  const probe=document.createElement('canvas');probe.width=probe.height=32;try{const pc=probe.getContext('2d');if(!pc)throw new Error('image-context');pc.drawImage(bitmap,0,0,width,height-40,0,0,32,32);assertScenePixels({width:32,height:32,rgba:pc.getImageData(0,0,32,32).data,generation:source.generation});}finally{probe.width=probe.height=0;}return {blob,width,height};
 }finally{bitmap?.close();raw.width=raw.height=canvas.width=canvas.height=0;}
}
