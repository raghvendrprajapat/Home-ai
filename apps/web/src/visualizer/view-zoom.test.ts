import {describe,expect,it} from 'vitest';
import fc from 'fast-check';
import {brushRadius,clampView,FIT_VIEW,gestureFor,MAX_ZOOM,panBy,pinchView,pixelToScreen,screenToPixel,viewTransform,wheelFactor,ZoomGestures,zoomAt} from './view-zoom';
import type {ZoomView} from './view-zoom';

// D87 Claude-authored builder tests; expected values are worked out by hand from the definitions, not from the code.
// Frame 400×300 CSS px showing a 1200×900 working photo (3 photo px per CSS px at fit).
const W=400,H=300,PW=1200,PH=900;
describe('D87 zoom maths',()=>{
 it('at fit, a frame point maps to the photo exactly as before zooming existed',()=>{
  expect(screenToPixel(200,150,FIT_VIEW,W,H,PW,PH)).toEqual([600,450]);
  expect(screenToPixel(0,0,FIT_VIEW,W,H,PW,PH)).toEqual([0,0]);
  expect(screenToPixel(400,300,FIT_VIEW,W,H,PW,PH)).toEqual([1200,900]);
  // Outside the frame is kept inside the photo.
  expect(screenToPixel(-20,600,FIT_VIEW,W,H,PW,PH)).toEqual([0,900]);
 });
 it('zooming 2× about the centre keeps the centre pixel and halves the distance per CSS px',()=>{
  const v=zoomAt(FIT_VIEW,2,200,150,W,H);
  // Centre fraction .5 stays at .5: x = .5 − .5·2 = −.5.
  expect(v).toEqual({scale:2,x:-.5,y:-.5});
  expect(screenToPixel(200,150,v,W,H,PW,PH)).toEqual([600,450]);
  // 100 CSS px right of the centre: 100·3/2 = 150 photo px.
  expect(screenToPixel(300,150,v,W,H,PW,PH)).toEqual([750,450]);
  // The frame's top-left corner now shows photo pixel (300, 225).
  expect(screenToPixel(0,0,v,W,H,PW,PH)).toEqual([300,225]);
  expect(viewTransform(v,W,H)).toBe('translate(-200px, -150px) scale(2)');
 });
 it('zooming about a corner keeps that corner; zoom is limited to fit … 6×',()=>{
  const v=zoomAt(FIT_VIEW,3,0,0,W,H);expect(v).toEqual({scale:3,x:0,y:0});
  expect(screenToPixel(400,300,v,W,H,PW,PH)).toEqual([400,300]);
  expect(zoomAt(v,100,0,0,W,H).scale).toBe(MAX_ZOOM);
  expect(zoomAt(v,.01,0,0,W,H)).toEqual(FIT_VIEW);
  expect(zoomAt(FIT_VIEW,.5,200,150,W,H)).toEqual(FIT_VIEW);
 });
 it('the photo always covers the frame: panning stops at the edges',()=>{
  const v={scale:2,x:-.5,y:-.5};
  expect(panBy(v,1000,0,W,H)).toEqual({scale:2,x:0,y:-.5});
  expect(panBy(v,-1000,-1000,W,H)).toEqual({scale:2,x:-1,y:-1});
  // 40 CSS px right is .1 of the frame width.
  expect(panBy(v,40,0,W,H).x).toBeCloseTo(-.4,12);
  expect(panBy(FIT_VIEW,50,50,W,H)).toEqual(FIT_VIEW);
  expect(clampView({scale:Number.NaN,x:5,y:-9})).toEqual(FIT_VIEW);
 });
 it('pixelToScreen is the inverse of screenToPixel',()=>{
  const v={scale:2.5,x:-.75,y:-1.2};
  const [sx,sy]=pixelToScreen(500,300,v,W,H,PW,PH);
  // x: (−.75 + 500/1200·2.5)·400 = (−.75 + 1.041666…)·400 = 116.666…; y: (−1.2 + 300/900·2.5)·300 = −110.
  expect(sx).toBeCloseTo(116.6666667,6);expect(sy).toBeCloseTo(-110,9);
 });
 it('property: screen → pixel → screen is the identity for every view and frame point',()=>{
  fc.assert(fc.property(fc.double({min:1,max:MAX_ZOOM,noNaN:true}),fc.double({min:0,max:1,noNaN:true}),fc.double({min:0,max:1,noNaN:true}),fc.double({min:0,max:1,noNaN:true}),fc.double({min:0,max:1,noNaN:true}),
   fc.integer({min:40,max:2000}),fc.integer({min:40,max:2000}),fc.integer({min:32,max:1536}),fc.integer({min:32,max:1536}),(scale,px,py,fx,fy,fw,fh,w,h)=>{
   const v=clampView({scale,x:(1-scale)*px,y:(1-scale)*py}),sx=fx*fw,sy=fy*fh;
   const [x,y]=screenToPixel(sx,sy,v,fw,fh,w,h);
   expect(x).toBeGreaterThanOrEqual(0);expect(x).toBeLessThanOrEqual(w);expect(y).toBeGreaterThanOrEqual(0);expect(y).toBeLessThanOrEqual(h);
   const [bx,by]=pixelToScreen(x,y,v,fw,fh,w,h);
   expect(Math.abs(bx-sx)).toBeLessThan(1e-6*fw);expect(Math.abs(by-sy)).toBeLessThan(1e-6*fh);
  }),{numRuns:500});
 });
 it('property: zooming about a point keeps the photo point under it unless the edge clamp moves it',()=>{
  fc.assert(fc.property(fc.double({min:.2,max:5,noNaN:true}),fc.double({min:0,max:1,noNaN:true}),fc.double({min:0,max:1,noNaN:true}),(factor,fx,fy)=>{
   const start={scale:2,x:-.5,y:-.5},v=zoomAt(start,factor,fx*W,fy*H,W,H),before=screenToPixel(fx*W,fy*H,start,W,H,PW,PH),after=screenToPixel(fx*W,fy*H,v,W,H,PW,PH);
   expect(v.scale).toBeGreaterThanOrEqual(1);expect(v.scale).toBeLessThanOrEqual(MAX_ZOOM);
   const unclamped=start.scale*factor;
   // Without clamping (scale in range and the shifted view still covers the frame) the point is fixed.
   const fixed={scale:unclamped,x:fx-(fx-start.x)/start.scale*unclamped,y:fy-(fy-start.y)/start.scale*unclamped};
   if(unclamped>=1&&unclamped<=MAX_ZOOM&&fixed.x<=0&&fixed.x>=1-unclamped&&fixed.y<=0&&fixed.y>=1-unclamped){expect(after[0]).toBeCloseTo(before[0],6);expect(after[1]).toBeCloseTo(before[1],6);}
  }),{numRuns:400});
 });
 it('pinch: fingers twice as far apart double the scale; the midpoint keeps its photo point',()=>{
  // Fingers at (150,150) and (250,150) move to (100,150) and (300,150): distance 100 → 200, midpoint stays (200,150).
  const v=pinchView(FIT_VIEW,[150,150],[250,150],[100,150],[300,150],W,H);
  expect(v).toEqual({scale:2,x:-.5,y:-.5});
  // The same pinch whose midpoint then moves 40 px left pans by −.1 of the frame.
  const moved=pinchView(FIT_VIEW,[150,150],[250,150],[60,150],[260,150],W,H);
  expect(moved.scale).toBe(2);expect(moved.x).toBeCloseTo(-.6,12);expect(moved.y).toBeCloseTo(-.5,12);
  // Fingers on one spot never divide by zero.
  expect(pinchView(FIT_VIEW,[10,10],[10,10],[50,50],[90,90],W,H).scale).toBe(1);
 });
 it('the brush keeps its size on screen: the photo radius shrinks as the zoom grows',()=>{
  // 20 CSS px on a 400 px frame of a 1200 px photo: 60 photo px at fit, 30 at 2×, 10 at 6×.
  expect(brushRadius(20,FIT_VIEW,W,PW)).toBe(60);
  expect(brushRadius(20,{scale:2,x:0,y:0},W,PW)).toBe(30);
  expect(brushRadius(20,{scale:6,x:0,y:0},W,PW)).toBe(10);
  expect(brushRadius(1,{scale:6,x:0,y:0},2000,100)).toBe(1);
 });
 it('wheel: up zooms in, down zooms out, lines count more than pixels',()=>{
  expect(wheelFactor(-100)).toBeCloseTo(Math.exp(.15),12);expect(wheelFactor(100)).toBeCloseTo(Math.exp(-.15),12);
  expect(wheelFactor(-3,1)).toBeCloseTo(Math.exp(.072),12);
  // A huge flick is limited to one 400 px step.
  expect(wheelFactor(-99999)).toBeCloseTo(Math.exp(.6),12);
 });
});

describe('D87 gesture classification',()=>{
 it('two pointers always pinch; Move photo or a held pan key pans; otherwise the tool decides',()=>{
  for(const tool of ['brush','erase','corners','ai-tap'] as const){
   expect(gestureFor(2,{moveMode:false,pan:false,tool})).toBe('pinch');expect(gestureFor(3,{moveMode:true,pan:false,tool})).toBe('pinch');
   expect(gestureFor(1,{moveMode:true,pan:false,tool})).toBe('pan');expect(gestureFor(1,{moveMode:false,pan:true,tool})).toBe('pan');
  }
  expect(gestureFor(1,{moveMode:false,pan:false,tool:'brush'})).toBe('draw');expect(gestureFor(1,{moveMode:false,pan:false,tool:'erase'})).toBe('draw');
  expect(gestureFor(1,{moveMode:false,pan:false,tool:'corners'})).toBe('tap');expect(gestureFor(1,{moveMode:false,pan:false,tool:'none'})).toBe('tap');
 });
 it('one finger draws; a second finger turns it into a pinch until every finger has lifted',()=>{
  const g=new ZoomGestures();let view:ZoomView=FIT_VIEW;
  expect(g.down(1,[150,150],view,false)).toBe(false);expect(g.active).toBe(false);
  expect(g.move(1,[160,150],W,H)).toBeUndefined();
  expect(g.down(2,[250,150],view,false)).toBe(true);expect(g.active).toBe(true);
  // Finger 1 moved to (160,150) before the pinch started, so the start distance is 90; finger 2 moves to 340 → 180.
  view=g.move(2,[340,150],W,H)!;expect(view.scale).toBeCloseTo(2,12);
  // Lifting one finger leaves a pan with the other; it never draws.
  expect(g.up(2,view)).toBe(true);expect(g.active).toBe(true);
  const panned=g.move(1,[120,150],W,H)!;expect(panned.x).toBeCloseTo(view.x-.1,12);
  expect(g.up(1,panned)).toBe(true);expect(g.active).toBe(false);expect(g.count).toBe(0);
  // A fresh single finger draws again.
  expect(g.down(3,[10,10],panned,false)).toBe(false);expect(g.up(3,panned)).toBe(false);
 });
 it('with a pan key or Move photo, one pointer pans from where it started',()=>{
  const g=new ZoomGestures(),start={scale:3,x:-1,y:-1};
  expect(g.down(7,[100,100],start,true)).toBe(true);
  expect(g.move(7,[140,70],W,H)).toEqual(clampView({scale:3,x:-1+40/W,y:-1-30/H}));
  expect(g.move(99,[0,0],W,H)).toBeUndefined();
  expect(g.up(7,start)).toBe(true);expect(g.up(7,start)).toBe(false);
 });
});
