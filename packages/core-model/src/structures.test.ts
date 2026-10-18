import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import sample from '../../../docs/examples/sample-project.json';
import { floorOuterRect, ProjectStore, recoveryCopy, roofShape, serializeProject, stairFootprint, stairRiser, stairSteps, stairTread, validateProject } from './index';
import type { Command, MaterialDef, ProjectDoc, Stair } from './index';

// FR-035 stairs and roofs (D66). Claude-authored analytic tests, not independent fixtures.
// H.6 sample: outer 230 mm walls on the centreline rectangle 0..8000 x 0..5000, walls 3000 mm, floor f0 at elevation 0.
const stone: MaterialDef = { id: 'm_stair_stone', name: 'Stone', baseColor: '#9a948a', roughness: 0.9, metalness: 0 };
const tiles: MaterialDef = { id: 'm_roof_tiles', name: 'Clay tiles', baseColor: '#a5543a', roughness: 0.8, metalness: 0 };
const setup = () => new ProjectStore(structuredClone(sample) as ProjectDoc, 'structures_session');
let serial = 0;
const run = (store: ProjectStore, command: Record<string, unknown>) =>
  store.execute({ id: `structure_${++serial}`, baseGeneration: store.getSnapshot().localGeneration, ...command } as Command);
const doc = (store: ProjectStore) => store.getSnapshot().document;
const stair = { floorId: 'f0', position: { x: 2000, y: 2500 }, rotationDeg: 0, width: 900, length: 4000, height: 3000, steps: 16 } as const;

describe('FR-035 stair geometry', () => {
  it('a 3000 mm climb in 16 steps over 4000 mm: riser 187.5 mm, tread 250 mm, footprint 900 x 4000 centred on the position', () => {
    expect(stairRiser(stair)).toBe(187.5); expect(stairTread(stair)).toBe(250);
    expect(stairFootprint(stair)).toEqual([1550, 500, 2450, 4500]);
    const steps = stairSteps(stair);
    expect(steps).toHaveLength(16);
    // Climbing north (up the screen): the first step is at the south end, the last one reaches the full height at the north end.
    expect(steps[0]).toEqual({ rect: [1550, 4250, 2450, 4500], top: 187.5 });
    expect(steps[15]).toEqual({ rect: [1550, 500, 2450, 750], top: 3000 });
    expect(stairSteps({ ...stair, rotationDeg: 90 })[0]).toEqual({ rect: [0, 2050, 250, 2950], top: 187.5 }); // east: starts at the west end
    expect(stairFootprint({ ...stair, rotationDeg: 270 })).toEqual([0, 2050, 4000, 2950]);
  });

  it('steps tile the footprint exactly, without gaps or overlaps, in every direction', () => {
    fc.assert(fc.property(fc.constantFrom(0, 90, 180, 270), fc.integer({ min: 600, max: 2000 }), fc.integer({ min: 1000, max: 8000 }), fc.integer({ min: 2, max: 30 }), fc.integer({ min: 500, max: 6000 }),
      (rotationDeg, width, length, steps, height) => {
        const s = { position: { x: 0, y: 0 }, rotationDeg, width, length, steps, height } as Pick<Stair, 'position' | 'rotationDeg' | 'width' | 'length' | 'steps' | 'height'>;
        const area = stairSteps(s).reduce((sum, { rect }) => sum + (rect[2] - rect[0]) * (rect[3] - rect[1]), 0);
        expect(area).toBeCloseTo(width * length, 3);
        const tops = stairSteps(s).map(step => step.top);
        expect(tops.at(-1)).toBeCloseTo(height, 9);
        for (let i = 1; i < tops.length; i++) expect(tops[i]! - tops[i - 1]!).toBeCloseTo(height / steps, 9);
      }), { seed: 20261018, numRuns: 80 });
  });
});

describe('FR-035 roof geometry', () => {
  it('covers the outer wall rectangle plus the overhang and rests on the walls', () => {
    const d = structuredClone(sample) as ProjectDoc;
    expect(floorOuterRect(d, 'f0')).toEqual([-115, -115, 8115, 5115]);
    expect(roofShape(d, { floorId: 'f0', kind: 'flat', pitchDeg: 30, overhang: 300, ridgeAxis: 'x' })).toEqual({ rect: [-415, -415, 8415, 5415], base: 3000, rise: 0 });
    // Gable along X: half-span across Y is (5415 + 415) / 2 = 2915 mm; rise = 2915 x tan 30 deg = 1682.99... mm.
    const gable = roofShape(d, { floorId: 'f0', kind: 'gable', pitchDeg: 30, overhang: 300, ridgeAxis: 'x' })!;
    expect(gable.rise).toBeCloseTo(2915 / Math.sqrt(3), 9);
    expect(roofShape(d, { floorId: 'f0', kind: 'gable', pitchDeg: 45, overhang: 0, ridgeAxis: 'y' })!.rise).toBeCloseTo(4115, 9); // half of 8230
    expect(roofShape({ ...d, walls: [] }, { floorId: 'f0', kind: 'flat', pitchDeg: 30, overhang: 0, ridgeAxis: 'x' })).toBeNull();
  });
});

describe('FR-035 stair and roof commands', () => {
  it('adds, edits and deletes stairs atomically; Undo restores the exact original document', () => {
    const store = setup(), original = serializeProject(doc(store));
    expect(run(store, { type: 'AddStair', stair, material: stone }).ok).toBe(true);
    const added = doc(store).stairs!;
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ ...stair, material: 'm_stair_stone', rev: 0 });
    expect(doc(store).materials.some(m => m.id === 'm_stair_stone')).toBe(true);
    const id = added[0]!.id;
    expect(run(store, { type: 'UpdateStair', stairId: id, properties: { rotationDeg: 90, steps: 18 } }).ok).toBe(true);
    expect(doc(store).stairs![0]).toMatchObject({ rotationDeg: 90, steps: 18, rev: 1 });
    expect(run(store, { type: 'DeleteStair', stairId: id }).ok).toBe(true);
    expect(doc(store).stairs).toBeUndefined(); // an empty list is removed, not saved
    while (store.undo()) { /* back to the start */ }
    expect(serializeProject(doc(store))).toBe(original);
  });

  it('rejects stairs outside the allowed sizes, outside the drawing or on a missing floor without changing anything', () => {
    const store = setup(), before = store.getSnapshot();
    for (const bad of [{ width: 599 }, { width: 2001 }, { length: 999 }, { steps: 1 }, { steps: 31 }, { height: 499 }, { rotationDeg: 45 }, { floorId: 'missing' }, { position: { x: 99900, y: 0 } }, { position: { x: 0.5, y: 0 } }])
      expect(run(store, { type: 'AddStair', stair: { ...stair, ...bad }, material: stone }).ok, JSON.stringify(bad)).toBe(false);
    expect(run(store, { type: 'UpdateStair', stairId: 'missing', properties: { steps: 10 } }).ok).toBe(false);
    expect(store.getSnapshot()).toBe(before);
  });

  it('one roof per floor: SetRoof adds, changes and removes it; pitch and overhang ranges hold', () => {
    const store = setup(), original = serializeProject(doc(store));
    expect(run(store, { type: 'SetRoof', floorId: 'f0', roof: { kind: 'gable', pitchDeg: 30, overhang: 300, ridgeAxis: 'x' }, material: tiles }).ok).toBe(true);
    const roof = doc(store).roofs![0]!;
    expect(roof).toMatchObject({ floorId: 'f0', kind: 'gable', pitchDeg: 30, overhang: 300, ridgeAxis: 'x', material: 'm_roof_tiles', rev: 0 });
    expect(run(store, { type: 'SetRoof', floorId: 'f0', roof: { kind: 'flat', pitchDeg: 30, overhang: 0, ridgeAxis: 'x' } }).ok).toBe(true);
    expect(doc(store).roofs).toEqual([{ ...roof, kind: 'flat', overhang: 0, rev: 1 }]); // same roof, same id, keeps its material
    const before = store.getSnapshot();
    for (const bad of [{ pitchDeg: 4 }, { pitchDeg: 61 }, { overhang: -1 }, { overhang: 1001 }, { kind: 'hip' }, { ridgeAxis: 'z' }])
      expect(run(store, { type: 'SetRoof', floorId: 'f0', roof: { kind: 'flat', pitchDeg: 30, overhang: 0, ridgeAxis: 'x', ...bad } }).ok, JSON.stringify(bad)).toBe(false);
    expect(run(store, { type: 'SetRoof', floorId: 'missing', roof: { kind: 'flat', pitchDeg: 30, overhang: 0, ridgeAxis: 'x' }, material: tiles }).ok).toBe(false);
    expect(store.getSnapshot()).toBe(before);
    expect(run(store, { type: 'SetRoof', floorId: 'f0', roof: null }).ok).toBe(true);
    expect(doc(store).roofs).toBeUndefined();
    while (store.undo()) { /* back to the start */ }
    expect(serializeProject(doc(store))).toBe(original);
  });

  it('a first roof needs a material; deleting a floor takes its stairs and roof with it', () => {
    const store = setup();
    expect(run(store, { type: 'SetRoof', floorId: 'f0', roof: { kind: 'flat', pitchDeg: 30, overhang: 0, ridgeAxis: 'x' } }).ok).toBe(false);
    run(store, { type: 'AddFloor', name: 'First floor', copyOutlineFrom: 'f0' });
    const upper = doc(store).floors[1]!.id;
    expect(run(store, { type: 'AddStair', stair, material: stone }).ok).toBe(true);
    expect(run(store, { type: 'SetRoof', floorId: upper, roof: { kind: 'gable', pitchDeg: 25, overhang: 450, ridgeAxis: 'y' }, material: tiles }).ok).toBe(true);
    expect(run(store, { type: 'AddStair', stair: { ...stair, floorId: upper }, material: stone }).ok).toBe(true);
    expect(roofShape(doc(store), doc(store).roofs![0]!)!.base).toBe(6000); // upper floor at 3000 + 3000 mm walls
    expect(run(store, { type: 'DeleteFloor', floorId: upper }).ok).toBe(true);
    expect(doc(store).roofs).toBeUndefined();
    expect(doc(store).stairs!.map(s => s.floorId)).toEqual(['f0']);
  });

  it('validation rejects two roofs on one floor and missing materials; a recovery copy renames every reference', () => {
    const store = setup();
    run(store, { type: 'AddStair', stair, material: stone });
    run(store, { type: 'SetRoof', floorId: 'f0', roof: { kind: 'flat', pitchDeg: 30, overhang: 0, ridgeAxis: 'x' }, material: tiles });
    const d = structuredClone(doc(store)) as ProjectDoc;
    expect(validateProject(d)).toEqual([]);
    expect(validateProject({ ...d, roofs: [...d.roofs!, { ...d.roofs![0]!, id: 'roof_second' }] }).map(e => e.code)).toContain('roof-floor');
    expect(validateProject({ ...d, stairs: [{ ...d.stairs![0]!, material: 'nope' }] }).map(e => e.code)).toContain('material-reference');
    let next = 0;
    const copy = recoveryCopy(d, '2026-10-18T00:00:00.000Z', () => `copy_${++next}`);
    expect(copy.stairs![0]!.id).not.toBe(d.stairs![0]!.id);
    expect(copy.materials.some(m => m.id === copy.stairs![0]!.material && m.name === 'Stone')).toBe(true);
    expect(copy.floors.some(f => f.id === copy.roofs![0]!.floorId)).toBe(true);
  });
});
