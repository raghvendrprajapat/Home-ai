import {Capacitor} from '@capacitor/core';
import {exportNativePng} from '../storage/native-png';
import type {Pixels} from './photo-prep';

/**
 * D85 Room photo: saving and sharing the preview. On the web the image is a JPEG download (or the phone's share sheet
 * when the browser can share files). The Android app reuses the verified native image save of the plan and 3D PNG
 * exports (D32/D35), which accepts only checked PNG files, so there the same picture is saved as PNG. A small "preview" label is drawn in the
 * corner of saved images only; the screen shows the clean result.
 */
export type SaveOutcome='requested'|'verified'|'cancelled'|'failed'|'shared';
export const RESULT_JPEG_QUALITY=.9;

const toBlob=(canvas:HTMLCanvasElement,type:string,quality?:number)=>new Promise<Blob>((resolve,reject)=>{
 const timer=setTimeout(()=>reject(new Error('image-timeout')),8000);
 try{canvas.toBlob(b=>{clearTimeout(timer);if(b&&b.size>0)resolve(b);else reject(new Error('image-encode'));},type,quality);}catch(e){clearTimeout(timer);reject(e);}
});
/** Encodes pixels as JPEG or PNG, optionally with a corner label. */
export async function encodeResult(pixels:Pixels,type:'image/jpeg'|'image/png',label?:string):Promise<Blob>{
 const canvas=document.createElement('canvas');canvas.width=pixels.width;canvas.height=pixels.height;
 try{
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('image-context');
  ctx.putImageData(new ImageData(pixels.data as Uint8ClampedArray<ArrayBuffer>,pixels.width,pixels.height),0,0);
  if(label){const size=Math.max(12,Math.round(Math.min(pixels.width,pixels.height)/40));ctx.font=`${size}px sans-serif`;const w=Math.min(pixels.width-8,ctx.measureText(label).width+size);ctx.fillStyle='rgba(255,255,255,.8)';ctx.fillRect(4,pixels.height-size*1.8-4,w,size*1.8);ctx.fillStyle='#263c31';ctx.fillText(label,4+size/2,pixels.height-4-size*.55,Math.max(1,w-size));}
  return await toBlob(canvas,type,type==='image/jpeg'?RESULT_JPEG_QUALITY:undefined);
 }finally{canvas.width=canvas.height=0;}
}
/** Saves the result: native verified PNG on Android, a JPEG download elsewhere. */
export async function saveResult(pixels:Pixels,label:string):Promise<SaveOutcome>{
 if(Capacitor.getPlatform()==='android'){
  if(!Capacitor.isPluginAvailable('ProjectFiles'))return 'failed';
  try{await exportNativePng(await encodeResult(pixels,'image/png',label));return 'verified';}
  catch(e){return e&&typeof e==='object'&&'code' in e&&e.code==='EXPORT_CANCELLED'?'cancelled':'failed';}
 }
 const blob=await encodeResult(pixels,'image/jpeg',label),url=URL.createObjectURL(blob);
 try{const link=document.createElement('a');link.href=url;link.download='gharplan-room-photo.jpg';link.click();return 'requested';}
 catch{return 'failed';}
 finally{setTimeout(()=>URL.revokeObjectURL(url),60_000);}
}
/** True when this browser can hand an image file to the phone's share sheet. */
export function canShareImages():boolean{
 try{return typeof navigator.share==='function'&&typeof navigator.canShare==='function'&&navigator.canShare({files:[new File([new Uint8Array(1)],'probe.jpg',{type:'image/jpeg'})]});}catch{return false;}
}
export async function shareResult(pixels:Pixels,label:string,title:string):Promise<SaveOutcome>{
 const blob=await encodeResult(pixels,'image/jpeg',label),file=new File([blob],'gharplan-room-photo.jpg',{type:'image/jpeg'});
 try{await navigator.share({files:[file],title});return 'shared';}
 catch(e){return e instanceof DOMException&&e.name==='AbortError'?'cancelled':'failed';}
}
