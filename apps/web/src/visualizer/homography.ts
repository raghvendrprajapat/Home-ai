/**
 * D85 Room photo: projective (perspective) mapping between the unit square and a four-corner quad on the photo.
 * A matrix [a,b,c,d,e,f,g,h] maps (u,v) to ((a·u+b·v+c)/w, (d·u+e·v+f)/w) with w = g·u+h·v+1 (Heckbert's closed form
 * of the 4-point DLT). Pure maths, image pixels in floats; nothing here touches the project model.
 */
export type Point=readonly [number,number];
/** Corners in screen order: top-left, top-right, bottom-right, bottom-left (clockwise with Y down). */
export type Quad=readonly [Point,Point,Point,Point];
export type Homography=readonly [number,number,number,number,number,number,number,number,number];
/** A quad smaller than this (px²) or with a corner angle this flat cannot hold a perspective plane. */
export const MIN_QUAD_AREA=64;

const det2=(a:number,b:number,c:number,d:number)=>a*d-b*c;
/** The 3×3 matrix (row-major, last entry 1 before normalising) taking the unit square's corners to q in order. */
export function squareToQuad(q:Quad):Homography{
 const [[x0,y0],[x1,y1],[x2,y2],[x3,y3]]=q,dx3=x0-x1+x2-x3,dy3=y0-y1+y2-y3;
 if(Math.abs(dx3)<1e-12&&Math.abs(dy3)<1e-12)return [x1-x0,x3-x0,x0,y1-y0,y3-y0,y0,0,0,1];
 const dx1=x1-x2,dx2=x3-x2,dy1=y1-y2,dy2=y3-y2,den=det2(dx1,dx2,dy1,dy2);
 if(Math.abs(den)<1e-12)throw new Error('quad-degenerate');
 const g=det2(dx3,dx2,dy3,dy2)/den,h=det2(dx1,dx3,dy1,dy3)/den;
 return [x1-x0+g*x1,x3-x0+h*x3,x0,y1-y0+g*y1,y3-y0+h*y3,y0,g,h,1];
}
/**
 * The true inverse (adjugate / determinant). Not rescaled: dividing by the determinant keeps w positive for every point
 * in front of the plane, which `apply` uses to reject points beyond the horizon.
 */
export function invert(m:Homography):Homography{
 const [a,b,c,d,e,f,g,h,i]=m;
 const A=e*i-f*h,B=-(d*i-f*g),C=d*h-e*g,D=-(b*i-c*h),E=a*i-c*g,F=-(a*h-b*g),G=b*f-c*e,H=-(a*f-c*d),I=a*e-b*d;
 const det=a*A+b*B+c*C;if(!Number.isFinite(det)||Math.abs(det)<1e-12)throw new Error('quad-degenerate');
 const s=1/det;
 return [A*s,D*s,G*s,B*s,E*s,H*s,C*s,F*s,I*s];
}
/** Applies m to p; undefined where the point lies on or beyond the plane's horizon (w ≤ 0). */
export function apply(m:Homography,p:Point):Point|undefined{
 const [a,b,c,d,e,f,g,h,i]=m,[x,y]=p,w=g*x+h*y+i;
 return w>1e-15?[(a*x+b*y+c)/w,(d*x+e*y+f)/w]:undefined;
}
/** Composition: first n, then m. */
export function compose(m:Homography,n:Homography):Homography{
 const r=new Array<number>(9);
 for(let row=0;row<3;row++)for(let col=0;col<3;col++)r[row*3+col]=m[row*3]!*n[col]!+m[row*3+1]!*n[3+col]!+m[row*3+2]!*n[6+col]!;
 return r as unknown as Homography;
}
/** The perspective mapping taking quad `from` onto quad `to`, corner by corner. */
export function quadToQuad(from:Quad,to:Quad):Homography{return compose(squareToQuad(to),invert(squareToQuad(from)));}
const cross=(o:Point,a:Point,b:Point)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
/** Signed area (positive when clockwise on screen, Y down). */
export function quadArea(q:Quad):number{let s=0;for(let i=0;i<4;i++){const [x0,y0]=q[i]!,[x1,y1]=q[(i+1)%4]!;s+=x0*y1-x1*y0;}return s/2;}
/** True when every turn has the same direction (no corner pushed inside, no crossing edges). */
export function isConvexQuad(q:Quad):boolean{
 const turns=[0,1,2,3].map(i=>cross(q[i]!,q[(i+1)%4]!,q[(i+2)%4]!));
 return turns.every(t=>t>1e-9)||turns.every(t=>t<-1e-9);
}
/**
 * Four tapped points, in any order, as a screen-ordered convex quad starting at the top-left corner (so a picture
 * stays upright), or undefined when they cannot make one (repeated, collinear, a dent, or too small).
 */
export function orderQuad(points:readonly Point[]):Quad|undefined{
 if(points.length!==4||!points.every(p=>Number.isFinite(p[0])&&Number.isFinite(p[1])))return undefined;
 const cx=points.reduce((s,p)=>s+p[0],0)/4,cy=points.reduce((s,p)=>s+p[1],0)/4;
 // Clockwise on screen (Y down) is increasing atan2 angle.
 const sorted=[...points].sort((p,q)=>Math.atan2(p[1]-cy,p[0]-cx)-Math.atan2(q[1]-cy,q[0]-cx));
 let start=0;for(let i=1;i<4;i++)if(sorted[i]![0]+sorted[i]![1]<sorted[start]![0]+sorted[start]![1])start=i;
 const q=[0,1,2,3].map(i=>sorted[(start+i)%4]!) as unknown as Quad;
 return isConvexQuad(q)&&quadArea(q)>=MIN_QUAD_AREA?q:undefined;
}
/** Mean lengths of the top/bottom and left/right edges: the plane's size in photo pixels, for pattern scale. */
export function quadPlaneSize(q:Quad):{width:number;height:number}{
 const len=(a:Point,b:Point)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
 return {width:(len(q[0],q[1])+len(q[3],q[2]))/2,height:(len(q[0],q[3])+len(q[1],q[2]))/2};
}
