import { describe, expect, it } from 'vitest';
import { STRUCTURE_DISCLAIMER } from '@gharplan/core-model';
import type { ProjectDoc } from '@gharplan/core-model';
import sample from '../../../../docs/examples/sample-project.json';
import { buildScene, CachedSceneBuilder, ROOF_SLAB_MM } from './mesh';
import { sceneInvalidation } from './dependencies';
import type { MeshData } from './types';

// FR-035 (D66) stair and roof meshes. Claude-authored analytic tests, not independent fixtures.
// H.6 sample: outer walls 230 mm on the centreline rectangle 0..8000 x 0..5000, 3000 mm high, floor at 0.
const materials = [{ id: 'm_stone', name: 'Stone', baseColor: '#9a948a', roughness: 0.9, metalness: 0 }, { id: 'm_tiles', name: 'Tiles', baseColor: '#a5543a', roughness: 0.8, metalness: 0 }];
const withStructures = (roof: Partial<NonNullable<ProjectDoc['roofs']>[number]> = {}): ProjectDoc => {
  const d = structuredClone(sample) as ProjectDoc;
  d.materials.push(...materials);
  d.stairs = [{ id: 'stair_1', floorId: 'f0', position: { x: 2000, y: 2500 }, rotationDeg: 0, width: 900, length: 4000, height: 3000, steps: 16, material: 'm_stone', rev: 0 }];
  d.roofs = [{ id: 'roof_1', floorId: 'f0', kind: 'gable', pitchDeg: 45, overhang: 0, ridgeAxis: 'y', material: 'm_tiles', rev: 0, ...roof }];
  return d;
};
const mesh = (meshes: MeshData[], id: string) => meshes.find(m => m.id === id)!;
const column = (m: MeshData, axis: 0 | 1 | 2) => Array.from({ length: m.positions.length / 3 }, (_, i) => m.positions[i * 3 + axis]!);
/** Every triangle's counter-clockwise (Three's front face) normal must equal its stored vertex normal. */
function facesOutward(m: MeshData): boolean {
  for (let i = 0; i < m.positions.length; i += 9) {
    const p = (k: number) => [m.positions[i + k * 3]!, m.positions[i + k * 3 + 1]!, m.positions[i + k * 3 + 2]!];
    const [a, b, c] = [p(0), p(1), p(2)], u = b.map((v, k) => v - a[k]!), w = c.map((v, k) => v - a[k]!);
    const cross = [u[1]! * w[2]! - u[2]! * w[1]!, u[2]! * w[0]! - u[0]! * w[2]!, u[0]! * w[1]! - u[1]! * w[0]!], length = Math.hypot(...cross);
    const n = [m.normals[i]!, m.normals[i + 1]!, m.normals[i + 2]!];
    if (Math.abs(cross[0]! / length - n[0]!) > 1e-6 || Math.abs(cross[1]! / length - n[1]!) > 1e-6 || Math.abs(cross[2]! / length - n[2]!) > 1e-6) return false;
  }
  return true;
}

describe('FR-035 stair and roof meshes', () => {
  it('a 16-step stair rises from the floor to 3.0 m inside its 0.9 x 4.0 m footprint, every face outward', () => {
    const stair = mesh(buildScene(withStructures()).meshes, 'stair:stair_1');
    expect(stair.category).toBe('stair'); expect(stair.groups).toEqual([{ start: 0, count: stair.positions.length / 3, materialId: 'm_stone' }]);
    expect(stair.positions.length / 9).toBe(16 * 5 * 2); // 16 boxes, 5 faces (no hidden bottom), 2 triangles each
    expect([Math.min(...column(stair, 0)), Math.max(...column(stair, 0))]).toEqual([1.55, 2.45]); // Three x = plan x
    expect([Math.min(...column(stair, 2)), Math.max(...column(stair, 2))]).toEqual([0.5, 4.5]);   // Three z = plan y
    expect([Math.min(...column(stair, 1)), Math.max(...column(stair, 1))]).toEqual([0, 3]);       // Three y = height
    expect(facesOutward(stair)).toBe(true);
  });

  it('a 45 degree gable along Y over the outer rectangle peaks 4.115 m above the 3.0 m wall tops', () => {
    const roof = mesh(buildScene(withStructures()).meshes, 'roof:roof_1');
    expect([Math.min(...column(roof, 0)), Math.max(...column(roof, 0))]).toEqual([-0.115, 8.115]);
    expect([Math.min(...column(roof, 2)), Math.max(...column(roof, 2))]).toEqual([-0.115, 5.115]);
    expect(Math.min(...column(roof, 1))).toBe(3);
    expect(Math.max(...column(roof, 1))).toBeCloseTo(3 + 4.115, 9); // half of 8230 mm x tan 45 deg
    expect(roof.positions.length / 9).toBe(2 * 2 + 2 + 2); // two slopes, two gable ends, a soffit
    expect(facesOutward(roof)).toBe(true);
    for (const kind of [{ ridgeAxis: 'x' as const }, { kind: 'flat' as const, overhang: 500 }]) expect(facesOutward(mesh(buildScene(withStructures(kind)).meshes, 'roof:roof_1'))).toBe(true);
  });

  it('a flat roof is a 150 mm slab over the walls plus overhang; scene bounds include the roof top', () => {
    const scene = buildScene(withStructures({ kind: 'flat', overhang: 500 })), roof = mesh(scene.meshes, 'roof:roof_1');
    expect([Math.min(...column(roof, 0)), Math.max(...column(roof, 0))]).toEqual([-0.615, 8.615]);
    expect([Math.min(...column(roof, 1)), Math.max(...column(roof, 1))]).toEqual([3, 3 + ROOF_SLAB_MM / 1000]);
    expect(scene.bounds![4]).toBe(3.15); expect(scene.bounds![0]).toBe(-0.615);
  });

  it('roof and stair edits rebuild only themselves; a wall height change moves the roof; material changes rebind', () => {
    const builder = new CachedSceneBuilder(), first = withStructures();
    builder.build(first);
    const steeper = withStructures({ pitchDeg: 30 });
    expect(sceneInvalidation(first, steeper).dirtyEntityIds).toEqual(['roof_1']);
    expect(builder.build(steeper).stats.meshesBuilt).toBe(1);
    const taller = structuredClone(steeper); taller.walls = taller.walls.map(w => ({ ...w, height: 3200 }));
    expect(sceneInvalidation(steeper, taller).dirtyEntityIds).toContain('roof_1');
    expect(Math.min(...column(mesh(builder.build(taller).meshes, 'roof:roof_1'), 1))).toBeCloseTo(3.2, 9);
    const recoloured = structuredClone(taller); recoloured.stairs![0]!.material = 'm_tiles';
    const rebound = builder.build(recoloured);
    expect(rebound.stats.meshesBuilt).toBe(0); expect(mesh(rebound.meshes, 'stair:stair_1').groups[0]!.materialId).toBe('m_tiles');
    const removed = structuredClone(recoloured); delete removed.stairs;
    expect(sceneInvalidation(recoloured, removed).removedIds).toEqual(['stair_1']);
    expect(builder.build(removed).meshes.some(m => m.category === 'stair')).toBe(false);
  });

  it('carries the planning-only disclaimer text the panel shows', () => {
    expect(STRUCTURE_DISCLAIMER).toBe('Planning tool only, not construction, structural or building-code advice.');
  });
});
