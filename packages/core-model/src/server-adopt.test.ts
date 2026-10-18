import { describe, expect, it } from 'vitest';
import sample from '../../../docs/examples/sample-project.json';
import { ProjectStore, serializeProject } from './index';
import type { Command, ProjectDoc } from './index';

// FR-032 (D68) store support for "replace after review" and restore. Claude-authored tests.
const setup = () => new ProjectStore(structuredClone(sample) as ProjectDoc, 'adopt_session');
const rename = (store: ProjectStore, name: string) => store.execute({ id: `rename_${name.length}x`, baseGeneration: store.getSnapshot().localGeneration, type: 'RenameProject', name } as Command);

describe('FR-032 server adoption', () => {
  it('adoptServerRevision moves only the revision forward, never backwards or from a stale base', () => {
    const store = setup(); rename(store, 'Mine');
    const before = store.getSnapshot();
    expect(store.adoptServerRevision(1, 1)).toBe(false); expect(store.adoptServerRevision(0, 5)).toBe(false); expect(store.adoptServerRevision(1, 0)).toBe(false);
    expect(store.getSnapshot()).toBe(before);
    expect(store.adoptServerRevision(1, 4)).toBe(true);
    const after = store.getSnapshot();
    expect(after.document.revision).toBe(4); expect(after.localGeneration).toBe(before.localGeneration); expect(after.canUndo).toBe(true);
    expect(serializeProject({ ...after.document, revision: 1 })).toBe(serializeProject(before.document));
  });

  it('replaceFromServer takes a newer head of the same drawing exactly, advances the generation and clears history', () => {
    const store = setup(); rename(store, 'Local edit');
    const cloud = { ...structuredClone(sample) as ProjectDoc, revision: 6, name: 'Cloud head' };
    const generation = store.getSnapshot().localGeneration;
    const result = store.replaceFromServer(cloud);
    expect(result.ok).toBe(true);
    const after = store.getSnapshot();
    expect(serializeProject(after.document)).toBe(serializeProject(cloud));
    expect(after.localGeneration).toBe(generation + 1); expect(after.canUndo).toBe(false); expect(after.canRedo).toBe(false);
    expect(store.undo()).toBe(false);
  });

  it('replaceFromServer refuses another drawing, an older or equal revision, and invalid content without any change', () => {
    const store = setup(), before = store.getSnapshot();
    expect(store.replaceFromServer({ ...structuredClone(sample) as ProjectDoc, id: 'prj_other', revision: 9 }).ok).toBe(false);
    expect(store.replaceFromServer({ ...structuredClone(sample) as ProjectDoc, revision: 1 }).ok).toBe(false);
    expect(store.replaceFromServer({ ...structuredClone(sample) as ProjectDoc, revision: 2, walls: [] , rooms: [{ ...(sample as ProjectDoc).rooms[0]! }] }).ok).toBe(false);
    expect(store.getSnapshot()).toBe(before);
  });

});
