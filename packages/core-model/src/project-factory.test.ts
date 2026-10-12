import { expect, it } from 'vitest';
import fc from 'fast-check';
import { createBlankProject, parseProject, ProjectStore, serializeProject, validateProject } from './index';
const now = '2026-10-12T11:00:00.000Z';
const ids = () => { let i = 0; return () => `created_${++i}`; };
it('blank creation is schema-valid, deterministic and ready for atomic drawing commands', () => {
  const doc = createBlankProject({ name: '  मेरा घर  ', units: 'metric', now, nextId: ids(), floorName: 'भूतल', materialName: 'मूल सतह' });
  expect(validateProject(doc)).toEqual([]); expect(doc.name).toBe('मेरा घर'); expect(doc.revision).toBe(0);
  expect([doc.id, doc.floors[0]!.id, doc.materials[0]!.id]).toEqual(['created_1', 'created_2', 'created_3']);
  const store = new ProjectStore(doc, 'blank_session'); expect(store.getSnapshot().derived.faces).toEqual([]);
  expect(parseProject(serializeProject(doc))).toEqual({ ok: true, document: doc });
  const before = serializeProject(doc);
  expect(store.execute({ type: 'AddRectangle', id: 'first_room', baseGeneration: 0, x: 0, y: 0, width: 4000, depth: 4000, thickness: 200, height: 2700 }).ok).toBe(true);
  expect(store.getSnapshot().derived.faces[0]!.clearAreaMm2).toBe(14440000); expect(store.undo()).toBe(true);
  expect(serializeProject(store.getSnapshot().document)).toBe(before);
});
it('blank factories reject invalid names/IDs/clock without returning partial drawings', () => {
  const base = { name: 'House', units: 'metric' as const, now, nextId: ids() };
  expect(() => createBlankProject({ ...base, name: '  ' })).toThrow();
  expect(() => createBlankProject({ ...base, name: 'x'.repeat(121) })).toThrow();
  expect(() => createBlankProject({ ...base, nextId: () => 'duplicate' })).toThrow();
  expect(() => createBlankProject({ ...base, now: 'invalid' })).toThrow();
});
it('seeded names/units preserve exact content and distinct identity in an empty document', () => {
  fc.assert(fc.property(fc.string({ minLength: 1, maxLength: 100 }).filter(name => !!name.trim()), fc.constantFrom('metric' as const, 'imperial' as const), (name, units) => {
    const doc = createBlankProject({ name, units, now, nextId: ids() });
    expect(doc.name).toBe(name.trim()); expect(doc.units).toBe(units); expect(doc.rooms).toEqual([]);
    expect(new Set([doc.id, doc.floors[0]!.id, doc.materials[0]!.id]).size).toBe(3);
    expect(parseProject(serializeProject(doc))).toEqual({ ok: true, document: doc });
  }), { seed: 20261012, numRuns: 100 });
});
