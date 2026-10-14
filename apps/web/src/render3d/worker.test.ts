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
  const request = () => worker.onmessage({ data: { requestId:replies.length+1, tag: store.asyncTag(), document: structuredClone(store.getSnapshot().document) as ProjectDoc } });
  request(); expect(replies[0]!.ok).toBe(true);
  store.execute({ type: 'RenameProject', name: 'New name', id: 'rename', baseGeneration: 0 }); request();
  const first = replies[0]!, second = replies[1]!;
  if (!first.ok || !second.ok) throw new Error('Expected successful builds.');
  expect(second.bundle.stats.meshesBuilt).toBe(0); expect(second.bundle.meshes[0]!.positions.byteLength).toBeGreaterThan(0);
  expect([...second.bundle.meshes[0]!.positions]).toEqual([...first.bundle.meshes[0]!.positions]);
  store.execute({ type: 'UpdateOpening', openingId: 'o_win_living', properties: { sill: 901 }, id: 'sill', baseGeneration: 1 }); request();
  const third = replies[2]!; if (!third.ok) throw new Error(third.message); expect(third.bundle.stats.meshesBuilt).toBe(1);
  const invalid = structuredClone(sample) as ProjectDoc; invalid.junctions[0]!.x = 0.4;
  worker.onmessage({ data: { requestId:replies.length+1, tag: store.asyncTag(), document: invalid } }); expect(replies[3]!.ok).toBe(false);
});

it('SYNC-006 actual worker rejects a valid document tagged as a different payload or project',async()=>{
 const replies:BuildReply[]=[];vi.stubGlobal('onmessage',undefined);vi.stubGlobal('postMessage',(reply:BuildReply)=>replies.push(reply));vi.resetModules();await import('./mesh.worker');const handler=(globalThis as unknown as {onmessage(e:{data:BuildRequest}):void}).onmessage;
 const store=new ProjectStore(structuredClone(sample) as ProjectDoc,'worker_bad_tag');for(const domain of ['projectId','dependencyHash'] as const){const tag={...store.asyncTag()};tag[domain]+='_wrong';handler({data:{requestId:replies.length+1,tag,document:structuredClone(sample) as ProjectDoc}});expect(replies.at(-1)!.ok).toBe(false);expect(replies.at(-1)!.requestId).toBe(replies.length);}
});
