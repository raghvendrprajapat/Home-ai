import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import sample from '../../../docs/examples/sample-project.json';
import { FURNITURE_ALIGN_MODES, ProjectStore, serializeProject } from './index';
import type { Command, FurnitureAlignMode, ProjectDoc } from './index';

// FR-019 furniture alignment. Claude-authored analytic/property tests (not independent fixtures).
// Sample footprints (centre, size w x d, rotation) and their axis-aligned bounding boxes, by hand:
//   sofa   (1300,4300) 2000x900 rot180 -> x 300..2300,  y 3850..4750   (180 deg: half-extents 1000, 450)
//   tv     (2250, 400) 1800x400 rot0   -> x 1350..3150, y  200..600
//   bed    (6450,1200) 1800x2000 rot0  -> x 5550..7350, y  200..2200
//   wardrobe (6250,4500) 1800x600 rot180 -> x 5350..7150, y 4200..4800
const setup = () => new ProjectStore(structuredClone(sample) as ProjectDoc, 'align_session');
const ids = ['fu_sofa', 'fu_tv', 'fu_bed', 'fu_wardrobe'];
let serial = 0;
const align = (store: ProjectStore, furnitureIds: readonly string[], mode: FurnitureAlignMode | string) =>
  store.execute({ id: `align_${++serial}`, baseGeneration: store.getSnapshot().localGeneration, type: 'AlignFurniture', furnitureIds, mode } as Command);
const pos = (store: ProjectStore) => Object.fromEntries(store.getSnapshot().document.furniture.map(f => [f.id, [f.position.x, f.position.y]]));

describe('FR-019 AlignFurniture', () => {
  it('aligns bounding-box edges to the extreme edge, from the original positions', () => {
    const cases: [FurnitureAlignMode, Record<string, number[]>][] = [
      // left: reference 300 (sofa); each centre = 300 + half-width
      ['left', { fu_sofa: [1300, 4300], fu_tv: [1200, 400], fu_bed: [1200, 1200], fu_wardrobe: [1200, 4500] }],
      // right: reference 7350 (bed); each centre = 7350 - half-width
      ['right', { fu_sofa: [6350, 4300], fu_tv: [6450, 400], fu_bed: [6450, 1200], fu_wardrobe: [6450, 4500] }],
      // top: reference 200 (tv and bed); each centre = 200 + half-depth
      ['top', { fu_sofa: [1300, 650], fu_tv: [2250, 400], fu_bed: [6450, 1200], fu_wardrobe: [6250, 500] }],
      // bottom: reference 4800 (wardrobe); each centre = 4800 - half-depth
      ['bottom', { fu_sofa: [1300, 4350], fu_tv: [2250, 4600], fu_bed: [6450, 3800], fu_wardrobe: [6250, 4500] }],
    ];
    for (const [mode, expected] of cases) {
      const store = setup(), result = align(store, ids, mode);
      expect(result.ok, mode).toBe(true);
      expect(pos(store), mode).toEqual(expected);
    }
  });
  it('centre lines use the middle of the combined bounding box', () => {
    // tv + bed: x 1350..7350 -> centre 4350.  sofa + wardrobe: y 3850..4800 -> centre 4325.
    const a = setup(); expect(align(a, ['fu_tv', 'fu_bed'], 'centreX').ok).toBe(true);
    expect(pos(a).fu_tv).toEqual([4350, 400]); expect(pos(a).fu_bed).toEqual([4350, 1200]); expect(pos(a).fu_sofa).toEqual([1300, 4300]);
    const b = setup(); expect(align(b, ['fu_sofa', 'fu_wardrobe'], 'centreY').ok).toBe(true);
    expect(pos(b).fu_sofa).toEqual([1300, 4325]); expect(pos(b).fu_wardrobe).toEqual([6250, 4325]);
  });
  it('only the chosen items move and only along the aligned axis; the other axis, rotation and size are untouched', () => {
    const store = setup(), before = store.getSnapshot().document;
    expect(align(store, ['fu_tv', 'fu_bed'], 'left').ok).toBe(true);
    const after = store.getSnapshot().document;
    for (const f of after.furniture) {
      const old = before.furniture.find(o => o.id === f.id)!;
      expect(f.position.y).toBe(old.position.y); expect(f.rotationDeg).toBe(old.rotationDeg); expect(f.size).toEqual(old.size);
      if (!['fu_tv', 'fu_bed'].includes(f.id)) expect(f).toEqual(old);
    }
    expect(after.furniture.find(f => f.id === 'fu_tv')!.position.x).toBe(1350 + 900); // tv is already the left-most of the pair
    expect(after.furniture.find(f => f.id === 'fu_bed')!.position.x).toBe(1350 + 900);
  });
  it('rotated footprints use their rotated bounding box (90 degrees swaps width and depth)', () => {
    const doc = structuredClone(sample) as ProjectDoc;
    doc.furniture.find(f => f.id === 'fu_tv')!.rotationDeg = 90; // 1800x400 turned: half-extents 200 x 900
    const store = new ProjectStore(doc, 'align_rot');
    // tv x 2050..2450, y -500..1300; sofa x 300..2300 -> bottom edges: tv 1300, sofa 4750; align bottom -> tv centre y = 4750 - 900
    expect(align(store, ['fu_tv', 'fu_sofa'], 'bottom').ok).toBe(true);
    expect(pos(store).fu_tv).toEqual([2250, 3850]); expect(pos(store).fu_sofa).toEqual([1300, 4300]);
  });
  it('non-right-angle rotations stay integer mm within half a millimetre of the exact edge', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 359 }), fc.integer({ min: 500, max: 3000 }), fc.integer({ min: 500, max: 3000 }), (angle, w, d) => {
      const doc = structuredClone(sample) as ProjectDoc, item = doc.furniture.find(f => f.id === 'fu_bed')!;
      item.rotationDeg = angle; item.size = { w, d, h: 900 };
      const store = new ProjectStore(doc, 'align_prop'), r = angle * Math.PI / 180, halfX = (Math.abs(Math.cos(r)) * w + Math.abs(Math.sin(r)) * d) / 2;
      const result = align(store, ['fu_bed', 'fu_tv'], 'left'); expect(result.ok).toBe(true);
      const bed = store.getSnapshot().document.furniture.find(f => f.id === 'fu_bed')!, tv = store.getSnapshot().document.furniture.find(f => f.id === 'fu_tv')!;
      expect(Number.isInteger(bed.position.x) && Number.isInteger(tv.position.x)).toBe(true);
      const left = Math.min(6450 - halfX, 1350); // tv (unrotated) left edge is 1350
      expect(Math.abs(bed.position.x - halfX - left)).toBeLessThanOrEqual(0.5 + 1e-9);
      expect(Math.abs(tv.position.x - 900 - left)).toBeLessThanOrEqual(0.5 + 1e-9);
    }), { seed: 20261017, numRuns: 150 });
  });
  it('one Undo restores the exact document and a second identical alignment is a no-op without history', () => {
    const store = setup(), original = serializeProject(store.getSnapshot().document);
    expect(align(store, ids, 'left').ok).toBe(true); expect(store.getSnapshot().localGeneration).toBe(1);
    const second = align(store, ids, 'left'); expect(second.ok && second.changed).toBe(false); expect(store.getSnapshot().localGeneration).toBe(1);
    expect(store.undo()).toBe(true); expect(serializeProject(store.getSnapshot().document)).toBe(original); expect(store.getSnapshot().canUndo).toBe(false);
  });
  it('invalid selections, modes and out-of-domain results reject atomically', () => {
    const store = setup(), before = store.getSnapshot();
    const bad: [readonly string[] | unknown, unknown][] = [[['fu_sofa'], 'left'], [[], 'left'], [['fu_sofa', 'fu_sofa'], 'left'], [['fu_sofa', 'missing'], 'left'],
      [Array.from({ length: 501 }, (_, i) => `f_${i}`), 'left'], [ids, 'middle'], [ids, undefined], ['fu_sofa,fu_tv', 'left'], [[1, 2], 'left']];
    for (const [furnitureIds, mode] of bad) { expect(align(store, furnitureIds as string[], mode as string).ok).toBe(false); expect(store.getSnapshot()).toBe(before); }
    expect(FURNITURE_ALIGN_MODES).toEqual(['left', 'right', 'top', 'bottom', 'centreX', 'centreY']);
    // tv at x=99950 (valid) has right edge 100850. A 200 mm wide item aligned right would need centre 100750 > 100000.
    const edge = structuredClone(sample) as ProjectDoc; edge.furniture.find(f => f.id === 'fu_tv')!.position = { x: 99950, y: 400 };
    edge.furniture.find(f => f.id === 'fu_bed')!.size = { w: 200, d: 200, h: 900 };
    const limit = new ProjectStore(edge, 'align_limit'), kept = limit.getSnapshot();
    expect(align(limit, ['fu_tv', 'fu_bed'], 'right').ok).toBe(false); expect(limit.getSnapshot()).toBe(kept);
    expect(align(limit, ['fu_tv', 'fu_bed'], 'left').ok).toBe(true); // moving toward the plan is fine
  });
});
