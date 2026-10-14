import type { Command } from '@gharplan/core-model';
import { junctionMoves } from './view2d';
import type { PlanDocument, Point2 } from './view2d';
export type MovedEnd='a'|'b'|'both';
/** Explicitly resize one wall and its orthogonally connected endpoint groups. */
export function wallLengthCommand(document:PlanDocument,wallId:string,length:number,movedEnd:MovedEnd,generation:number):Command {
 const wall=document.walls.find(w=>w.id===wallId),a=document.junctions.find(j=>j.id===wall?.a),b=document.junctions.find(j=>j.id===wall?.b);
 if(!wall||!a||!b||!Number.isSafeInteger(length)||length<10||length>200000||!['a','b','both'].includes(movedEnd))throw new Error('invalid-wall-length');
 const horizontal=a.y===b.y,oldLength=Math.abs(b.x-a.x)+Math.abs(b.y-a.y),delta=length-oldLength,sign=horizontal?Math.sign(b.x-a.x):Math.sign(b.y-a.y);
 if(movedEnd==='both'&&delta%2!==0)throw new Error('symmetric-integer');
 const shift=(j:typeof a,amount:number):Point2=>horizontal?[j.x+amount*sign,j.y]:[j.x,j.y+amount*sign];
 const moves=new Map<string,{junction:string;to:[number,number]}>();
 const add=(id:string,to:Point2)=>{for(const move of junctionMoves(document,id,to)){
  const original=document.junctions.find(j=>j.id===move.junction)!,base:[number,number]=[original.x,original.y],old=moves.get(move.junction)??{junction:move.junction,to:[...base] as [number,number]};
  for(const axis of [0,1] as const)if(move.to[axis]!==base[axis]){if(old.to[axis]!==base[axis]&&old.to[axis]!==move.to[axis])throw new Error('connected-wall-conflict');old.to[axis]=move.to[axis];}
  moves.set(move.junction,old);
 }};
 if(movedEnd==='a')add(a.id,shift(a,-delta));else if(movedEnd==='b')add(b.id,shift(b,delta));else {add(a.id,shift(a,-delta/2));add(b.id,shift(b,delta/2));}
 return {id:`length_${crypto.randomUUID().replaceAll('-','')}`,baseGeneration:generation,type:'MoveJunctions',moves:[...moves.values()]};
}
