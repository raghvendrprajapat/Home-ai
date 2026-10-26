import type {Point,Quad} from './homography';

/**
 * D85 Room photo: the chosen area as one alpha byte per working-size pixel (0 = untouched, 255 = fully replaced).
 * Brush and Eraser strokes have a one-pixel soft edge; the four-corner quad is filled hard and also becomes the
 * perspective plane. Undo/Redo replays recorded operations from a baked base, so memory stays at two masks plus at
 * most MAX_MASK_OPS small operation records. Visualizer-only state: never part of the project.
 */
export interface DirtyRect {readonly x0:number;readonly y0:number;readonly x1:number;readonly y1:number}
/** D86 'union' adds a selection from "Tap to select (AI)": its bounding box and one byte per box pixel (max-combined). */
export type MaskOp=Readonly<{kind:'brush'|'erase';radius:number;points:readonly Point[]}>|Readonly<{kind:'quad';quad:Quad}>|Readonly<{kind:'clear'}>|Readonly<{kind:'union';box:DirtyRect;data:Uint8Array}>;
export const MAX_MASK_OPS=40,MIN_BRUSH_RADIUS=1,MAX_BRUSH_RADIUS=400;

const clampInt=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,Math.floor(v)));
/** Paints (brush) or clears (erase) a round-capped line of the given radius; returns the pixels it may have changed. */
export function strokeSegment(mask:Uint8Array,width:number,height:number,kind:'brush'|'erase',radius:number,a:Point,b:Point):DirtyRect|undefined{
 const r=Math.max(MIN_BRUSH_RADIUS,Math.min(MAX_BRUSH_RADIUS,radius)),pad=r+1;
 const x0=clampInt(Math.min(a[0],b[0])-pad,0,width),x1=clampInt(Math.max(a[0],b[0])+pad+1,0,width),y0=clampInt(Math.min(a[1],b[1])-pad,0,height),y1=clampInt(Math.max(a[1],b[1])+pad+1,0,height);
 if(x0>=x1||y0>=y1)return undefined;
 const dx=b[0]-a[0],dy=b[1]-a[1],len2=dx*dx+dy*dy;
 for(let y=y0;y<y1;y++){
  const py=y+.5;
  for(let x=x0;x<x1;x++){
   const px=x+.5,t=len2>0?Math.max(0,Math.min(1,((px-a[0])*dx+(py-a[1])*dy)/len2)):0,ex=px-(a[0]+t*dx),ey=py-(a[1]+t*dy);
   // Coverage: 1 inside r − ½, 0 beyond r + ½, linear between (a one-pixel anti-aliased edge).
   const cover=Math.max(0,Math.min(1,r+.5-Math.sqrt(ex*ex+ey*ey)));if(cover<=0)continue;
   const i=y*width+x,v=Math.round(cover*255);
   mask[i]=kind==='brush'?Math.max(mask[i]!,v):Math.min(mask[i]!,255-v);
  }
 }
 return {x0,y0,x1,y1};
}
/** True when the pixel centre (x + ½, y + ½) lies inside the quad (even-odd rule; edges on the boundary count in). */
export function insideQuad(q:Quad,px:number,py:number):boolean{
 let inside=false;
 for(let i=0,j=3;i<4;j=i++){const [xi,yi]=q[i]!,[xj,yj]=q[j]!;if(yi>py!==yj>py&&px<(xj-xi)*(py-yi)/(yj-yi)+xi)inside=!inside;}
 return inside;
}
export function fillQuad(mask:Uint8Array,width:number,height:number,q:Quad):DirtyRect|undefined{
 const xs=q.map(p=>p[0]),ys=q.map(p=>p[1]),x0=clampInt(Math.min(...xs),0,width),x1=clampInt(Math.max(...xs)+1,0,width),y0=clampInt(Math.min(...ys),0,height),y1=clampInt(Math.max(...ys)+1,0,height);
 if(x0>=x1||y0>=y1)return undefined;
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(insideQuad(q,x+.5,y+.5))mask[y*width+x]=255;
 return {x0,y0,x1,y1};
}
/** Draws one recorded operation onto the mask. */
export function rasterize(mask:Uint8Array,width:number,height:number,op:MaskOp):DirtyRect|undefined{
 if(op.kind==='clear'){mask.fill(0);return {x0:0,y0:0,x1:width,y1:height};}
 if(op.kind==='union'){
  const {x0,y0,x1,y1}=op.box,w=x1-x0;
  if(x0<0||y0<0||x1>width||y1>height||w<1||y1<=y0||op.data.length!==w*(y1-y0))return undefined;
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const v=op.data[(y-y0)*w+x-x0]!,i=y*width+x;if(v>mask[i]!)mask[i]=v;}
  return op.box;
 }
 if(op.kind==='quad')return fillQuad(mask,width,height,op.quad);
 const pts=op.points;if(!pts.length)return undefined;
 let dirty:DirtyRect|undefined;
 for(let i=0;i<Math.max(1,pts.length-1);i++){const d=strokeSegment(mask,width,height,op.kind,op.radius,pts[i]!,pts[Math.min(i+1,pts.length-1)]!);if(d)dirty=dirty?{x0:Math.min(dirty.x0,d.x0),y0:Math.min(dirty.y0,d.y0),x1:Math.max(dirty.x1,d.x1),y1:Math.max(dirty.y1,d.y1)}:d;}
 return dirty;
}
/** The smallest rectangle holding every non-zero mask pixel, or undefined for an empty mask. */
export function maskBounds(mask:Uint8Array,width:number,height:number):DirtyRect|undefined{
 let x0=width,y0=height,x1=-1,y1=-1;
 for(let y=0;y<height;y++){const row=y*width;for(let x=0;x<width;x++)if(mask[row+x]){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;y1=y;}}
 return x1<0?undefined:{x0,y0,x1:x1+1,y1:y1+1};
}

/** The mask with Undo/Redo. `mask` is the live array the view draws; replace it only through these methods. */
export class MaskHistory {
 readonly mask:Uint8Array;
 private readonly base:Uint8Array;private basePlane:Quad|null=null;
 private ops:MaskOp[]=[];private cursor=0;
 constructor(readonly width:number,readonly height:number,private readonly maxOps=MAX_MASK_OPS){
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1)throw new Error('mask-size');
  this.mask=new Uint8Array(width*height);this.base=new Uint8Array(width*height);
 }
 get canUndo():boolean{return this.cursor>0;}
 get canRedo():boolean{return this.cursor<this.ops.length;}
 get size():number{return this.cursor;}
 /** The perspective plane: the newest four-corner quad since the last Clear, if any. */
 plane():Quad|null{
  for(let i=this.cursor-1;i>=0;i--){const op=this.ops[i]!;if(op.kind==='quad')return op.quad;if(op.kind==='clear')return null;}
  return this.basePlane;
 }
 /**
  * Records an operation and draws it, dropping any redo steps. `drawn` says the view already drew it segment by
  * segment while the finger moved (drawing again is harmless: brush takes the maximum, eraser the minimum).
  */
 apply(op:MaskOp,drawn=false):DirtyRect|undefined{
  this.ops.length=this.cursor;this.ops.push(op);this.cursor++;
  const dirty=drawn?undefined:rasterize(this.mask,this.width,this.height,op);
  // Bounded memory: the oldest step is baked into the base and can no longer be undone.
  while(this.ops.length>this.maxOps){const old=this.ops.shift()!;this.cursor--;rasterize(this.base,this.width,this.height,old);if(old.kind==='quad')this.basePlane=old.quad;if(old.kind==='clear')this.basePlane=null;}
  return dirty;
 }
 undo():boolean{if(!this.canUndo)return false;this.cursor--;this.replay();return true;}
 redo():boolean{if(!this.canRedo)return false;rasterize(this.mask,this.width,this.height,this.ops[this.cursor]!);this.cursor++;return true;}
 isEmpty():boolean{return !this.mask.some(v=>v>0);}
 private replay(){this.mask.set(this.base);for(let i=0;i<this.cursor;i++)rasterize(this.mask,this.width,this.height,this.ops[i]!);}
}
