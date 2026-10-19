import { describe, expect, it } from 'vitest';
import { ProjectStore, serializeProject } from '@gharplan/core-model';
import type { Command, ProjectDoc } from '@gharplan/core-model';
import sample from '../../../../docs/examples/sample-project.json';
import type { CloudApi, LoadReply, SaveReply, SaveRequest } from './api';
import { CloudSaver } from './cloud-save';
import type { CloudSyncMemory, CloudSyncRecord } from './linked';

// FR-031 (D67) §H.5 client rules against an in-memory stand-in for the D65 save function. Claude-authored tests.
/** Mirrors save_snapshot: receipts are checked before the head; a stale base conflicts; success makes head + 1. */
class FakeServer {
  head = new Map<string, { revision: number; document: string }>(); receipts = new Map<string, { digest: string; revision: number }>(); requests: SaveRequest[] = [];
  save(request: SaveRequest): SaveReply {
    this.requests.push(request);
    const key = `${request.projectId}/${request.commandId}`, digest = JSON.stringify([request.expectedServerRevision, serializeProject(request.document)]);
    const receipt = this.receipts.get(key);
    if (receipt) return receipt.digest === digest ? { ok: true, serverRevision: receipt.revision, sha256: 'x', savedAt: 't', replayed: true } : { ok: false, code: 'IDEMPOTENCY_MISMATCH' };
    const head = this.head.get(request.projectId);
    if (!head && request.expectedServerRevision !== 0) return { ok: false, code: 'NOT_FOUND' };
    if ((head?.revision ?? 0) !== request.expectedServerRevision) return { ok: false, code: 'REVISION_CONFLICT', details: { currentServerRevision: head!.revision } };
    if (request.document.revision !== request.expectedServerRevision) return { ok: false, code: 'INVALID_DOCUMENT' };
    const revision = request.expectedServerRevision + 1;
    this.head.set(request.projectId, { revision, document: serializeProject({ ...request.document, revision }) }); this.receipts.set(key, { digest, revision });
    return { ok: true, serverRevision: revision, sha256: 'x', savedAt: `t${revision}` };
  }
  load(projectId: string): LoadReply {
    const head = this.head.get(projectId);
    return head ? { ok: true, serverRevision: head.revision, name: 'x', document: JSON.parse(head.document) as unknown } : { ok: false, code: 'NOT_FOUND' };
  }
}
/** This device's per-drawing sync memory (localStorage in the app). */
const memoryOf = (records = new Map<string, CloudSyncRecord>()): CloudSyncMemory & { records: Map<string, CloudSyncRecord> } =>
  ({ records, get: id => records.get(id), set: (id, record) => { if (record) records.set(id, record); else records.delete(id); } });
type Reply = (request: SaveRequest) => Promise<SaveReply>;
function harness(revision = 0, { server = new FakeServer(), memory = memoryOf(), document, keys = 'k' }: { server?: FakeServer; memory?: ReturnType<typeof memoryOf>; document?: ProjectDoc; keys?: string } = {}) {
  const timers: { run: () => void; ms: number }[] = [];
  let reply: Reply = request => Promise.resolve(server.save(request));
  const api = { save: (request: SaveRequest) => reply(request), load: (projectId: string) => Promise.resolve(server.load(projectId)) } as unknown as CloudApi;
  const doc = structuredClone(document ?? sample) as ProjectDoc; doc.revision = revision;
  const store = new ProjectStore(doc, 'cloud_session'); let key = 0;
  const saver = new CloudSaver(store, api, { memory, delayMs: 2000, newKey: () => `${keys}${++key}`, setTimer: (run, ms) => { const t = { run, ms }; timers.push(t); return t; }, clearTimer: t => { const i = timers.indexOf(t as never); if (i >= 0) timers.splice(i, 1); } });
  const tick = async () => { const t = timers.shift(); if (!t) throw new Error('no timer'); t.run(); await new Promise(r => setTimeout(r, 0)); return t.ms; };
  let n = 0;
  const edit = (x: number) => { const r = store.execute({ id: `e${++n}`, baseGeneration: store.getSnapshot().localGeneration, type: 'MoveJunctions', moves: [{ junction: 'j2', to: [x, 0] }, { junction: 'j5', to: [x, 5000] }] } as Command); if (!r.ok) throw new Error('edit'); };
  return { server, memory, store, saver, timers, tick, edit, setReply: (next: Reply) => { reply = next; } };
}
const deferred = () => { let resolve!: (reply: SaveReply) => void; const promise = new Promise<SaveReply>(r => { resolve = r; }); return { promise, resolve }; };

describe('FR-031 cloud save queue (§H.5 client rules)', () => {
  it('first save sends base 0 with the document at revision 0; success moves only document.revision to 1 and shows saved', async () => {
    const h = harness(0), before = h.store.getSnapshot();
    h.saver.start(); expect(await h.tick()).toBe(0);
    expect(h.server.requests).toEqual([{ projectId: 'prj_sample_2room', expectedServerRevision: 0, commandId: 'k1', document: before.document }]);
    const after = h.store.getSnapshot();
    expect(after.document.revision).toBe(1); expect(after.localGeneration).toBe(before.localGeneration);
    expect(serializeProject({ ...after.document, revision: 0 })).toBe(serializeProject(before.document));
    expect(h.saver.getSnapshot()).toMatchObject({ phase: 'saved', serverRevision: 1, ackedGeneration: before.localGeneration, savedAt: 't1' });
  });

  it('one save in flight: edits made meanwhile stay local, "saved" waits for them, and the next save carries the newest geometry', async () => {
    const h = harness(0), gate = deferred();
    h.setReply(request => gate.promise.then(() => h.server.save(request)));
    h.saver.start(); h.timers.shift()!.run();
    h.edit(4600); h.edit(4700);
    expect(h.timers).toEqual([]); // nothing queued while a save is in flight
    expect(h.server.requests).toHaveLength(0);
    gate.resolve({ ok: true, serverRevision: 0, sha256: '', savedAt: '' }); await new Promise(r => setTimeout(r, 0));
    expect(h.server.requests).toHaveLength(1);
    expect(h.store.getSnapshot().document.revision).toBe(1);
    expect(h.store.getSnapshot().document.junctions.find(j => j.id === 'j2')!.x).toBe(4700); // newer local geometry kept
    expect(h.saver.getSnapshot().phase).toBe('waiting');
    h.setReply(request => Promise.resolve(h.server.save(request)));
    expect(await h.tick()).toBe(2000);
    expect(h.server.requests[1]).toMatchObject({ expectedServerRevision: 1, commandId: 'k2' });
    expect(h.server.requests[1]!.document.junctions.find(j => j.id === 'j2')!.x).toBe(4700);
    expect(h.saver.getSnapshot()).toMatchObject({ phase: 'saved', serverRevision: 2 });
  });

  it('no answer: the retry resends the exact same request and key even after more edits; a lost response replays without a second version', async () => {
    const h = harness(0);
    let calls = 0;
    // The first call reaches the server and commits, but the answer is lost on the way back.
    h.setReply(request => { calls++; if (calls === 1) { h.server.save(request); return Promise.resolve({ ok: false, code: 'NETWORK' }); } return Promise.resolve(h.server.save(request)); });
    h.saver.start(); await h.tick();
    expect(h.saver.getSnapshot().phase).toBe('offline');
    h.edit(4600);
    expect(await h.tick()).toBe(2000); // back-off 2 s, then 4 s, 8 s ... (capped at 60 s)
    expect(h.server.requests[1]).toBe(h.server.requests[0]); // identical request object: same key, same content
    expect(h.store.getSnapshot().document.revision).toBe(1);
    expect(h.server.head.get('prj_sample_2room')!.revision).toBe(1); // replayed, not saved twice
    expect(h.saver.getSnapshot().phase).toBe('waiting');
    await h.tick();
    expect(h.server.requests[2]).toMatchObject({ expectedServerRevision: 1, commandId: 'k2' });
    expect(h.saver.getSnapshot()).toMatchObject({ phase: 'saved', serverRevision: 2 });
  });

  it('back-off doubles up to 60 s while offline, and online() retries at once', async () => {
    const h = harness(0);
    h.setReply(() => Promise.resolve({ ok: false, code: 'NETWORK' }));
    h.saver.start(); await h.tick();
    const waits = [];
    for (let i = 0; i < 7; i++) waits.push(await h.tick());
    expect(waits).toEqual([2000, 4000, 8000, 16000, 32000, 60000, 60000]);
    h.saver.online(); expect(h.timers.map(t => t.ms)).toEqual([0]);
  });

  it('a newer cloud head stops automatic saving and keeps the local work; edits do not resend', async () => {
    const h = harness(0);
    h.server.head.set('prj_sample_2room', { revision: 3, document: '{}' }); // another device saved meanwhile
    h.saver.start(); await h.tick();
    expect(h.saver.getSnapshot()).toMatchObject({ phase: 'conflict', cloudRevision: 3 });
    const local = h.store.getSnapshot().document;
    h.edit(4600);
    expect(h.timers).toEqual([]); expect(h.server.requests).toHaveLength(1);
    expect(h.store.getSnapshot().document.revision).toBe(local.revision);
  });

  it('a drawing never saved under this id (the bundled sample claims revision 1) is reported, not overwritten', async () => {
    const h = harness(1);
    h.saver.start(); await h.tick();
    expect(h.saver.getSnapshot().phase).toBe('not-in-cloud');
    expect(h.store.getSnapshot().document.revision).toBe(1);
  });

  it('a drawing opened from its cloud head uploads nothing until it changes; closing mid-save applies nothing', async () => {
    const h = harness(0);
    h.saver.start(true);
    expect(h.timers).toEqual([]); expect(h.saver.getSnapshot().phase).toBe('saved');
    const gate = deferred(); h.setReply(request => gate.promise.then(() => h.server.save(request)));
    h.edit(4600); expect(h.saver.getSnapshot().phase).toBe('waiting');
    h.timers.shift()!.run(); h.saver.close();
    gate.resolve({ ok: true, serverRevision: 0, sha256: '', savedAt: '' }); await new Promise(r => setTimeout(r, 0));
    expect(h.store.getSnapshot().document.revision).toBe(0);
  });

  it('FR-032 replace after review: one save on top of the reviewed cloud head; only the revision jumps forward', async () => {
    const h = harness(0);
    h.server.head.set('prj_sample_2room', { revision: 3, document: '{}' });
    h.edit(4600); h.saver.start(); await h.tick();
    expect(h.saver.getSnapshot()).toMatchObject({ phase: 'conflict', cloudRevision: 3 });
    expect(h.saver.replaceCloudAfterReview()).toBe(true);
    await h.tick();
    const sent = h.server.requests.at(-1)!;
    expect(sent).toMatchObject({ expectedServerRevision: 3 }); expect(sent.document.revision).toBe(3);
    expect(sent.document.junctions.find(j => j.id === 'j2')!.x).toBe(4600); // this device's geometry
    expect(h.store.getSnapshot().document.revision).toBe(4);
    expect(h.saver.getSnapshot()).toMatchObject({ phase: 'saved', serverRevision: 4 });
    expect(h.saver.replaceCloudAfterReview()).toBe(false); // only from a conflict
  });

  it('FR-032 replace after review survives a lost answer: the retry replays and the revision is adopted once', async () => {
    const h = harness(0); let calls = 0;
    h.server.head.set('prj_sample_2room', { revision: 5, document: '{}' });
    h.saver.start(); await h.tick();
    h.setReply(request => { calls++; if (calls === 1) { h.server.save(request); return Promise.resolve({ ok: false, code: 'NETWORK' }); } return Promise.resolve(h.server.save(request)); });
    h.saver.replaceCloudAfterReview(); await h.tick();
    expect(h.saver.getSnapshot().phase).toBe('offline');
    await h.tick();
    expect(h.server.head.get('prj_sample_2room')!.revision).toBe(6);
    expect(h.store.getSnapshot().document.revision).toBe(6);
    expect(h.saver.getSnapshot().phase).toBe('saved');
  });

  it('FR-032 a restored drawing is in sync; a cloud that moved on while edits waited pauses as a conflict', async () => {
    const h = harness(0);
    h.saver.start(); await h.tick(); h.edit(4600);
    h.saver.markInSync();
    expect(h.timers).toEqual([]); expect(h.saver.getSnapshot()).toMatchObject({ phase: 'saved', ackedGeneration: h.store.getSnapshot().localGeneration });
    h.saver.markConflict(9);
    expect(h.saver.getSnapshot()).toMatchObject({ phase: 'conflict', cloudRevision: 9 });
    h.edit(4700); expect(h.timers).toEqual([]);
  });

  // Audit 2026-10-19 (§H.5 local recovery). Each "relaunch" is a new store and saver over the same server and memory.
  it('reopening an unchanged drawing uploads nothing and keeps the version history; a changed one still saves', async () => {
    const first = harness(0); first.saver.start(); await first.tick(); first.saver.close();
    const saved = first.store.getSnapshot().document as ProjectDoc;
    for (let launch = 0; launch < 3; launch++) {
      const again = harness(1, { server: first.server, memory: first.memory, document: saved, keys: 'launch1-' });
      again.saver.start();
      expect(again.timers).toEqual([]); expect(again.saver.getSnapshot()).toMatchObject({ phase: 'saved', serverRevision: 1 });
      again.saver.close();
    }
    expect(first.server.requests).toHaveLength(1); expect(first.server.head.get('prj_sample_2room')!.revision).toBe(1);
    const edited = harness(1, { server: first.server, memory: first.memory, document: saved, keys: 'launch2-' });
    edited.edit(4600); edited.saver.start(); await edited.tick();
    expect(first.server.requests.at(-1)).toMatchObject({ expectedServerRevision: 1 });
    expect(edited.saver.getSnapshot()).toMatchObject({ phase: 'saved', serverRevision: 2 });
  });

  it('the app closed after the cloud acknowledged a save but before this device stored the new revision: no false conflict', async () => {
    const first = harness(0); first.saver.start(); await first.tick(); first.saver.close();
    const again = harness(0, { server: first.server, memory: first.memory, keys: 'launch0-' }); // the device copy still says revision 0
    again.saver.start();
    expect(again.timers).toEqual([]); expect(again.store.getSnapshot().document.revision).toBe(1);
    expect(again.saver.getSnapshot()).toMatchObject({ phase: 'saved', serverRevision: 1 }); expect(first.server.requests).toHaveLength(1);
  });

  it('a save that reached the cloud but whose answer was lost before the app closed is recognised, not a conflict', async () => {
    const first = harness(0);
    first.setReply(request => { first.server.save(request); return Promise.resolve({ ok: false, code: 'NETWORK' }); });
    first.saver.start(); await first.tick(); first.saver.close();
    expect(first.server.head.get('prj_sample_2room')!.revision).toBe(1); expect(first.store.getSnapshot().document.revision).toBe(0);
    const again = harness(0, { server: first.server, memory: first.memory, keys: 'launch3-' });
    again.saver.start(); await again.tick();
    expect(again.store.getSnapshot().document.revision).toBe(1);
    expect(again.saver.getSnapshot()).toMatchObject({ phase: 'saved', serverRevision: 1 });
    expect(first.server.head.get('prj_sample_2room')!.revision).toBe(1); // no second version
    expect(again.memory.get('prj_sample_2room')?.pending).toBeUndefined();
  });

  it('after a lost answer, edits made after the relaunch go on top of the recognised save', async () => {
    const first = harness(0);
    first.setReply(request => { first.server.save(request); return Promise.resolve({ ok: false, code: 'NETWORK' }); });
    first.saver.start(); await first.tick(); first.saver.close();
    const again = harness(0, { server: first.server, memory: first.memory, keys: 'launch4-' });
    again.edit(4600); again.saver.start(); await again.tick();
    expect(again.store.getSnapshot().document.revision).toBe(1); expect(again.saver.getSnapshot().phase).toBe('waiting');
    expect(await again.tick()).toBe(0);
    expect(first.server.requests.at(-1)).toMatchObject({ expectedServerRevision: 1 });
    expect(again.saver.getSnapshot()).toMatchObject({ phase: 'saved', serverRevision: 2 });
    expect(JSON.parse(first.server.head.get('prj_sample_2room')!.document).junctions.find((j: { id: string }) => j.id === 'j2').x).toBe(4600);
  });

  it('a cloud head with other content after a lost answer is still a real conflict', async () => {
    const first = harness(0);
    first.setReply(request => { first.server.save(request); return Promise.resolve({ ok: false, code: 'NETWORK' }); });
    first.saver.start(); await first.tick(); first.saver.close();
    const other = harness(1, { server: first.server, memory: memoryOf(), document: JSON.parse(first.server.head.get('prj_sample_2room')!.document) as ProjectDoc, keys: 'launch5-' });
    other.edit(4800); other.saver.start(); await other.tick(); other.saver.close(); // another device saved r2
    const again = harness(0, { server: first.server, memory: first.memory, keys: 'launch6-' });
    again.saver.start(); await again.tick();
    expect(again.saver.getSnapshot()).toMatchObject({ phase: 'conflict', cloudRevision: 2 });
    expect(again.store.getSnapshot().document.revision).toBe(0);
  });
});
