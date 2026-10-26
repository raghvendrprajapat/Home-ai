/**
 * D85 Room photo: opening the person's photo on the device. The photo is decoded once, turned upright and shrunk to
 * the working size (at most 1536 px on the long side and 1024 px on the short side, never enlarged); that canvas size
 * is the size of the mask, the offline engine and the saved image. Drawing through a canvas drops EXIF/GPS data. The
 * photo is never uploaded and never saved in the project.
 */
export interface Pixels {readonly width:number;readonly height:number;readonly data:Uint8ClampedArray}
export const MAX_PHOTO_BYTES=15*1024*1024,WORK_LONG=1536,WORK_SHORT=1024,MIN_PHOTO_EDGE=32;
/** Decoded photos above this many pixels (a 12 MP photo is ~48 MB as RGBA) are refused before any copy is made. */
export const MAX_DECODED_PIXELS=50_000_000;
export type PhotoProblem='type'|'size'|'small'|'decode';

/** Cheap checks before decoding: an image type, not empty, at most 15 MB (the same limit as Photo or sketch to plan). */
export function checkPhotoFile(file:Pick<File,'type'|'size'>):PhotoProblem|null{
 if(!file.type.startsWith('image/'))return 'type';
 return file.size<1||file.size>MAX_PHOTO_BYTES?'size':null;
}
/** The working size for a decoded photo: one uniform scale, never above 1, fitting 1536 × 1024 in either orientation. */
export function workingSize(width:number,height:number):{width:number;height:number;scale:number}{
 if(!(width>0&&height>0)||!Number.isFinite(width)||!Number.isFinite(height))throw new Error('photo-size');
 const long=Math.max(width,height),short=Math.min(width,height),scale=Math.min(1,WORK_LONG/long,WORK_SHORT/short);
 return {width:Math.max(1,Math.min(width,Math.round(width*scale))),height:Math.max(1,Math.min(height,Math.round(height*scale))),scale};
}
/** The largest box with the photo's shape that fits the screen area (CSS pixels, whole numbers). */
export function fitSize(boxWidth:number,boxHeight:number,width:number,height:number):{width:number;height:number}{
 const s=Math.max(0,Math.min(boxWidth/width,boxHeight/height));
 return {width:Math.max(1,Math.floor(width*s)),height:Math.max(1,Math.floor(height*s))};
}
/** A pointer position on the shown photo as working-size pixel coordinates (floats, kept inside the photo). */
export function toPixel(clientX:number,clientY:number,rect:{readonly left:number;readonly top:number;readonly width:number;readonly height:number},width:number,height:number):[number,number]{
 const x=(clientX-rect.left)/Math.max(1e-9,rect.width)*width,y=(clientY-rect.top)/Math.max(1e-9,rect.height)*height;
 return [Math.max(0,Math.min(width,x)),Math.max(0,Math.min(height,y))];
}

type Upright={readonly source:CanvasImageSource;readonly width:number;readonly height:number;release():void};
/**
 * Decodes upright. createImageBitmap with imageOrientation 'from-image' applies EXIF rotation where supported; the
 * fallback <img> decode relies on browsers applying EXIF orientation by default (CSS image-orientation: from-image).
 */
async function decodeUpright(file:Blob):Promise<Upright>{
 if(typeof createImageBitmap==='function'){
  try{const bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});return {source:bitmap,width:bitmap.width,height:bitmap.height,release:()=>bitmap.close()};}catch{/* fall back to <img> */}
 }
 const url=URL.createObjectURL(file);
 try{const image=new Image();image.decoding='async';image.src=url;await image.decode();return {source:image,width:image.naturalWidth,height:image.naturalHeight,release:()=>{image.src='';}};}
 finally{URL.revokeObjectURL(url);}
}
/** Opens the photo at working size. Throws an Error whose message is a PhotoProblem. */
export async function preparePhoto(file:File):Promise<Pixels>{
 const problem=checkPhotoFile(file);if(problem)throw new Error(problem);
 let upright:Upright;try{upright=await decodeUpright(file);}catch{throw new Error('decode');}
 const canvas=document.createElement('canvas');
 try{
  if(upright.width<MIN_PHOTO_EDGE||upright.height<MIN_PHOTO_EDGE)throw new Error('small');
  if(upright.width*upright.height>MAX_DECODED_PIXELS)throw new Error('size');
  const size=workingSize(upright.width,upright.height);canvas.width=size.width;canvas.height=size.height;
  const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw new Error('decode');
  context.imageSmoothingQuality='high';context.drawImage(upright.source,0,0,size.width,size.height);
  // Release the full-size decode at once: on a budget phone it is the biggest allocation in this feature.
  upright.release();
  return {width:size.width,height:size.height,data:context.getImageData(0,0,size.width,size.height).data};
 }catch(error){throw error instanceof Error&&['size','small','decode'].includes(error.message)?error:new Error('decode');}
 finally{upright.release();canvas.width=canvas.height=0;}
}
/** A small reference picture (pattern or wall art), decoded upright and kept at most `edge` px on its long side. */
export async function prepareReference(file:Blob,edge=1024):Promise<Pixels>{
 if(!file.type.startsWith('image/')||file.size<1||file.size>MAX_PHOTO_BYTES)throw new Error('type');
 let upright:Upright;try{upright=await decodeUpright(file);}catch{throw new Error('decode');}
 const canvas=document.createElement('canvas');
 try{
  if(upright.width<4||upright.height<4||upright.width*upright.height>MAX_DECODED_PIXELS)throw new Error('decode');
  const s=Math.min(1,edge/Math.max(upright.width,upright.height)),width=Math.max(1,Math.round(upright.width*s)),height=Math.max(1,Math.round(upright.height*s));
  canvas.width=width;canvas.height=height;const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw new Error('decode');
  context.imageSmoothingQuality='high';context.drawImage(upright.source,0,0,width,height);upright.release();
  return {width,height,data:context.getImageData(0,0,width,height).data};
 }catch{throw new Error('decode');}
 finally{upright.release();canvas.width=canvas.height=0;}
}
