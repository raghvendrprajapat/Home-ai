import type {Opening} from '@gharplan/core-model';
import type {Point2,PlanDocument} from './view2d';
/** Original parametric plan symbol, world mm. flipX also carries the oriented side on reversal. */
export function openingSymbol(document:PlanDocument,opening:Opening):{centre:Point2;hinge:Point2;leaf:Point2;arc:Point2[]} {
 const wall=document.walls.find(w=>w.id===opening.wallId)!,a=document.junctions.find(j=>j.id===wall.a)!,b=document.junctions.find(j=>j.id===wall.b)!;
 const length=Math.abs(b.x-a.x)+Math.abs(b.y-a.y),dx=(b.x-a.x)/length,dy=(b.y-a.y)/length,u=opening.flipX?-1:1,v=opening.flipY?-1:1;
 const centre:Point2=[a.x+dx*opening.offset,a.y+dy*opening.offset],hinge:Point2=[centre[0]-u*dx*opening.width/2,centre[1]-u*dy*opening.width/2];
 const point=(angle:number):Point2=>[hinge[0]+u*opening.width*(dx*Math.cos(angle)-dy*v*Math.sin(angle)),hinge[1]+u*opening.width*(dy*Math.cos(angle)+dx*v*Math.sin(angle))];
 return {centre,hinge,leaf:point(Math.PI/2),arc:Array.from({length:17},(_,i)=>point(i*Math.PI/32))};
}
