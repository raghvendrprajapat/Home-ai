import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import sample from '../../../docs/examples/sample-project.json';
import { ProjectStore, serializeProject } from './index';
import type { Command, ProjectDoc } from './index';

// FR-019 rotating furniture together (group rotation). Claude-authored analytic/property tests (not independent fixtures).
// Hand-derived bounding boxes: sofa (1300,4300) 2000x900 rot180 -> x 300..2300, y 3850..4750; tv (2250,400) 1800x400 rot0 -> x 1350..3150, y 200..600.
// Combined box x 300..3150, y 200..4750 -> pivot (1725, 2475).
// Positive degrees turn clockwise on screen (Y down): offset (dx,dy) -> (dx cos - dy sin, dx sin + dy cos); +90 gives (-dy, dx).
const setup = (doc = structuredClone(sample) as ProjectDoc) => new ProjectStore(doc, 'rotate_session');
let serial = 0;
const rotate = (store: ProjectStore, furnitureIds: readonly string[] | unknown, deltaDeg: unknown) =>
  store.execute({ id: `rotate_${++serial}`, baseGeneration: store.getSnapshot().localGeneration, type: 'RotateFurniture', furnitureIds, deltaDeg } as Command);
const get = (store: ProjectStore, id: string) => store.getSnapshot().document.furniture.find(f => f.id === id)!;
const pair = ['fu_sofa', 'fu_tv'];

describe('FR-019 RotateFurniture', () => {
  it('+90 turns the pair about the combined box centre, exactly', () => {
    const store = setup(); expect(rotate(store, pair, 90).ok).toBe(true);
    // sofa offset (-425, 1825) -> (-1825, -425) -> (-100, 2050); tv offset (525, -2075) -> (2075, 525) -> (3800, 3000).
    expect(get(store, 'fu_sofa').position).toEqual({ x: -100, y: 2050 }); expect(get(store, 'fu_sofa').rotationDeg).toBe(270);
    expect(get(store, 'fu_tv').position).toEqual({ x: 3800, y: 3000 }); expect(get(store, 'fu_tv').rotationDeg).toBe(90);
    expect(get(store, 'fu_bed')).toEqual(setup().getSnapshot().document.furniture.find(f => f.id === 'fu_bed')); // unselected items untouched
  });
  it('-90 (anticlockwise) and 180 match the hand values; four quarter turns return the exact document', () => {
    const a = setup(); expect(rotate(a, pair, -90).ok).toBe(true);
    // -90: (dx,dy) -> (dy, -dx). sofa (1825, 425) -> (3550, 2900); tv (-2075, -525) -> (-350, 1950).
    expect(get(a, 'fu_sofa').position).toEqual({ x: 3550, y: 2900 }); expect(get(a, 'fu_sofa').rotationDeg).toBe(90);
    expect(get(a, 'fu_tv').position).toEqual({ x: -350, y: 1950 }); expect(get(a, 'fu_tv').rotationDeg).toBe(270);
    const b = setup(); expect(rotate(b, pair, 180).ok).toBe(true);
    // 180: (dx,dy) -> (-dx,-dy). sofa (2150, 650) rot 0; tv (1200, 4550) rot 180.
    expect(get(b, 'fu_sofa').position).toEqual({ x: 2150, y: 650 }); expect(get(b, 'fu_sofa').rotationDeg).toBe(0);
    expect(get(b, 'fu_tv').position).toEqual({ x: 1200, y: 4550 }); expect(get(b, 'fu_tv').rotationDeg).toBe(180);
    const c = setup(), original = serializeProject(c.getSnapshot().document).replace(/"rev":\d+/g, '');
    for (let i = 0; i < 4; i++) expect(rotate(c, pair, 90).ok).toBe(true);
    expect(serializeProject(c.getSnapshot().document).replace(/"rev":\d+/g, '').replace(/"updatedAt":"[^"]*"/, '')).toBe(original.replace(/"updatedAt":"[^"]*"/, ''));
  });
  it('a single item turns in place about its own centre', () => {
    const store = setup(); expect(rotate(store, ['fu_bed'], 90).ok).toBe(true);
    expect(get(store, 'fu_bed').position).toEqual({ x: 6450, y: 1200 }); expect(get(store, 'fu_bed').rotationDeg).toBe(90);
  });
  it('one Undo restores the exact document; 0 and 360 are no-ops without history', () => {
    const store = setup(), original = serializeProject(store.getSnapshot().document);
    for (const turn of [0, 360, -360]) { const r = rotate(store, pair, turn); expect(r.ok && r.changed).toBe(false); }
    expect(store.getSnapshot().localGeneration).toBe(0);
    expect(rotate(store, pair, 15).ok).toBe(true); expect(store.undo()).toBe(true);
    expect(serializeProject(store.getSnapshot().document)).toBe(original); expect(store.getSnapshot().canUndo).toBe(false);
  });
  it('any angle keeps integer positions, rotations in [0,360) and every pairwise distance within rounding', () => {
    fc.assert(fc.property(fc.integer({ min: -359, max: 359 }), fc.subarray(['fu_sofa', 'fu_tv', 'fu_bed', 'fu_wardrobe'], { minLength: 2 }), (turn, ids) => {
      const store = setup(), before = store.getSnapshot().document;
      expect(rotate(store, ids, turn).ok).toBe(true);
      const after = store.getSnapshot().document, at = (doc: { readonly furniture: readonly ProjectDoc["furniture"][number][] }, id: string) => doc.furniture.find(f => f.id === id)!;
      for (const id of ids) {
        const item = at(after, id), old = at(before, id);
        expect(Number.isInteger(item.position.x) && Number.isInteger(item.position.y)).toBe(true);
        expect(item.rotationDeg >= 0 && item.rotationDeg < 360).toBe(true);
        expect(Math.abs(((item.rotationDeg - old.rotationDeg - turn) % 360 + 540) % 360 - 180)).toBeLessThan(1e-9);
        for (const other of ids) {
          // Each centre is rounded at most 0.5 mm per axis, so a distance changes by at most 2 * sqrt(0.5) mm.
          const d = (doc: Parameters<typeof at>[0]) => Math.hypot(at(doc, id).position.x - at(doc, other).position.x, at(doc, id).position.y - at(doc, other).position.y);
          expect(Math.abs(d(after) - d(before))).toBeLessThanOrEqual(Math.SQRT2 + 1e-9);
        }
      }
    }), { seed: 20261017, numRuns: 200 });
  });
  it('invalid selections, angles and out-of-domain results reject atomically', () => {
    const store = setup(), before = store.getSnapshot();
    const bad: [unknown, unknown][] = [[[], 90], [['fu_sofa', 'fu_sofa'], 90], [['missing'], 90], ['fu_sofa', 90], [[1], 90],
      [Array.from({ length: 501 }, (_, i) => `f_${i}`), 90], [pair, NaN], [pair, Infinity], [pair, 361], [pair, '90'], [pair, undefined]];
    for (const [ids, turn] of bad) { expect(rotate(store, ids, turn).ok).toBe(false); expect(store.getSnapshot()).toBe(before); }
    // tv (99000,99000) box x 98100..99900, y 98800..99200; bed (-99000,-99000) box x -99900..-98100, y -100000..-98000 -> pivot (0, -400).
    // 45 degrees sends the tv offset (99000, 99400) to y = -400 + 198400 * sqrt(1/2) = about 139888: outside +/-100000. 90 degrees stays inside.
    const far = structuredClone(sample) as ProjectDoc;
    far.furniture.find(f => f.id === 'fu_tv')!.position = { x: 99000, y: 99000 }; far.furniture.find(f => f.id === 'fu_bed')!.position = { x: -99000, y: -99000 };
    const limit = setup(far), kept = limit.getSnapshot();
    expect(rotate(limit, ['fu_tv', 'fu_bed'], 45).ok).toBe(false); expect(limit.getSnapshot()).toBe(kept);
    expect(rotate(limit, ['fu_tv', 'fu_bed'], 90).ok).toBe(true);
  });
});
