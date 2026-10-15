import {it,expect} from 'vitest';
import * as THREE from 'three';
import fc from 'fast-check';
import sample from '../../../../docs/examples/sample-project.json';
import type {ProjectDoc} from '@gharplan/core-model';
import {SceneAdapter} from './scene';
import {buildScene} from './mesh';
import {openingBounds} from './camera';
import {pickRay,visibleMeshes,PickGesture} from './picking';
const demo=()=>structuredClone(sample) as ProjectDoc;
const down=(x:number,z:number,y=8)=>new THREE.Raycaster(new THREE.Vector3(x,y,z),new THREE.Vector3(0,-1,0));
it.each(['low','mid']as const)('actual %s structural rays resolve room IDs and never intersect hidden ceiling/original meshes',tier=>{
 const doc=demo();doc.furniture=[];const adapter=new SceneAdapter(tier);adapter.apply(buildScene(doc),doc);const wallRay=new THREE.Raycaster(new THREE.Vector3(1,1.5,-2),new THREE.Vector3(0,0,1));expect(pickRay(wallRay,adapter.group,doc)).toEqual({kind:'wall',id:'w1'});const ray=down(1,2);expect(pickRay(ray,adapter.group,doc)).toEqual({kind:'room',id:'r_living'});expect(visibleMeshes(adapter.group).every(m=>m.visible)).toBe(true);ray.far=6;expect(pickRay(ray,adapter.group,doc)).toBeNull();adapter.setCeilingsVisible(true);expect(pickRay(ray,adapter.group,doc)).toEqual({kind:'room',id:'r_living'});adapter.group.visible=false;expect(pickRay(down(1,2),adapter.group,doc)).toBeNull();adapter.dispose();
});
it('Low instance IDs resolve after reordered transforms and instancing threshold changes',()=>{
 const doc=demo();doc.walls=[];doc.rooms=[];doc.junctions=[];doc.openings=[];doc.furniture=doc.furniture.slice(0,3).map((f,i)=>({...f,id:'instance_'+i,position:{x:i*5000,y:0},rotationDeg:[0,90,37][i]!}));const adapter=new SceneAdapter('low');adapter.apply(buildScene(doc),doc);
 for(let i=0;i<3;i++)expect(pickRay(down(i*5,0),adapter.group,doc)).toEqual({kind:'furniture',id:'instance_'+i});doc.furniture.reverse();adapter.apply(buildScene(doc),doc);expect(pickRay(down(5,0),adapter.group,doc)).toEqual({kind:'furniture',id:'instance_1'});doc.furniture=doc.furniture.slice(0,2);adapter.apply(buildScene(doc),doc);for(const f of doc.furniture)expect(pickRay(down(f.position.x/1000,0),adapter.group,doc)).toEqual({kind:'furniture',id:f.id});adapter.dispose();
});
it('logical opening void is selectable without a solid mesh; closer furniture still occludes it',()=>{
 const doc=demo();doc.furniture=[];const adapter=new SceneAdapter('low');adapter.apply(buildScene(doc),doc);const opening=doc.openings[0]!,b=openingBounds(doc,opening.id)!,x=(b[0]+b[3])/2,y=(b[1]+b[4])/2,ray=new THREE.Raycaster(new THREE.Vector3(x,y,b[2]-2),new THREE.Vector3(0,0,1));expect(pickRay(ray,adapter.group,doc)).toEqual({kind:'opening',id:opening.id});ray.far=1.9;expect(pickRay(ray,adapter.group,doc)).toBeNull();ray.far=Infinity;
 doc.furniture=[{...demo().furniture[0]!,id:'in_front',position:{x:Math.round(x*1000),y:Math.round((b[2]-1)*1000)},size:{w:500,d:500,h:3000}}];adapter.apply(buildScene(doc),doc);expect(pickRay(ray,adapter.group,doc)).toEqual({kind:'furniture',id:'in_front'});adapter.dispose();
});
it('rotated furniture rays obey independently computed clockwise plan corners',()=>{
 fc.assert(fc.property(fc.integer({min:100,max:4000}),fc.integer({min:100,max:4000}),fc.integer({min:0,max:359}),(w,d,angle)=>{
  const doc=demo();doc.walls=[];doc.junctions=[];doc.rooms=[];doc.openings=[];doc.furniture=[{...doc.furniture[0]!,position:{x:1000,y:2000},size:{w,d,h:1000},rotationDeg:angle}];const adapter=new SceneAdapter();adapter.apply(buildScene(doc),doc);const theta=angle*Math.PI/180,id=doc.furniture[0]!.id;
  const inside={x:1+w/4000*Math.cos(theta),z:2+w/4000*Math.sin(theta)},outside={x:1+(w/2000+.01)*Math.cos(theta),z:2+(w/2000+.01)*Math.sin(theta)};expect(pickRay(down(inside.x,inside.z),adapter.group,doc)).toEqual({kind:'furniture',id});expect(pickRay(down(outside.x,outside.z),adapter.group,doc)).toBeNull();adapter.dispose();
 }),{numRuns:100,seed:305});
});
it('gesture ownership rejects orbit, pinch, outside fingers, cancellation and stale tags; release restores fresh picking',()=>{
 const g=new PickGesture();g.begin(1,[0,0],'a');expect(g.end(1,[0,0],'a')).toBe(true);g.begin(1,[0,0],'a');g.move(1,[7,0]);expect(g.end(1,[0,0],'a')).toBe(false);g.begin(1,[0,0],'a');expect(g.end(1,[0,0],'b')).toBe(false);g.begin(1,[0,0],'a');g.begin(2,[0,0],'a');expect(g.end(2,[0,0],'a')).toBe(false);expect(g.end(1,[0,0],'a')).toBe(false);g.begin(2,[0,0],'a',false);g.begin(1,[0,0],'a');g.cancel();expect(g.end(2,[0,0],'a')).toBe(false);expect(g.end(1,[0,0],'a')).toBe(false);g.begin(1,[0,0],'a');expect(g.end(99,[0,0],'a')).toBe(false);expect(g.end(1,[0,0],'a')).toBe(true);g.begin(1,[0,0],'a');g.clear();expect(g.end(1,[0,0],'a')).toBe(false);
});

it('interruption cancels the candidate while physically held IDs block a later finger until every release',()=>{
 const g=new PickGesture();g.begin(1,[0,0],'tag');g.cancel();g.begin(2,[0,0],'tag');expect(g.end(2,[0,0],'tag')).toBe(false);expect(g.end(1,[0,0],'tag')).toBe(false);g.begin(3,[0,0],'tag');expect(g.end(3,[0,0],'tag')).toBe(true);
});
