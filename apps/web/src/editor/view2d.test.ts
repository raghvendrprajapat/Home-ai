import { expect, it } from 'vitest';
import fc from 'fast-check';
import { parseProject, ProjectStore, serializeProject } from '@gharplan/core-model';
import sample from '../../../../docs/examples/sample-project.json';
import gap from '../../../../tests/fixtures/independent/geometry/closing-gap.json';
import { fitView, junctionMoves, screenToWorld, snapPointer, worldToScreen, zoomAt } from './view2d';

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
