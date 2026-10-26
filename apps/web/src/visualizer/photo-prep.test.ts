import {describe,expect,it} from 'vitest';
import fc from 'fast-check';
import {checkPhotoFile,fitSize,MAX_PHOTO_BYTES,toPixel,workingSize} from './photo-prep';

// D85 Claude-authored builder tests; sizes are worked out by hand.
describe('D85 photo preparation maths',()=>{
 it('fits 1536 on the long side and 1024 on the short side in either orientation, never enlarging',()=>{
  // 4000×3000: long 1536/4000 = 0.384, short 1024/3000 = 0.3413… → the short side decides: 1365×1024.
  expect(workingSize(4000,3000)).toMatchObject({width:1365,height:1024});
  expect(workingSize(3000,4000)).toMatchObject({width:1024,height:1365});
  // A panorama is limited by its long side: 6000×1000 × 0.256 = 1536×256.
  expect(workingSize(6000,1000)).toMatchObject({width:1536,height:256});
  expect(workingSize(1200,800)).toEqual({width:1200,height:800,scale:1});
  expect(workingSize(1536,1024)).toEqual({width:1536,height:1024,scale:1});
  expect(()=>workingSize(0,10)).toThrow('photo-size');
 });
 it('property: the working size keeps the shape, fits both limits and is never bigger than the photo',()=>{
  fc.assert(fc.property(fc.integer({min:32,max:12000}),fc.integer({min:32,max:12000}),(w,h)=>{
   const s=workingSize(w,h);
   expect(Math.max(s.width,s.height)).toBeLessThanOrEqual(1536);expect(Math.min(s.width,s.height)).toBeLessThanOrEqual(1024);
   expect(s.width).toBeLessThanOrEqual(w);expect(s.height).toBeLessThanOrEqual(h);expect(s.scale).toBeLessThanOrEqual(1);
   expect(Math.abs(s.width-w*s.scale)).toBeLessThanOrEqual(.5+1e-9);expect(Math.abs(s.height-h*s.scale)).toBeLessThanOrEqual(.5+1e-9);
  }),{numRuns:400});
 });
 it('maps a pointer on the shown photo to working pixels, kept inside the photo',()=>{
  const rect={left:100,top:50,width:400,height:300};
  // Halfway across and down the shown 400×300 box is (600, 450) on a 1200×900 photo.
  expect(toPixel(300,200,rect,1200,900)).toEqual([600,450]);
  expect(toPixel(100,50,rect,1200,900)).toEqual([0,0]);expect(toPixel(500,350,rect,1200,900)).toEqual([1200,900]);
  expect(toPixel(-20,900,rect,1200,900)).toEqual([0,900]);
  // One CSS pixel on a box shown at a third of the size is three photo pixels.
  expect(toPixel(101,51,rect,1200,900)).toEqual([3,3]);
 });
 it('property: the pointer mapping is the exact inverse of showing pixel (x, y) at its scaled place',()=>{
  fc.assert(fc.property(fc.integer({min:16,max:1536}),fc.integer({min:16,max:1536}),fc.double({min:.1,max:4,noNaN:true}),fc.double({min:0,max:1,noNaN:true}),fc.double({min:0,max:1,noNaN:true}),(w,h,s,fx,fy)=>{
   const rect={left:37,top:11,width:w*s,height:h*s},x=fx*w,y=fy*h,[px,py]=toPixel(rect.left+x*s,rect.top+y*s,rect,w,h);
   expect(px).toBeCloseTo(x,6);expect(py).toBeCloseTo(y,6);
  }),{numRuns:300});
 });
 it('shows the photo as large as fits the screen area, keeping its shape',()=>{
  // 800/1536 = 0.5208 < 600/1024 = 0.5859 → 800 × 533.33 → whole pixels 800 × 533.
  expect(fitSize(800,600,1536,1024)).toEqual({width:800,height:533});
  // 512/1024 = 0.5 > 400/1600 = 0.25 → the height decides: 256 × 400.
  expect(fitSize(512,400,1024,1600)).toEqual({width:256,height:400});
 });
 it('refuses non-images, empty files and files over 15 MB before decoding',()=>{
  expect(checkPhotoFile({type:'image/jpeg',size:1000})).toBeNull();
  expect(checkPhotoFile({type:'image/png',size:MAX_PHOTO_BYTES})).toBeNull();
  expect(checkPhotoFile({type:'image/png',size:MAX_PHOTO_BYTES+1})).toBe('size');
  expect(checkPhotoFile({type:'image/png',size:0})).toBe('size');
  expect(checkPhotoFile({type:'application/pdf',size:1000})).toBe('type');
  expect(checkPhotoFile({type:'',size:1000})).toBe('type');
 });
});
