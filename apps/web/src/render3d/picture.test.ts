import {describe,expect,it} from 'vitest';
import fc from 'fast-check';
import * as THREE from 'three';
import {captureLens,contentExtent,MAX_PICTURE_FOV,PICTURE_PRESETS,pictureBytes,pictureScale,pictureShadowSize,planPictureSize,planTiles,renderPictureTiles} from './picture';
import type {PicturePreset} from './picture';
import {profiles} from './quality';

// D89 builder (Claude) tests: expected values are worked out by hand from the stated rules, not produced by the code.
const big={maxTextureSize:4096,maxRenderbufferSize:4096,maxSamples:4};
const deg=(tan:number)=>Math.atan(tan)*360/Math.PI,tanHalf=(fov:number)=>Math.tan(fov*Math.PI/360);
describe('D89 picture size',()=>{
 it('keeps preset sizes when the device allows them',()=>{
  for(const tier of ['mid','high'] as const)expect([planPictureSize('hd',{gpu:big,tier,nativeSave:false}),planPictureSize('qhd',{gpu:big,tier,nativeSave:false}),planPictureSize('square',{gpu:big,tier,nativeSave:false})]).toEqual([{width:1920,height:1080,capped:false,limit:null},{width:2560,height:1440,capped:false,limit:null},{width:2048,height:2048,capped:false,limit:null}]);
 });
 it('Low tier: long side at most 1920; HD itself is not capped',()=>{
  expect(planPictureSize('hd',{gpu:big,tier:'low',nativeSave:false})).toEqual({width:1920,height:1080,capped:false,limit:null});
  expect(planPictureSize('qhd',{gpu:big,tier:'low',nativeSave:false})).toEqual({width:1920,height:1080,capped:true,limit:'tier'});
  expect(planPictureSize('square',{gpu:big,tier:'low',nativeSave:false})).toEqual({width:1920,height:1920,capped:true,limit:'tier'});
 });
 it('Android verified PNG save: at most 2048 px per side and 4,000,000 pixels',()=>{
  expect(planPictureSize('hd',{gpu:big,tier:'mid',nativeSave:true})).toEqual({width:1920,height:1080,capped:false,limit:null});
  expect(planPictureSize('qhd',{gpu:big,tier:'mid',nativeSave:true})).toEqual({width:2048,height:1152,capped:true,limit:'save'});
  expect(planPictureSize('square',{gpu:big,tier:'mid',nativeSave:true})).toEqual({width:2000,height:2000,capped:true,limit:'save'});
 });
 it('never exceeds what the device reports; too small fails instead of a tiny "HD" picture',()=>{
  expect(planPictureSize('hd',{gpu:{maxTextureSize:2048,maxRenderbufferSize:1536,maxSamples:4},tier:'mid',nativeSave:false})).toEqual({width:1536,height:864,capped:true,limit:'device'});
  expect(()=>planPictureSize('hd',{gpu:{maxTextureSize:512,maxRenderbufferSize:512,maxSamples:0},tier:'low',nativeSave:false})).toThrow('picture-budget');
  expect(()=>planPictureSize('hd',{gpu:{maxTextureSize:Number.NaN,maxRenderbufferSize:4096,maxSamples:0},tier:'low',nativeSave:false})).toThrow('picture-budget');
  expect(pictureBytes(1920,1080)).toBe(1920*1080*12+8*1024*1024);
 });
 it('property: exact preset aspect, every limit respected, memory within the tier budget, never upscaled',()=>{
  fc.assert(fc.property(fc.constantFrom<PicturePreset>('hd','qhd','square'),fc.constantFrom('low','mid','high' as const),fc.boolean(),fc.integer({min:1300,max:16384}),fc.integer({min:1300,max:16384}),(preset,tier,nativeSave,maxTextureSize,maxRenderbufferSize)=>{
   const base=PICTURE_PRESETS[preset],p=planPictureSize(preset,{gpu:{maxTextureSize,maxRenderbufferSize,maxSamples:4},tier,nativeSave});
   expect(p.width*base.height).toBe(p.height*base.width);expect(p.width).toBeLessThanOrEqual(base.width);expect(Math.max(p.width,p.height)).toBeLessThanOrEqual(Math.min(maxTextureSize,maxRenderbufferSize));
   if(tier==='low')expect(Math.max(p.width,p.height)).toBeLessThanOrEqual(1920);
   if(nativeSave){expect(Math.max(p.width,p.height)).toBeLessThanOrEqual(2048);expect(p.width*p.height).toBeLessThanOrEqual(4_000_000);}
   expect(pictureBytes(p.width,p.height)).toBeLessThanOrEqual(profiles[tier].captureBytes);expect(p.capped).toBe(p.width<base.width);expect(p.limit===null).toBe(!p.capped);
  }));
 });
 it('supersampling and picture-only shadow size',()=>{
  expect(pictureScale(1920,1080,'low')).toBe(1.5);expect(pictureScale(1920,1080,'mid')).toBe(2);expect(pictureScale(2560,1440,'high')).toBe(2);expect(pictureScale(2048,2048,'mid')).toBe(2);
  expect(pictureScale(4096,4096,'high')).toBeCloseTo(Math.sqrt(17_000_000/16_777_216),12);expect(pictureScale(8000,8000,'high')).toBe(1);
  expect(pictureShadowSize('low',big)).toBe(0);expect(pictureShadowSize('mid',big)).toBe(2048);expect(pictureShadowSize('high',big)).toBe(4096);expect(pictureShadowSize('high',{...big,maxTextureSize:2048})).toBe(2048);
 });
});

describe('D89 capture camera (lens only, never moved, never stretched)',()=>{
 const pose={position:[8,9,12] as const,target:[1,0,2] as const};
 it('same shape keeps the exact live lens',()=>{
  expect(captureLens({...pose,fov:45,aspect:16/9},1920,1080,null)).toEqual({position:[8,9,12],target:[1,0,2],fov:45,aspect:16/9,fit:'same'});
 });
 it('narrower picture without content information keeps the whole screen width (horizontal field preserved)',()=>{
  const lens=captureLens({...pose,fov:45,aspect:2},1920,1080,null);
  expect(lens.fit).toBe('contain');expect(lens.aspect).toBe(1920/1080);expect(tanHalf(lens.fov)*1920/1080).toBeCloseTo(tanHalf(45)*2,12);
  const square=captureLens({...pose,fov:45,aspect:1.6},2048,2048,null);expect(tanHalf(square.fov)).toBeCloseTo(Math.tan(Math.PI/8)*1.6,12);
 });
 it('wider picture without content keeps the vertical field of view',()=>{
  const lens=captureLens({...pose,fov:45,aspect:0.5},1920,1080,null);expect(lens.fit).toBe('contain');expect(lens.fov).toBeCloseTo(45,10);
 });
 it('content decides between the cover and contain frames (4% margin)',()=>{
  // Portrait phone (aspect 0.5) to 16:9: cover tan = tan(22.5°)·0.5/(16/9) ≈ 0.1165, contain tan = tan(22.5°) ≈ 0.4142.
  const out=16/9,mid=captureLens({...pose,fov:45,aspect:0.5},1920,1080,{tanX:0.4,tanY:0.1});expect(mid.fit).toBe('content');expect(mid.fov).toBeCloseTo(deg(0.4/out*1.04),10);
  const small=captureLens({...pose,fov:45,aspect:0.5},1920,1080,{tanX:0.05,tanY:0.05});expect(small.fit).toBe('cover');expect(tanHalf(small.fov)).toBeCloseTo(Math.tan(Math.PI/8)*0.5/out,12);
  const large=captureLens({...pose,fov:45,aspect:0.5},1920,1080,{tanX:3,tanY:3});expect(large.fit).toBe('contain');expect(large.fov).toBeCloseTo(45,10);
 });
 it('content extent from camera-space points; points behind the camera mean "surrounds the camera"',()=>{
  expect(contentExtent([[1,0,-2],[0,-1,-4]],0.01)).toEqual({tanX:0.5,tanY:0.25});expect(contentExtent([[1,0,-2],[0,0,1]],0.01)).toBeNull();expect(contentExtent([],0.01)).toBeNull();
 });
 it('property: picture aspect equals the requested aspect, position/target unchanged, frame between cover and contain',()=>{
  const coord=fc.double({min:-50,max:50,noNaN:true});
  fc.assert(fc.property(fc.tuple(coord,coord,coord),fc.tuple(coord,coord,coord),fc.double({min:20,max:90,noNaN:true}),fc.double({min:0.3,max:3,noNaN:true}),fc.integer({min:64,max:4096}),fc.integer({min:64,max:4096}),fc.option(fc.record({tanX:fc.double({min:0,max:5,noNaN:true}),tanY:fc.double({min:0,max:5,noNaN:true})})),(position,target,fov,aspect,width,height,content)=>{
   const lens=captureLens({position,target,fov,aspect},width,height,content);
   expect(lens.aspect).toBe(width/height);expect(lens.position).toEqual(position);expect(lens.target).toEqual(target);
   const t=tanHalf(lens.fov),ratio=aspect/(width/height),cover=tanHalf(fov)*Math.min(1,ratio),contain=Math.min(tanHalf(fov)*Math.max(1,ratio),tanHalf(MAX_PICTURE_FOV));
   expect(t).toBeGreaterThanOrEqual(cover*(1-1e-9));expect(t).toBeLessThanOrEqual(Math.max(cover,contain)*(1+1e-9));expect(lens.fov).toBeLessThanOrEqual(MAX_PICTURE_FOV+1e-9);
  }));
 });
});

describe('D89 tiles',()=>{
 it('analytic tile layout with a 4 px overlap margin',()=>{
  expect(planTiles(100,50,2,120,70)).toEqual([
   {ox:0,oy:0,w:56,h:31,vx:-4,vy:-4,sx:4,sy:4,sw:112,sh:62},{ox:56,oy:0,w:44,h:31,vx:108,vy:-4,sx:4,sy:4,sw:88,sh:62},
   {ox:0,oy:31,w:56,h:19,vx:-4,vy:58,sx:4,sy:4,sw:112,sh:38},{ox:56,oy:31,w:44,h:19,vx:108,vy:58,sx:4,sy:4,sw:88,sh:38},
  ]);
  expect(()=>planTiles(100,50,2,30,70)).toThrow('capture-size');
 });
 it('property: tiles cover every output pixel exactly once and read only inside the drawing buffer',()=>{
  fc.assert(fc.property(fc.integer({min:1,max:300}),fc.integer({min:1,max:300}),fc.constantFrom(1,1.5,2),fc.integer({min:48,max:400}),fc.integer({min:48,max:400}),(w,h,scale,bw,bh)=>{
   const tiles=planTiles(w,h,scale,bw,bh),seen=new Uint8Array(w*h);
   for(const t of tiles){for(let y=t.oy;y<t.oy+t.h;y++)for(let x=t.ox;x<t.ox+t.w;x++)seen[y*w+x]!++;expect(t.sx+t.sw).toBeLessThanOrEqual(bw);expect(t.sy+t.sh).toBeLessThanOrEqual(bh);expect(t.vx+t.sx).toBeCloseTo(t.ox*scale,9);expect(t.vy+t.sy).toBeCloseTo(t.oy*scale,9);}
   expect(seen.every(v=>v===1)).toBe(true);
  }),{numRuns:60});
 });
 function fake(width=120,height=70){
  const canvas={width,height} as HTMLCanvasElement,gl={drawingBufferWidth:width,drawingBufferHeight:height,isContextLost:()=>false},views:unknown[]=[];
  const renderer={domElement:canvas,getContext:()=>gl,getRenderTarget:()=>null,render:(_:THREE.Scene,camera:THREE.PerspectiveCamera)=>{views.push({...camera.view!});}};
  return {renderer:renderer as unknown as THREE.WebGLRenderer,canvas,gl,views};
 }
 it('renders each tile with its view offset, restores after every slice and clears the offset',async()=>{
  const f=fake(),camera=new THREE.PerspectiveCamera(45,2),log:string[]=[],progress:number[]=[];
  const total=await renderPictureTiles({renderer:f.renderer,scene:new THREE.Scene(),camera,width:100,height:50,scale:2,signal:new AbortController().signal,check:()=>log.push('check'),begin:()=>log.push('begin'),copy:t=>log.push(`copy ${t.ox},${t.oy}`),end:()=>log.push('end'),onProgress:d=>progress.push(d),sliceMs:0,yieldToUi:async()=>{log.push('yield');}});
  expect(total).toBe(4);expect(f.views.map(v=>(v as {offsetX:number;offsetY:number;fullWidth:number;fullHeight:number;width:number;height:number}))).toEqual([[-4,-4],[108,-4],[-4,58],[108,58]].map(([x,y])=>expect.objectContaining({fullWidth:200,fullHeight:100,offsetX:x,offsetY:y,width:120,height:70})));
  expect(log).toEqual(['check','begin','copy 0,0','end','yield','check','begin','copy 56,0','end','yield','check','begin','copy 0,31','end','yield','check','begin','copy 56,31','end']);expect(progress).toEqual([1,2,3,4]);expect(camera.view?.enabled).toBe(false);
 });
 it('cancel, scene change and drawing-buffer change stop the picture; restore still runs',async()=>{
  for(const mode of ['abort','changed','resize','lost'] as const){
   const f=fake(),camera=new THREE.PerspectiveCamera(45,2),controller=new AbortController();let ends=0,begins=0,slices=0;
   const run=renderPictureTiles({renderer:f.renderer,scene:new THREE.Scene(),camera,width:100,height:50,scale:2,signal:controller.signal,
    check:()=>{if(mode==='changed'&&slices===1)throw new Error('capture-changed');},begin:()=>{begins++;},copy:()=>{if(mode==='lost')f.gl.isContextLost=()=>true;},end:()=>{ends++;},onProgress:()=>{slices++;if(mode==='abort')controller.abort();if(mode==='resize')f.canvas.width=200;},sliceMs:0,yieldToUi:async()=>{}});
   await expect(run).rejects.toThrow(mode==='abort'?'capture-cancelled':mode==='lost'?'capture-context':'capture-changed');expect(ends).toBe(begins);expect(camera.view?.enabled).toBe(false);
  }
 });
});
