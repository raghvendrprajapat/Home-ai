import {expect,it,vi} from 'vitest';
import fc from 'fast-check';
import * as THREE from 'three';
import {parseProject} from '@gharplan/core-model';
import type {ProjectDoc} from '@gharplan/core-model';
import fixture from '../../../../docs/examples/sample-project.json';
import {BoundedPointLights,lightSources,mood} from './night-lighting';

// Codex-authored. Analytic values from the original lamp sources and sample placements, not independent fixtures.
function sample():ProjectDoc{
 const result=parseProject(JSON.stringify(fixture));if(!result.ok)throw new Error('sample');const d=structuredClone(result.document) as ProjectDoc;
 d.furniture=[
  {id:'fu_floor_lamp',floorId:'f0',assetId:'a_l0_floor_lamp',assetVersion:1,position:{x:3350,y:2250},elevation:0,rotationDeg:0,size:{w:400,d:400,h:1600},materialOverrides:{},rev:0},
  {id:'fu_table_lamp',floorId:'f0',assetId:'a_l0_table_lamp',assetVersion:1,position:{x:5295,y:340},elevation:520,rotationDeg:0,size:{w:260,d:260,h:450},materialOverrides:{},rev:0},
 ];return d;
}
it('D81 shade centres follow the actual sample lamps; Low stays unlit and daytime keeps existing tier budgets',()=>{
 const d=sample(),before=JSON.stringify(d);
 expect(lightSources(d,'mid','night','f0').map(s=>[s.id,s.position,s.intensity])).toEqual([
  ['furniture:fu_floor_lamp',[3.35,1.46,2.25],35],['furniture:fu_table_lamp',[5.295,.88,.34],20],
 ]);
 for(const mode of ['day','warm','night'] as const)expect(lightSources(d,'low',mode,'f0')).toEqual([]);
 for(const mode of ['day','warm'] as const){expect(lightSources(d,'mid',mode,'f0')).toEqual([]);expect(lightSources(d,'high',mode,'f0').map(s=>[s.id,s.position,s.intensity])).toEqual([
  ['light:l_bed',[6.25,2.9,3.5],1],['light:l_living',[2.25,2.9,2.5],1.5],
 ]);}
 expect(JSON.stringify(d)).toBe(before);
});
it('D81 elevated floors, resized lamps and low-wall visibility; deleted/unrecognised lamps do not emit',()=>{
 const d=sample();d.floors[0]!.elevation=3200;
 const lamp=d.furniture.find(f=>f.id==='fu_table_lamp')!;lamp.size.h=900;lamp.elevation=700;lamp.position={x:8000,y:9000};
 expect(lightSources(d,'mid','night','f0').find(s=>s.id.endsWith(lamp.id))!.position).toEqual([8,4.62,9]);
 expect(lightSources(d,'mid','night','f0',1000).map(s=>s.id)).not.toContain('furniture:fu_table_lamp');
 lamp.assetVersion=2;expect(lightSources(d,'mid','night','f0').map(s=>s.id)).not.toContain('furniture:fu_table_lamp');
 d.furniture=[];expect(lightSources(d,'mid','night','f0').map(s=>s.id)).toEqual(['light:l_bed','light:l_living']);
 d.lights=[];expect(lightSources(d,'mid','night','f0')).toEqual([]);
 d.floors.push({...d.floors[0]!,id:'upper',level:1,elevation:6200});
 expect(lightSources(d,'mid','night','upper')).toEqual([]);
});
it('D81 property: arbitrary translations/elevations/yaws keep the bulb at the scaled centre; deterministic two-light cap',()=>{
 fc.assert(fc.property(fc.integer({min:-100000,max:100000}),fc.integer({min:-100000,max:100000}),fc.integer({min:0,max:15000}),fc.integer({min:1,max:20}),fc.integer({min:0,max:359}),(x,y,z,n,yaw)=>{
  const d=sample(),lamp=d.furniture.find(f=>f.id==='fu_table_lamp')!;d.lights=[];d.floors[0]!.elevation=z;lamp.position={x,y};lamp.elevation=500;lamp.size.h=450*n;lamp.rotationDeg=yaw;d.furniture=[lamp];
  expect(lightSources(d,'mid','night','f0')[0]!.position).toEqual([x/1000,(z+500+360*n)/1000,y/1000]);
  d.furniture=Array.from({length:30},(_,i)=>({...lamp,id:`lamp_${i}`}));
  const sources=lightSources(d,'mid','night','f0');expect(sources).toHaveLength(2);d.furniture.reverse();expect(lightSources(d,'mid','night','f0')).toEqual(sources);
 }),{numRuns:100,seed:81021});
});
it('D81 actual Three lights are reused, follow edits and are detached/disposed exactly once',()=>{
 const scene=new THREE.Scene(),rig=new BoundedPointLights(scene),sources=lightSources(sample(),'mid','night','f0');rig.set(sources);
 const lights=[...scene.children] as THREE.PointLight[],dispose=lights.map(l=>vi.spyOn(l,'dispose'));
 rig.set(sources.map(s=>({...s,position:[s.position[0]+1,s.position[1],s.position[2]]})));
 expect(scene.children).toEqual(lights);expect(lights[0]!.position.toArray()).toEqual([4.35,1.46,2.25]);
 expect(rig.snapshot.every(l=>l.castsShadow===false)).toBe(true);
 expect(()=>rig.set([...sources,sources[0]!])).toThrow('point-light-budget');expect(scene.children).toHaveLength(2);
 rig.close();rig.close();rig.set(sources);expect(scene.children).toHaveLength(0);expect(rig.snapshot).toEqual([]);for(const spy of dispose)expect(spy).toHaveBeenCalledTimes(1);
});
it('D81 day and warm restore original settings before/after HDRI; night remains bounded and visibly distinct',()=>{
 expect(mood('day',false)).toEqual({background:'#f1f2ee',sunColor:'#fff1dc',sun:3.3,hemisphere:2.1,environment:.6});
 expect(mood('warm',true)).toEqual({background:'#f1f2ee',sunColor:'#ffd9ad',sun:2.2,hemisphere:.45,environment:.6});
 expect(mood('night',true)).toEqual(mood('night',false));expect(mood('night',true).sun).toBeLessThan(.2);expect(mood('night',true).environment).toBeLessThan(.1);
});
