import {it,expect} from 'vitest';
import fc from 'fast-check';
import * as THREE from 'three';
import {FurnitureProjection} from './furniture-projection';
const rect={left:100,top:200,width:800,height:400};
function down(){const camera=new THREE.PerspectiveCamera(90,2,.01,1000);camera.position.set(0,10,0);camera.up.set(0,0,-1);camera.lookAt(0,0,0);return camera;}
it('known top-down perspective projects25pixels/metre at8m distance, with correct south/down and mm axes',()=>{
 const p=new FurnitureProjection(down(),rect,2);expect(p.point([525,450])![0]).toBeCloseTo(1000,8);expect(p.point([525,450])![1]).toBeCloseTo(2000,8);expect(p.screen([1000,2000])![0]).toBeCloseTo(525,10);expect(p.screen([1000,2000])![1]).toBeCloseTo(450,10);
 fc.assert(fc.property(fc.integer({min:-5000,max:5000}),fc.integer({min:-5000,max:5000}),(x,y)=>{const got=p.point([500+x*.025,400+y*.025])!;expect(got[0]).toBeCloseTo(x,7);expect(got[1]).toBeCloseTo(y,7);expect(p.screen([x,y])![0]).toBeCloseTo(500+x*.025,10);expect(p.screen([x,y])![1]).toBeCloseTo(400+y*.025,10);}),{seed:40330,numRuns:200});
});
it('known45degree ray passes through frozen visible hit height without forcing elevation to ground',()=>{
 const camera=new THREE.PerspectiveCamera(45,2,.01,1000);camera.position.set(0,10,10);camera.lookAt(0,0,0);const p=new FurnitureProjection(camera,rect,2.5),point=p.point([500,400])!;expect(point[0]).toBeCloseTo(0,8);expect(point[1]).toBeCloseTo(2500,8);
});
it('camera/viewport changes invalidate ownership but cannot mutate the captured mapping',()=>{
 const camera=down(),p=new FurnitureProjection(camera,rect,2),before=p.point([525,450]);expect(p.matches(camera,rect)).toBe(true);camera.position.x=1;expect(p.matches(camera,rect)).toBe(false);expect(p.point([525,450])).toEqual(before);expect(p.matches(down(),{...rect,left:101})).toBe(false);
});
it('near-parallel, behind-eye, far, nonfinite and invalid camera/viewport projections reject',()=>{
 const camera=down();expect(new FurnitureProjection(camera,rect,15).point([500,400])).toBe(null);camera.far=20;camera.updateProjectionMatrix();expect(new FurnitureProjection(camera,rect,-100).point([500,400])).toBe(null);camera.position.set(0,2,10);camera.lookAt(0,2,0);expect(new FurnitureProjection(camera,rect,0).point([500,400])).toBe(null);
 expect(new FurnitureProjection(down(),rect,0).point([Infinity,0])).toBe(null);expect(()=>new FurnitureProjection(down(),{...rect,width:0},0)).toThrow('projection');expect(()=>new FurnitureProjection(down(),rect,NaN)).toThrow('projection');
});
it('prototype-backed viewport getters are copied explicitly, as with browser DOMRect',()=>{
 class NativeRect {get left(){return 100;}get top(){return 200;}get width(){return 800;}get height(){return 400;}}
 const p=new FurnitureProjection(down(),new NativeRect(),2);expect(p.rect).toEqual(rect);expect(p.point([525,450])![0]).toBeCloseTo(1000,8);expect(p.matches(down(),new NativeRect())).toBe(true);
});
it('off-axis visible points obey clipping depth, not radial distance, at near and far planes',()=>{
 const camera=down();camera.near=2;camera.far=10;camera.updateProjectionMatrix();
 const far=new FurnitureProjection(camera,rect,1),screen=far.screen([5000,0])!;expect(screen).not.toBe(null);expect(far.point(screen)![0]).toBeCloseTo(5000,7);
 const near=new FurnitureProjection(camera,rect,9),outside=near.point([780,400]);expect(outside).toBe(null);expect(new FurnitureProjection(camera,rect,-1).point([500,400])).toBe(null);
});
