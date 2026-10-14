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
  reply(reply: Omit<Extract<BuildReply,{ok:true}>,'requestId'>|Omit<Extract<BuildReply,{ok:false}>,'requestId'>): void { this.onmessage?.({ data: {...reply,requestId:this.requests.at(-1)!.requestId} } as MessageEvent<BuildReply>); }
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
    delayed({ data: { requestId:old.worker.requests[0]!.requestId, tag: old.worker.requests[0]!.tag, ok: true, bundle } } as MessageEvent<BuildReply>); expect(old.callbacks.ready).not.toHaveBeenCalled();
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
    late({ data: { requestId:h.worker.requests[0]!.requestId, tag: h.worker.requests[0]!.tag, ok: true, bundle } } as MessageEvent<BuildReply>); expect(h.callbacks.ready).not.toHaveBeenCalled(); h.pipeline.dispose();
  });
});

it('SYNC-006 duplicate idle/old replies cannot apply twice, cancel a newer deadline or create extra requests',()=>{
 vi.useFakeTimers();const h=harness();let terminations=0;h.worker.terminate=()=>{terminations++;h.worker.terminated=true;};const zero=h.worker.requests[0]!;
 const deliver=(request:BuildRequest)=>h.worker.onmessage?.({data:{requestId:request.requestId,tag:request.tag,ok:true,bundle}} as MessageEvent<BuildReply>);
 deliver(zero);expect(h.callbacks.ready).toHaveBeenCalledTimes(1);deliver(zero);expect(h.callbacks.ready).toHaveBeenCalledTimes(1);expect(h.worker.requests).toHaveLength(1);
 expect(h.store.execute({type:'RenameProject',name:'After first',id:'duplicate_edit',baseGeneration:0}).ok).toBe(true);vi.advanceTimersByTime(9000);deliver(zero);expect(h.worker.requests).toHaveLength(2);vi.advanceTimersByTime(999);expect(terminations).toBe(0);vi.advanceTimersByTime(1);expect(terminations).toBe(1);expect(h.callbacks.failed).toHaveBeenCalledTimes(1);h.pipeline.dispose();expect(terminations).toBe(1);
});
it('SYNC-006 matching request ID with a substituted newer tag cannot relabel old payload as current',()=>{
 const h=harness(),old=h.worker.requests[0]!;expect(h.store.execute({type:'RenameProject',name:'Newer',id:'substitute',baseGeneration:0}).ok).toBe(true);
 h.worker.onmessage?.({data:{requestId:old.requestId,tag:h.store.asyncTag(),ok:true,bundle}} as MessageEvent<BuildReply>);expect(h.callbacks.ready).not.toHaveBeenCalled();expect(h.worker.requests).toHaveLength(2);expect(h.worker.requests[1]!.tag.localGeneration).toBe(1);h.worker.reply({tag:h.worker.requests[1]!.tag,ok:true,bundle});expect(h.callbacks.ready).toHaveBeenCalledTimes(1);h.pipeline.dispose();
});
it.each(['runtime','post','current reply'] as const)('SYNC-006 %s failure detaches/terminates once; later edits/late callbacks cannot revive worker',mode=>{
 const h=harness(),late=h.worker.onmessage!,old=h.worker.requests[0]!;let terminations=0;h.worker.terminate=()=>{terminations++;};
 if(mode==='runtime')h.worker.onerror?.({message:'broken worker'} as ErrorEvent);
 else if(mode==='current reply')h.worker.reply({tag:old.tag,ok:false,message:'geometry budget'});
 else{h.worker.reply({tag:old.tag,ok:true,bundle});h.worker.postMessage=()=>{throw new Error('clone failure');};expect(h.store.execute({type:'RenameProject',name:'Throwing post',id:'post_failure',baseGeneration:0}).ok).toBe(true);}
 expect(terminations).toBe(1);expect(h.worker.onmessage).toBeNull();expect(h.worker.onerror).toBeNull();expect(h.callbacks.failed).toHaveBeenCalledTimes(1);const ready=h.callbacks.ready.mock.calls.length,pending=h.callbacks.pending.mock.calls.length,requests=h.worker.requests.length;
 expect(h.store.execute({type:'RenameProject',name:'Still editable',id:'after_failure',baseGeneration:h.store.getSnapshot().localGeneration}).ok).toBe(true);late({data:{requestId:old.requestId,tag:old.tag,ok:true,bundle}} as MessageEvent<BuildReply>);expect(h.callbacks.ready).toHaveBeenCalledTimes(ready);expect(h.callbacks.pending).toHaveBeenCalledTimes(pending);expect(h.worker.requests).toHaveLength(requests);h.pipeline.dispose();expect(terminations).toBe(1);
});
