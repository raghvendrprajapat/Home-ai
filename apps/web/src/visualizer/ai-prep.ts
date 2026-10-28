import {encodePng} from './ai-image';

/**
 * D92 AI test mode, pure preparation maths for OpenAI's image edit (no canvas, so it runs in unit tests).
 * OpenAI custom sizes (image-generation guide and API reference, fetched 2026-10-28): width and height multiples of
 * 16, aspect ratio between 1:3 and 3:1, total pixels 655 360 … 8 294 400. GharPlan also keeps the long side at most
 * 1536 px (the working size). The same numbers are checked again on the server (server/vercel/room-ai/images.ts).
 * The photo is stretched (never cropped) to that size, so every mask pixel keeps its place; the AI answer is scaled
 * back to the working size and composited only inside our own mask.
 */
export const AI_MAX_LONG=1536,AI_MIN_PIXELS=655_360,AI_MAX_RATIO=3;
/** The AI size for a working photo, or null for a shape OpenAI does not accept (wider or taller than 3:1). */
export function aiSize(width:number,height:number,maxLong=AI_MAX_LONG):{width:number;height:number}|null{
 if(!(width>0&&height>0)||!Number.isFinite(width)||!Number.isFinite(height))return null;
 const ratio=width/height;if(ratio>AI_MAX_RATIO||ratio<1/AI_MAX_RATIO)return null;
 let s=Math.min(1,Math.min(maxLong,AI_MAX_LONG)/Math.max(width,height));
 if(width*height*s*s<AI_MIN_PIXELS)s=Math.sqrt(AI_MIN_PIXELS/(width*height));
 let w=Math.max(16,Math.round(width*s/16)*16),h=Math.max(16,Math.round(height*s/16)*16);
 while(w*h<AI_MIN_PIXELS){if(w/h<ratio)w+=16;else h+=16;}
 while(w>AI_MAX_RATIO*h)h+=16;
 while(h>AI_MAX_RATIO*w)w+=16;
 return Math.max(w,h)<=AI_MAX_LONG?{width:w,height:h}:null;
}
/**
 * OpenAI's mask as RGBA samples at the AI size: alpha 0 (transparent = edit) wherever any covered pixel of our mask
 * is chosen, alpha 255 elsewhere; colour always black. At the same size this is exactly "transparent where our
 * mask is non-zero". When resizing, each AI pixel looks at the block of working pixels it covers, so a thin brush
 * line is never lost.
 */
export function alphaMaskRgba(mask:Uint8Array,width:number,height:number,outWidth:number,outHeight:number):Uint8Array{
 if(mask.length!==width*height||outWidth<1||outHeight<1)throw new Error('mask-size');
 const out=new Uint8Array(outWidth*outHeight*4),sx=width/outWidth,sy=height/outHeight;
 for(let y=0;y<outHeight;y++){
  const y0=Math.min(height-1,Math.floor(y*sy)),y1=Math.max(y0+1,Math.min(height,Math.ceil((y+1)*sy)));
  for(let x=0;x<outWidth;x++){
   const x0=Math.min(width-1,Math.floor(x*sx)),x1=Math.max(x0+1,Math.min(width,Math.ceil((x+1)*sx)));
   let chosen=false;
   for(let yy=y0;yy<y1&&!chosen;yy++)for(let xx=x0;xx<x1;xx++)if(mask[yy*width+xx]){chosen=true;break;}
   out[(y*outWidth+x)*4+3]=chosen?0:255;
  }
 }
 return out;
}
/** The mask PNG sent to OpenAI (8-bit RGBA, colour type 6), exactly outWidth × outHeight. */
export const encodeAlphaMaskPng=(mask:Uint8Array,width:number,height:number,outWidth:number,outHeight:number):Promise<Blob>=>encodePng(alphaMaskRgba(mask,width,height,outWidth,outHeight),outWidth,outHeight,4);

/** Upload limits, the same as the server's (server/vercel/room-ai/edit.ts and segment.ts), with a little room spare. */
export const UPLOAD_LIMITS={total:4_150_000,room:3_400_000,mask:600_000,reference:800_000,segmentRoom:2_400_000} as const;
/** Base64 → bytes; null for anything that is not plain base64. */
export function base64Bytes(value:unknown):Uint8Array|null{
 if(typeof value!=='string'||!value||value.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(value))return null;
 try{return Uint8Array.from(atob(value),c=>c.charCodeAt(0));}catch{return null;}
}
