import {it,expect,vi} from 'vitest';
import * as THREE from 'three';
import sample from '../../../../docs/examples/sample-project.json';
import type {ProjectDoc} from '@gharplan/core-model';
import {CachedSceneBuilder} from './mesh';
import {SceneAdapter} from './scene';
import {triangleEntity} from './batches';
import type {EntityTriangleRange} from './batches';
function doc(){const d=structuredClone(sample) as ProjectDoc;for(const w of d.walls)w.leftMaterial=w.rightMaterial='m_paint_white';for(const r of d.rooms)r.floorMaterial='m_paint_white';return d;}
function structural(a:SceneAdapter){return a.group.children.filter((x):x is THREE.Mesh=>x instanceof THREE.Mesh&&x.userData.category!=='furniture-placeholder'&&x.userData.category!=='furniture-instances');}
it.each(['low','mid'] as const)('SYNC-005 %s paint splits/coalesces existing GPU groups without reallocating geometry or losing picking ownership',tier=>{
 const d=doc(),a=new SceneAdapter(tier),builder=new CachedSceneBuilder(),first=builder.build(d);a.apply(first,d);const initial=structural(a),geometries=initial.map(m=>m.geometry),attributes=geometries.map(g=>[g.getAttribute('position'),g.getAttribute('normal'),g.getAttribute('uv')]),dispose=geometries.map(g=>vi.spyOn(g,'dispose')),baseline=a.resourceStats;
 try{for(let cycle=0;cycle<20;cycle++){
  const blue=cycle%2===0;d.walls.find(w=>w.id==='w7')!.leftMaterial=blue?'m_paint_blue':'m_paint_white';d.rooms[0]!.floorMaterial=blue?'m_paint_blue':'m_paint_white';a.apply(builder.build(d),d);
  expect(structural(a)).toEqual(initial);for(let i=0;i<initial.length;i++){const m=initial[i]!;expect(m.geometry).toBe(geometries[i]);expect([m.geometry.getAttribute('position'),m.geometry.getAttribute('normal'),m.geometry.getAttribute('uv')]).toEqual(attributes[i]);for(let j=0;j<3;j++)expect([m.geometry.getAttribute('position'),m.geometry.getAttribute('normal'),m.geometry.getAttribute('uv')][j]).toBe(attributes[i]![j]);}
  expect(a.resourceStats.created).toBe(baseline.created);expect(a.resourceStats.disposed).toBe(baseline.disposed);expect(dispose.every(s=>s.mock.calls.length===0)).toBe(true);
  const visible=initial.filter(m=>m.visible),target=new THREE.Color(blue?'#bcd7ea':'#f4f4f2'),white=new THREE.Color('#f4f4f2');let inspected=0;
  for(const m of visible){const ranges=m.userData.entityRanges as EntityTriangleRange[]|undefined,n=m.geometry.getAttribute('normal'),materials=Array.isArray(m.material)?m.material:[m.material];for(let v=0;v<n.count;v+=3){const range=ranges?.find(r=>v/3>=r.start&&v/3<r.start+r.count),entity=range?.entityId??m.userData.entityId,category=range?.category??m.userData.category;if(ranges)expect(triangleEntity(ranges,v/3)).toBe(entity);const blueSide=category==='wall'&&entity==='w7'&&n.getX(v)>=0,blueFloor=category==='floor'&&entity==='r_living'||category==='threshold';const expected=blueSide||blueFloor?target:white,group=m.geometry.groups.find(g=>v>=g.start&&v<g.start+g.count)!;expect(group).toBeDefined();expect((materials[group.materialIndex!] as THREE.MeshStandardMaterial).color.equals(expected)).toBe(true);inspected++;}}
  expect(inspected).toBeGreaterThan(100);expect(a.lastChanges.replaced.sort()).toEqual(['floor:r_living','threshold:o_bed_door','threshold:o_main_door','wall:w7']);
 }
 expect(a.resourceStats).toEqual(baseline);
 }finally{a.dispose();}expect(dispose.every(s=>s.mock.calls.length===1)).toBe(true);expect(a.resourceStats).toMatchObject({live:0,references:0});expect(a.resourceStats.created).toBe(a.resourceStats.disposed);
});
it.each(['low','mid'] as const)('REN-003 %s actual UV/shape changes still replace GPU geometry after paint reuse',tier=>{
 const d=doc(),a=new SceneAdapter(tier),b=new CachedSceneBuilder();try{a.apply(b.build(d),d);const initial=a.mesh('wall:w7')!.geometry;d.walls.find(w=>w.id==='w7')!.leftMaterial='m_paint_blue';a.apply(b.build(d),d);expect(a.mesh('wall:w7')!.geometry).toBe(initial);const dispose=vi.spyOn(initial,'dispose');d.materials.find(m=>m.id==='m_paint_blue')!.uvScaleMm=500;a.apply(b.build(d),d);expect(a.mesh('wall:w7')!.geometry).not.toBe(initial);expect(dispose).toHaveBeenCalledTimes(1);const painted=a.mesh('wall:w7')!.geometry;d.walls.find(w=>w.id==='w7')!.height+=100;a.apply(b.build(d),d);expect(a.mesh('wall:w7')!.geometry).not.toBe(painted);}finally{a.dispose();}
});
it.each(['low','mid'] as const)('SYNC-005 %s failed binding acquisition closes every retained geometry/material exactly once',tier=>{
 const d=doc(),a=new SceneAdapter(tier),b=new CachedSceneBuilder();a.apply(b.build(d),d);const geometries=structural(a).map(m=>m.geometry),dispose=geometries.map(g=>vi.spyOn(g,'dispose')),next=b.build(d);next.meshes=next.meshes.map(m=>m.id==='wall:w7'?{...m,groups:m.groups.map(g=>({...g,materialId:'missing'}))}:m);expect(()=>a.apply(next,d)).toThrow('scene-material');expect(a.group.visible).toBe(false);expect(a.group.children).toHaveLength(0);expect(a.resourceStats).toMatchObject({live:0,references:0,closed:true});expect(a.resourceStats.created).toBe(a.resourceStats.disposed);expect(dispose.every(s=>s.mock.calls.length===1)).toBe(true);
});
it.each(['low','mid'] as const)('SYNC-005 %s late material acquisition failure and corrupt ranges cannot leak retained buffers',tier=>{
 for(const broken of ['late-material','coverage'] as const){const d=doc(),a=new SceneAdapter(tier),b=new CachedSceneBuilder();a.apply(b.build(d),d);const next=b.build(d);next.meshes=next.meshes.map(m=>m.id==='wall:w7'?{...m,groups:broken==='late-material'?[{start:0,count:3,materialId:'m_paint_white'},{start:3,count:m.positions.length/3-3,materialId:'missing'}]:[{start:0,count:3,materialId:'m_paint_white'}]}:m);expect(()=>a.apply(next,d)).toThrow(broken==='late-material'?'scene-material':'scene-binding-coverage');expect(a.resourceStats).toMatchObject({live:0,references:0,closed:true});expect(a.resourceStats.created).toBe(a.resourceStats.disposed);}
});
