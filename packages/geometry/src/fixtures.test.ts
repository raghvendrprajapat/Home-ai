import { describe, expect, it } from 'vitest';
import completeSample from '../../../docs/examples/sample-project.json';
import closingGap from '../../../tests/fixtures/independent/geometry/closing-gap.json';
import collinear from '../../../tests/fixtures/independent/geometry/collinear-overlap.json';
import footprints from '../../../tests/fixtures/independent/geometry/footprint-area.json';
import rejections from '../../../tests/fixtures/independent/geometry/rejections.json';
import sample from '../../../tests/fixtures/independent/geometry/sample-project.json';
import limits from '../../../tests/fixtures/independent/geometry/segments-and-limits.json';
import smallRooms from '../../../tests/fixtures/independent/geometry/small-rooms.json';
import splitMerge from '../../../tests/fixtures/independent/geometry/split-merge.json';
import tJunction from '../../../tests/fixtures/independent/geometry/t-junction.json';
import twoSquares from '../../../tests/fixtures/independent/geometry/two-squares.json';
import { applyGeometry, endpoints, formatArea, rectArea, signedArea, wallLength } from './index';
import type { Face, GeometryResult, Junction, Operation, Plan, Point, Room, Wall } from './index';

interface FixturePlan {
  junctions: (Omit<Junction, 'floorId' | 'x' | 'y'> & { x: number | string; y: number | string; floorId?: string })[];
  walls: (Pick<Wall, 'id' | 'a' | 'b' | 'thickness' | 'height'> & Partial<Wall>)[];
  rooms?: (Pick<Room, 'id' | 'boundary' | 'name'> & Partial<Room>)[];
}
interface FaceExpectation {
  corners?: Point[]; centrelineSignedAreaMm2?: number; clearRect?: number[];
  clearAreaMm2?: number; smallSpaceWarning?: boolean; roomId?: string; displayLabelM2?: string;
}
interface Case {
  id: string; earliestTask: string; plan: FixturePlan | string;
  operation: Operation & { withOpening?: unknown };
  expect: {
    accepted?: boolean; modelUnchanged?: boolean; wallCount?: number; junctionCount?: number; faceCount?: number;
    faces?: FaceExpectation[]; junctionsAt?: { at: Point; id?: string; degree?: number }[];
    wallsAlongLine?: { axis: 'x' | 'y'; at: number; union: number[][]; totalLength: number; idsPresent: string[] };
    wallIdOn?: { from: Point; to: Point; id: string }[]; changedWalls?: string[]; unchangedWalls?: string[];
    footprintUnionAreaMm2?: number; outerBoundaryRect?: number[]; thresholdAreaMm2?: number;
    newRoomCopiesPropertiesFrom?: string; checkRoomNamesHint?: boolean; errorKind?: string;
  };
}
const sets = { 'closing-gap.json': closingGap, 'collinear-overlap.json': collinear, 'footprint-area.json': footprints,
  'rejections.json': rejections, 'sample-project.json': sample, 'segments-and-limits.json': limits,
  'small-rooms.json': smallRooms, 'split-merge.json': splitMerge, 't-junction.json': tJunction, 'two-squares.json': twoSquares } as unknown as Record<string, { cases: Case[] }>;
const all = Object.entries(sets).flatMap(([file, set]) => set.cases.map(c => ({ file, ...c })));
function inputPlan(c: Case, file: string): Plan {
  if (typeof c.plan === 'string') {
    const result = c.plan.startsWith('result of '), reference = c.plan.replace(/^(same as|result of) /, '').split(' ');
    const otherFile = reference.length === 2 ? reference[0]! : file, id = reference.at(-1)!;
    const found = sets[otherFile]?.cases.find(c => c.id === id);
    if (!found) throw new Error(`Unknown fixture reference: ${c.plan}`);
    const input = inputPlan(found, otherFile);
    if (!result) return input;
    const applied = applyGeometry(input, found.operation);
    if (!applied.accepted) throw applied.error;
    return applied.plan;
  }
  return {
    junctions: c.plan.junctions.map(j => ({ floorId: 'f0', ...j, x: Number(j.x), y: Number(j.y) })),
    walls: c.plan.walls.map(w => ({ floorId: 'f0', leftMaterial: 'm_default', rightMaterial: 'm_default', rev: 0, ...w })),
    rooms: (c.plan.rooms ?? []).map(r => ({ floorId: 'f0', type: 'other', ceilingHeight: 3000, floorMaterial: 'm_default', rev: 0, ...r })),
  };
}
function cyclicPoints(actual: readonly Point[], expected: readonly Point[]): boolean {
  return actual.length === expected.length && actual.some((_, start) => expected.every((p, i) =>
    p[0] === actual[(start + i) % actual.length]![0] && p[1] === actual[(start + i) % actual.length]![1]));
}
function assertFace(face: Face, wanted: FaceExpectation, before: Plan) {
  if (wanted.corners) expect(cyclicPoints(face.corners, wanted.corners)).toBe(true);
  expect(signedArea(face.corners)).toBeGreaterThan(0);
  if (wanted.centrelineSignedAreaMm2 !== undefined) expect(Math.abs(face.centrelineSignedAreaMm2 - wanted.centrelineSignedAreaMm2)).toBeLessThanOrEqual(1);
  if (wanted.clearRect) wanted.clearRect.forEach((n, i) => expect(Math.abs(face.clearRect[i]! - n)).toBeLessThanOrEqual(0.001));
  if (wanted.clearAreaMm2 !== undefined) expect(Math.abs(face.clearAreaMm2 - wanted.clearAreaMm2)).toBeLessThanOrEqual(1);
  if (wanted.smallSpaceWarning !== undefined) expect(face.smallSpaceWarning).toBe(wanted.smallSpaceWarning);
  if (wanted.displayLabelM2 !== undefined) expect(formatArea(face.clearAreaMm2)).toBe(wanted.displayLabelM2);
  if (wanted.roomId === '<new>') expect(before.rooms.some(r => r.id === face.roomId)).toBe(false);
  else if (wanted.roomId) expect(face.roomId).toBe(wanted.roomId);
}
function assertCase(c: Case, before: Plan, result: GeometryResult) {
  const e = c.expect, after = result.plan;
  if (e.accepted !== undefined) expect(result.accepted).toBe(e.accepted);
  else if (!e.modelUnchanged && c.id !== 'COL-02') expect(result.accepted, `${c.id} requires computed geometry`).toBe(true);
  if (e.modelUnchanged) { expect(after).toEqual(before); expect(after).toBe(before); }
  if (e.wallCount !== undefined) expect(after.walls).toHaveLength(e.wallCount);
  if (e.junctionCount !== undefined) expect(after.junctions).toHaveLength(e.junctionCount);
  if (!result.accepted && (e.accepted === false || e.modelUnchanged)) return;
  // COL-02 explicitly permits rejecting a contained duplicate, but coverage still must be checked.
  const analyzed = result.accepted ? result : applyGeometry(after, { op: 'analyze' });
  expect(analyzed.accepted).toBe(true);
  if (!analyzed.accepted) throw analyzed.error;
  const d = analyzed.derived;
  if (e.faceCount !== undefined) expect(d.faces).toHaveLength(e.faceCount);
  if (e.faces) {
    const matched = new Set<Face>();
    for (const wanted of e.faces) {
      const face = d.faces.find(face => !matched.has(face) &&
        (wanted.corners ? cyclicPoints(face.corners, wanted.corners) : wanted.roomId && wanted.roomId !== '<new>' ?
          face.roomId === wanted.roomId : wanted.clearAreaMm2 !== undefined ? Math.abs(face.clearAreaMm2 - wanted.clearAreaMm2) <= 1 : true));
      expect(face, `Missing face ${JSON.stringify(wanted)}`).toBeDefined(); matched.add(face!); assertFace(face!, wanted, before);
    }
  }
  for (const j of e.junctionsAt ?? []) {
    const found = after.junctions.filter(p => p.x === j.at[0] && p.y === j.at[1]); expect(found).toHaveLength(1);
    if (j.id) expect(found[0]!.id).toBe(j.id);
    if (j.degree !== undefined) expect(after.walls.filter(w => w.a === found[0]!.id || w.b === found[0]!.id)).toHaveLength(j.degree);
  }
  if (e.wallsAlongLine) {
    const line = e.wallsAlongLine, intervals: number[][] = [];
    const walls = after.walls.filter(w => endpoints(after, w).every(p => p[line.axis] === line.at));
    for (const w of walls) {
      const [a, b] = endpoints(after, w); const axis = line.axis === 'x' ? 'y' : 'x'; intervals.push([Math.min(a[axis], b[axis]), Math.max(a[axis], b[axis])]);
    }
    intervals.sort(([a], [b]) => a! - b!); const union: number[][] = [];
    for (const interval of intervals) { const last = union.at(-1); if (last && interval[0]! <= last[1]!) last[1] = Math.max(last[1]!, interval[1]!); else union.push([...interval]); }
    expect(union).toEqual(line.union); expect(walls.reduce((s, w) => s + wallLength(after, w), 0)).toBe(line.totalLength);
    for (const id of line.idsPresent) expect(walls.some(w => w.id === id)).toBe(true);
  }
  for (const wanted of e.wallIdOn ?? []) {
    const w = after.walls.find(w => w.id === wanted.id); expect(w).toBeDefined();
    const [a, b] = endpoints(after, w!); expect(cyclicPoints([[a.x, a.y], [b.x, b.y]], [wanted.from, wanted.to])).toBe(true);
  }
  const shape = (p: Plan, id: string) => { const w = p.walls.find(w => w.id === id)!; return endpoints(p, w).map(j => [j.x, j.y]); };
  for (const id of e.changedWalls ?? []) expect(shape(after, id)).not.toEqual(shape(before, id));
  for (const id of e.unchangedWalls ?? []) expect(shape(after, id)).toEqual(shape(before, id));
  if (e.footprintUnionAreaMm2 !== undefined) {
    expect(Math.abs(d.footprintUnionAreaMm2 - e.footprintUnionAreaMm2)).toBeLessThanOrEqual(1);
    expect(d.footprints.reduce((s, p) => s + rectArea(p.rect), 0)).toBe(d.footprintUnionAreaMm2);
  }
  if (e.outerBoundaryRect) expect(d.outerBoundaryRect).toEqual(e.outerBoundaryRect);
  if (e.newRoomCopiesPropertiesFrom) {
    const source = before.rooms.find(r => r.id === e.newRoomCopiesPropertiesFrom)!;
    const created = after.rooms.filter(r => !before.rooms.some(old => old.id === r.id)); expect(created.length).toBeGreaterThan(0);
    for (const r of created) expect({ ...r, id: source.id, boundary: source.boundary }).toEqual(source);
  }
  if (e.checkRoomNamesHint !== undefined) expect(analyzed.checkRoomNamesHint).toBe(e.checkRoomNamesHint);
}
function run(c: typeof all[number]) {
  const before = inputPlan(c, c.file), snapshot = JSON.stringify(before);
  const result = applyGeometry(before, c.operation); assertCase(c, before, result);
  expect(JSON.stringify(before)).toBe(snapshot); // No input mutation even when rejected.
}
describe('Accepted Claude PR #60 fixtures (unmodified)', () => {
  it('actual complete H.6 document produces the same exact approved sample and moved-partition areas', () => {
    const input: Plan = completeSample;
    const initial = applyGeometry(input, { op: 'analyze' });
    expect(initial.accepted).toBe(true);
    if (!initial.accepted) throw initial.error;
    expect(initial.derived.faces.map(f => f.clearAreaMm2).sort((a, b) => b - a)).toEqual([20642175, 15872175]);
    const moved = applyGeometry(input, { op: 'moveJunctions', moves: [{ junction: 'j2', to: [4600, 0] }, { junction: 'j5', to: [4600, 5000] }] });
    expect(moved.accepted).toBe(true);
    if (!moved.accepted) throw moved.error;
    expect(moved.derived.faces.map(f => f.clearAreaMm2).sort((a, b) => b - a)).toEqual([21119175, 15395175]);
    // Openings, furniture and materials remain the core-model's responsibility in PH0-T03.
    expect(completeSample.junctions.find(j => j.id === 'j2')!.x).toBe(4500);
  });
  const geometry = all.filter(c => c.earliestTask === 'PH0-T02');
  it('enumerates every PH0-T02 case: 50, with no omissions', () => { expect(all).toHaveLength(55); expect(geometry).toHaveLength(50); expect(new Set(all.map(c => c.id)).size).toBe(55); });
  it.each(geometry)('$id', run);
  it.each(all.filter(c => c.earliestTask === 'PH0-T03'))('$id early canonical geometry rejection; core transaction assertion follows in PH0-T03', run);
  it('TWOSQ-03 room areas remain separators; 3D threshold assertion is pending PH0-T05', () => {
    const c = all.find(c => c.id === 'TWOSQ-03')!; run(c);
    expect(c.expect.thresholdAreaMm2).toBe(180000); // Inventory only, not a claim of rendered threshold correctness.
  });
  it('GAP-01 stays assigned to PH2-T03 pointer snapping, never a fractional canonical command', () => {
    const c = all.find(c => c.id === 'GAP-01')!; expect(c.earliestTask).toBe('PH2-T03'); expect(c.operation.op).toBe('addWallRaw');
  });
});
