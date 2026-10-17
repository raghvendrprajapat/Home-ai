import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import sample from '../../../docs/examples/sample-project.json';
import { ProjectStore, serializeProject } from './index';
import type { Command, ProjectDoc } from './index';

// FR-019 furniture grouping. Claude-authored analytic/property tests (not independent fixtures).
// Sample furniture: fu_sofa (1300,4300), fu_tv (2250,400), fu_bed (6450,1200), fu_wardrobe (6250,4500).
const setup = (doc: ProjectDoc = structuredClone(sample) as ProjectDoc) => new ProjectStore(doc, 'group_session');
let serial = 0;
const run = (store: ProjectStore, body: Record<string, unknown>) => store.execute({ id: `group_${++serial}`, baseGeneration: store.getSnapshot().localGeneration, ...body } as Command);
const group = (store: ProjectStore) => Object.fromEntries(store.getSnapshot().document.furniture.map(f => [f.id, f.groupId ?? null]));
const pos = (store: ProjectStore, id: string) => store.getSnapshot().document.furniture.find(f => f.id === id)!.position;

describe('FR-019 GroupFurniture / UngroupFurniture / MoveFurniture', () => {
  it('grouping gives the chosen items one fresh group ID and leaves others alone; one Undo removes it', () => {
    const store = setup(), original = serializeProject(store.getSnapshot().document);
    expect(run(store, { type: 'GroupFurniture', furnitureIds: ['fu_sofa', 'fu_tv'] }).ok).toBe(true);
    expect(group(store)).toEqual({ fu_sofa: 'group_1', fu_tv: 'group_1', fu_bed: null, fu_wardrobe: null });
    expect(store.undo()).toBe(true); expect(serializeProject(store.getSnapshot().document)).toBe(original);
  });
  it('grouping an item that is already grouped merges its whole group; regrouping the same set is a no-op', () => {
    const store = setup();
    run(store, { type: 'GroupFurniture', furnitureIds: ['fu_sofa', 'fu_tv'] });
    expect(run(store, { type: 'GroupFurniture', furnitureIds: ['fu_sofa', 'fu_bed'] }).ok).toBe(true);
    // group_1 is still in use when the new ID is chosen, so the merged group is group_2.
    expect(group(store)).toEqual({ fu_sofa: "group_2", fu_tv: "group_2", fu_bed: "group_2", fu_wardrobe: null });
    const again = run(store, { type: 'GroupFurniture', furnitureIds: ['fu_tv', 'fu_bed'] });
    expect(again.ok && again.changed).toBe(false); expect(store.getSnapshot().localGeneration).toBe(2);
  });
  it('ungrouping any member dissolves its whole group', () => {
    const store = setup();
    run(store, { type: 'GroupFurniture', furnitureIds: ['fu_sofa', 'fu_tv', 'fu_bed'] });
    expect(run(store, { type: 'UngroupFurniture', furnitureIds: ['fu_tv'] }).ok).toBe(true);
    expect(group(store)).toEqual({ fu_sofa: null, fu_tv: null, fu_bed: null, fu_wardrobe: null });
    const none = run(store, { type: 'UngroupFurniture', furnitureIds: ['fu_wardrobe'] }); expect(none.ok && none.changed).toBe(false);
  });
  it('MoveFurniture moves every listed item by exactly the same integer delta in one command', () => {
    const store = setup();
    expect(run(store, { type: 'MoveFurniture', furnitureIds: ['fu_sofa', 'fu_tv'], dx: 100, dy: -50 }).ok).toBe(true);
    expect(pos(store, 'fu_sofa')).toEqual({ x: 1400, y: 4250 }); expect(pos(store, 'fu_tv')).toEqual({ x: 2350, y: 350 });
    expect(pos(store, 'fu_bed')).toEqual({ x: 6450, y: 1200 }); expect(store.getSnapshot().localGeneration).toBe(1);
    expect(store.undo()).toBe(true); expect(pos(store, 'fu_sofa')).toEqual({ x: 1300, y: 4300 });
  });
  it('property: a group move preserves every pairwise offset exactly', () => {
    fc.assert(fc.property(fc.integer({ min: -2000, max: 2000 }), fc.integer({ min: -2000, max: 2000 }), (dx, dy) => {
      const store = setup(), ids = ['fu_sofa', 'fu_tv', 'fu_bed'], before = ids.map(id => pos(store, id));
      expect(run(store, { type: 'MoveFurniture', furnitureIds: ids, dx, dy }).ok).toBe(true);
      const after = ids.map(id => pos(store, id));
      for (let i = 0; i < ids.length; i++) expect(after[i]).toEqual({ x: before[i]!.x + dx, y: before[i]!.y + dy });
    }), { seed: 20261017, numRuns: 100 });
  });
  it('invalid input and an out-of-domain move reject atomically', () => {
    const store = setup(), before = store.getSnapshot();
    for (const body of [
      { type: 'GroupFurniture', furnitureIds: ['fu_sofa'] }, { type: 'GroupFurniture', furnitureIds: ['fu_sofa', 'fu_sofa'] }, { type: 'GroupFurniture', furnitureIds: ['fu_sofa', 'missing'] },
      { type: 'UngroupFurniture', furnitureIds: [] }, { type: 'MoveFurniture', furnitureIds: ['fu_sofa'], dx: 0.5, dy: 0 }, { type: 'MoveFurniture', furnitureIds: ['fu_sofa'], dx: '1', dy: 0 },
      { type: 'MoveFurniture', furnitureIds: ['fu_sofa', 'fu_tv'], dx: 99000, dy: 0 }, { type: 'MoveFurniture', furnitureIds: Array.from({ length: 501 }, (_, i) => `f_${i}`), dx: 1, dy: 1 },
    ]) { expect(run(store, body).ok, JSON.stringify(body)).toBe(false); expect(store.getSnapshot()).toBe(before); }
  });
  it('duplicating group members still gives independent copies with no group (existing rule)', () => {
    const store = setup(); run(store, { type: 'GroupFurniture', furnitureIds: ['fu_sofa', 'fu_tv'] });
    expect(run(store, { type: 'DuplicateFurniture', furnitureIds: ['fu_sofa', 'fu_tv'] }).ok).toBe(true);
    const copies = store.getSnapshot().document.furniture.filter(f => !['fu_sofa', 'fu_tv', 'fu_bed', 'fu_wardrobe'].includes(f.id));
    expect(copies).toHaveLength(2); expect(copies.every(c => c.groupId === undefined)).toBe(true);
  });
});
