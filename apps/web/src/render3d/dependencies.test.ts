import {expect,it} from 'vitest';
import fc from 'fast-check';
import {ProjectStore,canonicalStringify} from '@gharplan/core-model';
import type {ProjectDoc} from '@gharplan/core-model';
import sample from '../../../../docs/examples/sample-project.json';
import {geometryDependencies,sceneInvalidation} from './dependencies';
import {CachedSceneBuilder} from './mesh';
const doc=()=>structuredClone(sample) as ProjectDoc;
it('SYNC-001 metadata/material display edits skip geometry; UV and real geometry remain dependencies',()=>{
 const a=doc(),b=doc(),builder=new CachedSceneBuilder(),first=builder.build(a);
 b.name='Renamed';b.units='imperial';b.rooms[0]!.name='Different';b.rooms[0]!.type='other';b.rooms[0]!.rev++;b.walls[0]!.rev++;b.materials[0]!.baseColor='#111111';b.materials[0]!.roughness=.4;b.materials[0]!.metalness=.5;b.materials[0]!.name='Changed material';b.floors[0]!.name='Renamed floor';b.floors[0]!.defaultWallHeight=4000;
 expect(geometryDependencies(b)).toEqual(geometryDependencies(a));const next=builder.build(b);expect(next.stats.meshesBuilt).toBe(0);expect(next.meshes).toBe(first.meshes);expect(next.invalidation!.geometryChanged).toBe(false);expect(next.invalidation!.dirtyEntityIds).toEqual([]);expect(next.invalidation!.materialIds).toEqual([b.materials[0]!.id]);
 b.materials[0]!.uvScaleMm=750;const uv=builder.build(b);expect(uv.invalidation!.geometryChanged).toBe(true);expect(uv.stats.meshesBuilt).toBeGreaterThan(0);
});
it('SYNC-001 graph expands moved junctions through old/new incident caps, openings and rooms',()=>{
 const a=doc(),store=new ProjectStore(a,'graph_junction');expect(store.execute({type:'MoveJunctions',moves:[{junction:'j2',to:[4600,0]},{junction:'j5',to:[4600,5000]}],id:'graph_move',baseGeneration:0}).ok).toBe(true);const b=structuredClone(store.getSnapshot().document) as ProjectDoc,p=sceneInvalidation(a,b);expect(p.geometryChanged).toBe(true);
 for(const id of ['j2','j5','w1','w2','w4','w5','w7','r_living','r_bed',...a.openings.filter(o=>o.wallId==='w7').map(o=>o.id)])expect(p.dirtyEntityIds).toContain(id);
});
it('SYNC-001 room finish propagates to hosted door threshold; elevation invalidates surfaces and furniture; removed links remain tracked',()=>{
 const a=doc(),b=doc();b.rooms[0]!.floorMaterial=b.materials.find(m=>m.id!==b.rooms[0]!.floorMaterial)!.id;const room=sceneInvalidation(a,b);expect(room.dirtyEntityIds).toContain(b.rooms[0]!.id);const doors=b.openings.filter(o=>o.kind==='door'&&b.walls.some(w=>w.id===o.wallId&&b.rooms[0]!.boundary.includes(w.a)&&b.rooms[0]!.boundary.includes(w.b)));expect(doors.length).toBeGreaterThan(0);for(const o of doors)expect(room.dirtyEntityIds).toContain(o.id);
 b.floors[0]!.elevation=1000;const floor=sceneInvalidation(a,b);for(const e of [...b.walls,...b.rooms,...b.openings])expect(floor.dirtyEntityIds).toContain(e.id);expect(floor.furnitureIds).toEqual(b.furniture.map(f=>f.id).sort());
 const deleted=doc(),opening=deleted.openings.pop()!;const removal=sceneInvalidation(a,deleted);expect(removal.removedIds).toEqual([opening.id]);expect(removal.dirtyEntityIds).toContain(opening.wallId);expect(removal.dirtyEntityIds).toContain(opening.id);
});
it('SYNC-001 property metadata changes preserve exact projected signature and cached geometry',()=>{
 fc.assert(fc.property(fc.string({maxLength:30}),fc.integer({min:0,max:10000}),(name,rev)=>{const a=doc(),b=doc();b.rooms.forEach(r=>{r.name=name;r.rev=rev;r.type='other';});b.walls.forEach(w=>{w.rev=rev;});b.name=name;expect(canonicalStringify(geometryDependencies(b))).toBe(canonicalStringify(geometryDependencies(a)));expect(sceneInvalidation(a,b).geometryChanged).toBe(false);}),{numRuns:100,seed:33202});
});
