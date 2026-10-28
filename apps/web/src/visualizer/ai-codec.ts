import {encodeMaskPng} from './ai-image';
import {encodeResult,toBlob} from './result-export';
import type {Pixels} from './photo-prep';
import type {AiCodec} from './server-surface';
import type {TestCodec} from './test-surface';

/**
 * D86 Browser image work for the AI provider. Results arrive as Blobs from the app's own storage (never as cross-origin
 * <img> sources), so reading their pixels never taints a canvas. One decode at a time; canvases are emptied at once.
 */
async function decodeScaled(blob:Blob,width:number,height:number):Promise<Pixels>{
  const bitmap=await createImageBitmap(blob,{colorSpaceConversion:'none',premultiplyAlpha:'none'}),canvas=document.createElement('canvas');
  try{
   canvas.width=width;canvas.height=height;const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw new Error('decode');
   context.imageSmoothingQuality='high';context.drawImage(bitmap,0,0,width,height);
   return {width,height,data:context.getImageData(0,0,width,height).data};
  }finally{bitmap.close();canvas.width=canvas.height=0;}
}
export const browserCodec:AiCodec={jpeg:pixels=>encodeResult(pixels,'image/jpeg'),maskPng:encodeMaskPng,decode:decodeScaled};

/** Pixels drawn into a canvas of exactly width × height (stretched when the size differs), then encoded. */
async function encodeScaled(pixels:Pixels,width:number,height:number,type:'image/png'|'image/jpeg',quality?:number):Promise<Blob>{
 const source=document.createElement('canvas'),target=width===pixels.width&&height===pixels.height?source:document.createElement('canvas');
 try{
  source.width=pixels.width;source.height=pixels.height;
  const sctx=source.getContext('2d');if(!sctx)throw new Error('image-context');
  sctx.putImageData(new ImageData(pixels.data as Uint8ClampedArray<ArrayBuffer>,pixels.width,pixels.height),0,0);
  if(target!==source){target.width=width;target.height=height;const tctx=target.getContext('2d');if(!tctx)throw new Error('image-context');tctx.imageSmoothingQuality='high';tctx.drawImage(source,0,0,width,height);}
  return await toBlob(target,type,quality);
 }finally{source.width=source.height=0;target.width=target.height=0;}
}
/** D92 AI test mode: the room as PNG at the AI size, references as JPEG, answers decoded at the working size. */
export const browserTestCodec:TestCodec={
 png:(pixels,width,height)=>encodeScaled(pixels,width,height,'image/png'),
 jpeg:(pixels,quality)=>encodeScaled(pixels,pixels.width,pixels.height,'image/jpeg',quality),
 decode:decodeScaled,
};
