import { expect, it } from 'vitest';
import fc from 'fast-check';
import { parseProject, ProjectStore, serializeProject } from '@gharplan/core-model';
import sample from '../../../../docs/examples/sample-project.json';
import gap from '../../../../tests/fixtures/independent/geometry/closing-gap.json';
import { fitView, junctionMoves, screenToWorld, snapPointer, wallChain, wallDrag, wallMoves, worldToScreen, zoomAt } from './view2d';

function demo() {
  const parsed = parseProject(JSON.stringify(sample)); if (!parsed.ok) throw new Error('Invalid fixture'); return new ProjectStore(parsed.document, 'view_test');
}
it('viewport conversion and anchor zoom preserve analytic points at all supported scales', () => {
  fc.assert(fc.property(fc.tuple(fc.integer({ min: -100000, max: 100000 }), fc.integer({ min: -100000, max: 100000 })), fc.double({ min: 0.001, max: 1, noNaN: true }), fc.integer({ min: -10000, max: 10000 }), (point, scale, offset) => {
    const view = { x: offset, y: -offset, scale }, screen = worldToScreen(point, view);
    const restored = screenToWorld(screen, view); expect(restored[0]).toBeCloseTo(point[0], 6); expect(restored[1]).toBeCloseTo(point[1], 6);
    const zoomed = zoomAt(view, screen, 1.5), anchored = screenToWorld(screen, zoomed);
    expect(anchored[0]).toBeCloseTo(point[0], 6); expect(anchored[1]).toBeCloseTo(point[1], 6);
  }), { seed: 20261011, numRuns: 1000 });
});
it('GAP-01 raw 0.4mm snapping reuses the target before integer-mm command construction', () => {
  const fixture = gap.cases.find(c => c.id === 'GAP-01')!;
  if (typeof fixture.plan !== 'object' || !('zoomPxPerMm' in fixture.operation) || !('junctionCount' in fixture.expect) ||
    typeof fixture.expect.wallCount !== 'number' || typeof fixture.expect.faceCount !== 'number' || !fixture.expect.faces || !fixture.expect.committedCommand) throw new Error('Fixture shape changed.');
  const parsed = parseProject(JSON.stringify(sample)); if (!parsed.ok) throw new Error('Invalid sample'); const doc = parsed.document;
  doc.junctions = fixture.plan.junctions.map(j => ({ ...j, floorId: 'f0' }));
  doc.walls = fixture.plan.walls.map(w => ({ ...w, floorId: 'f0', leftMaterial: doc.materials[0]!.id, rightMaterial: doc.materials[0]!.id, rev: 0 }));
  doc.rooms = []; doc.openings = []; doc.furniture = []; doc.lights = []; doc.cameras = [];
  const store = new ProjectStore(doc, 'gap_input'), document = store.getSnapshot().document;
  const view = { x: 0, y: 0, scale: fixture.operation.zoomPxPerMm };
  const from = snapPointer(document, fixture.operation.from as [number, number], view), to = snapPointer(document, fixture.operation.to as [number, number], view);
  expect(store.execute({ id: 'raw_close', baseGeneration: 0, type: 'AddWall', from, to, thickness: fixture.operation.thickness, height: fixture.operation.height }).ok).toBe(fixture.expect.accepted);
  expect(store.getSnapshot().document.junctions).toHaveLength(fixture.expect.junctionCount);
  expect(store.getSnapshot().document.walls).toHaveLength(fixture.expect.wallCount);
  expect(store.getSnapshot().derived.faces).toHaveLength(fixture.expect.faceCount);
  expect(store.getSnapshot().derived.faces[0]!.clearAreaMm2).toBe(fixture.expect.faces[0]!.clearAreaMm2);
  const added = store.getSnapshot().document.walls.find(w => !document.walls.some(old => old.id === w.id))!;
  expect(added.a).toBe(fixture.expect.committedCommand.fromJunction); expect(added.b).toBe(fixture.expect.committedCommand.toJunction);
  expect(snapPointer(document, [0, 0.4], { x: 20, y: 50, scale: 0.1 }, 'j6')).toEqual([0, 0]);
  expect(snapPointer(document, [1234.4, 1234.6], { x: 20, y: 50, scale: 0.1 })).toEqual([1234, 1235]);
  fc.assert(fc.property(fc.double({ min: -7.9, max: 7.9, noNaN: true }), distancePx => {
    expect(snapPointer(document, [0, distancePx / 0.1], { x: 0, y: 0, scale: 0.1 })).toEqual([0, 0]);
  }), { seed: 20261011, numRuns: 200 });
});
it('junction snap has hysteresis, a 250mm world cap and deterministic stable-ID ties', () => {
  const document = demo().getSnapshot().document;
  expect(snapPointer(document, [15, 0], { x: 0, y: 0, scale: 1 }, undefined, 12, 'j1')).toEqual([0, 0]);
  expect(snapPointer(document, [19, 0], { x: 0, y: 0, scale: 1 }, undefined, 12, 'j1')).toEqual([19, 0]);
  expect(snapPointer(document, [300, 0], { x: 0, y: 0, scale: 0.001 })).toEqual([300, 0]);
  const tied = { ...document, junctions: [{ id: 'aa', floorId: 'f0', x: -1, y: 0 }, { id: 'bb', floorId: 'f0', x: 1, y: 0 }] };
  expect(snapPointer(tied, [0, 0], { x: 0, y: 0, scale: 1 })).toEqual([-1, 0]);
});
it('moving the partition corner preserves axis constraints, exact approved areas and one undo', () => {
  const store = demo(), before = serializeProject(store.getSnapshot().document), moves = junctionMoves(store.getSnapshot().document, 'j2', [4600, 0]);
  const command = { id: 'corner_move', baseGeneration: 0, type: 'MoveJunctions' as const, moves };
  expect(store.preview(command).ok).toBe(true); expect(store.getSnapshot().localGeneration).toBe(0); expect(store.getSnapshot().canUndo).toBe(false);
  expect(serializeProject(store.getSnapshot().document)).toBe(before);
  expect(store.execute(command).ok).toBe(true); expect(store.getSnapshot().derived.faces.map(f => f.clearAreaMm2).sort((a, b) => b - a)).toEqual([21119175, 15395175]);
  expect(store.undo()).toBe(true); expect(store.undo()).toBe(false); expect(serializeProject(store.getSnapshot().document)).toBe(before);
});
it('invalid preview/commit and stale preview keep the canonical model and history intact', () => {
  const store = demo(), before = store.getSnapshot();
  const invalid = { id: 'bad_corner', baseGeneration: 0, type: 'MoveJunctions' as const, moves: junctionMoves(before.document, 'j2', [0, 0]) };
  expect(store.preview(invalid).ok).toBe(false); expect(store.execute(invalid).ok).toBe(false); expect(store.getSnapshot()).toBe(before);
  expect(store.preview({ ...invalid, baseGeneration: 12 }).ok).toBe(false); expect(store.getSnapshot()).toBe(before);
  expect(() => junctionMoves(before.document, 'missing', [1, 2])).toThrow(); expect(() => junctionMoves(before.document, 'j2', [0.4, 0])).toThrow();
});
it('orthogonal linked groups remain axis-aligned for bounded random corner movements', () => {
  const document = demo().getSnapshot().document;
  fc.assert(fc.property(fc.integer({ min: 100, max: 400 }), fc.integer({ min: 100, max: 400 }), (dx, dy) => {
    const moves = new Map(junctionMoves(document, 'j1', [dx, dy]).map(m => [m.junction, m.to]));
    for (const wall of document.walls) {
      const oldA = document.junctions.find(j => j.id === wall.a)!, oldB = document.junctions.find(j => j.id === wall.b)!;
      const a = moves.get(oldA.id) ?? [oldA.x, oldA.y], b = moves.get(oldB.id) ?? [oldB.x, oldB.y];
      expect(oldA.y === oldB.y ? a[1] === b[1] : a[0] === b[0]).toBe(true);
    }
  }), { seed: 20261011, numRuns: 500 });
});
it('fit places every sample junction inside a 390px/mobile or desktop viewport', () => {
  const document = demo().getSnapshot().document;
  for (const width of [320, 390, 768, 1440]) {
    const view = fitView(document, width, 450);
    for (const j of document.junctions) { const p = worldToScreen([j.x, j.y], view); expect(p[0]).toBeGreaterThan(0); expect(p[0]).toBeLessThan(width); expect(p[1]).toBeGreaterThan(0); expect(p[1]).toBeLessThan(450); }
  }
});

// FR-008 wall-segment dragging. These are Claude-authored analytic checks (not independent fixtures):
// every expected area is derived by hand from the H.6 geometry (walls 230 mm outside, 115 mm partition).
const areaOf = (store: ProjectStore, roomId: string) => store.getSnapshot().derived.faces.find(f => f.roomId === roomId)!.clearAreaMm2;
const dragWall = (store: ProjectStore, wallId: string, coordinate: number) =>
  store.execute({ id: `drag_${wallId}_${coordinate}`, baseGeneration: store.getSnapshot().localGeneration, type: 'MoveJunctions', moves: wallMoves(store.getSnapshot().document, wallId, coordinate) });
it('FR-008 dragging w7 +100mm equals the atomic MoveWall result byte for byte, with exact approved areas', () => {
  const dragged = demo(), moved = demo(), original = serializeProject({ ...dragged.getSnapshot().document, updatedAt: '' });
  expect(dragWall(dragged, 'w7', 4600).ok).toBe(true);
  expect(moved.execute({ id: 'move_w7', baseGeneration: 0, type: 'MoveWall', wallId: 'w7', dx: 100, dy: 0 }).ok).toBe(true);
  // Only the wall-clock updatedAt may differ between two separate executions.
  const stable = (store: ProjectStore) => ({ ...store.getSnapshot().document, updatedAt: '' });
  expect(serializeProject(stable(dragged))).toBe(serializeProject(stable(moved)));
  // 21,119,175 and 15,395,175 mm² are the exact values of §H.6/DM-003; the 21.1192 label is a rounded illustration.
  expect(areaOf(dragged, 'r_living')).toBe(21119175); expect(areaOf(dragged, 'r_bed')).toBe(15395175);
  expect(dragged.undo()).toBe(true); expect(serializeProject({ ...dragged.getSnapshot().document, updatedAt: '' })).toBe(original);
  expect(dragged.getSnapshot().localGeneration).toBe(2);
});
it('FR-008 a horizontal wall drags its collinear chain sideways; stretched walls and hosted openings stay valid', () => {
  const doc = demo().getSnapshot().document;
  expect(wallDrag(doc, 'w1')).toEqual({ axis: 'y', origin: [0, 0], along: 2250 });
  expect([...wallChain(doc, 'w1')].sort()).toEqual(['j1', 'j2', 'j3']);
  expect([...wallChain(doc, 'w7')].sort()).toEqual(['j2', 'j5']);
  const store = demo(); expect(dragWall(store, 'w1', 100).ok).toBe(true);
  const after = store.getSnapshot().document, y = (id: string) => after.junctions.find(j => j.id === id)!.y;
  expect(['j1', 'j2', 'j3'].map(y)).toEqual([100, 100, 100]); expect(['j4', 'j5', 'j6'].map(y)).toEqual([5000, 5000, 5000]);
  // Inner top face = 100 + 115 = 215; inner bottom face = 5000 - 115 = 4885; clear depth 4670.
  // Living 4327.5 x 4670 = 20,209,425 and Bedroom 3327.5 x 4670 = 15,539,425 mm².
  expect(areaOf(store, 'r_living')).toBe(20209425); expect(areaOf(store, 'r_bed')).toBe(15539425);
  expect(after.openings.map(o => [o.id, o.offset])).toEqual(demo().getSnapshot().document.openings.map(o => [o.id, o.offset]));
});
it('FR-008 a vertical outer wall drags outward and the larger room grows by exactly the analytic amount', () => {
  const store = demo(); expect(wallDrag(store.getSnapshot().document, 'w6')).toEqual({ axis: 'x', origin: [0, 5000], along: 2500 });
  expect(dragWall(store, 'w6', -200).ok).toBe(true);
  // Inner left face = -200 + 115 = -85; inner partition face 4442.5; clear width 4527.5; depth 4770.
  expect(areaOf(store, 'r_living')).toBe(21596175); expect(areaOf(store, 'r_bed')).toBe(15872175);
});
it('FR-008 impossible drags and bad input leave the model unchanged with a clear error', () => {
  const store = demo(), before = store.getSnapshot();
  // x = 7995 leaves w2 (j2 to j3 at x = 8000) only 5 mm long, below the 10 mm minimum.
  const result = dragWall(store, 'w7', 7995); expect(result.ok).toBe(false); expect(store.getSnapshot()).toBe(before);
  expect(() => wallMoves(before.document, 'w7', 4600.5)).toThrow(); expect(() => wallMoves(before.document, 'missing', 0)).toThrow();
  expect(() => wallMoves(before.document, 'w7', Number.NaN)).toThrow();
  const diagonal = { ...before.document, junctions: before.document.junctions.map(j => (j.id === 'j5' ? { ...j, x: 4700 } : j)) };
  expect(() => wallDrag(diagonal, 'w7')).toThrow();
});
it('FR-008 property: any valid w7 position gives the analytic areas; the sum only shifts between rooms', () => {
  fc.assert(fc.property(fc.integer({ min: 3500, max: 7500 }), x => {
    const store = demo(), result = dragWall(store, 'w7', x); expect(result.ok).toBe(true);
    // Living width x - 57.5 - 115, bedroom width 7885 - (x + 57.5); both times the 4770 mm clear depth.
    expect(areaOf(store, 'r_living')).toBe(4770 * x - 822825); expect(areaOf(store, 'r_bed')).toBe(4770 * (7827.5 - x));
    expect(areaOf(store, 'r_living') + areaOf(store, 'r_bed')).toBe(36514350);
  }), { seed: 20261017, numRuns: 80 });
});
