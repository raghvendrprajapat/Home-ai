import type { ProjectDoc, ProjectStore } from '@gharplan/core-model';
import type { CloudApi, CloudCode, SaveRequest } from './api';

/**
 * FR-031 (D67) cloud save queue, following the §H.5 client rules:
 * - one save in flight per editor; edits made meanwhile stay local and go in the next save;
 * - a retry after no answer resends the exact same request and key;
 * - on success only `document.revision` moves (store.confirmServerRevision), never the newer local geometry;
 * - "saved in cloud" only when the acknowledged edit generation is the current one;
 * - a revision conflict stops automatic saving and keeps the local work; nothing is ever merged automatically.
 */
export type CloudPhase = 'idle' | 'waiting' | 'saving' | 'saved' | 'offline' | 'conflict' | 'not-in-cloud' | 'taken' | 'trashed' | 'too-large' | 'limit' | 'invalid' | 'signed-out' | 'error';
export interface CloudSaveState { readonly phase: CloudPhase; readonly serverRevision: number; readonly ackedGeneration: number | null; readonly cloudRevision?: number; readonly savedAt?: string }
export interface CloudSaverOptions { delayMs?: number; retryMs?: (attempt: number) => number; newKey?: () => string; setTimer?: (run: () => void, ms: number) => unknown; clearTimer?: (timer: unknown) => void }
const STOPPED: Partial<Record<CloudCode, CloudPhase>> = { REVISION_CONFLICT: 'conflict', NOT_FOUND: 'not-in-cloud', PROJECT_ID_TAKEN: 'taken', PROJECT_TRASHED: 'trashed', TOO_LARGE: 'too-large', PROJECT_LIMIT: 'limit', INVALID_DOCUMENT: 'invalid', INVALID_REQUEST: 'invalid', NOT_SIGNED_IN: 'signed-out' };
/** Phases in which automatic saving waits for the person to choose what happens next. */
export const BLOCKED: ReadonlySet<CloudPhase> = new Set(['conflict', 'not-in-cloud', 'taken', 'trashed', 'too-large', 'limit', 'invalid', 'signed-out', 'error']);

export class CloudSaver {
  #state: CloudSaveState; #listeners = new Set<() => void>(); #unsubscribe: (() => void) | null = null;
  #inFlight = false; #retry: { request: SaveRequest; generation: number } | null = null; #attempts = 0; #timer: unknown = null; #closed = false;
  readonly #delay: number; readonly #retryMs: (attempt: number) => number; readonly #newKey: () => string;
  readonly #setTimer: (run: () => void, ms: number) => unknown; readonly #clearTimer: (timer: unknown) => void;
  constructor(private readonly store: ProjectStore, private readonly api: CloudApi, options: CloudSaverOptions = {}) {
    this.#delay = options.delayMs ?? 2000; this.#retryMs = options.retryMs ?? (attempt => Math.min(60_000, 2000 * 2 ** (attempt - 1)));
    this.#newKey = options.newKey ?? (() => `save-${crypto.randomUUID().replaceAll('-', '')}`);
    this.#setTimer = options.setTimer ?? ((run, ms) => setTimeout(run, ms)); this.#clearTimer = options.clearTimer ?? (timer => clearTimeout(timer as ReturnType<typeof setTimeout>));
    this.#state = { phase: 'idle', serverRevision: store.getSnapshot().document.revision, ackedGeneration: null };
  }
  getSnapshot = (): CloudSaveState => this.#state;
  subscribe = (listener: () => void): (() => void) => { this.#listeners.add(listener); return () => this.#listeners.delete(listener); };
  #set(next: Partial<CloudSaveState>): void { this.#state = { ...this.#state, ...next }; for (const listener of [...this.#listeners]) listener(); }
  /**
   * Starts (or resumes after the person resolved a stop) automatic saving, with one save right away. `inSync` says the
   * drawing was just loaded from its cloud head, so nothing is uploaded until it changes.
   */
  start(inSync = false): void {
    if (this.#closed) return;
    this.#unsubscribe ??= this.store.subscribe(() => this.#changed());
    const snapshot = this.store.getSnapshot();
    if (inSync) { this.#set({ phase: 'saved', ackedGeneration: snapshot.localGeneration, serverRevision: snapshot.document.revision }); return; }
    if (BLOCKED.has(this.#state.phase)) this.#set({ phase: 'idle' });
    this.#schedule(0);
  }
  stop(): void { this.#unsubscribe?.(); this.#unsubscribe = null; this.#cancelTimer(); if (!this.#inFlight) this.#set({ phase: 'idle' }); }
  close(): void { this.#closed = true; this.stop(); this.#listeners.clear(); }
  /** Network came back: retry a waiting request now instead of at the end of its back-off. */
  online(): void { if (this.#state.phase === 'offline') this.#schedule(0); }
  #changed(): void {
    const generation = this.store.getSnapshot().localGeneration;
    if (BLOCKED.has(this.#state.phase) || generation === this.#state.ackedGeneration) return;
    if (this.#state.phase === 'saved' || this.#state.phase === 'idle') this.#set({ phase: 'waiting' });
    if (!this.#inFlight && this.#state.phase !== 'offline') this.#schedule(this.#delay);
  }
  #cancelTimer(): void { if (this.#timer !== null) { this.#clearTimer(this.#timer); this.#timer = null; } }
  #schedule(ms: number): void { this.#cancelTimer(); this.#timer = this.#setTimer(() => { this.#timer = null; void this.#send(); }, ms); }
  async #send(): Promise<void> {
    if (this.#inFlight || this.#closed || BLOCKED.has(this.#state.phase)) return;
    const snapshot = this.store.getSnapshot();
    if (!this.#retry && snapshot.localGeneration === this.#state.ackedGeneration) { this.#set({ phase: 'saved' }); return; }
    const document = snapshot.document as ProjectDoc;
    const { request, generation } = this.#retry ?? { request: { projectId: document.id, expectedServerRevision: document.revision, commandId: this.#newKey(), document }, generation: snapshot.localGeneration };
    this.#inFlight = true; this.#set({ phase: 'saving' });
    const reply = await this.api.save(request);
    this.#inFlight = false;
    if (this.#closed) return;
    if (reply.ok) {
      this.#retry = null; this.#attempts = 0;
      const now = this.store.getSnapshot().document.revision;
      if (now !== reply.serverRevision && !this.store.confirmServerRevision(request.expectedServerRevision, reply.serverRevision)) { this.#set({ phase: 'error' }); return; }
      const current = this.store.getSnapshot().localGeneration;
      this.#set({ phase: current === generation ? 'saved' : 'waiting', serverRevision: reply.serverRevision, ackedGeneration: generation, savedAt: reply.savedAt });
      if (current !== generation && this.#unsubscribe) this.#schedule(this.#delay);
      return;
    }
    if (reply.code === 'NETWORK') { this.#retry = { request, generation }; this.#attempts++; this.#set({ phase: 'offline' }); this.#schedule(this.#retryMs(this.#attempts)); return; }
    this.#retry = null; this.#attempts = 0;
    const cloudRevision = typeof reply.details?.currentServerRevision === 'number' ? reply.details.currentServerRevision : undefined;
    this.#set({ phase: STOPPED[reply.code] ?? 'error', ...cloudRevision !== undefined ? { cloudRevision } : {} });
  }
}
