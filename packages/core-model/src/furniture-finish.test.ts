import { describe, expect, it } from 'vitest';
import sample from '../../../docs/examples/sample-project.json';
import { FURNITURE_FINISH_SLOT, ProjectStore, serializeProject } from './index';
import type { Command, MaterialDef, ProjectDoc } from './index';

// FR-022 furniture colour variants. Claude-authored analytic tests (not independent fixtures).
const setup = () => new ProjectStore(structuredClone(sample) as ProjectDoc, 'finish_session');
let serial = 0;
const finish = (store: ProjectStore, furnitureIds: unknown, material: unknown) =>
  store.execute({ id: `finish_${++serial}`, baseGeneration: store.getSnapshot().localGeneration, type: 'SetFurnitureFinish', furnitureIds, material } as Command);
const navy: MaterialDef = { id: 'm_fin_navy', name: 'Navy', baseColor: '#2f3e5c', roughness: 0.7, metalness: 0 };
const item = (store: ProjectStore, id: string) => store.getSnapshot().document.furniture.find(f => f.id === id)!;

describe('FR-022 SetFurnitureFinish', () => {
  it('installs a new finish once and points every chosen item at it through the main slot', () => {
    const store = setup(), materials = store.getSnapshot().document.materials.length;
    expect(FURNITURE_FINISH_SLOT).toBe('main');
    expect(finish(store, ['fu_sofa', 'fu_tv'], navy).ok).toBe(true);
    expect(item(store, 'fu_sofa').materialOverrides).toEqual({ main: 'm_fin_navy' }); expect(item(store, 'fu_tv').materialOverrides).toEqual({ main: 'm_fin_navy' });
    expect(store.getSnapshot().document.materials).toHaveLength(materials + 1);
    expect(store.getSnapshot().document.materials.at(-1)).toEqual(navy);
    expect(finish(store, ['fu_wardrobe'], navy).ok).toBe(true); // the same definition is reused, not duplicated
    expect(store.getSnapshot().document.materials).toHaveLength(materials + 1);
    expect(item(store, 'fu_bed').materialOverrides).toEqual({ frame: 'm_wood_laminate' }); // untouched items keep theirs
  });
  it('null restores the model colours, replacing any older override; one Undo restores the exact document', () => {
    const store = setup(), original = serializeProject(store.getSnapshot().document);
    expect(finish(store, ['fu_bed'], null).ok).toBe(true); expect(item(store, 'fu_bed').materialOverrides).toEqual({});
    expect(store.undo()).toBe(true); expect(serializeProject(store.getSnapshot().document)).toBe(original);
    expect(finish(store, ['fu_bed'], navy).ok).toBe(true); expect(item(store, 'fu_bed').materialOverrides).toEqual({ main: 'm_fin_navy' });
    expect(store.undo()).toBe(true); expect(serializeProject(store.getSnapshot().document)).toBe(original); expect(store.getSnapshot().canUndo).toBe(false);
  });
  it('repeating the same finish is a no-op without history', () => {
    const store = setup(); expect(finish(store, ['fu_sofa'], navy).ok).toBe(true); expect(store.getSnapshot().localGeneration).toBe(1);
    const again = finish(store, ['fu_sofa'], navy); expect(again.ok && again.changed).toBe(false); expect(store.getSnapshot().localGeneration).toBe(1);
  });
  it('invalid selections, conflicting or malformed materials reject atomically', () => {
    const store = setup(), before = store.getSnapshot(), existing = before.document.materials[0]!;
    const bad: [unknown, unknown][] = [[[], navy], [['fu_sofa', 'fu_sofa'], navy], [['missing'], navy], ['fu_sofa', navy], [[1], navy],
      [Array.from({ length: 501 }, (_, i) => `f_${i}`), navy], [['fu_sofa'], undefined], [['fu_sofa'], 'm_fin_navy'], [['fu_sofa'], [navy]],
      [['fu_sofa'], { ...existing, baseColor: existing.baseColor === '#000000' ? '#ffffff' : '#000000' }], // same ID, different definition
      [['fu_sofa'], { ...navy, baseColor: 'navy' }], [['fu_sofa'], { ...navy, id: 'x' }], [['fu_sofa'], { ...navy, roughness: 2 }]];
    for (const [ids, material] of bad) { expect(finish(store, ids, material).ok).toBe(false); expect(store.getSnapshot()).toBe(before); }
  });
});
