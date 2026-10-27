/**
 * D87 Room photo: pinch-zoom and pan of the shown photo. Pure maths, no DOM. The shown frame keeps its fitted size
 * (`frameW` × `frameH` CSS px); the photo inside it is scaled by `scale` (1 = fit … MAX_ZOOM) and shifted by `x`, `y`,
 * which are fractions of the frame size (so a resize or a phone rotation keeps the same part of the photo in view).
 * A photo point at fraction c (0…1 of the photo) shows at frame px (x + c·scale)·frameW. The view is always clamped so
 * the photo covers the whole frame: x ∈ [1 − scale, 0].
 */
export interface ZoomView {readonly scale:number;readonly x:number;readonly y:number}
export const FIT_VIEW:ZoomView=Object.freeze({scale:1,x:0,y:0});
export const MAX_ZOOM=6,ZOOM_STEP=1.5;

const clamp=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v));
/** The nearest allowed view: scale in 1 … MAX_ZOOM, and the photo covering the frame. */
export function clampView(view:ZoomView):ZoomView{
 const scale=Number.isFinite(view.scale)?clamp(view.scale,1,MAX_ZOOM):1;
 const x=Number.isFinite(view.x)?clamp(view.x,1-scale,0):0,y=Number.isFinite(view.y)?clamp(view.y,1-scale,0):0;
 return {scale,x,y};
}
export const isZoomed=(view:ZoomView)=>view.scale>1+1e-9;
/** Zooms by `factor` about the frame point (sx, sy) in CSS px: the photo point under it stays under it (unless clamped). */
export function zoomAt(view:ZoomView,factor:number,sx:number,sy:number,frameW:number,frameH:number):ZoomView{
 const fx=sx/Math.max(1e-9,frameW),fy=sy/Math.max(1e-9,frameH),cx=(fx-view.x)/view.scale,cy=(fy-view.y)/view.scale;
 const scale=clamp(view.scale*(Number.isFinite(factor)&&factor>0?factor:1),1,MAX_ZOOM);
 return clampView({scale,x:fx-cx*scale,y:fy-cy*scale});
}
/** Moves the photo by (dx, dy) CSS px. */
export function panBy(view:ZoomView,dx:number,dy:number,frameW:number,frameH:number):ZoomView{
 return clampView({scale:view.scale,x:view.x+dx/Math.max(1e-9,frameW),y:view.y+dy/Math.max(1e-9,frameH)});
}
export type Pt=readonly [number,number];
/**
 * Two fingers: from the view when the pinch started and the two finger positions then (a0, b0) and now (a1, b1), all
 * in frame px. The scale follows the finger distance and the photo point under the start midpoint follows the
 * midpoint, so a two-finger drag also pans. Computed from the start each time, so it never drifts.
 */
export function pinchView(start:ZoomView,a0:Pt,b0:Pt,a1:Pt,b1:Pt,frameW:number,frameH:number):ZoomView{
 const d0=Math.hypot(b0[0]-a0[0],b0[1]-a0[1]),d1=Math.hypot(b1[0]-a1[0],b1[1]-a1[1]);
 const scale=clamp(start.scale*(d0>1?d1/d0:1),1,MAX_ZOOM),W=Math.max(1e-9,frameW),H=Math.max(1e-9,frameH);
 const m0x=(a0[0]+b0[0])/2/W,m0y=(a0[1]+b0[1])/2/H,m1x=(a1[0]+b1[0])/2/W,m1y=(a1[1]+b1[1])/2/H;
 const cx=(m0x-start.x)/start.scale,cy=(m0y-start.y)/start.scale;
 return clampView({scale,x:m1x-cx*scale,y:m1y-cy*scale});
}
/** A wheel step as a zoom factor (lines are counted as 16 px; pages as 400 px). Up/away zooms in. */
export function wheelFactor(deltaY:number,deltaMode=0):number{
 const px=deltaY*(deltaMode===1?16:deltaMode===2?400:1);
 return Math.exp(-clamp(px,-400,400)*.0015);
}
/** A frame point (CSS px from the frame's top-left) → working-size photo pixel (floats, kept inside the photo). */
export function screenToPixel(sx:number,sy:number,view:ZoomView,frameW:number,frameH:number,width:number,height:number):[number,number]{
 const cx=(sx/Math.max(1e-9,frameW)-view.x)/view.scale,cy=(sy/Math.max(1e-9,frameH)-view.y)/view.scale;
 return [clamp(cx*width,0,width),clamp(cy*height,0,height)];
}
/** A working-size photo pixel → frame point in CSS px (may lie outside the frame when that part is zoomed out of view). */
export function pixelToScreen(px:number,py:number,view:ZoomView,frameW:number,frameH:number,width:number,height:number):[number,number]{
 return [(view.x+px/width*view.scale)*frameW,(view.y+py/height*view.scale)*frameH];
}
/** Brush radius in photo pixels for a brush size in screen px, so the brush keeps the same size on screen at any zoom. */
export function brushRadius(screenPx:number,view:ZoomView,frameW:number,width:number):number{
 return Math.max(1,screenPx*width/Math.max(1,frameW*view.scale));
}
/** The CSS transform of the photo layer (origin top-left) for a view and frame size. */
export function viewTransform(view:ZoomView,frameW:number,frameH:number):string{
 return `translate(${view.x*frameW}px, ${view.y*frameH}px) scale(${view.scale})`;
}

/**
 * Which gesture a pointer starts. Two or more pointers are always a pinch (never a stroke); with "Move photo" on, a
 * held Space or the middle mouse button, one pointer pans; otherwise it draws (brush/eraser) or taps (corners, AI).
 */
export type Gesture='draw'|'tap'|'pan'|'pinch';
export function gestureFor(pointers:number,{moveMode,pan,tool}:{moveMode:boolean;pan:boolean;tool:'brush'|'erase'|'corners'|'ai-tap'|'none'}):Gesture{
 if(pointers>=2)return 'pinch';
 if(moveMode||pan)return 'pan';
 return tool==='brush'||tool==='erase'?'draw':'tap';
}
/** A tap is a press that moved at most this many CSS px; more is a drag, which never places a corner. */
export const TAP_SLOP=10;

/**
 * Tracks the pointers on the photo and turns them into view changes. `down` answers whether this pointer belongs to a
 * zoom gesture (then the drawing layer must ignore it and cancel any stroke in progress). Once two fingers have
 * touched, every pointer is part of the gesture until all have lifted, so a finger left behind after a pinch pans
 * instead of drawing.
 */
export class ZoomGestures {
 private readonly points=new Map<number,Pt>();
 private mode:'none'|'pan'|'pinch'='none';
 private start:{view:ZoomView;a:Pt;b:Pt;ids:[number,number]}|{view:ZoomView;p:Pt;id:number}|null=null;
 get active():boolean{return this.mode!=='none';}
 get count():number{return this.points.size;}
 /** Returns true when the pointer is part of a pan or pinch (not a stroke or tap). */
 down(id:number,p:Pt,view:ZoomView,pan:boolean):boolean{
  this.points.set(id,p);
  if(this.points.size>=2){this.beginPinch(view);return true;}
  if(this.mode!=='none'||pan){this.mode='pan';this.start={view,p,id};return true;}
  return false;
 }
 /** The new view when this pointer moves as part of a gesture, or undefined when it is not part of one. */
 move(id:number,p:Pt,frameW:number,frameH:number):ZoomView|undefined{
  if(!this.points.has(id))return undefined;
  this.points.set(id,p);const s=this.start;if(this.mode==='none'||!s)return undefined;
  if('ids' in s){const a=this.points.get(s.ids[0]),b=this.points.get(s.ids[1]);return a&&b?pinchView(s.view,s.a,s.b,a,b,frameW,frameH):undefined;}
  return s.id===id?panBy(s.view,p[0]-s.p[0],p[1]-s.p[1],frameW,frameH):undefined;
 }
 /** Returns true when the lifted pointer was part of a gesture. `view` is the current view (for a remaining finger). */
 up(id:number,view:ZoomView):boolean{
  if(!this.points.delete(id))return false;
  const was=this.mode!=='none';
  if(!this.points.size){this.mode='none';this.start=null;}
  else if(was){
   if(this.points.size>=2)this.beginPinch(view);
   else{const [rest,p]=[...this.points][0]!;this.mode='pan';this.start={view,p,id:rest};}
  }
  return was;
 }
 reset():void{this.points.clear();this.mode='none';this.start=null;}
 private beginPinch(view:ZoomView){
  const [[ia,a],[ib,b]]=[...this.points] as [[number,Pt],[number,Pt]];
  this.mode='pinch';this.start={view,a,b,ids:[ia,ib]};
 }
}
