import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { applyGeometry, assertCoordinate, bounds, candidatePairs, clearRegion, derivePlan, detectFaces, endpoints, formatArea,
  freshId, GeometryError, insidePolygon, normalizePlan, partitionRectangles, pointKey, rectArea, rectIntersection, regionPolygons,
  signedArea, simplifyCorners, validateInputs, validateTopology, wallLength, wallStrips } from './index';
import type { Plan, Point, Rect } from './index';

const settings = { seed: 20261011, numRuns: 500 };
function polygonPlan(points: Point[], thickness = 200): Plan {
  return { junctions: points.map(([x, y], i) => ({ id: `j${i}`, floorId: 'f0', x, y })),
    walls: points.map((_, i) => ({ id: `w${i}`, floorId: 'f0', a: `j${i}`, b: `j${(i + 1) % points.length}`,
      thickness, height: 3000, leftMaterial: 'm_default', rightMaterial: 'm_default', rev: 0 })), rooms: [] };
}
function rectangle(width: number, depth: number, thickness = 200): Plan {
  return polygonPlan([[0, 0], [width, 0], [width, depth], [0, depth]], thickness);
}
function unionOracle(rects: readonly Rect[], test?: (point: Point) => boolean): number {
  // Independent compressed-cell occupancy oracle; never calls the sweep/strip implementation.
  const xs = [...new Set(rects.flatMap(r => [r[0], r[2]]))].sort((a, b) => a - b);
  const ys = [...new Set(rects.flatMap(r => [r[1], r[3]]))].sort((a, b) => a - b);
  let area = 0;
  for (let i = 1; i < xs.length; i++) for (let j = 1; j < ys.length; j++) {
    const x = (xs[i - 1]! + xs[i]!) / 2, y = (ys[j - 1]! + ys[j]!) / 2;
    if (test ? test([x, y]) : rects.some(r => x > r[0] && x < r[2] && y > r[1] && y < r[3]))
      area += (xs[i]! - xs[i - 1]!) * (ys[j]! - ys[j - 1]!);
  }
  return area;
}
function invariantOracle(plan: Plan): void {
  // Exhaustive test-only pair oracle, distinct from the production spatial index.
  expect(new Set(plan.junctions.map(j => `${j.floorId}:${j.x},${j.y}`)).size).toBe(plan.junctions.length);
  for (const w of plan.walls) {
    const [a, b] = endpoints(plan, w); expect(a.floorId).toBe(w.floorId); expect(b.floorId).toBe(w.floorId);
    expect(a.x === b.x || a.y === b.y).toBe(true); expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThanOrEqual(10);
  }
  for (let i = 0; i < plan.walls.length; i++) for (let j = i + 1; j < plan.walls.length; j++) {
    const w = plan.walls[i]!, v = plan.walls[j]!; const [a, b] = endpoints(plan, w), [c, d] = endpoints(plan, v);
    const shared = [w.a, w.b].filter(id => id === v.a || id === v.b);
    if ((a.y === b.y) === (c.y === d.y)) {
      if (a.y === b.y && a.y === c.y) expect(Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) - Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x))).toBeLessThanOrEqual(0);
      if (a.x === b.x && a.x === c.x) expect(Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) - Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y))).toBeLessThanOrEqual(0);
    } else {
      const [h1, h2, v1, v2] = a.y === b.y ? [a, b, c, d] : [c, d, a, b];
      if (v1.x >= Math.min(h1.x, h2.x) && v1.x <= Math.max(h1.x, h2.x) && h1.y >= Math.min(v1.y, v2.y) && h1.y <= Math.max(v1.y, v2.y)) expect(shared).toHaveLength(1);
    }
  }
}

describe('GEO analytic primitives and validation', () => {
  it('signed winding, corners, bounds, intersection, membership and separate half-up label', () => {
    const p: Point[] = [[0, 0], [500, 0], [1000, 0], [1000, 700], [0, 700]];
    expect(signedArea(p)).toBe(700000); expect(signedArea([...p].reverse())).toBe(-700000);
    expect(simplifyCorners(p)).toHaveLength(4); expect(bounds(p)).toEqual([0, 0, 1000, 700]);
    expect(insidePolygon([500, 350], p)).toBe(true); expect(insidePolygon([-1, 350], p)).toBe(false);
    expect(rectIntersection([0, 0, 3, 4], [1, 2, 5, 6])).toEqual([1, 2, 3, 4]);
    expect(rectArea([4, 0, 1, 4])).toBe(0); expect(formatArea(249001)).toBe('0.25'); expect(formatArea(1005000)).toBe('1.01');
    expect(() => formatArea(Number.NaN)).toThrow(GeometryError); expect(() => bounds([])).toThrow(GeometryError);
    const ids = new Set(['child_1']); expect(freshId('child', ids)).toBe('child_2'); expect(pointKey([1, -2])).toBe('1,-2');
  });
  it('primitive properties use analytic rectangle area and integer ranges', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 100000 }), fc.integer({ min: 1, max: 100000 }), (w, d) => {
      const p: Point[] = [[0, 0], [w, 0], [w, d], [0, d]];
      expect(signedArea(p)).toBe(w * d); expect(bounds(p)).toEqual([0, 0, w, d]); expect(simplifyCorners(p)).toEqual(p);
      expect(insidePolygon([w / 2, d / 2], p)).toBe(true); expect(rectArea(rectIntersection([0, 0, w, d], [w / 2, d / 2, w * 2, d * 2]))).toBe(w * d / 4);
      expect(formatArea(w * 10000)).toBe((w / 100).toFixed(2)); assertCoordinate(w);
      expect(() => assertCoordinate(w + 0.25)).toThrow(GeometryError);
      const used = new Set<string>(); const id = freshId('x'.repeat(100), used); expect(used.has(id)).toBe(true); expect(id.length).toBeLessThanOrEqual(40);
      expect(pointKey([w, d])).toBe(`${w},${d}`);
    }), settings);
  });
  it('hard boundaries, material-side reversal conflicts, four-way junctions and duplicate moves', () => {
    const plan = rectangle(4000, 3000);
    validateInputs(plan); validateTopology(plan); expect(wallLength(plan, plan.walls[0]!)).toBe(4000);
    expect(() => validateInputs({ ...plan, walls: [...plan.walls, { ...plan.walls[0]! }] })).toThrow(GeometryError);
    const four = { junctions: [{ id: 'jc', floorId: 'f0', x: 0, y: 0 }, ...[[1000, 0], [0, 1000], [-1000, 0], [0, -1000]].map(([x, y], i) => ({ id: `j${i}`, floorId: 'f0', x: x!, y: y! }))],
      walls: plan.walls.map((w, i) => ({ ...w, a: 'jc', b: `j${i}` })), rooms: [] };
    expect(applyGeometry(four, { op: 'validate' }).accepted).toBe(false);
    const duplicate = applyGeometry(plan, { op: 'moveJunctions', moves: [{ junction: 'j0', to: [0, 0] }, { junction: 'j0', to: [0, 0] }] });
    expect(duplicate.accepted).toBe(false); expect(duplicate.plan).toBe(plan);
    const asym = { ...plan, walls: [{ ...plan.walls[0]!, leftMaterial: 'red', rightMaterial: 'blue' }] };
    const conflict = applyGeometry(asym, { op: 'addWall', from: [4000, 0], to: [0, 0], thickness: 200, height: 3000, leftMaterial: 'red', rightMaterial: 'blue' });
    expect(conflict.accepted).toBe(false);
    const reverse = applyGeometry(asym, { op: 'addWall', from: [4000, 0], to: [0, 0], thickness: 200, height: 3000, leftMaterial: 'blue', rightMaterial: 'red' });
    expect(reverse.accepted).toBe(true); expect(reverse.plan).toEqual(asym);
  });
  it('review regressions: globally unique room IDs, duplicate face ownership and unknown operation', () => {
    const plan = rectangle(4000, 3000);
    const room = { id: 'room1', floorId: 'f0', boundary: ['j0', 'j1', 'j2', 'j3'], name: 'Hall', type: 'other', ceilingHeight: 3000, floorMaterial: 'm_default', rev: 0 };
    const collision = { ...plan, rooms: [{ ...room, id: 'w0' }] };
    expect(applyGeometry(collision, { op: 'validate' }).accepted).toBe(false);
    for (const id of ['room1', 'room2']) {
      const duplicate = { ...plan, rooms: [room, { ...room, id, boundary: ['j2', 'j3', 'j0', 'j1'] }] };
      const r = applyGeometry(duplicate, { op: 'validate' }); expect(r.accepted).toBe(false); expect(r.plan).toBe(duplicate);
    }
    const reversed = { ...plan, rooms: [room, { ...room, id: 'kitchen', name: 'Kitchen', boundary: ['j3', 'j2', 'j1', 'j0'] }] };
    expect(applyGeometry(reversed, { op: 'validate' }).accepted).toBe(false);
    const wrongFloor = { ...plan, rooms: [{ ...room, floorId: 'f1' }] };
    expect(applyGeometry(wrongFloor, { op: 'validate' }).accepted).toBe(false);
    const invalid = applyGeometry(plan, { op: 'made-up' } as unknown as Parameters<typeof applyGeometry>[1]);
    expect(invalid.accepted).toBe(false); expect(invalid.plan).toBe(plan);
    fc.assert(fc.property(fc.integer({ min: 1000, max: 10000 }), w => {
      const valid = rectangle(w, 3000), duplicate = { ...valid, rooms: [room, { ...room, id: 'otherRoom' }] };
      expect(() => validateInputs(duplicate)).toThrow(GeometryError);
      expect(applyGeometry(duplicate, { op: 'moveJunctions', moves: [] }).plan).toBe(duplicate);
    }), settings);
  });
});

describe('GEO-006/010 footprints, clear regions and non-rectangular rooms', () => {
  it('D18 free square caps, concave room and interior dead-end stub', () => {
    const open = rectangle(4000, 3000); open.walls = [open.walls[0]!];
    const free = derivePlan(open); expect(free.faces).toHaveLength(0); expect(free.outerBoundaryRect).toEqual([-100, -100, 4100, 100]); expect(free.footprintUnionAreaMm2).toBe(840000);
    const l = polygonPlan([[0, 0], [6000, 0], [6000, 2000], [3000, 2000], [3000, 5000], [0, 5000]]);
    const derived = derivePlan(l); expect(derived.faces).toHaveLength(1); expect(derived.faces[0]!.clearAreaMm2).toBe(18840000);
    expect(signedArea(derived.faces[0]!.clearPolygons[0]!)).toBe(18840000);
    const stub = applyGeometry(l, { op: 'addWall', from: [3000, 0], to: [3000, 1000], thickness: 100, height: 3000 });
    expect(stub.accepted).toBe(true);
    if (stub.accepted) { expect(stub.derived.faces).toHaveLength(1); expect(stub.derived.faces[0]!.clearAreaMm2).toBe(18745000); }
  });
  it('holes rejected, positive disconnected clear components retained under D12', () => {
    const outside = rectangle(6000, 6000), island = polygonPlan([[2000, 2000], [4000, 2000], [4000, 4000], [2000, 4000]]);
    island.junctions.forEach(j => { j.id = `inner_${j.id}`; }); island.walls.forEach(w => { w.id = `inner_${w.id}`; w.a = `inner_${w.a}`; w.b = `inner_${w.b}`; });
    expect(applyGeometry({ junctions: [...outside.junctions, ...island.junctions], walls: [...outside.walls, ...island.walls], rooms: [] }, { op: 'validate' }).accepted).toBe(false);
    // Narrow connecting corridor is closed by thick footprints; both positive carpet components remain one face.
    const dumbbell = polygonPlan([[0, 0], [2000, 0], [2000, 900], [3000, 900], [3000, 0], [5000, 0], [5000, 2000], [3000, 2000], [3000, 1100], [2000, 1100], [2000, 2000], [0, 2000]]);
    const d = derivePlan(dumbbell); expect(d.faces).toHaveLength(1); expect(d.faces[0]!.clearPolygons).toHaveLength(2); expect(d.faces[0]!.clearAreaMm2).toBe(6480000);
  });
  it('random rectangles: exact clear area, ring area, independent winding and normalization idempotence', () => {
    fc.assert(fc.property(fc.integer({ min: 50, max: 1000 }), fc.integer({ min: 1, max: 30000 }), fc.integer({ min: 1, max: 30000 }), (t, cw, cd) => {
      const plan = rectangle(cw + t, cd + t, t), normalized = normalizePlan(plan), d = derivePlan(plan);
      const f = d.faces[0]!;
      expect(f.clearAreaMm2).toBe(cw * cd); expect(f.smallSpaceWarning).toBe(cw * cd < 250000);
      expect(d.footprintUnionAreaMm2).toBe((cw + 2 * t) * (cd + 2 * t) - cw * cd);
      expect(signedArea(f.clearPolygons[0]!)).toBe(cw * cd); expect(detectFaces(plan)[0]!.centrelineSignedAreaMm2).toBe((cw + t) * (cd + t));
      expect(normalizePlan(normalized.plan).plan).toEqual(normalized.plan); validateInputs(plan); validateTopology(plan);
      expect(wallLength(plan, plan.walls[0]!)).toBe(cw + t); expect(endpoints(plan, plan.walls[0]!)[0]!.id).toBe('j0');
      const region = clearRegion([[0, 0], [cw, 0], [cw, cd], [0, cd]], []); expect(region.reduce((sum, r) => sum + rectArea(r), 0)).toBe(cw * cd);
      expect(regionPolygons(region).reduce((sum, p) => sum + signedArea(p), 0)).toBe(cw * cd);
      const strips = wallStrips(plan); expect(strips[0]!.rect).toEqual([-t / 2, -t / 2, cw + 1.5 * t, t / 2]);
    }), settings);
  });
  it('owned rectangle sweep matches independent occupancy oracle, and never overlaps', () => {
    const rect = fc.tuple(fc.integer({ min: -20, max: 20 }), fc.integer({ min: -20, max: 20 }), fc.integer({ min: 1, max: 15 }), fc.integer({ min: 1, max: 15 }))
      .map(([x, y, w, d]): Rect => [x / 2, y / 2, (x + w) / 2, (y + d) / 2]);
    fc.assert(fc.property(fc.array(rect, { minLength: 1, maxLength: 8 }), rects => {
      const pieces = partitionRectangles(rects.map((r, i) => ({ ownerId: `w${i}`, rect: r })));
      expect(pieces.reduce((sum, p) => sum + rectArea(p.rect), 0)).toBe(unionOracle(rects));
      for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) expect(rectArea(rectIntersection(pieces[i]!.rect, pieces[j]!.rect))).toBe(0);
      for (const piece of pieces) expect(rectArea(rectIntersection(piece.rect, rects[Number(piece.ownerId.slice(1))]!))).toBe(rectArea(piece.rect));
    }), settings);
  });
  it('ladder plans: N cells = N rooms; mixed partition thickness matches analytic carpet/ring area', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 8 }), fc.integer({ min: 1000, max: 6000 }),
      fc.integer({ min: 1000, max: 6000 }), fc.integer({ min: 50, max: 500 }), fc.integer({ min: 50, max: 500 }), (n, w, d, t, partition) => {
      const plan: Plan = { junctions: [], walls: [], rooms: [] };
      for (let i = 0; i <= n; i++) for (const y of [0, d]) plan.junctions.push({ id: `j${i}_${y}`, floorId: 'f0', x: i * w, y });
      const add = (a: string, b: string, thickness: number) => plan.walls.push({ id: `wall${plan.walls.length}`, a, b,
        floorId: 'f0', thickness, height: 3000, leftMaterial: 'm_default', rightMaterial: 'm_default', rev: 0 });
      for (let i = 0; i < n; i++) { add(`j${i}_0`, `j${i + 1}_0`, t); add(`j${i + 1}_${d}`, `j${i}_${d}`, t); }
      for (let i = 0; i <= n; i++) add(`j${i}_0`, `j${i}_${d}`, i === 0 || i === n ? t : partition);
      const derived = derivePlan(plan); expect(derived.faces).toHaveLength(n);
      const expected = (n * w - t - (n - 1) * partition) * (d - t);
      expect(derived.faces.reduce((sum, f) => sum + f.clearAreaMm2, 0)).toBe(expected);
      expect(derived.footprintUnionAreaMm2).toBe((n * w + t) * (d + t) - expected);
      invariantOracle(plan);
    }), { ...settings, numRuns: 200 });
  });
  it('mixed-height footprint bands use only active solids', () => {
    const plan = rectangle(4000, 3000); plan.walls[0]!.height = 1000;
    expect(wallStrips(plan, 0)).toHaveLength(4); expect(wallStrips(plan, 1000)).toHaveLength(3); expect(wallStrips(plan, 3000)).toHaveLength(0);
  });
  it('slab subtraction and traced boundary agree with compressed-cell oracle', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 40 }), fc.integer({ min: 1, max: 40 }), (a, b) => {
      const polygon: Point[] = [[0, 0], [100, 0], [100, 100], [0, 100]], walls: Rect[] = [[0, 0, a, 100], [0, 0, 100, b]];
      const region = clearRegion(polygon, walls), expected = (100 - a) * (100 - b);
      expect(region.reduce((sum, r) => sum + rectArea(r), 0)).toBe(expected);
      expect(regionPolygons(region).reduce((sum, p) => sum + signedArea(p), 0)).toBe(expected);
      expect(unionOracle([[0, 0, 100, 100], ...walls], ([x, y]) => x > a && y > b)).toBe(expected);
    }), settings);
  });
});

describe('GEO-003/004/005/017 command sequences and spatial broad phase', () => {
  it('spatial candidate pairs equal exhaustive bbox intersections across negative grid boundaries', () => {
    fc.assert(fc.property(fc.array(fc.tuple(fc.integer({ min: -100000, max: 100000 }), fc.integer({ min: -100000, max: 100000 }), fc.integer({ min: 0, max: 100000 }), fc.integer({ min: 0, max: 100000 })), { maxLength: 20 }), values => {
      const boxes: Rect[] = values.map(([x, y, w, d]) => [x, y, x + w, y + d]), expected: [number, number][] = [];
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!, b = boxes[j]!; if (a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3]) expected.push([i, j]);
      }
      expect(candidatePairs(boxes)).toEqual(expected);
    }), { ...settings, numRuns: 100 });
  });
  it('random T splits preserve old ID on longest piece and cover intervals once', () => {
    fc.assert(fc.property(fc.integer({ min: 10, max: 5990 }), x => {
      const plan = rectangle(6000, 4000); plan.walls = [plan.walls[0]!];
      const r = applyGeometry(plan, { op: 'addWall', from: [x, 0], to: [x, 3000], thickness: 200, height: 3000 });
      expect(r.accepted).toBe(true);
      if (r.accepted) {
        const original = r.plan.walls.find(w => w.id === 'w0')!; expect(wallLength(r.plan, original)).toBe(Math.max(x, 6000 - x));
        expect(r.plan.walls.reduce((sum, w) => sum + wallLength(r.plan, w), 0)).toBe(9000);
        invariantOracle(r.plan); expect(normalizePlan(r.plan).plan).toEqual(r.plan);
      }
    }), settings);
  });
  it('10,000 seeded random command sequences: accepted invariants and rejected atomicity', () => {
    const action = fc.record({ kind: fc.integer({ min: 0, max: 4 }), value: fc.integer({ min: -1000, max: 9000 }) });
    fc.assert(fc.property(fc.array(action, { minLength: 1, maxLength: 8 }), actions => {
      let plan = rectangle(6000, 4000);
      for (const { kind, value } of actions) {
        const before = JSON.stringify(plan);
        const r = kind === 0 ? applyGeometry(plan, { op: 'addWall', from: [value, 0], to: [value, 4000], thickness: 100, height: 3000 }) :
          kind === 1 ? applyGeometry(plan, { op: 'addWall', from: [-1000, value], to: [9000, value], thickness: 200, height: 3000 }) :
          kind === 2 ? applyGeometry(plan, { op: 'moveJunctions', moves: [{ junction: 'j1', to: [value, 0] }, { junction: 'j2', to: [value, 4000] }] }) :
          kind === 3 ? applyGeometry(plan, { op: 'deleteWall', wall: plan.walls.at(-1)?.id ?? 'missing' }) :
          applyGeometry(plan, { op: 'addWall', from: [0, 0], to: [value + 0.4, 0], thickness: 200, height: 3000 });
        expect(JSON.stringify(plan)).toBe(before);
        if (r.accepted) { plan = r.plan; invariantOracle(plan); validateTopology(plan); }
        else expect(r.plan).toBe(plan);
      }
    }), { seed: 20261011, numRuns: 10000 });
  }, 60000);
});
