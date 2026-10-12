import { serializeProject } from '@gharplan/core-model';
import type { ModelChange, ProjectDoc, ProjectStore } from '@gharplan/core-model';
import type { Immutable } from 'immer';
import { prepare } from './journal';
import { sameHead, StorageError } from './types';
import type { Head, ProjectMeta } from './types';
import type { IndexedProjectStorage } from './indexed-db';
import type { NativeMirror } from './native-mirror';

export interface SaveStatus { phase: 'memory' | 'saving' | 'saved' | 'partial' | 'error' | 'conflict'; message: string; pending: number; diskSequence: number }
export class SaveCoordinator {
  #meta: ProjectMeta; #changes: Immutable<ModelChange>[] = []; #listeners = new Set<() => void>();
  #timer: ReturnType<typeof setTimeout> | null = null; #flight: Promise<void> | null = null;
  #unsubscribe: () => void; #closed = false; #blocked = false; #ackText: string; #ackDocument: Immutable<ProjectDoc>;
  #nativeHead: Head | null; #nativeFlight: Promise<void> | null = null; #nativeGate: Promise<void> | null = null;
  #nativeWanted: { head: Head; text: string } | null = null; #nativeBlocked = false; #nativeStalled = false;
  #releaseNativeGate: (() => void) | null = null;
  #watchdog: ReturnType<typeof setTimeout> | null = null;
  #status: SaveStatus; #nativeError: string | null = null;
  constructor(readonly store: ProjectStore, readonly storage: IndexedProjectStorage, meta: ProjectMeta,
    readonly options: { mirror: NativeMirror | null; nativeRequired: boolean; mirrorMatches: boolean }) {
    this.#meta = meta; this.#ackDocument = store.getSnapshot().document; this.#ackText = serializeProject(this.#ackDocument);
    this.#nativeHead = options.mirrorMatches ? { ...meta } : null;
    this.#status = { phase: 'memory', message: 'Preparing local save.', pending: 0, diskSequence: meta.seq };
    this.#unsubscribe = store.subscribeChanges(change => {
      if (this.#closed) return;
      this.#changes.push(change); this.#refresh(); this.#schedule();
    });
    this.#refresh();
  }
  getSnapshot = (): SaveStatus => this.#status;
  subscribe = (listener: () => void): (() => void) => { this.#listeners.add(listener); return () => this.#listeners.delete(listener); };
  getMeta(): ProjectMeta { return structuredClone(this.#meta); }
  #schedule(): void {
    if (!this.#blocked && !this.#closed && !this.#timer && !this.#flight)
      this.#timer = setTimeout(() => { this.#timer = null; void this.flush(); }, 250);
  }
  #publish(phase: SaveStatus['phase'], message: string): void {
    this.#status = { phase, message, pending: this.#changes.length, diskSequence: this.#meta.seq };
    for (const listener of [...this.#listeners]) { try { listener(); } catch { /* UI failure cannot undo a durable commit. */ } }
  }
  #refresh(): void {
    if (this.#blocked) return;
    if (this.#changes.length || this.store.getSnapshot().document !== this.#ackDocument || this.#flight || this.#nativeFlight && !this.#nativeStalled) {
      this.#publish('saving', 'Saving current changes on this device…'); return;
    }
    if (this.options.nativeRequired && (!this.#nativeHead || !sameHead(this.#nativeHead, this.#meta))) {
      this.#publish('partial', this.#nativeError ?? 'Local save complete; extra phone backup is pending. Keep an exported copy.'); return;
    }
    this.#publish('saved', this.options.nativeRequired ? 'Saved on this phone.' : 'Saved in this browser on this device.');
  }
  flush = async (): Promise<void> => {
    do {
      await this.#flushBrowser();
      // Await a native attempt or its diagnostic timeout for explicit callers,
      // while independent edit timers continue committing browser journals.
      while (this.#nativeGate && !this.#nativeStalled && !this.#nativeBlocked && !this.#closed) await this.#nativeGate;
    } while (this.#changes.length && !this.#closed && !this.#blocked);
  };
  #flushBrowser(): Promise<void> {
    if (this.#timer) { clearTimeout(this.#timer); this.#timer = null; }
    if (this.#closed || this.#blocked) return Promise.resolve();
    if (this.#flight) return this.#flight;
    this.#flight = this.#runBrowser().finally(() => {
      this.#flight = null; this.#refresh(); if (this.#changes.length) this.#schedule();
    });
    this.#refresh(); return this.#flight;
  }
  async #runBrowser(): Promise<void> {
    do {
      const batch = this.#changes.splice(0);
      if (batch.length) {
        try {
          const prepared = await prepare(this.#meta, batch);
          this.#meta = await this.storage.commit(prepared); this.#ackDocument = prepared.document;
          this.#ackText = serializeProject(prepared.document);
        } catch (error) {
          this.#changes.unshift(...batch); this.#blocked = true;
          this.#publish(error instanceof StorageError && error.kind === 'conflict' ? 'conflict' : 'error',
            error instanceof StorageError ? error.message : 'Local save failed. Your drawing remains in memory; export it now.'); return;
        }
      }
      if (this.options.nativeRequired) {
        this.#nativeWanted = { head: { projectId: this.#meta.projectId, epoch: this.#meta.epoch, seq: this.#meta.seq, hash: this.#meta.hash }, text: this.#ackText };
        this.#startNative();
      }
    } while (this.#changes.length && !this.#closed);
  }
  #startNative(): void {
    const wanted = this.#nativeWanted;
    if (!wanted || this.#closed || this.#nativeFlight || this.#nativeBlocked || this.#nativeHead && sameHead(this.#nativeHead, wanted.head)) return;
    let release!: () => void;
    this.#nativeGate = new Promise<void>(resolve => { release = resolve; });
    this.#releaseNativeGate = release;
    this.#watchdog = setTimeout(() => {
      this.#nativeStalled = true;
      this.#nativeError = 'Local save complete; phone backup is not responding. Browser autosave continues. Export a separate copy.';
      release(); this.#refresh();
    }, 1500);
    this.#nativeFlight = (async () => {
      try {
        if (!this.options.mirror) throw new StorageError('unavailable', 'Phone backup is unavailable.');
        await this.options.mirror.write(wanted.head, JSON.parse(wanted.text));
        this.#nativeHead = wanted.head; this.#nativeError = null;
      } catch {
        this.#nativeBlocked = true; this.#nativeError = 'Local save complete; extra phone backup failed. Export a separate copy.';
      }
    })().finally(() => {
      if (this.#watchdog) clearTimeout(this.#watchdog); this.#watchdog = null;
      this.#nativeFlight = null; this.#nativeGate = null; this.#nativeStalled = false;
      release(); this.#releaseNativeGate = null; this.#startNative(); this.#refresh();
    });
  }
  retry = (): Promise<void> => { this.#blocked = false; this.#nativeBlocked = false; this.#nativeError = null; return this.flush(); };
  close(): void {
    this.#closed = true; this.#unsubscribe(); if (this.#timer) clearTimeout(this.#timer); if (this.#watchdog) clearTimeout(this.#watchdog); this.#listeners.clear();
    this.#releaseNativeGate?.();
    // Closing never claims pending async writes completed or cancels an I/O
    // operation that could still complete. Native writes remain serialized.
  }
}
