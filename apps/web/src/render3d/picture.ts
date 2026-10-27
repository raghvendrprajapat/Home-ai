import type * as THREE from 'three';
import {profiles} from './quality';
import type {GpuCapabilities,QualityTier} from './quality';

/**
 * D89 "HD picture" of the 3D view. The picture is rendered in tiles into the live canvas's own drawing buffer
 * (camera view offsets), so no extra WebGL buffer is allocated and sizes above the drawing-buffer limit stay exact.
 */
export type PicturePreset='hd'|'qhd'|'square';
export const PICTURE_PRESETS:Readonly<Record<PicturePreset,{width:number;height:number}>>={hd:{width:1920,height:1080},qhd:{width:2560,height:1440},square:{width:2048,height:2048}};
/** Low tier never makes a long side above this (owner brief, D89). */
export const LOW_PICTURE_EDGE=1920;
/** Below this long side the picture is no better than Screen; fail instead of making a tiny "HD" picture. */
export const MIN_PICTURE_EDGE=640;
/** The verified Android PNG save accepts at most this (editor/png.ts and ProjectPngSource.java). */
export const NATIVE_SAVE_LIMIT={edge:2048,pixels:4_000_000} as const;
const HEADROOM=8*1024*1024;
/** Output canvas + encoder copy + decoded check bitmap (4 bytes each), plus headroom for one tile copy and the file. */
export function pictureBytes(width:number,height:number):number{return width*height*12+HEADROOM;}
export type PictureLimit='tier'|'device'|'save'|'memory';
export interface PicturePlan {width:number;height:number;capped:boolean;limit:PictureLimit|null}
const gcd=(a:number,b:number):number=>b?gcd(b,a%b):a;
/** Largest picture of the preset's exact aspect that fits every limit the device reports; never upscales. */
export function planPictureSize(preset:PicturePreset,limits:{gpu:GpuCapabilities;tier:QualityTier;nativeSave:boolean}):PicturePlan{
 const base=PICTURE_PRESETS[preset];if(!base)throw new Error('picture-budget');const {gpu,tier,nativeSave}=limits,long=Math.max(base.width,base.height),area=base.width*base.height;
 if(![gpu.maxTextureSize,gpu.maxRenderbufferSize].every(v=>Number.isFinite(v)&&v>0))throw new Error('picture-budget');
 const scales:[PictureLimit,number][]=[['device',Math.min(gpu.maxTextureSize,gpu.maxRenderbufferSize)/long],['memory',Math.sqrt(Math.max(0,profiles[tier].captureBytes-HEADROOM)/(12*area))]];
 if(tier==='low')scales.push(['tier',LOW_PICTURE_EDGE/long]);
 if(nativeSave)scales.push(['save',Math.min(NATIVE_SAVE_LIMIT.edge/long,Math.sqrt(NATIVE_SAVE_LIMIT.pixels/area))]);
 let scale=1,limit:PictureLimit|null=null;for(const [name,value] of scales)if(value<scale){scale=value;limit=name;}
 // Whole aspect units keep the requested shape exact (16:9 stays 16:9, square stays square).
 const g=gcd(base.width,base.height),unitW=base.width/g,unitH=base.height/g,units=Math.floor(base.width*scale/unitW+1e-9),width=units*unitW,height=units*unitH;
 if(Math.max(width,height)<MIN_PICTURE_EDGE)throw new Error('picture-budget');
 return {width,height,capped:limit!==null,limit};
}
/** Supersampling factor for one capture: every output pixel averages scale² rendered samples (bounded work). */
export function pictureScale(width:number,height:number,tier:QualityTier):number{
 const wanted=tier==='low'?1.5:2;return Math.max(1,Math.min(wanted,Math.sqrt(17_000_000/(width*height))));
}
/** Sharper sun shadows for the picture only; tiers without shadows stay without (no shader recompiles). */
export function pictureShadowSize(tier:QualityTier,gpu:GpuCapabilities):number{
 const live=profiles[tier].shadowSize;if(!profiles[tier].shadows||!live)return 0;return Math.max(live,Math.min(gpu.maxTextureSize,tier==='high'?4096:2048));
}

export interface LensPose {position:readonly [number,number,number];target:readonly [number,number,number];fov:number;aspect:number}
/** How far the visible scene reaches from the view axis, as tangents in camera space; null when it surrounds the camera. */
export interface ContentExtent {tanX:number;tanY:number}
export function contentExtent(points:readonly (readonly [number,number,number])[],near:number):ContentExtent|null{
 if(!points.length)return null;let tanX=0,tanY=0;
 for(const [x,y,z] of points){const depth=-z;if(!(depth>near)||![x,y].every(Number.isFinite))return null;tanX=Math.max(tanX,Math.abs(x)/depth);tanY=Math.max(tanY,Math.abs(y)/depth);}
 return {tanX,tanY};
}
export const CONTENT_MARGIN=1.04,MAX_PICTURE_FOV=120;
/**
 * Camera for a picture of another shape: same position, target and direction; only the lens (aspect, vertical field of view)
 * changes, so nothing is stretched. The frame never shows less than the part of the screen that fits the new shape ("cover")
 * and never more than the whole screen ("contain"); between those it is as tight as the visible house allows.
 */
export function captureLens(live:LensPose,width:number,height:number,content:ContentExtent|null):LensPose&{fit:'same'|'content'|'cover'|'contain'}{
 if(![width,height,live.fov,live.aspect].every(v=>Number.isFinite(v)&&v>0)||live.fov>=180)throw new Error('picture-lens');
 const aspect=width/height,position=[...live.position] as [number,number,number],target=[...live.target] as [number,number,number];
 if(aspect===live.aspect)return {position,target,fov:live.fov,aspect,fit:'same'};
 const tan=Math.tan(live.fov*Math.PI/360),ratio=live.aspect/aspect,cover=tan*Math.min(1,ratio),contain=Math.min(tan*Math.max(1,ratio),Math.tan(MAX_PICTURE_FOV*Math.PI/360));
 let chosen=contain,fit:'content'|'cover'|'contain'='contain';
 if(content){const need=Math.max(content.tanY,content.tanX/aspect)*CONTENT_MARGIN;if(need<=cover){chosen=cover;fit='cover';}else if(need<contain){chosen=need;fit='content';}}
 return {position,target,fov:Math.atan(Math.max(cover,chosen))*360/Math.PI,aspect,fit};
}

/** One tile: output rectangle (ox,oy,w,h), the camera view offset in supersampled pixels, and the source rectangle in the drawing buffer. */
export interface PictureTile {ox:number;oy:number;w:number;h:number;vx:number;vy:number;sx:number;sy:number;sw:number;sh:number}
export const TILE_MARGIN=4;
export function planTiles(width:number,height:number,scale:number,bufferWidth:number,bufferHeight:number,margin=TILE_MARGIN):PictureTile[]{
 if(![width,height,bufferWidth,bufferHeight].every(Number.isSafeInteger)||!(scale>=1)||width<1||height<1)throw new Error('capture-size');
 const tw=Math.floor((bufferWidth-2*margin)/scale),th=Math.floor((bufferHeight-2*margin)/scale);if(tw<16||th<16)throw new Error('capture-size');
 const tiles:PictureTile[]=[];
 for(let oy=0;oy<height;oy+=th)for(let ox=0;ox<width;ox+=tw){const w=Math.min(tw,width-ox),h=Math.min(th,height-oy);tiles.push({ox,oy,w,h,vx:ox*scale-margin,vy:oy*scale-margin,sx:margin,sy:margin,sw:w*scale,sh:h*scale});}
 return tiles;
}

export interface PictureRun {
 renderer:THREE.WebGLRenderer;scene:THREE.Scene;camera:THREE.PerspectiveCamera;width:number;height:number;scale:number;signal:AbortSignal;
 /** Throws when the scene, model or view changed since the picture started. */
 check():void;
 /** Before each slice of tiles (hide selection, etc.). */
 begin():void;
 copy(tile:PictureTile,source:HTMLCanvasElement):void;
 /** After each slice, also on failure: restore what begin() changed and redraw the live view in the same task. */
 end():void;
 onProgress(done:number,total:number):void;
 sliceMs?:number;yieldToUi?:()=>Promise<void>;now?:()=>number;
}
/** Renders all tiles in short slices so the page stays responsive; the live drawing buffer size and state are never changed. */
export async function renderPictureTiles(run:PictureRun):Promise<number>{
 const {renderer,scene,camera,width,height,scale,signal}=run,gl=renderer.getContext(),canvas=renderer.domElement,now=run.now??(()=>performance.now()),pause=run.yieldToUi??(()=>new Promise<void>(r=>setTimeout(r,0)));
 if(gl.isContextLost())throw new Error('capture-context');
 const bufferWidth=canvas.width,bufferHeight=canvas.height;if(gl.drawingBufferWidth!==bufferWidth||gl.drawingBufferHeight!==bufferHeight)throw new Error('capture-size');
 if(renderer.getRenderTarget()!==null)throw new Error('capture-unavailable');
 const tiles=planTiles(width,height,scale,bufferWidth,bufferHeight),fullWidth=width*scale,fullHeight=height*scale;let done=0;
 try{
  while(done<tiles.length){
   if(signal.aborted)throw new Error('capture-cancelled');run.check();
   if(canvas.width!==bufferWidth||canvas.height!==bufferHeight||gl.drawingBufferWidth!==bufferWidth||gl.drawingBufferHeight!==bufferHeight)throw new Error('capture-changed');
   const started=now();run.begin();
   try{
    do{const tile=tiles[done]!;camera.setViewOffset(fullWidth,fullHeight,tile.vx,tile.vy,bufferWidth,bufferHeight);renderer.render(scene,camera);if(gl.isContextLost())throw new Error('capture-context');run.copy(tile,canvas);done++;}
    while(done<tiles.length&&now()-started<(run.sliceMs??40));
   }finally{run.end();}
   run.onProgress(done,tiles.length);if(done<tiles.length)await pause();
  }
 }finally{camera.clearViewOffset();}
 return tiles.length;
}
