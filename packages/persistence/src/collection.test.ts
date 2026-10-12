import 'fake-indexeddb/auto';
import { afterEach, expect, it } from 'vitest';
import { createBlankProject, ProjectStore, serializeProject } from '@gharplan/core-model';
import type { ModelChange } from '@gharplan/core-model';
import type { Immutable } from 'immer';
import { IndexedProjectStorage, prepare, recover } from './index';
const connections: IndexedProjectStorage[] = [];
afterEach(() => { for (const c of connections.splice(0)) c.close(); });
const blank = (prefix: string) => { let n = 0; return createBlankProject({ name: prefix, units: 'metric', now: '2026-10-12T11:00:00.000Z', nextId: () => `${prefix}_${++n}` }); };
async function setup() { const name = `collection_${crypto.randomUUID()}`, storage = await IndexedProjectStorage.open(indexedDB, name); connections.push(storage); return { name, storage }; }
async function row(storage: IndexedProjectStorage, id: string) {
  return new Promise<unknown>((resolve, reject) => { const tx = storage.db.transaction('projects'), r = tx.objectStore('projects').get(id); tx.oncomplete = () => resolve(r.result); tx.onabort = () => reject(tx.error); });
}
it('project list/open/activation preserves documents and background save never switches selection', async () => {
  const { storage } = await setup(), first = new ProjectStore(blank('first'), 'first_session'), changes: Immutable<ModelChange>[] = [];
  const firstMeta = await storage.initialize(first.getSnapshot().document); first.subscribeChanges(c => changes.push(c));
  expect(first.execute({ type: 'RenameProject', id: 'rename_first', baseGeneration: 0, name: 'Renamed first' }).ok).toBe(true);
  const second = blank('second'), secondMeta = await storage.initialize(second);
  const next = await storage.commit(await prepare(firstMeta, changes));
  expect((await storage.readActive())!.meta.projectId).toBe(second.id);
  expect((await storage.listProjects()).projects.map(p => p.name).sort()).toEqual(['Renamed first', 'second']);
  const loaded = await recover((await storage.readProject(firstMeta.projectId))!); expect(serializeProject(loaded.document)).toBe(serializeProject(first.getSnapshot().document));
  await expect(storage.activate(firstMeta)).rejects.toMatchObject({ kind: 'conflict' });
  expect((await storage.readActive())!.meta.projectId).toBe(second.id);
  await storage.activate(next); expect((await storage.readActive())!.meta.projectId).toBe(firstMeta.projectId);
  expect(serializeProject((await recover((await storage.readProject(secondMeta.projectId))!)).document)).toBe(serializeProject(second));
});
it('trash is reversible, preserves checkpoints, rejects stale editors and never silently untrashes', async () => {
  const { storage } = await setup(), store = new ProjectStore(blank('kept'), 'kept_session'), meta = await storage.initialize(store.getSnapshot().document), changes: Immutable<ModelChange>[] = [];
  store.subscribeChanges(c => changes.push(c)); expect(store.execute({ type: 'RenameProject', id: 'rename_pending', baseGeneration: 0, name: 'Pending rename' }).ok).toBe(true);
  const prepared = await prepare(meta, changes), before = (await storage.readProject(meta.projectId))!;
  await storage.setTrashed(meta, true); expect(await storage.readActive()).toBeNull();
  expect((await storage.listProjects()).projects[0]!.trashedAt).toMatch(/^\d{4}-\d\d-\d\dT/);
  await expect(storage.activate(meta)).rejects.toMatchObject({ kind: 'conflict' });
  await expect(storage.commit(prepared)).rejects.toMatchObject({ kind: 'conflict' });
  const retained = (await storage.readProject(meta.projectId))!; expect(retained.meta.seq).toBe(0);
  expect(new Uint8Array(await retained.checkpoints[0]!.packed.blob.arrayBuffer())).toEqual(new Uint8Array(await before.checkpoints[0]!.packed.blob.arrayBuffer()));
  expect(retained.journal).toEqual([]);
  await storage.setTrashed(meta, false); await storage.activate(meta);
  expect((await storage.listProjects()).projects[0]!.trashedAt).toBeUndefined();
  await storage.commit(prepared); expect((await storage.readActive())!.meta.name).toBe('Pending rename');
});
it('independent connection cannot activate a project trashed earlier in the transaction queue', async () => {
  const { storage, name } = await setup(), other = await IndexedProjectStorage.open(indexedDB, name); connections.push(other);
  const meta = await storage.initialize(blank('raced'));
  const outcomes = await Promise.allSettled([storage.setTrashed(meta, true), other.activate(meta)]);
  expect(outcomes[0]!.status).toBe('fulfilled'); expect(outcomes[1]!.status).toBe('rejected');
  expect(await other.readActive()).toBeNull(); expect((await other.readProject(meta.projectId))!.meta.trashedAt).toBeTruthy();
});
it('damaged list entries warn without hiding valid projects or rewriting originals', async () => {
  const { storage } = await setup(), meta = await storage.initialize(blank('valid')), damaged = { ...meta, projectId: 'damaged', checkpointSeqs: [-1] };
  await new Promise<void>((resolve, reject) => { const tx = storage.db.transaction('projects', 'readwrite'); tx.objectStore('projects').put(damaged); tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); });
  const listed = await storage.listProjects(); expect(listed.projects.map(p => p.projectId)).toEqual([meta.projectId]); expect(listed.warnings).toHaveLength(1);
  expect(await row(storage, 'damaged')).toEqual(damaged); await expect(storage.readProject('bad/id')).rejects.toThrow();
});
it('oversized collections reject rather than silently truncate/delete saved metadata', async () => {
  const { storage } = await setup(), meta = await storage.initialize(blank('original'));
  await new Promise<void>((resolve, reject) => { const tx = storage.db.transaction('projects', 'readwrite'); for (let i = 0; i <= 1000; i++) tx.objectStore('projects').put({ ...meta, projectId: `saved_${i}` }); tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); });
  await expect(storage.listProjects()).rejects.toMatchObject({ kind: 'size' });
  expect(await row(storage, 'saved_1000')).toMatchObject({ projectId: 'saved_1000' });
});
it('database v2 upgrade preserves v1 bytes and blocks legacy writers from erasing trash flags', async () => {
  const name = `legacy_${crypto.randomUUID()}`;
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore('projects', { keyPath: 'projectId' }); request.result.createObjectStore('checkpoints', { keyPath: ['projectId', 'seq'] }); request.result.createObjectStore('journal', { keyPath: ['projectId', 'seq'] }); };
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  const legacy = new IndexedProjectStorage(db); connections.push(legacy);
  const doc = blank('legacy'), meta = await legacy.initialize(doc), before = (await legacy.readActive())!;
  const updated = await IndexedProjectStorage.open(indexedDB, name); connections.push(updated);
  expect(updated.db.version).toBe(2); expect(() => legacy.db.transaction('projects')).toThrow();
  const restored = (await updated.readActive())!; expect(restored.meta).toEqual(meta);
  expect(new Uint8Array(await restored.checkpoints[0]!.packed.blob.arrayBuffer())).toEqual(new Uint8Array(await before.checkpoints[0]!.packed.blob.arrayBuffer()));
  expect(serializeProject((await recover(restored)).document)).toBe(serializeProject(doc));
  await updated.setTrashed(meta, true);
  await expect(new Promise((resolve, reject) => { const r = indexedDB.open(name, 1); r.onsuccess = () => { r.result.close(); resolve(null); }; r.onerror = () => reject(r.error); })).rejects.toMatchObject({ name: 'VersionError' });
  expect((await updated.readProject(meta.projectId))!.meta.trashedAt).toBeTruthy();
});
