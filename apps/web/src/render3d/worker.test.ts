import { afterEach, expect, it, vi } from 'vitest';
import { ProjectStore } from '@gharplan/core-model';
import type { ProjectDoc } from '@gharplan/core-model';
import sample from '../../../../docs/examples/sample-project.json';
import type { BuildReply, BuildRequest } from './types';

afterEach(() => vi.unstubAllGlobals());
it('actual worker handler transfers valid buffers without detaching cached geometry; invalid documents fail safely', async () => {
  const replies: BuildReply[] = [];
  vi.stubGlobal('onmessage', undefined);
  vi.stubGlobal('postMessage', (reply: BuildReply, transfers: ArrayBuffer[] = []) => { replies.push(structuredClone(reply, { transfer: transfers })); });
  await import('./mesh.worker');
  const worker = globalThis as unknown as { onmessage(event: { data: BuildRequest }): void };
  const store = new ProjectStore(structuredClone(sample) as ProjectDoc, 'actual_worker');
  const request = () => worker.onmessage({ data: { tag: store.asyncTag(), document: structuredClone(store.getSnapshot().document) as ProjectDoc } });
  request(); expect(replies[0]!.ok).toBe(true);
  store.execute({ type: 'RenameProject', name: 'New name', id: 'rename', baseGeneration: 0 }); request();
  const first = replies[0]!, second = replies[1]!;
  if (!first.ok || !second.ok) throw new Error('Expected successful builds.');
  expect(second.bundle.stats.meshesBuilt).toBe(0); expect(second.bundle.meshes[0]!.positions.byteLength).toBeGreaterThan(0);
  expect([...second.bundle.meshes[0]!.positions]).toEqual([...first.bundle.meshes[0]!.positions]);
  store.execute({ type: 'UpdateOpening', openingId: 'o_win_living', properties: { sill: 901 }, id: 'sill', baseGeneration: 1 }); request();
  const third = replies[2]!; if (!third.ok) throw new Error(third.message); expect(third.bundle.stats.meshesBuilt).toBe(1);
  const invalid = structuredClone(sample) as ProjectDoc; invalid.junctions[0]!.x = 0.4;
  worker.onmessage({ data: { tag: store.asyncTag(), document: invalid } }); expect(replies[3]!.ok).toBe(false);
});
