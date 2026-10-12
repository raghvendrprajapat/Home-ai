import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { ProjectStore, recoveryCopy, proposeRoomRepair, serializeProject, validateProject } from '@gharplan/core-model';
import type { ModelChange, ProjectDoc } from '@gharplan/core-model';
import type { Immutable } from 'immer';
import sample from '../../../docs/examples/sample-project.json';
import { IndexedProjectStorage, pack, prepare, recover, sha256, unpack, checkedPatches, NativeMirror, SaveCoordinator, canOpenLocalAutomatically } from './index';
import type { MirrorIo } from './index';

const connections: IndexedProjectStorage[] = [];
const coordinators: SaveCoordinator[] = [];
afterEach(() => { for (const c of coordinators.splice(0)) c.close(); for (const c of connections.splice(0)) c.close(); });
const document = (): ProjectDoc => structuredClone(sample) as ProjectDoc;
const newStore = () => new ProjectStore(document(), `session_${crypto.randomUUID()}`, { now: () => '2026-10-12T06:00:00Z' });
async function setup(name = `test_${crypto.randomUUID()}`) {
  const storage = await IndexedProjectStorage.open(indexedDB, name); connections.push(storage);
  const store = newStore(), meta = await storage.initialize(store.getSnapshot().document), changes: Immutable<ModelChange>[] = [];
  store.subscribeChanges(change => changes.push(change)); return { storage, store, meta, changes, name };
}
function move(store: ProjectStore, dx = 100) {
  const result = store.execute({ type: 'MoveWall', wallId: 'w7', dx, dy: 0, id: `move_${store.getSnapshot().localGeneration}`, baseGeneration: store.getSnapshot().localGeneration });
  expect(result.ok).toBe(true); return result;
}
async function rawWrite(storage: IndexedProjectStorage, name: string, action: (store: IDBObjectStore) => void) {
  await new Promise<void>((resolve, reject) => { const tx = storage.db.transaction(name, 'readwrite'); tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); action(tx.objectStore(name)); });
}
class MemoryFiles implements MirrorIo {
  files = new Map<string, string>(); calls = 0; failAt = -1;
  step() { if (++this.calls === this.failAt) throw new Error('Injected file I/O interruption'); }
  async list(path: string) { this.step(); const prefix = path + '/'; return [...new Set([...this.files.keys()].filter(k => k.startsWith(prefix)).map(k => k.slice(prefix.length).split('/')[0]!))]; }
  async read(path: string, max: number) { this.step(); const text = this.files.get(path); if (text === undefined || new TextEncoder().encode(text).length > max) throw new Error('Missing or oversized file'); return text; }
  async write(path: string, text: string) { this.step(); this.files.set(path, text); }
  async rename(from: string, to: string) { this.step(); const text = this.files.get(from); if (text === undefined) throw new Error('Missing source'); this.files.set(to, text); this.files.delete(from); }
  async remove(path: string) { this.step(); this.files.delete(path); }
}

describe('REL-001/002/003 local transaction and replay proofs — Codex analytic cases', () => {
  it('roundtrips exact canonical JSON and rejects invalid canonical coordinates before save', async () => {
    const input = document(); expect(serializeProject(await unpack(await pack(input)))).toBe(serializeProject(input));
    input.junctions[0]!.x = 0.4; await expect(pack(input)).rejects.toThrow();
  });
  it('journals command, undo, redo and server metadata independently of generation', async () => {
    const s = await setup(); move(s.store); s.store.undo(); s.store.redo();
    expect(s.store.confirmServerRevision(1, 2)).toBe(true);
    expect(s.changes.map(c => c.source)).toEqual(['command', 'undo', 'redo', 'server']);
    expect(s.changes.map(c => c.localGeneration)).toEqual([1, 2, 3, 3]);
    const prepared = await prepare(s.meta, s.changes); await s.storage.commit(prepared);
    const loaded = await recover((await s.storage.readActive())!);
    expect(loaded.head.seq).toBe(4); expect(loaded.document.revision).toBe(2); expect(loaded.journalNewer).toBe(true);
    expect(serializeProject(loaded.document)).toBe(serializeProject(s.store.getSnapshot().document));
    const reopened = new ProjectStore(loaded.document, 'reopened');
    expect(reopened.getSnapshot().derived.faces.map(f => f.clearAreaMm2)).toEqual([21119175, 15395175]);
  });
  it('rolls back journal and metadata after a real transaction abort', async () => {
    const s = await setup(); move(s.store); const prepared = await prepare(s.meta, s.changes);
    await expect(s.storage.commit(prepared, () => { throw new Error('quota-like abort after put'); })).rejects.toThrow();
    const bundle = (await s.storage.readActive())!;
    expect(bundle.meta.seq).toBe(0); expect(bundle.journal).toHaveLength(0);
    expect(serializeProject((await recover(bundle)).document)).toBe(serializeProject(document()));
  });
  it('two independent connections perform CAS atomically; stale retry cannot overwrite', async () => {
    const a = await setup(), b = await IndexedProjectStorage.open(indexedDB, a.name); connections.push(b);
    move(a.store); const first = await prepare(a.meta, a.changes);
    const other = newStore(), changes: Immutable<ModelChange>[] = []; other.subscribeChanges(c => changes.push(c)); move(other, -100);
    const second = await prepare(a.meta, changes);
    const results = await Promise.allSettled([a.storage.commit(first), b.commit(second)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    await expect(b.commit(second)).rejects.toThrow('Another tab');
    expect(serializeProject((await recover((await b.readActive())!)).document)).toBe(serializeProject(a.store.getSnapshot().document));
    expect(other.getSnapshot().document.junctions.find(j => j.id === 'j2')!.x).toBe(4400);
  });
  it('compacts at 50 changes and preserves older checkpoint plus its required journal', async () => {
    const s = await setup(); for (let i = 0; i < 100; i++) move(s.store, i % 2 ? -100 : 100);
    const p = await prepare(s.meta, s.changes); await s.storage.commit(p);
    const bundle = (await s.storage.readActive())!;
    expect(bundle.meta.checkpointSeqs).toEqual([100, 50]); expect(bundle.checkpoints).toHaveLength(2); expect(bundle.journal).toHaveLength(50);
    const newest = bundle.checkpoints.find(c => c.seq === 100)!;
    await rawWrite(s.storage, 'checkpoints', store => store.put({ ...newest, packed: { ...newest.packed, blob: new Blob(['truncated']) } }));
    const repaired = await recover((await s.storage.readActive())!);
    expect(repaired.head.seq).toBe(100); expect(repaired.complete).toBe(true); expect(repaired.warning).toContain('checkpoint');
    await rawWrite(s.storage, 'journal', store => store.delete([s.meta.projectId, 51]));
    const partial = await recover((await s.storage.readActive())!);
    expect(partial.head.seq).toBe(50); expect(partial.complete).toBe(false);
    expect((await s.storage.readActive())!.checkpoints.find(c => c.seq === 100)!.packed.blob.size).toBe(9);
  });
  it('time compaction at 30 seconds preserves canonical data', async () => {
    const s = await setup(); move(s.store); const p = await prepare(s.meta, s.changes, s.meta.checkpointAt + 30000);
    expect(p.meta.checkpointSeqs).toEqual([1, 0]); await s.storage.commit(p);
    expect(serializeProject((await recover((await s.storage.readActive())!)).document)).toBe(serializeProject(s.store.getSnapshot().document));
  });
  it('GEO-021 saves and restores a positive very-small room; a zero-area command leaves storage/model unchanged', async () => {
    const input = document(); input.junctions = []; input.walls = []; input.rooms = []; input.openings = []; input.furniture = [];
    const store = new ProjectStore(input, 'small_room_session'), changes: Immutable<ModelChange>[] = [];
    store.subscribeChanges(change => changes.push(change));
    const storage = await IndexedProjectStorage.open(indexedDB, `small_${crypto.randomUUID()}`); connections.push(storage);
    const meta = await storage.initialize(store.getSnapshot().document);
    const command = { type: 'AddRectangle' as const, x: 0, y: 0, width: 300, depth: 300, height: 3000 };
    const original = serializeProject(store.getSnapshot().document);
    expect(store.execute({ ...command, thickness: 300, id: 'zero_clear_area', baseGeneration: 0 }).ok).toBe(false);
    expect(serializeProject(store.getSnapshot().document)).toBe(original); expect(changes).toHaveLength(0);
    expect(store.execute({ ...command, thickness: 200, id: 'positive_small_room', baseGeneration: 0 }).ok).toBe(true);
    await storage.commit(await prepare(meta, changes));
    const reopened = new ProjectStore((await recover((await storage.readActive())!)).document, 'small_reopened');
    expect(reopened.getSnapshot().document.rooms).toHaveLength(1);
    expect(reopened.getSnapshot().derived.faces[0]!.clearAreaMm2).toBe(10000); expect(reopened.getSnapshot().derived.faces[0]!.smallSpaceWarning).toBe(true);
  });
  it('semantic room damage in newest checkpoint stays flagged after complete older replay', async () => {
    const s = await setup(); for (let i = 0; i < 100; i++) move(s.store, i % 2 ? -100 : 100);
    await s.storage.commit(await prepare(s.meta, s.changes)); const b = (await s.storage.readActive())!;
    const newest = b.checkpoints.find(c => c.seq === 100)!, damaged = await unpack(newest.packed);
    damaged.rooms[0]!.boundary.reverse(); const text = JSON.stringify(damaged), hash = await sha256(text);
    await rawWrite(s.storage, 'checkpoints', store => store.put({ ...newest, hash, packed: { codec: 'json', blob: new Blob([text]), bytes: new TextEncoder().encode(text).length, hash } }));
    const recovered = await recover((await s.storage.readActive())!);
    expect(recovered.complete).toBe(true); expect(recovered.warning).toContain('checkpoint');
    expect(canOpenLocalAutomatically(recovered, [])).toBe(false);
    expect(await (await s.storage.readActive())!.checkpoints.find(c => c.seq === 100)!.packed.blob.text()).toBe(text);
  });
  it('reconciliation never chooses differing epochs, equal-seq different hashes or native-ahead automatically', async () => {
    const s = await setup(); move(s.store); await s.storage.commit(await prepare(s.meta, s.changes, s.meta.checkpointAt + 30000));
    const local = await recover((await s.storage.readActive())!), matching = { head: local.head, document: local.document, warning: false };
    expect(canOpenLocalAutomatically(null, [matching])).toBe(false);
    expect(canOpenLocalAutomatically(local, [])).toBe(true); expect(canOpenLocalAutomatically(local, [matching])).toBe(true);
    expect(canOpenLocalAutomatically(local, [{ ...matching, head: s.meta }])).toBe(true);
    expect(canOpenLocalAutomatically(local, [{ ...matching, head: { ...local.head, seq: 2 } }])).toBe(false);
    expect(canOpenLocalAutomatically(local, [{ ...matching, head: { ...local.head, hash: 'f'.repeat(64) } }])).toBe(false);
    expect(canOpenLocalAutomatically(local, [{ ...matching, head: { ...local.head, epoch: crypto.randomUUID() } }])).toBe(false);
    expect(canOpenLocalAutomatically(local, [{ ...matching, warning: true }])).toBe(false);
  });
  it('seeded accepted movement/undo sequences roundtrip with analytic areas', async () => {
    await fc.assert(fc.asyncProperty(fc.array(fc.boolean(), { minLength: 1, maxLength: 12 }), async actions => {
      const s = await setup(); let position = 4500;
      for (const undo of actions) { if (undo && s.store.getSnapshot().canUndo) { s.store.undo(); position = s.store.getSnapshot().document.junctions.find(j => j.id === 'j2')!.x; } else { move(s.store, position === 4500 ? 100 : -100); position = position === 4500 ? 4600 : 4500; } }
      await s.storage.commit(await prepare(s.meta, s.changes)); const reopened = new ProjectStore((await recover((await s.storage.readActive())!)).document, 'property_reopened');
      expect(serializeProject(reopened.getSnapshot().document)).toBe(serializeProject(s.store.getSnapshot().document));
      expect(reopened.getSnapshot().derived.faces.map(f => f.clearAreaMm2)).toEqual(position === 4500 ? [20642175, 15872175] : [21119175, 15395175]);
      s.storage.close();
    }), { seed: 20261012, numRuns: 50 });
  });
});

describe('REL-005 bounded recovery and SEC-007 unsafe input', () => {
  it('rejects unsafe patch paths, corrupted hashes and sequences without replacing a model', async () => {
    expect(() => checkedPatches([{ op: 'replace', path: ['__proto__', 'polluted'], value: true }])).toThrow();
    expect(() => checkedPatches([{ op: 'replace', path: ['constructor', 'prototype'], value: {} }])).toThrow();
    expect(() => checkedPatches([{ op: 'add', path: ['junctions', -1], value: {} }])).toThrow();
    const s = await setup(); move(s.store); await s.storage.commit(await prepare(s.meta, s.changes));
    const original = serializeProject(s.store.getSnapshot().document), b = (await s.storage.readActive())!;
    b.journal[0]!.beforeHash = '0'.repeat(64); const loaded = await recover(b);
    expect(loaded.complete).toBe(false); expect(loaded.head.seq).toBe(0); expect(serializeProject(s.store.getSnapshot().document)).toBe(original);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
  it('bounds compressed and decompressed sizes, rejects invalid UTF8 and unknown codec', async () => {
    const p = await pack(document());
    await expect(unpack({ ...p, codec: 'other' as 'json' })).rejects.toThrow();
    await expect(unpack({ ...p, blob: new Blob([new Uint8Array(10 * 1024 * 1024 + 65537)]) })).rejects.toThrow();
    await expect(unpack({ ...p, bytes: 10 })).rejects.toThrow();
    await expect(unpack({ codec: 'json', bytes: 1, hash: '0'.repeat(64), blob: new Blob([new Uint8Array([255])]) })).rejects.toThrow();
    const future = { ...document(), schemaVersion: 2 }; const text = JSON.stringify(future);
    await expect(unpack({ codec: 'json', bytes: new TextEncoder().encode(text).length, hash: await sha256(text), blob: new Blob([text]) })).rejects.toThrow();
  });
  it('offers explicit room repair only, remaps every entity and preserves the original', () => {
    const broken = document(); broken.rooms[0]!.boundary = [...broken.rooms[0]!.boundary].reverse(); const original = JSON.stringify(broken);
    const repair = proposeRoomRepair(original); expect(repair).not.toBeNull(); expect(validateProject(repair)).toEqual([]);
    const copy = recoveryCopy(repair!, '2026-10-12T06:00:00Z', () => `cp_${crypto.randomUUID().replaceAll('-', '')}`); expect(validateProject(copy)).toEqual([]); expect(copy.revision).toBe(0);
    const ids = new Set([broken.id, ...[broken.floors, broken.junctions, broken.walls, broken.openings, broken.rooms, broken.furniture, broken.materials, broken.lights, broken.cameras].flat().map(e => e.id)]);
    expect([copy.id, ...[copy.floors, copy.junctions, copy.walls, copy.openings, copy.rooms, copy.furniture, copy.materials, copy.lights, copy.cameras].flat().map(e => e.id)].some(id => ids.has(id))).toBe(false);
    expect(JSON.stringify(broken)).toBe(original); broken.junctions[0]!.x = 0.4; expect(proposeRoomRepair(JSON.stringify(broken))).toBeNull();
  });
  it('does not offer a checksum-valid repaired checkpoint belonging to a different project', async () => {
    const s = await setup(), b = (await s.storage.readActive())!, wrong = document(); wrong.id = 'foreign_project'; wrong.rooms[0]!.boundary.reverse();
    const text = JSON.stringify(wrong), hash = await sha256(text); b.checkpoints[0]!.hash = hash;
    b.checkpoints[0]!.packed = { codec: 'json', blob: new Blob([text]), hash, bytes: new TextEncoder().encode(text).length };
    await expect(recover(b)).rejects.toThrow('No valid'); expect((await s.storage.readActive())!.meta.hash).toBe(s.meta.hash);
  });
});

describe('native mirror and truthful asynchronous saved status', () => {
  it('an unsafe ready-marker filename preserves its possible referenced originals without reading it', async () => {
    const s = await setup(), io = new MemoryFiles(), mirror = new NativeMirror(io);
    await mirror.write(s.meta, s.store.getSnapshot().document);
    const markerName = [...io.files.keys()].find(n => n.endsWith('.ready.json'))!, marker = io.files.get(markerName)!;
    const folder = markerName.slice(0, markerName.lastIndexOf('/')), documentFile = `${folder}/${JSON.parse(marker).documentFile}`;
    const original = io.files.get(documentFile)!, unsafeName = `${folder}/future..ready.json`;
    io.files.set(unsafeName, marker);
    for (let i = 0; i < 3; i++) {
      move(s.store, i % 2 ? -100 : 100); const text = serializeProject(s.store.getSnapshot().document);
      await mirror.write({ ...s.meta, seq: i + 1, hash: await sha256(text) }, s.store.getSnapshot().document);
    }
    expect(io.files.get(unsafeName)).toBe(marker); expect(io.files.get(documentFile)).toBe(original);
    expect((await mirror.read())[0]!.head.seq).toBe(3); expect(mirror.getWarnings().length).toBeGreaterThan(0);
  });
  it('one corrupt native directory cannot hide a different valid project', async () => {
    const s = await setup(), io = new MemoryFiles(); io.files.set('gharplan-mirrors/bad_project/bad.ready.json', 'truncated');
    await new NativeMirror(io).write(s.meta, s.store.getSnapshot().document);
    const mirror = new NativeMirror(io), candidates = await mirror.read();
    expect(candidates).toHaveLength(1); expect(candidates[0]!.head.projectId).toBe(s.meta.projectId);
    expect(mirror.getWarnings().length).toBeGreaterThan(0); expect(io.files.get('gharplan-mirrors/bad_project/bad.ready.json')).toBe('truncated');
  });
  it('unreadable and oversized native directories do not hide another valid project', async () => {
    const s = await setup(), io = new MemoryFiles();
    io.files.set('gharplan-mirrors/unreadable_project/first.tmp', 'retained');
    for (let i = 0; i < 601; i++) io.files.set(`gharplan-mirrors/oversized_project/file_${i}.tmp`, 'retained');
    const original = io.list.bind(io); io.list = async path => { if (path.endsWith('/unreadable_project')) throw new Error('Injected directory permission denial'); return original(path); };
    await new NativeMirror(io).write(s.meta, s.store.getSnapshot().document);
    const mirror = new NativeMirror(io), candidates = await mirror.read();
    expect(candidates).toHaveLength(1); expect(candidates[0]!.head.projectId).toBe(s.meta.projectId);
    expect(mirror.getWarnings()).toHaveLength(2); expect(io.files.get('gharplan-mirrors/oversized_project/file_600.tmp')).toBe('retained');
  });
  it('unsupported and aliased markers and their referenced original documents survive pruning', async () => {
    const s = await setup(), io = new MemoryFiles(), mirror = new NativeMirror(io);
    await mirror.write(s.meta, s.store.getSnapshot().document);
    const originalName = [...io.files.keys()].find(n => n.endsWith('.ready.json'))!, original = JSON.parse(io.files.get(originalName)!) as { documentFile: string };
    const folder = originalName.slice(0, originalName.lastIndexOf('/')), originalFile = `${folder}/${original.documentFile}`, originalText = io.files.get(originalFile)!;
    const futureFile = `${s.meta.epoch}_0_future.json`, futureMarker = `${folder}/${s.meta.epoch}_0_future.ready.json`;
    io.files.set(`${folder}/${futureFile}`, originalText); io.files.set(futureMarker, JSON.stringify({ ...JSON.parse(io.files.get(originalName)!), storageVersion: 2, documentFile: futureFile }));
    const alias = `${folder}/${s.meta.epoch}_0_alias.ready.json`; io.files.set(alias, io.files.get(originalName)!);
    for (let i = 0; i < 3; i++) {
      move(s.store, i % 2 ? -100 : 100); const text = serializeProject(s.store.getSnapshot().document);
      await mirror.write({ ...s.meta, seq: i + 1, hash: await sha256(text) }, s.store.getSnapshot().document);
    }
    expect(io.files.has(futureMarker)).toBe(true); expect(io.files.get(`${folder}/${futureFile}`)).toBe(originalText);
    expect(io.files.has(alias)).toBe(true); expect(io.files.get(originalFile)).toBe(originalText);
    expect((await mirror.read())[0]!.head.seq).toBe(3);
  });
  it('preserves previous complete mirror across every new write/rename/readback failure', async () => {
    const s = await setup(), baseline = new MemoryFiles(); await new NativeMirror(baseline).write(s.meta, s.store.getSnapshot().document);
    const baseFiles = new Map(baseline.files); move(s.store); const next = await prepare(s.meta, s.changes);
    const normal = new MemoryFiles(); normal.files = new Map(baseFiles); await new NativeMirror(normal).write(next.meta, next.document);
    for (let fail = 1; fail <= normal.calls; fail++) {
      const io = new MemoryFiles(); io.files = new Map(baseFiles); io.failAt = fail;
      try { await new NativeMirror(io).write(next.meta, next.document); } catch { /* Injected failure expected at I/O boundaries. */ }
      io.failAt = -1; const candidates = await new NativeMirror(io).read(s.meta.projectId);
      expect(candidates.length).toBeGreaterThan(0); expect([s.meta.hash, next.meta.hash]).toContain(candidates[0]!.head.hash);
      expect(validateProject(candidates[0]!.document)).toEqual([]);
    }
  });
  it('serializes delayed old/new native writes and refuses epoch divergence', async () => {
    const s = await setup(), io = new MemoryFiles(), mirror = new NativeMirror(io);
    let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
    const write = io.write.bind(io); let first = true;
    io.write = async (path, text) => { if (first) { first = false; await gate; } await write(path, text); };
    const a = mirror.write(s.meta, s.store.getSnapshot().document); move(s.store); const p = await prepare(s.meta, s.changes);
    const b = mirror.write(p.meta, p.document); release(); await Promise.all([a, b]);
    expect((await mirror.read())[0]!.head.seq).toBe(1);
    await expect(mirror.write({ ...p.meta, epoch: crypto.randomUUID() }, p.document)).rejects.toThrow('epoch');
    expect((await mirror.read())[0]!.head.seq).toBe(1);
  });
  it('acknowledges only current browser/native state after edits, undo, redo and server revision', async () => {
    const s = await setup(), io = new MemoryFiles(), mirror = new NativeMirror(io);
    await mirror.write(s.meta, s.store.getSnapshot().document);
    const c = new SaveCoordinator(s.store, s.storage, s.meta, { mirror, nativeRequired: true, mirrorMatches: true }); coordinators.push(c);
    let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; }); const original = io.write.bind(io); let blocked = true;
    io.write = async (path, text) => { if (blocked) { blocked = false; await gate; } await original(path, text); };
    move(s.store); const pending = c.flush(); await new Promise(resolve => setTimeout(resolve, 20));
    s.store.undo(); s.store.redo(); expect(s.store.confirmServerRevision(1, 2)).toBe(true);
    expect(c.getSnapshot().phase).toBe('saving'); release(); await pending;
    expect(c.getSnapshot().phase).toBe('saved'); expect(c.getMeta().seq).toBe(4);
    expect(serializeProject((await mirror.read())[0]!.document)).toBe(serializeProject(s.store.getSnapshot().document));
  });
  it('native failure leaves browser durable and warns instead of claiming full save', async () => {
    const s = await setup(), io = new MemoryFiles(); io.failAt = 1;
    const c = new SaveCoordinator(s.store, s.storage, s.meta, { mirror: new NativeMirror(io), nativeRequired: true, mirrorMatches: false }); coordinators.push(c);
    move(s.store); await c.flush(); expect(c.getSnapshot().phase).toBe('partial');
    expect((await s.storage.readActive())!.meta.seq).toBe(1); io.failAt = -1; await c.retry(); expect(c.getSnapshot().phase).toBe('saved');
  });
  it('a stalled native write never blocks later browser journals or falsely acknowledges an equal-hash later sequence', async () => {
    const s = await setup(), io = new MemoryFiles(), mirror = new NativeMirror(io); await mirror.write(s.meta, s.store.getSnapshot().document);
    let release!: () => void, started!: () => void; const gate = new Promise<void>(resolve => { release = resolve; }), entered = new Promise<void>(resolve => { started = resolve; });
    const write = io.write.bind(io); let first = true;
    io.write = async (path, text) => { if (first) { first = false; started(); await gate; } await write(path, text); };
    const c = new SaveCoordinator(s.store, s.storage, s.meta, { mirror, nativeRequired: true, mirrorMatches: true }); coordinators.push(c);
    move(s.store); const pending = c.flush(); await entered; s.store.undo();
    await vi.waitFor(async () => expect((await s.storage.readActive())!.meta.seq).toBe(2), { timeout: 1000 });
    expect((await s.storage.readActive())!.meta.hash).toBe(s.meta.hash);
    expect(c.getSnapshot().phase).not.toBe('saved'); await pending;
    expect(c.getSnapshot().phase).toBe('partial'); expect(c.getSnapshot().message).toContain('not responding');
    release(); await vi.waitFor(() => expect(c.getSnapshot().phase).toBe('saved'), { timeout: 2000 });
    expect((await mirror.read())[0]!.head.seq).toBe(2);
  });
});
