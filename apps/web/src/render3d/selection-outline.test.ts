import {it,expect,vi} from 'vitest';
import * as THREE from 'three';
import fc from 'fast-check';
import sample from '../../../../docs/examples/sample-project.json';
import type {ProjectDoc} from '@gharplan/core-model';
import {SelectionOutline,outlineGeometry} from './selection-outline';
import {SceneAdapter} from './scene';
import {buildScene} from './mesh';
it('outline represents exact unit box edges at generated dimensions; no diagonal or duplicate edges',()=>{
 fc.assert(fc.property(fc.integer({min:1,max:6000}),fc.integer({min:1,max:6000}),fc.integer({min:1,max:6000}),(w,h,d)=>{
  const geometry=outlineGeometry();geometry.scale(w,h,d);const p=geometry.getAttribute('position'),unique=new Set<string>();expect(p.count).toBe(24);
  for(let i=0;i<p.count;i+=2){const a=new THREE.Vector3().fromBufferAttribute(p,i),b=new THREE.Vector3().fromBufferAttribute(p,i+1),delta=b.clone().sub(a);expect(delta.toArray().filter(n=>n!==0)).toHaveLength(1);expect([w,h,d]).toContain(delta.length());unique.add([a.toArray().join(','),b.toArray().join(',')].sort().join(':'));}expect(unique.size).toBe(12);geometry.computeBoundingBox();expect(geometry.boundingBox!.getSize(new THREE.Vector3()).toArray()).toEqual([w,h,d]);geometry.dispose();
 }),{numRuns:100,seed:305});
});
it('rotated/elevated instanced furniture selection has exact object matrix; repeated clear/select retains only two owners and closes once',()=>{
 const doc=structuredClone(sample) as ProjectDoc,f=doc.furniture[0]!;f.rotationDeg=37;f.elevation=300;const adapter=new SceneAdapter('low');adapter.apply(buildScene(doc),doc);const selection=new SelectionOutline();selection.set({kind:'furniture',id:f.id},adapter,doc);selection.group.updateWorldMatrix(true,true);const line=selection.group.children[0]!,actual=new THREE.Vector3(.5,.5,.5).applyMatrix4(line.matrixWorld),theta=37*Math.PI/180;
 expect(actual.x).toBeCloseTo((f.position.x+f.size.w/2*Math.cos(theta)-f.size.d/2*Math.sin(theta))/1000,9);expect(actual.y).toBeCloseTo((doc.floors[0]!.elevation+f.elevation+f.size.h)/1000,9);expect(actual.z).toBeCloseTo((f.position.y+f.size.w/2*Math.sin(theta)+f.size.d/2*Math.cos(theta))/1000,9);
 const stats=selection.resourceStats;for(let i=0;i<50;i++){selection.set(undefined,adapter,doc);expect(selection.group.visible).toBe(false);selection.set({kind:'furniture',id:f.id},adapter,doc);}expect(selection.resourceStats).toEqual(stats);expect(stats.live).toBe(2);selection.dispose();selection.dispose();expect(selection.resourceStats).toMatchObject({live:0,references:0,created:2,disposed:2,disposalFailures:0});adapter.dispose();
});
it('selection allocation failure closes partial owners and missing IDs create no resources',()=>{
 const doc=structuredClone(sample) as ProjectDoc,adapter=new SceneAdapter();adapter.apply(buildScene(doc),doc);const selection=new SelectionOutline();selection.set({kind:'furniture',id:'missing'},adapter,doc);expect(selection.resourceStats.created).toBe(0);const attribute=vi.spyOn(THREE.BufferGeometry.prototype,'setAttribute').mockImplementation(()=>{throw Error('outline-allocation');}),dispose=vi.spyOn(THREE.BufferGeometry.prototype,'dispose');try{expect(()=>selection.set({kind:'furniture',id:doc.furniture[0]!.id},adapter,doc)).toThrow('outline-allocation');expect(dispose).toHaveBeenCalled();expect(selection.resourceStats).toMatchObject({live:0,closed:true});}finally{attribute.mockRestore();dispose.mockRestore();adapter.dispose();}
});
