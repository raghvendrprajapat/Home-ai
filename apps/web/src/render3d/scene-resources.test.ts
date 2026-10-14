import {it,expect,vi} from 'vitest';
import * as THREE from 'three';
import sample from '../../../../docs/examples/sample-project.json';
import type {ProjectDoc} from '@gharplan/core-model';
import {buildScene} from './mesh';
import {SceneAdapter,unitBoxGeometry} from './scene';
import fc from 'fast-check';
import * as batchModule from './batches';
import {materialBatches} from './batches';
const demo=()=>structuredClone(sample) as ProjectDoc;
it.each(['low','mid'] as const)('retains identical %s allocations and releases removed/replaced ownership exactly once',tier=>{
 const p=demo(),adapter=new SceneAdapter(tier),first=buildScene(p);adapter.apply(first,p);const baseline=adapter.resourceStats;
 const geometry=adapter.mesh(first.meshes[0]!.id)!.geometry,dispose=vi.spyOn(geometry,'dispose');
 for(let i=0;i<10;i++)adapter.apply(buildScene(p),p);expect(adapter.resourceStats).toEqual(baseline);expect(dispose).not.toHaveBeenCalled();
 p.walls[0]!.height+=100;adapter.apply(buildScene(p),p);expect(adapter.resourceStats.live).toBe(baseline.live);expect(adapter.resourceStats.created).toBeGreaterThan(baseline.created);
 p.furniture=p.furniture.slice(0,2);adapter.apply(buildScene(p),p);expect(adapter.group.children.some(c=>c instanceof THREE.InstancedMesh)).toBe(false);
 p.furniture=[];p.walls=[];p.rooms=[];p.openings=[];p.junctions=[];p.materials=[];adapter.apply(buildScene(p),p);expect(adapter.resourceStats).toMatchObject({live:3,references:3});
 adapter.dispose();adapter.dispose();expect(adapter.resourceStats.live).toBe(0);expect(adapter.resourceStats.created).toBe(adapter.resourceStats.disposed);expect(dispose).toHaveBeenCalledTimes(1);expect(()=>adapter.apply(first,demo())).toThrow('scene-closed');
});
it('a missing material fails closed and releases allocations created before the failure',()=>{
 const p=demo(),adapter=new SceneAdapter('low');adapter.apply(buildScene(p),p);const broken=buildScene(p);broken.meshes[0]!.groups[0]!.materialId='missing';expect(()=>adapter.apply(broken,p)).toThrow('scene-material');expect(adapter.group.visible).toBe(false);expect(adapter.group.children).toHaveLength(0);expect(adapter.resourceStats.live).toBe(0);expect(adapter.resourceStats.created).toBe(adapter.resourceStats.disposed);adapter.dispose();
});
it('50 adapters with replacement, furniture threshold changes and disposal return every owned resource to zero',()=>{
 const disposeCounts=new Map<object,number>();const g=THREE.BufferGeometry.prototype.dispose,m=THREE.Material.prototype.dispose;
 const gs=vi.spyOn(THREE.BufferGeometry.prototype,'dispose').mockImplementation(function(this:THREE.BufferGeometry){disposeCounts.set(this,(disposeCounts.get(this)??0)+1);g.call(this);});
 const ms=vi.spyOn(THREE.Material.prototype,'dispose').mockImplementation(function(this:THREE.Material){disposeCounts.set(this,(disposeCounts.get(this)??0)+1);m.call(this);});
 try{for(let i=0;i<50;i++){const p=demo(),adapter=new SceneAdapter(i%2?'low':'mid');adapter.apply(buildScene(p),p);p.furniture=p.furniture.slice(0,2);adapter.apply(buildScene(p),p);p.rooms[0]!.ceilingHeight+=100;adapter.apply(buildScene(p),p);adapter.dispose();adapter.dispose();expect(adapter.resourceStats).toMatchObject({live:0,references:0,closed:true});expect(adapter.resourceStats.created).toBe(adapter.resourceStats.disposed);}expect([...disposeCounts.values()].every(n=>n===1)).toBe(true);}finally{gs.mockRestore();ms.mockRestore();}
});
it('rolls back partial structural geometry, batch allocations and constructor-owned materials on allocation failures',()=>{
 const p=demo(),data=buildScene(p),disposed=new Set<object>(),geo=THREE.BufferGeometry.prototype.dispose,mat=THREE.Material.prototype.dispose;
 const gd=vi.spyOn(THREE.BufferGeometry.prototype,'dispose').mockImplementation(function(this:THREE.BufferGeometry){disposed.add(this);geo.call(this);});
 const md=vi.spyOn(THREE.Material.prototype,'dispose').mockImplementation(function(this:THREE.Material){disposed.add(this);mat.call(this);});
 const partial=new Set<THREE.BufferGeometry>();
 const injected=vi.spyOn(THREE.BufferGeometry.prototype,'setAttribute').mockImplementation(function(this:THREE.BufferGeometry){partial.add(this);throw Error('attribute-allocation');});
 try{expect(()=>new SceneAdapter()).toThrow('attribute-allocation');expect(partial.size).toBe(1);expect(disposed.has([...partial][0]!)).toBe(true);expect([...disposed].filter(o=>o instanceof THREE.Material)).toHaveLength(2);}
 finally{injected.mockRestore();gd.mockRestore();md.mockRestore();}
 const adapter=new SceneAdapter();const dispose=vi.spyOn(THREE.BufferGeometry.prototype,'dispose');const failure=vi.spyOn(THREE.BufferGeometry.prototype,'setAttribute').mockImplementation(()=>{throw Error('mesh-allocation');});
 try{expect(()=>adapter.apply(data,p)).toThrow('mesh-allocation');expect(dispose).toHaveBeenCalled();expect(adapter.resourceStats.live).toBe(0);expect(adapter.resourceStats.created).toBe(adapter.resourceStats.disposed);}finally{failure.mockRestore();dispose.mockRestore();}
});

it('unit cube has analytical outward normals/area/volume at arbitrary positive dimensions',()=>{
 fc.assert(fc.property(fc.integer({min:1,max:10000}),fc.integer({min:1,max:10000}),fc.integer({min:1,max:10000}),(w,h,d)=>{
 const geometry=unitBoxGeometry();geometry.scale(w,h,d);const p=geometry.getAttribute('position'),n=geometry.getAttribute('normal');let area=0,volume=0;for(let i=0;i<p.count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(p,i),b=new THREE.Vector3().fromBufferAttribute(p,i+1),c=new THREE.Vector3().fromBufferAttribute(p,i+2),normal=new THREE.Vector3().fromBufferAttribute(n,i),cross=b.clone().sub(a).cross(c.clone().sub(a));expect(cross.dot(normal)).toBeGreaterThan(0);area+=cross.length()/2;volume+=a.dot(b.clone().cross(c))/6;}expect(area).toBeCloseTo(2*(w*h+w*d+h*d),4);expect(volume).toBeCloseTo(w*h*d,2);geometry.dispose();}),{numRuns:100,seed:304});
});
it('batch helper releases earlier and partial geometries when a later batch allocation fails',()=>{
 const p=demo(),meshes=buildScene(p).meshes,disposed=new Set<object>(),allocated=new Set<object>(),original=THREE.BufferGeometry.prototype.setAttribute;
 const dispose=vi.spyOn(THREE.BufferGeometry.prototype,'dispose').mockImplementation(function(this:THREE.BufferGeometry){disposed.add(this);});
 const attributes=vi.spyOn(THREE.BufferGeometry.prototype,'setAttribute').mockImplementation(function(this:THREE.BufferGeometry,...args:Parameters<typeof original>){allocated.add(this);if(allocated.size===2)throw Error('batch-allocation');return original.apply(this,args);});
 try{expect(()=>materialBatches(meshes)).toThrow('batch-allocation');expect(allocated.size).toBe(2);expect(disposed).toEqual(allocated);}finally{dispose.mockRestore();attributes.mockRestore();}
});

it('batch allocation rollback attempts every geometry even when the first disposer throws',()=>{
 const allocated=new Set<THREE.BufferGeometry>(),attempted=new Set<THREE.BufferGeometry>(),set=THREE.BufferGeometry.prototype.setAttribute;
 const attributes=vi.spyOn(THREE.BufferGeometry.prototype,'setAttribute').mockImplementation(function(this:THREE.BufferGeometry,...args:Parameters<typeof set>){allocated.add(this);if(allocated.size===3)throw Error('third-allocation');return set.apply(this,args);});
 const dispose=vi.spyOn(THREE.BufferGeometry.prototype,'dispose').mockImplementation(function(this:THREE.BufferGeometry){attempted.add(this);if(attempted.size===1)throw Error('first-disposal');});
 try{expect(()=>materialBatches(buildScene(demo()).meshes)).toThrow('third-allocation');expect(allocated.size).toBe(3);expect(attempted).toEqual(allocated);}finally{attributes.mockRestore();dispose.mockRestore();}
});

it('adapter rollback attempts all returned unclaimed batches despite a throwing disposer',()=>{
 const geometries=[new THREE.BufferGeometry(),new THREE.BufferGeometry(),new THREE.BufferGeometry()],counts=[vi.spyOn(geometries[0]!,'dispose'),vi.spyOn(geometries[1]!,'dispose').mockImplementation(()=>{throw Error('unclaimed-disposal');}),vi.spyOn(geometries[2]!,'dispose')];
 const batches=vi.spyOn(batchModule,'materialBatches').mockReturnValue(geometries.map((geometry,i)=>({key:String(i),materialId:'missing',ceiling:false,geometry,ranges:[]})));
 const p=demo(),adapter=new SceneAdapter('low');
 try{expect(()=>adapter.apply(buildScene(p),p)).toThrow('unclaimed-disposal');for(const count of counts)expect(count).toHaveBeenCalledTimes(1);expect(adapter.resourceStats.live).toBe(0);expect(adapter.group.visible).toBe(false);}finally{batches.mockRestore();for(const count of counts)count.mockRestore();}
});
