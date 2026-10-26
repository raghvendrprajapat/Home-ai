import {describe,expect,it} from 'vitest';
import fc from 'fast-check';
import {apply,invert,isConvexQuad,orderQuad,quadArea,quadPlaneSize,quadToQuad,squareToQuad} from './homography';
import type {Point,Quad} from './homography';

// D85 Claude-authored builder tests (not independent fixtures). Expected values are worked out by hand in comments.
const near=(p:Point|undefined,q:Point,digits=9)=>{expect(p).toBeDefined();expect(p![0]).toBeCloseTo(q[0],digits);expect(p![1]).toBeCloseTo(q[1],digits);};
// Symmetric trapezoid; by hand: x = (4u + 2v)/(v + 1), y = 4v/(v + 1) (g = 0, h = 1 in Heckbert's form).
const TRAPEZOID:Quad=[[0,0],[4,0],[3,2],[1,2]];

describe('D85 homography',()=>{
 it('maps the unit square onto an axis-aligned rectangle as a plain scale and shift',()=>{
  const m=squareToQuad([[10,20],[110,20],[110,70],[10,70]]);
  near(apply(m,[0,0]),[10,20]);near(apply(m,[1,1]),[110,70]);near(apply(m,[.5,.5]),[60,45]);near(apply(m,[.25,1]),[35,70]);
 });
 it('maps corners exactly and the square centre to the crossing of the quad diagonals (perspective, not the average)',()=>{
  const m=squareToQuad(TRAPEZOID);
  near(apply(m,[0,0]),[0,0]);near(apply(m,[1,0]),[4,0]);near(apply(m,[1,1]),[3,2]);near(apply(m,[0,1]),[1,2]);
  // Diagonals (0,0)-(3,2) and (4,0)-(1,2) cross at t = 2/3: (2, 4/3). The corner average would be (2, 1).
  near(apply(m,[.5,.5]),[2,4/3]);
  // v = 1/2 on the left edge: 2/3 of the way from (0,0) to (1,2).
  near(apply(m,[0,.5]),[2/3,4/3]);
  // u = 1/2 is the symmetry axis x = 2 at every depth.
  for(const v of [0,.1,.7,1])expect(apply(m,[.5,v])![0]).toBeCloseTo(2,9);
 });
 it('inverts exactly: photo points go back to their square coordinates',()=>{
  const inv=invert(squareToQuad(TRAPEZOID));
  near(apply(inv,[2,4/3]),[.5,.5]);near(apply(inv,[3,2]),[1,1]);near(apply(inv,[2/3,4/3]),[0,.5]);
  near(apply(quadToQuad(TRAPEZOID,TRAPEZOID),[1.7,.9]),[1.7,.9]);
  // Quad to quad: TRAPEZOID onto the 4×2 rectangle sends the diagonal crossing to the rectangle centre.
  near(apply(quadToQuad(TRAPEZOID,[[0,0],[4,0],[4,2],[0,2]]),[2,4/3]),[2,1]);
 });
 it('rejects points beyond the horizon and degenerate quads',()=>{
  // w = v + 1 for TRAPEZOID, so v = -1 is the horizon.
  expect(apply(squareToQuad(TRAPEZOID),[.5,-1])).toBeUndefined();
  expect(()=>squareToQuad([[0,0],[1,1],[2,2],[3,3]])).toThrow('quad-degenerate');
 });
 it('orders four taps into a clockwise quad that starts at the top-left corner',()=>{
  expect(orderQuad([[30,25],[10,10],[12,28],[31,9]])).toEqual([[10,10],[31,9],[30,25],[12,28]]);
  expect(orderQuad([[0,0],[10,0],[20,0],[30,0]])).toBeUndefined();
  // A dent: (2,4) sits inside the triangle of the other three.
  expect(orderQuad([[0,0],[10,0],[0,10],[2,4]])).toBeUndefined();
  expect(orderQuad([[0,0],[5,0],[5,5],[0,5]])).toBeUndefined();
  expect(orderQuad([[0,0],[5,0],[5,5]])).toBeUndefined();
  expect(quadArea([[0,0],[4,0],[4,3],[0,3]])).toBe(12);
  expect(quadPlaneSize(TRAPEZOID)).toEqual({width:3,height:Math.sqrt(5)});
 });
 // A w × ht rectangle with every corner pushed up to 30 % of the size each way; dented ones are filtered out.
 const convexQuad=fc.record({j:fc.array(fc.double({min:-.3,max:.3,noNaN:true}),{minLength:8,maxLength:8}),w:fc.double({min:50,max:1500,noNaN:true}),ht:fc.double({min:50,max:1000,noNaN:true})})
  .map(({j,w,ht}):Quad=>{const [a,b,c,d,e,f,g,h]=j as [number,number,number,number,number,number,number,number];return [[a*w,b*ht],[w+c*w,d*ht],[w+e*w,ht+f*ht],[g*w,ht+h*ht]];}).filter(q=>isConvexQuad(q)&&quadArea(q)>100);
 it('property: for random convex quads, forward then inverse returns the square point',()=>{
  fc.assert(fc.property(convexQuad,fc.double({min:0,max:1,noNaN:true}),fc.double({min:0,max:1,noNaN:true}),(q,u,v)=>{
   const m=squareToQuad(q),p=apply(m,[u,v])!,back=apply(invert(m),p)!;
   expect(Math.abs(back[0]-u)).toBeLessThan(1e-6);expect(Math.abs(back[1]-v)).toBeLessThan(1e-6);
  }),{numRuns:300});
 });
 it('property: straight lines stay straight (three points on u = const are collinear in the photo)',()=>{
  fc.assert(fc.property(convexQuad,fc.double({min:0,max:1,noNaN:true}),(q,u)=>{
   const m=squareToQuad(q),[a,b,c]=[0,.37,1].map(v=>apply(m,[u,v])!) as [Point,Point,Point];
   const cross=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]),scale=Math.hypot(c[0]-a[0],c[1]-a[1])**2+1;
   expect(Math.abs(cross)/scale).toBeLessThan(1e-9);
  }),{numRuns:200});
 });
});
