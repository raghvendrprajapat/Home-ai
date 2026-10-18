import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import sample from '../../../docs/examples/sample-project.json';
import { derivePlan } from './index';
import type { Plan } from './types';

// FR-034 per-floor derivation. Claude-authored property test (not an independent fixture).
const base = (): Plan => { const s = structuredClone(sample); return { junctions: s.junctions, walls: s.walls, rooms: s.rooms } as Plan; };
/** A copy of the sample plan on floor f1, shifted by (dx, dy), with fresh IDs. */
const shifted = (dx: number, dy: number): Plan => {
  const p = base(), id = (v: string) => `${v}_up`;
  return {
    junctions: p.junctions.map(j => ({ ...j, id: id(j.id), floorId: 'f1', x: j.x + dx, y: j.y + dy })),
    walls: p.walls.map(w => ({ ...w, id: id(w.id), floorId: 'f1', a: id(w.a), b: id(w.b) })),
    rooms: p.rooms.map(r => ({ ...r, id: id(r.id), floorId: 'f1', boundary: r.boundary.map(id) })),
  };
};
const summary = (plan: Plan, floor: string) => {
  const owner = new Map(plan.walls.map(w => [w.id, w.floorId])), floorOf = new Map(plan.junctions.map(j => [j.id, j.floorId]));
  const d = derivePlan(plan);
  return {
    faces: d.faces.filter(f => floorOf.get(f.boundary[0]!) === floor).map(f => [f.boundary.join(','), f.clearAreaMm2, f.clearRect]).sort(),
    footprints: d.footprints.filter(p => owner.get(p.ownerId) === floor).map(p => [p.ownerId, ...p.rect]).sort(),
  };
};

describe('FR-034 derivePlan per floor', () => {
  it('two floors derive exactly as each floor alone, wherever the upper floor sits (including exactly on top)', () => {
    const ground = base(), alone0 = summary(ground, 'f0');
    expect(alone0.faces.map(f => f[1] as number).sort((a, b) => a - b)).toEqual([15872175, 20642175]); // H.6 clear areas
    fc.assert(fc.property(fc.integer({ min: -6000, max: 6000 }), fc.integer({ min: -6000, max: 6000 }), (dx, dy) => {
      const upper = shifted(dx, dy), both: Plan = { junctions: [...ground.junctions, ...upper.junctions], walls: [...ground.walls, ...upper.walls], rooms: [...ground.rooms, ...upper.rooms] };
      expect(summary(both, 'f0')).toEqual(alone0);
      expect(summary(both, 'f1')).toEqual(summary(upper, 'f1'));
    }), { seed: 20261018, numRuns: 60 });
  });
  it('exactly stacked floors keep the H.6 clear areas on both floors', () => {
    const both: Plan = { junctions: [...base().junctions, ...shifted(0, 0).junctions], walls: [...base().walls, ...shifted(0, 0).walls], rooms: [...base().rooms, ...shifted(0, 0).rooms] };
    const areas = derivePlan(both).faces.map(f => f.clearAreaMm2).sort((a, b) => a - b);
    expect(areas).toEqual([15872175, 15872175, 20642175, 20642175]);
  });
});
