import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectStore } from '@gharplan/core-model';
import type { AsyncTag, ProjectDoc } from '@gharplan/core-model';
import sample from '../../../../docs/examples/sample-project.json';
import { ScenePipeline } from './pipeline';
import type { MeshWorker } from './pipeline';
import type { BuildReply, BuildRequest, SceneBundle } from './types';

class FakeWorker implements MeshWorker {
  onmessage: MeshWorker['onmessage'] = null; onerror: MeshWorker['onerror'] = null;
  requests: BuildRequest[] = []; terminated = false;
  postMessage(request: BuildRequest): void { this.requests.push(request); }
  terminate(): void { this.terminated = true; }
  reply(reply: BuildReply): void { this.onmessage?.({ data: reply } as MessageEvent<BuildReply>); }
}
const bundle: SceneBundle = { meshes: [], bounds: null, stats: { boxes: 0, quads: 0, vertices: 0, wallVolumeMm3: 0, meshesBuilt: 0 } };
function harness() {
  const store = new ProjectStore(structuredClone(sample) as ProjectDoc, 'pipeline_session'), worker = new FakeWorker();
  const callbacks = { pending: vi.fn(), ready: vi.fn(), failed: vi.fn() };
  const pipeline = new ScenePipeline(store, worker, callbacks); return { store, worker, callbacks, pipeline };
}
afterEach(() => vi.useRealTimers());
describe('SYNC-006 fault-injected worker results', () => {
  it.each(['projectId', 'sessionId', 'localGeneration', 'dependencyHash'] as const)('drops a mismatched %s before touching the scene', domain => {
    const h = harness(), tag: AsyncTag = { ...h.worker.requests[0]!.tag };
    if (domain === 'localGeneration') tag[domain]++; else tag[domain] += '_stale';
    h.worker.reply({ tag, ok: true, bundle }); expect(h.callbacks.ready).not.toHaveBeenCalled();
    expect(h.worker.requests).toHaveLength(2);
    h.worker.reply({ tag: h.worker.requests[1]!.tag, ok: true, bundle }); expect(h.callbacks.ready).toHaveBeenCalledExactlyOnceWith(bundle); h.pipeline.dispose();
  });
  it('coalesces rapid edits, drops late generation zero, and handles undo without generation reuse', () => {
    const h = harness(), zero = h.worker.requests[0]!;
    for (let i = 0; i < 20; i++) expect(h.store.execute({ type: 'RenameProject', name: `Project ${i}`, id: `rename_${i}`, baseGeneration: i }).ok).toBe(true);
    expect(h.worker.requests).toHaveLength(1); expect(h.callbacks.pending).toHaveBeenCalledTimes(21);
    h.worker.reply({ tag: zero.tag, ok: true, bundle }); expect(h.callbacks.ready).not.toHaveBeenCalled();
    expect(h.worker.requests).toHaveLength(2); expect(h.worker.requests[1]!.tag.localGeneration).toBe(20);
    h.store.undo(); h.worker.reply({ tag: h.worker.requests[1]!.tag, ok: true, bundle }); expect(h.callbacks.ready).not.toHaveBeenCalled();
    expect(h.worker.requests[2]!.tag.localGeneration).toBe(21);
    h.worker.reply({ tag: h.worker.requests[2]!.tag, ok: true, bundle }); expect(h.callbacks.ready).toHaveBeenCalledTimes(1);
    h.pipeline.dispose();
  });
  it('closing/reopening a view terminates workers; an old session reply is rejected', () => {
    const old = harness(), delayed = old.worker.onmessage!; old.pipeline.dispose(); expect(old.worker.terminated).toBe(true);
    delayed({ data: { tag: old.worker.requests[0]!.tag, ok: true, bundle } } as MessageEvent<BuildReply>); expect(old.callbacks.ready).not.toHaveBeenCalled();
    const next = harness(); next.worker.reply({ tag: { ...old.worker.requests[0]!.tag, sessionId: 'closed_session' }, ok: true, bundle }); expect(next.callbacks.ready).not.toHaveBeenCalled(); next.pipeline.dispose();
  });
  it('stale failures are ignored; current failures are reported without changing the document', () => {
    const h = harness(), document = h.store.getSnapshot().document;
    h.worker.reply({ tag: { ...h.worker.requests[0]!.tag, dependencyHash: 'bad' }, ok: false, message: 'old error' }); expect(h.callbacks.failed).not.toHaveBeenCalled();
    h.worker.reply({ tag: h.worker.requests[1]!.tag, ok: false, message: 'capacity limit' }); expect(h.callbacks.failed).toHaveBeenCalledExactlyOnceWith('capacity limit');
    expect(h.store.getSnapshot().document).toBe(document); h.pipeline.dispose();
  });
  it('terminates a stuck build after 10 seconds and ignores its delayed reply', () => {
    vi.useFakeTimers(); const h = harness(), late = h.worker.onmessage!;
    vi.advanceTimersByTime(9999); expect(h.worker.terminated).toBe(false);
    vi.advanceTimersByTime(1); expect(h.worker.terminated).toBe(true); expect(h.callbacks.failed).toHaveBeenCalledTimes(1);
    late({ data: { tag: h.worker.requests[0]!.tag, ok: true, bundle } } as MessageEvent<BuildReply>); expect(h.callbacks.ready).not.toHaveBeenCalled(); h.pipeline.dispose();
  });
});
