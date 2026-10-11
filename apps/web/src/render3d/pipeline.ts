import { ProjectStore } from '@gharplan/core-model';
import type { ProjectDoc } from '@gharplan/core-model';
import type { BuildReply, BuildRequest, SceneBundle } from './types';

export interface MeshWorker {
  onmessage: ((event: MessageEvent<BuildReply>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(request: BuildRequest): void;
  terminate(): void;
}
/** One in-flight build, latest queued snapshot. All four async-tag domains are checked. */
export class ScenePipeline {
  #busy = false; #disposed = false; #unsubscribe: () => void; #timer: ReturnType<typeof setTimeout> | undefined;
  constructor(private store: ProjectStore, private worker: MeshWorker, private callbacks: {
    pending: () => void; ready: (bundle: SceneBundle) => void; failed: (message: string) => void;
  }) {
    worker.onmessage = event => {
      if (this.#disposed) return;
      clearTimeout(this.#timer); this.#busy = false;
      if (!this.store.acceptsAsync(event.data.tag)) { this.#request(); return; }
      if (event.data.ok) callbacks.ready(event.data.bundle); else callbacks.failed(event.data.message);
    };
    worker.onerror = event => { if (!this.#disposed) { clearTimeout(this.#timer); this.#busy = false; callbacks.failed(`3D preview failed: ${event.message}`); } };
    this.#unsubscribe = store.subscribe(() => { callbacks.pending(); this.#request(); });
    callbacks.pending(); this.#request();
  }
  #request(): void {
    if (this.#busy || this.#disposed) return;
    this.#busy = true;
    this.#timer = setTimeout(() => {
      if (this.#disposed) return;
      this.worker.terminate(); this.#disposed = true; this.#unsubscribe();
      this.callbacks.failed('3D preview timed out. Your drawing is safe in this session. Switch to 2D, then retry 3D.');
    }, 10_000);
    try {
      this.worker.postMessage({ tag: this.store.asyncTag(), document: structuredClone(this.store.getSnapshot().document) as ProjectDoc });
    } catch (error) { clearTimeout(this.#timer); this.#busy = false; this.callbacks.failed(error instanceof Error ? error.message : 'Could not start the 3D preview.'); }
  }
  dispose(): void {
    this.#disposed = true; clearTimeout(this.#timer); this.#unsubscribe(); this.worker.onmessage = null; this.worker.onerror = null; this.worker.terminate();
  }
}
