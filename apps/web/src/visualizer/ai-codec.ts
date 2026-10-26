import {encodeMaskPng} from './ai-image';
import {encodeResult} from './result-export';
import type {AiCodec} from './server-surface';

/**
 * D86 Browser image work for the AI provider. Results arrive as Blobs from the app's own storage (never as cross-origin
 * <img> sources), so reading their pixels never taints a canvas. One decode at a time; canvases are emptied at once.
 */
export const browserCodec:AiCodec={
 jpeg:pixels=>encodeResult(pixels,'image/jpeg'),
 maskPng:encodeMaskPng,
 async decode(blob,width,height){
  const bitmap=await createImageBitmap(blob,{colorSpaceConversion:'none',premultiplyAlpha:'none'}),canvas=document.createElement('canvas');
  try{
   canvas.width=width;canvas.height=height;const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw new Error('decode');
   context.imageSmoothingQuality='high';context.drawImage(bitmap,0,0,width,height);
   return {width,height,data:context.getImageData(0,0,width,height).data};
  }finally{bitmap.close();canvas.width=canvas.height=0;}
 },
};
