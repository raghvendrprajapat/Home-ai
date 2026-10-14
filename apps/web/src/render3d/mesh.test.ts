import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import * as THREE from 'three';
import { ProjectStore, serializeProject } from '@gharplan/core-model';
import type { ProjectDoc } from '@gharplan/core-model';
import sample from '../../../../docs/examples/sample-project.json';
import twoSquares from '../../../../tests/fixtures/independent/geometry/two-squares.json';
import { buildScene, CachedSceneBuilder, openingRect, subtractRectangle } from './mesh';
import { bufferGeometry, SceneAdapter } from './scene';
import type { MeshData, SceneBundle } from './types';

const demo = (): ProjectDoc => structuredClone(sample) as ProjectDoc;
function single(length = 4000, thickness = 200, height = 3000): ProjectDoc {
  const p = demo(); p.junctions = [{ id: 'j1', floorId: 'f0', x: 0, y: 0 }, { id: 'j2', floorId: 'f0', x: length, y: 0 }];
  p.walls = [{ ...p.walls[0]!, a: 'j1', b: 'j2', thickness, height }]; p.openings = []; p.rooms = []; p.furniture = []; return p;
}
function rectangle(w: number, d: number, t: number, h: number): ProjectDoc {
  const p = single(w, t, h); p.junctions.push({ id: 'j3', floorId: 'f0', x: w, y: d }, { id: 'j4', floorId: 'f0', x: 0, y: d });
  p.walls = [['j1', 'j2'], ['j2', 'j3'], ['j3', 'j4'], ['j4', 'j1']].map(([a, b], i) => ({ ...p.walls[0]!, id: `w${i + 1}`, a: a!, b: b! }));
  p.rooms = [{ ...demo().rooms[0]!, boundary: ['j1', 'j2', 'j3', 'j4'] }]; return p;
}
function triangles(mesh: MeshData): THREE.Triangle[] {
  const ts: THREE.Triangle[] = [];
  for (let i = 0; i < mesh.positions.length; i += 9) ts.push(new THREE.Triangle(new THREE.Vector3(...mesh.positions.slice(i, i + 3)), new THREE.Vector3(...mesh.positions.slice(i + 3, i + 6)), new THREE.Vector3(...mesh.positions.slice(i + 6, i + 9))));
  return ts;
}
function area(mesh: MeshData): number { return triangles(mesh).reduce((sum, t) => sum + t.getArea(), 0) * 1_000_000; }
function volume(bundle: SceneBundle): number {
  return bundle.meshes.filter(m => m.category === 'wall').flatMap(triangles).reduce((sum, t) => sum + t.a.dot(t.b.clone().cross(t.c)) / 6, 0) * 1_000_000_000;
}
function closed(bundle: SceneBundle): void {
  const edges = new Map<string, number>(), oriented = new Map<string, number>();
  const key = (p: THREE.Vector3) => p.toArray().map(n => Math.round(n * 1_000_000)).join(',');
  for (const mesh of bundle.meshes.filter(m => m.category === 'wall')) for (const t of triangles(mesh)) {
    expect(t.getArea()).toBeGreaterThan(0);
    for (const [a, b] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]] as const) {
      const ka = key(a), kb = key(b), e = [ka, kb].sort().join('|');
      edges.set(e, (edges.get(e) ?? 0) + 1); oriented.set(e, (oriented.get(e) ?? 0) + (ka < kb ? 1 : -1));
    }
  }
  expect([...edges.values()].every(n => n === 2)).toBe(true); expect([...oriented.values()].every(n => n === 0)).toBe(true);
}
function hits(bundle: SceneBundle, origin: [number, number, number], direction: [number, number, number]): THREE.Intersection[] {
  const meshes = bundle.meshes.filter(m => m.category === 'wall').map(data => new THREE.Mesh(bufferGeometry(data), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })));
  const result = new THREE.Raycaster(new THREE.Vector3(...origin), new THREE.Vector3(...direction).normalize(), 0, 0.6).intersectObjects(meshes);
  meshes.forEach(m => { m.geometry.dispose(); m.material.dispose(); }); return result;
}
describe('PH0-T05 analytic mesh proofs (Codex-authored unless explicitly named)', () => {
  it('rectangle subtraction conserves exact area without overlaps', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 1000 }), fc.integer({ min: 1, max: 1000 }), (w, h) => {
      const result = subtractRectangle([0, 0, 2000, 2000], [500, 500, 500 + w, 500 + h]);
      expect(result.reduce((n, r) => n + (r[2] - r[0]) * (r[3] - r[1]), 0)).toBe(4_000_000 - w * h);
      for (let i = 0; i < result.length; i++) for (let j = i + 1; j < result.length; j++) {
        const a = result[i]!, b = result[j]!; expect(Math.min(a[2], b[2]) <= Math.max(a[0], b[0]) || Math.min(a[3], b[3]) <= Math.max(a[1], b[1])).toBe(true);
      }
    }), { seed: 20261011, numRuns: 300 });
  });
  it('D18 free caps and random box volumes/winding are analytic and closed', () => {
    fc.assert(fc.property(fc.integer({ min: 1000, max: 9000 }), fc.integer({ min: 50, max: 1000 }), fc.integer({ min: 1000, max: 6000 }), (l, t, h) => {
      const b = buildScene(single(l, t, h)); expect(b.stats.wallVolumeMm3).toBe((l + t) * t * h);
      expect(Math.abs(volume(b) - (l + t) * t * h)).toBeLessThan(0.1); closed(b);
      expect(b.bounds).toEqual([-t / 2000, 0, -t / 2000, (l + t / 2) / 1000, h / 1000, t / 2000]);
    }), { seed: 20261011, numRuns: 100 });
  });
  it('openingRect is exact along all four host directions and preserves position after reversal', () => {
    fc.assert(fc.property(fc.integer({ min: 2000, max: 9000 }), fc.integer({ min: 50, max: 1000 }), fc.boolean(), fc.boolean(), (length, thickness, vertical, reverse) => {
      const p = single(length, thickness), wall = p.walls[0]!, opening = { ...demo().openings[2]!, wallId: wall.id, offset: Math.floor(length / 2), width: 500 };
      if (vertical) { p.junctions[1]!.x = 0; p.junctions[1]!.y = length; }
      const offset = opening.offset, expected = vertical ? [-thickness / 2, offset - 250, thickness / 2, offset + 250] : [offset - 250, -thickness / 2, offset + 250, thickness / 2];
      if (reverse) { [wall.a, wall.b] = [wall.b, wall.a]; opening.offset = length - opening.offset; }
      expect(openingRect(p, wall, opening)).toEqual(expected);
    }), { seed: 20261011, numRuns: 200 });
  });
  it('material sides follow a→b; normals face outward and UV scale continues in world coordinates', () => {
    const p = single(); p.materials[0]!.uvScaleMm = 600; const b = buildScene(p), m = b.meshes[0]!;
    for (let i = 0; i < m.positions.length; i += 9) {
      const a = new THREE.Vector3().fromArray(m.positions, i), c = new THREE.Vector3().fromArray(m.positions, i + 3), d = new THREE.Vector3().fromArray(m.positions, i + 6);
      const normal = new THREE.Triangle(a, c, d).getNormal(new THREE.Vector3()); expect(normal.dot(new THREE.Vector3().fromArray(m.normals, i))).toBeCloseTo(1, 8);
    }
    for (const group of m.groups) for (let i = group.start; i < group.start + group.count; i++) {
      const nz = m.normals[i * 3 + 2]!;
      if (nz === -1) { expect(group.materialId).toBe('m_ext'); expect(m.uv[i * 2]).toBeCloseTo(m.positions[i * 3]! * 1000 / 600, 5); }
      if (nz === 1) expect(group.materialId).toBe('m_paint_white');
    }
  });
  it('L corners enclose the exact solid ring and floors keep positive small rooms', () => {
    fc.assert(fc.property(fc.integer({ min: 1500, max: 7000 }), fc.integer({ min: 1500, max: 7000 }), fc.integer({ min: 50, max: 999 }), (w, d, t) => {
      const b = buildScene(rectangle(w, d, t, 3000)), expected = 2 * t * (w + d) * 3000;
      expect(b.stats.wallVolumeMm3).toBe(expected); expect(Math.abs(volume(b) - expected)).toBeLessThan(0.1); closed(b);
      expect(Math.abs(area(b.meshes.find(m => m.category === 'floor')!) - (w - t) * (d - t))).toBeLessThan(0.001);
    }), { seed: 20261011, numRuns: 100 });
    const small = buildScene(rectangle(700, 699, 200, 3000)); expect(Math.round(area(small.meshes.find(m => m.category === 'floor')!))).toBe(249500);
  });
  it('SYNC-002 sample holes, lintels, sills and thresholds are structural surfaces', () => {
    const p = demo(), b = buildScene(p); closed(b);
    expect(b.meshes.filter(m => m.category === 'wall')).toHaveLength(7);
    expect(b.meshes.filter(m => m.category === 'floor')).toHaveLength(2); expect(b.meshes.filter(m => m.category === 'threshold')).toHaveLength(2);
    expect(Math.round(area(b.meshes.find(m => m.id === 'floor:r_living')!))).toBe(20642175);
    expect(Math.round(area(b.meshes.find(m => m.id === 'floor:r_bed')!))).toBe(15872175);
    expect(hits(b, [4.2, 1, 1], [1, 0, 0])).toHaveLength(0); // shared door
    expect(hits(b, [4.2, 2.5, 1], [1, 0, 0]).length).toBeGreaterThan(0); // lintel
    expect(hits(b, [2.25, 1.5, -0.3], [0, 0, 1])).toHaveLength(0); // window
    expect(hits(b, [2.25, 0.5, -0.3], [0, 0, 1]).length).toBeGreaterThan(0); // sill
    expect(hits(b, [3.1, 1.5, -0.3], [0, 0, 1]).length).toBeGreaterThan(0); // jamb
    expect(Math.round(area(b.meshes.find(m => m.id === 'threshold:o_bed_door')!))).toBe(103500);
    expect(b.meshes.some(m => m.id === 'threshold:o_win_living')).toBe(false);
  });
  it('accepted Claude PR #60 TWOSQ-03 renders its unchanged 180000 mm² threshold', () => {
    const fixture = twoSquares.cases[0]!, p = demo(), opening = twoSquares.cases[2]!.operation.withOpening!;
    if (typeof fixture.plan === 'string') throw new Error('Expected the accepted base plan.');
    p.junctions = fixture.plan.junctions.map(j => ({ ...j, floorId: 'f0' }));
    p.walls = fixture.plan.walls.map(w => ({ ...p.walls[0]!, ...w }));
    p.rooms = fixture.plan.rooms.map(r => ({ ...p.rooms[0]!, ...r }));
    if (opening.kind !== 'door') throw new Error('Expected the accepted door case.');
    p.furniture = []; p.openings = [{ ...demo().openings[1]!, ...opening, kind: opening.kind }];
    const b = buildScene(p); closed(b);
    expect(Math.round(area(b.meshes.find(m => m.category === 'threshold')!))).toBe(twoSquares.cases[2]!.expect.thresholdAreaMm2);
    expect(b.meshes.filter(m => m.category === 'floor').map(m => Math.round(area(m)))).toEqual(twoSquares.cases[2]!.expect.faces!.map(f => f.clearAreaMm2));
  });
  it('SYNC-002 reversed hosts preserve hole location; width/offset/sill changes update probes', () => {
    const store = new ProjectStore(demo(), 'mesh_reverse'), before = openingRect(demo(), demo().walls[6]!, demo().openings[1]!);
    expect(store.execute({ type: 'ReverseWall', wallId: 'w7', id: 'reverse', baseGeneration: 0 }).ok).toBe(true);
    const p = structuredClone(store.getSnapshot().document) as ProjectDoc;
    expect(openingRect(p, p.walls[6]!, p.openings[1]!)).toEqual(before);
    expect(hits(buildScene(p), [4.2, 1, 1], [1, 0, 0])).toHaveLength(0);
    const edit = new ProjectStore(single(), 'openings');
    const opening = { ...demo().openings[2]!, id: 'window', wallId: 'w1', offset: 2000, width: 1000 };
    expect(edit.execute({ type: 'AddOpening', opening, id: 'window_add', baseGeneration: 0 }).ok).toBe(true);
    expect(edit.execute({ type: 'UpdateOpening', openingId: 'window', properties: { offset: 2500, width: 800, sill: 1200 }, id: 'window_edit', baseGeneration: 1 }).ok).toBe(true);
    const b = buildScene(structuredClone(edit.getSnapshot().document) as ProjectDoc);
    expect(hits(b, [2.5, 1.5, -0.3], [0, 0, 1])).toHaveLength(0);
    expect(hits(b, [2.5, 1, -0.3], [0, 0, 1]).length).toBeGreaterThan(0); closed(b);
  });
  it('different-height T junctions use active-band caps and expose only the union', () => {
    const p = single(); p.junctions.push({ id: 'j3', floorId: 'f0', x: 0, y: 4000 }, { id: 'j4', floorId: 'f0', x: -4000, y: 0 });
    p.walls.push({ ...p.walls[0]!, id: 'w2', a: 'j1', b: 'j3', thickness: 1000, height: 1000 }, { ...p.walls[0]!, id: 'w3', a: 'j4', b: 'j1' });
    const b = buildScene(p); closed(b);
    // Low union: 8200x200 arms + (4000+100 junction+500 free cap)x1000 spur,
    // minus their 1000x200 intersection. This is Codex arithmetic, not a fixture edit.
    // High union: collinear arms form one 8200x200 strip.
    const expected = (8200 * 200 + 4600 * 1000 - 1000 * 200) * 1000 + 8200 * 200 * 2000;
    expect(b.stats.wallVolumeMm3).toBe(expected); expect(Math.abs(volume(b) - expected)).toBeLessThan(0.1);
  });
  it('SYNC-001 adapter keeps unaffected geometry; undo and a reused entity rev cannot leave stale meshes', () => {
    const store = new ProjectStore(demo(), 'mesh_dirty'), adapter = new SceneAdapter();
    const apply = () => adapter.apply(buildScene(structuredClone(store.getSnapshot().document) as ProjectDoc), store.getSnapshot().document);
    apply(); const old = adapter.mesh('wall:w6')!.geometry;
    expect(store.execute({ type: 'MoveJunctions', moves: [{ junction: 'j2', to: [4600, 0] }, { junction: 'j5', to: [4600, 5000] }], id: 'move_one', baseGeneration: 0 }).ok).toBe(true);
    apply(); expect(adapter.mesh('wall:w6')!.geometry).toBe(old);
    expect(adapter.lastChanges.replaced).toContain('wall:w7'); expect(adapter.lastChanges.kept).toContain('wall:w6');
    expect(Math.round(area(buildScene(structuredClone(store.getSnapshot().document) as ProjectDoc).meshes.find(m => m.id === 'floor:r_living')!))).toBe(21119175);
    store.undo(); apply(); const firstRevision = store.getSnapshot().document.walls[6]!.rev;
    expect(store.execute({ type: 'MoveJunctions', moves: [{ junction: 'j2', to: [4400, 0] }, { junction: 'j5', to: [4400, 5000] }], id: 'move_two', baseGeneration: 2 }).ok).toBe(true);
    apply(); expect(store.getSnapshot().document.walls[6]!.rev).toBe(firstRevision + 1);
    const bounds = adapter.mesh('wall:w7')!.geometry.boundingBox!; expect(Math.abs((bounds.min.x + bounds.max.x) / 2 - 4.4)).toBeLessThan(0.001);
    expect(adapter.mesh('wall:w6')!.geometry).toBe(old); adapter.dispose();
  });
  it('mesh generation never mutates the canonical document; serialization excludes render objects', () => {
    const store = new ProjectStore(demo(), 'immutable'), before = serializeProject(store.getSnapshot().document);
    buildScene(structuredClone(store.getSnapshot().document) as ProjectDoc);
    expect(serializeProject(store.getSnapshot().document)).toBe(before); expect(before).not.toContain('positions');
  });
  it('opening sill changes build only dependent buffers; unrelated GPU meshes retain identity', () => {
    const builder = new CachedSceneBuilder(), store = new ProjectStore(demo(), 'sill_dirty'), adapter = new SceneAdapter();
    const doc = () => structuredClone(store.getSnapshot().document) as ProjectDoc;
    const first = builder.build(doc()); adapter.apply(first, store.getSnapshot().document);
    const old = new Map(first.meshes.map(m => [m.id, adapter.mesh(m.id)!.geometry]));
    expect(store.execute({ type: 'UpdateOpening', openingId: 'o_win_living', properties: { sill: 901 }, id: 'sill_edit', baseGeneration: 0 }).ok).toBe(true);
    const next = builder.build(doc()); adapter.apply(next, store.getSnapshot().document); closed(next);
    expect(next.stats.meshesBuilt).toBe(1); expect(adapter.lastChanges.replaced).toEqual(['wall:w1']);
    for (const [id, geometry] of old) if (id !== 'wall:w1') expect(adapter.mesh(id)!.geometry).toBe(geometry);
    expect(store.execute({ type: 'RenameProject', name: 'Renamed', id: 'rename', baseGeneration: 1 }).ok).toBe(true);
    expect(builder.build(doc()).stats.meshesBuilt).toBe(0);
    expect(store.execute({ type: 'UpdateFurniture', furnitureId: 'fu_sofa', properties: { rotationDeg: 90 }, id: 'furniture_rotate', baseGeneration: 2 }).ok).toBe(true);
    expect(builder.build(doc()).stats.meshesBuilt).toBe(0);
    store.undo(); store.undo(); store.undo(); const restored = builder.build(doc());
    expect(restored.stats.meshesBuilt).toBe(1); expect(Math.abs(volume(restored) - volume(first))).toBeLessThan(0.1); adapter.dispose();
  });
});

it('PH2-T04 SYNC-002 Codex analytic room door/window void volumes, sills, reverse/delete and reload agree',()=>{
 const store=new ProjectStore(rectangle(4000,3000,200,3000),'opening_mesh'),baseline=store.getSnapshot().document;
 const add=(id:string,kind:'door'|'window',offset:number,width:number,height:number,sill:number)=>store.execute({id:`add_${id}`,baseGeneration:store.getSnapshot().localGeneration,type:'AddOpening',opening:{id,wallId:'w1',kind,assetId:'own_parametric_symbol',offset,width,height,sill,flipX:false,flipY:false}});
 expect(add('test_door','door',1000,900,2100,0).ok).toBe(true);expect(add('test_window','window',2700,1000,1200,900).ok).toBe(true);
 const document=structuredClone(store.getSnapshot().document) as ProjectDoc,bundle=buildScene(document);
 // (4200*3200 -3800*2800)*3000 -900*200*2100 -1000*200*1200.
 expect(bundle.stats.wallVolumeMm3).toBe(7782000000);expect(Math.abs(volume(bundle)-7782000000)).toBeLessThan(0.1);closed(bundle);
 expect(hits(bundle,[1,1,-0.3],[0,0,1])).toHaveLength(0);expect(hits(bundle,[2.7,1.4,-0.3],[0,0,1])).toHaveLength(0);expect(hits(bundle,[2.7,0.5,-0.3],[0,0,1]).length).toBeGreaterThan(0);
 expect(store.execute({id:'reverse_mesh',baseGeneration:store.getSnapshot().localGeneration,type:'ReverseWall',wallId:'w1'}).ok).toBe(true);const reversed=buildScene(structuredClone(store.getSnapshot().document) as ProjectDoc);expect(reversed.stats.wallVolumeMm3).toBe(7782000000);expect(hits(reversed,[1,1,-0.3],[0,0,1])).toHaveLength(0);
 const reloaded=new ProjectStore(structuredClone(store.getSnapshot().document) as ProjectDoc,'opening_reload');expect(buildScene(structuredClone(reloaded.getSnapshot().document) as ProjectDoc).stats.wallVolumeMm3).toBe(7782000000);
 expect(store.undo()).toBe(true);expect(store.execute({id:'delete_window',baseGeneration:store.getSnapshot().localGeneration,type:'DeleteOpening',openingId:'test_window'}).ok).toBe(true);expect(buildScene(structuredClone(store.getSnapshot().document) as ProjectDoc).stats.wallVolumeMm3).toBe(8022000000);expect(store.undo()).toBe(true);expect(store.undo()).toBe(true);expect(store.undo()).toBe(true);expect(store.getSnapshot().document).toEqual(baseline);
});
