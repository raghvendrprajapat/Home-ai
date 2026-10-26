import {invert,quadPlaneSize,squareToQuad} from './homography';
import type {Homography,Quad} from './homography';
import {maskBounds} from './mask';
import type {DirtyRect} from './mask';
import type {Pixels} from './photo-prep';

/**
 * D85 Room photo, the offline 'stand-in' engine: deterministic, on the device, no AI. Inside the chosen area the new
 * colour is multiplied by the photo's own light (pixel luminance ÷ the area's median luminance, clamped), so shadows
 * and lamp light stay where they were; the mask alpha blends the edges. Pixels with mask 0 are copied byte for byte.
 * Paint keeps each pixel's own light (wall texture shows through, as with real paint); patterns and pictures use the
 * light smoothed over about 1 % of the photo, so the old floor's grain or the old wallpaper does not print through.
 */
export type Rgb=readonly [number,number,number];
export type SurfaceMaterial=
 |Readonly<{kind:'paint';rgb:Rgb}>
 /** One repeat is `sizePx` wide (photo pixels flat, or plane pixels on a four-corner plane); `grout` draws tile joints. */
 |Readonly<{kind:'pattern';texture:Pixels;sizePx:number;rotate:0|90;grout:Rgb|null}>
 /** Placed once into the four-corner quad, perspective-correct. */
 |Readonly<{kind:'picture';image:Pixels}>;
export interface SurfaceEditRequest {readonly photo:Pixels;readonly mask:Uint8Array;readonly plane:Quad|null;readonly material:SurfaceMaterial}
export const SHADE_MIN=.2,SHADE_MAX=1.8,MIN_PATTERN_PX=8,MAX_PATTERN_PX=2048;
/** Grout joint width as a share of one repeat (at least one pixel). */
export const GROUT_SHARE=.03;
/** Smoothing radius for pattern and picture light: 1 % of the photo's short side, at least 2 px. */
export const shadeBlurRadius=(width:number,height:number)=>Math.max(2,Math.round(Math.min(width,height)*.01));

/** Integer Rec. 709 luma weights summing to 256, so a grey (g, g, g) has luminance exactly g. */
export const luminance=(r:number,g:number,b:number)=>(54*r+183*g+19*b)>>8;
/**
 * The reference light of the area: the median luminance of pixels at least half chosen (all chosen pixels when none
 * are), the lower median for an even count. 0 when the mask is empty.
 */
export function referenceLuminance(photo:Pixels,mask:Uint8Array,box:DirtyRect|undefined=maskBounds(mask,photo.width,photo.height)):number{
 if(!box)return 0;
 const strong=new Uint32Array(256),weak=new Uint32Array(256),d=photo.data,w=photo.width;let ns=0,nw=0;
 for(let y=box.y0;y<box.y1;y++)for(let x=box.x0;x<box.x1;x++){const i=y*w+x,m=mask[i]!;if(!m)continue;const L=luminance(d[i*4]!,d[i*4+1]!,d[i*4+2]!);if(m>=128){strong[L]!++;ns++;}else{weak[L]!++;nw++;}}
 const hist=ns?strong:weak,n=ns||nw;if(!n)return 0;
 const half=Math.ceil(n/2);let seen=0;for(let L=0;L<256;L++){seen+=hist[L]!;if(seen>=half)return L;}
 return 255;
}
/**
 * Luminance averaged over a (2r + 1)² square of chosen pixels only (unchosen pixels, such as a sofa beside the floor,
 * do not darken the edge), for the pixels of `box`, row by row inside the box. Two running-sum passes: O(pixels).
 */
export function smoothLuminance(photo:Pixels,mask:Uint8Array,box:DirtyRect,radius:number):Uint8Array{
 const bw=box.x1-box.x0,bh=box.y1-box.y0,w=photo.width,d=photo.data,sums=new Float32Array(bw*bh),counts=new Uint16Array(bw*bh),out=new Uint8Array(bw*bh);
 const r=Math.max(0,Math.min(radius,1000)),line=new Int16Array(bw);
 for(let y=0;y<bh;y++){
  let s=0,n=0;const row=(box.y0+y)*w+box.x0;
  for(let x=0;x<bw;x++){const i=row+x;line[x]=mask[i]?luminance(d[i*4]!,d[i*4+1]!,d[i*4+2]!):-1;}
  for(let x=0;x<Math.min(r,bw);x++){const L=line[x]!;if(L>=0){s+=L;n++;}}
  for(let x=0;x<bw;x++){
   if(x+r<bw){const L=line[x+r]!;if(L>=0){s+=L;n++;}}
   if(x-r-1>=0){const L=line[x-r-1]!;if(L>=0){s-=L;n--;}}
   sums[y*bw+x]=s;counts[y*bw+x]=n;
  }
 }
 for(let x=0;x<bw;x++){
  let s=0,n=0;
  for(let y=0;y<Math.min(r,bh);y++){s+=sums[y*bw+x]!;n+=counts[y*bw+x]!;}
  for(let y=0;y<bh;y++){
   if(y+r<bh){s+=sums[(y+r)*bw+x]!;n+=counts[(y+r)*bw+x]!;}
   if(y-r-1>=0){s-=sums[(y-r-1)*bw+x]!;n-=counts[(y-r-1)*bw+x]!;}
   const i=(box.y0+y)*w+box.x0+x;out[y*bw+x]=n>0?Math.round(s/n):luminance(d[i*4]!,d[i*4+1]!,d[i*4+2]!);
  }
 }
 return out;
}
export const shadeFactor=(L:number,reference:number)=>reference>0?Math.max(SHADE_MIN,Math.min(SHADE_MAX,L/reference)):1;

/** Bilinear sample with wrap-around (patterns) or edge clamp (pictures), into out[0..2]. */
function sample(img:Pixels,fx:number,fy:number,wrap:boolean,out:Float64Array){
 const w=img.width,h=img.height,d=img.data;
 let x=fx-.5,y=fy-.5;
 if(wrap){x-=w*Math.floor(x/w);y-=h*Math.floor(y/h);}else{x=Math.max(0,Math.min(w-1,x));y=Math.max(0,Math.min(h-1,y));}
 const x0=Math.min(w-1,Math.floor(x)),y0=Math.min(h-1,Math.floor(y)),tx=x-x0,ty=y-y0;
 const x1=x0+1<w?x0+1:wrap?0:x0,y1=y0+1<h?y0+1:wrap?0:y0;
 const i00=(y0*w+x0)*4,i10=(y0*w+x1)*4,i01=(y1*w+x0)*4,i11=(y1*w+x1)*4,sx=1-tx,sy=1-ty;
 out[0]=(d[i00]!*sx+d[i10]!*tx)*sy+(d[i01]!*sx+d[i11]!*tx)*ty;
 out[1]=(d[i00+1]!*sx+d[i10+1]!*tx)*sy+(d[i01+1]!*sx+d[i11+1]!*tx)*ty;
 out[2]=(d[i00+2]!*sx+d[i10+2]!*tx)*sy+(d[i01+2]!*sx+d[i11+2]!*tx)*ty;
}

export interface SurfaceJob {
 readonly box:DirtyRect|undefined;readonly reference:number;
 /** Writes rows [y0, y1) of the box into out (a copy of the photo); returns how many pixels changed colour. */
 renderRows(out:Uint8ClampedArray,y0:number,y1:number):number;
}
/** Checks the request and prepares everything that does not depend on the pixel (bounds, light, plane). */
export function prepareSurface(request:SurfaceEditRequest):SurfaceJob{
 const {photo,mask,plane,material}=request,w=photo.width,h=photo.height;
 if(!Number.isSafeInteger(w)||!Number.isSafeInteger(h)||w<1||h<1||photo.data.length!==w*h*4||mask.length!==w*h)throw new Error('surface-size');
 if(material.kind==='picture'&&!plane)throw new Error('surface-needs-corners');
 if(material.kind==='pattern'&&!(material.sizePx>=MIN_PATTERN_PX&&material.sizePx<=MAX_PATTERN_PX))throw new Error('surface-pattern-size');
 const box=maskBounds(mask,w,h),reference=referenceLuminance(photo,mask,box);
 const smooth=box&&material.kind!=='paint'?smoothLuminance(photo,mask,box,shadeBlurRadius(w,h)):undefined,bw=box?box.x1-box.x0:0;
 let inverse:Homography|undefined,planeW=1,planeH=1;
 if(plane){inverse=invert(squareToQuad(plane));const size=quadPlaneSize(plane);planeW=size.width;planeH=size.height;}
 const colour=new Float64Array(3),src=photo.data;
 // Everything per-material is unpacked once here: the row loop below runs for every chosen pixel.
 const [ha,hb,hc,hd,he,hf,hg,hh,hi]=inverse??[1,0,0,0,1,0,0,0,1];
 const tex=material.kind==='pattern'?material.texture:material.kind==='picture'?material.image:undefined;
 const P=material.kind==='pattern'?material.sizePx:1,Q=tex&&material.kind==='pattern'?P*tex.height/tex.width:1,turned=material.kind==='pattern'&&material.rotate===90;
 const groutRgb=material.kind==='pattern'?material.grout:null,groutPx=Math.max(1,P*GROUT_SHARE);
 /** Material colour at plane/photo position (s, t) into `colour`; false where the material does not reach. */
 const materialAt=(s:number,t:number,u:number,v:number):boolean=>{
  if(material.kind==='paint'){colour[0]=material.rgb[0];colour[1]=material.rgb[1];colour[2]=material.rgb[2];return true;}
  if(material.kind==='picture'){if(u<0||u>1||v<0||v>1)return false;sample(tex!,u*tex!.width,v*tex!.height,false,colour);return true;}
  // A quarter turn: the pattern's rows run down the picture instead of across.
  if(turned){const old=s;s=t;t=-old;}
  const fs=s-P*Math.floor(s/P),ft=t-Q*Math.floor(t/Q);
  if(groutRgb&&(fs<groutPx||ft<groutPx)){colour[0]=groutRgb[0];colour[1]=groutRgb[1];colour[2]=groutRgb[2];return true;}
  sample(tex!,fs/P*tex!.width,ft/Q*tex!.height,true,colour);return true;
 };
 return {box,reference,renderRows(out,y0,y1){
  if(!box)return 0;let changed=0;
  for(let y=Math.max(y0,box.y0);y<Math.min(y1,box.y1);y++){
   // The inverse homography is linear in x before the divide, so each step along a row only adds (a, d, g).
   const t0=y+.5,s0=box.x0+.5;let nx=ha*s0+hb*t0+hc,ny=hd*s0+he*t0+hf,nq=hg*s0+hh*t0+hi;
   for(let x=box.x0;x<box.x1;x++,nx+=ha,ny+=hd,nq+=hg){
    const i=y*w+x,m=mask[i]!;if(!m)continue;
    let s=x+.5,t=t0,u=0,v=0;
    if(inverse){if(nq<=1e-15)continue;u=nx/nq;v=ny/nq;s=u*planeW;t=v*planeH;}
    if(!materialAt(s,t,u,v))continue;
    const p=i*4,r=src[p]!,g=src[p+1]!,b=src[p+2]!,k=shadeFactor(smooth?smooth[(y-box.y0)*bw+x-box.x0]!:luminance(r,g,b),reference),a=m/255;
    const nr=Math.min(255,Math.round(colour[0]!*k)),ng=Math.min(255,Math.round(colour[1]!*k)),nb=Math.min(255,Math.round(colour[2]!*k));
    const or=m===255?nr:Math.round(r+(nr-r)*a),og=m===255?ng:Math.round(g+(ng-g)*a),ob=m===255?nb:Math.round(b+(nb-b)*a);
    if(or!==r||og!==g||ob!==b)changed++;
    out[p]=or;out[p+1]=og;out[p+2]=ob;
   }
  }
  return changed;
 }};
}
/** Synchronous whole render (tests and small photos); the stand-in provider renders the same rows in slices. */
export function renderSurface(request:SurfaceEditRequest):Pixels{
 const out=new Uint8ClampedArray(request.photo.data);prepareSurface(request).renderRows(out,0,request.photo.height);
 return {width:request.photo.width,height:request.photo.height,data:out};
}
