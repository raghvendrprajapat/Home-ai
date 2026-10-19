import { canonicalStringify, dependencyHash } from '@gharplan/core-model';
import type { ProjectDoc, ProjectStore } from '@gharplan/core-model';
import type { CloudApi, CloudCode, SaveRequest } from './api';
import { syncMemory } from './linked';
import type { CloudSyncMemory } from './linked';

/**
 * FR-031 (D67) cloud save queue, following the §H.5 client rules:
 * - one save in flight per editor; edits made meanwhile stay local and go in the next save;
 * - a retry after no answer resends the exact same request and key;
 * - on success only `document.revision` moves (store.confirmServerRevision), never the newer local geometry;
 * - "saved in cloud" only when the acknowledged edit generation is the current one;
 * - a revision conflict stops automatic saving and keeps the local work; nothing is ever merged automatically;
 * - local recovery (audit 2026-10-19): this device remembers the acknowledged revision and content of each drawing and
 *   any save still waiting for its answer, so reopening an unchanged drawing uploads nothing, and a save whose answer
 *   was lost before the app closed is recognised in the cloud instead of showing a false conflict.
 */
export type CloudPhase = 'idle' | 'waiting' | 'saving' | 'saved' | 'offline' | 'conflict' | 'not-in-cloud' | 'taken' | 'trashed' | 'too-large' | 'limit' | 'invalid' | 'signed-out' | 'error';
export interface CloudSaveState { readonly phase: CloudPhase; readonly serverRevision: number; readonly ackedGeneration: number | null; readonly cloudRevision?: number; readonly savedAt?: string }
export interface CloudSaverOptions { memory?: CloudSyncMemory; delayMs?: number; retryMs?: (attempt: number) => number; newKey?: () => string; setTimer?: (run: () => void, ms: number) => unknown; clearTimer?: (timer: unknown) => void }
const STOPPED: Partial<Record<CloudCode, CloudPhase>> = { REVISION_CONFLICT: 'conflict', NOT_FOUND: 'not-in-cloud', PROJECT_ID_TAKEN: 'taken', PROJECT_TRASHED: 'trashed', TOO_LARGE: 'too-large', PROJECT_LIMIT: 'limit', INVALID_DOCUMENT: 'invalid', INVALID_REQUEST: 'invalid', NOT_SIGNED_IN: 'signed-out' };
/** Phases in which automatic saving waits for the person to choose what happens next. */
export const BLOCKED: ReadonlySet<CloudPhase> = new Set(['conflict', 'not-in-cloud', 'taken', 'trashed', 'too-large', 'limit', 'invalid', 'signed-out', 'error']);
/** Tag of a drawing's content without its server revision (which only the cloud moves); empty when it cannot be read. */
export function contentTag(document: unknown): string {
  if (!document || typeof document !== 'object') return '';
  try { const value = { ...document as object, revision: 0 }; return `${canonicalStringify(value).length}:${dependencyHash(value)}`; } catch { return ''; }
}

export class CloudSaver {
  #state: CloudSaveState; #listeners = new Set<() => void>(); #unsubscribe: (() => void) | null = null;
  #inFlight = false; #retry: { request: SaveRequest; generation: number; tag: string } | null = null; #attempts = 0; #timer: unknown = null; #closed = false; #override: number | null = null;
  readonly #memory: CloudSyncMemory; readonly #delay: number; readonly #retryMs: (attempt: number) => number; readonly #newKey: () => string;
  readonly #setTimer: (run: () => void, ms: number) => unknown; readonly #clearTimer: (timer: unknown) => void;
  constructor(private readonly store: ProjectStore, private readonly api: CloudApi, options: CloudSaverOptions = {}) {
    this.#memory = options.memory ?? syncMemory; this.#delay = options.delayMs ?? 2000; this.#retryMs = options.retryMs ?? (attempt => Math.min(60_000, 2000 * 2 ** (attempt - 1)));
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
    let snapshot = this.store.getSnapshot();
    const { id, revision } = snapshot.document, tag = contentTag(snapshot.document), known = this.#memory.get(id);
    // Reopened unchanged since the cloud acknowledged it: nothing to upload (a copy would push real versions out). If the
    // app closed before this device stored the acknowledged revision, the drawing takes it now instead of conflicting.
    const acked = !inSync && !this.#retry && !!tag && !!known && !known.pending && known.hash === tag && (known.revision === revision || (known.revision > revision && this.store.adoptServerRevision(revision, known.revision)));
    this.#unsubscribe ??= this.store.subscribe(() => this.#changed());
    snapshot = this.store.getSnapshot();
    if (inSync || acked) {
      if (inSync) this.#memory.set(id, { revision, hash: tag });
      this.#set({ phase: 'saved', ackedGeneration: snapshot.localGeneration, serverRevision: snapshot.document.revision }); return;
    }
    if (BLOCKED.has(this.#state.phase)) this.#set({ phase: 'idle' });
    this.#schedule(0);
  }
  stop(): void { this.#unsubscribe?.(); this.#unsubscribe = null; this.#cancelTimer(); if (!this.#inFlight) this.#set({ phase: 'idle' }); }
  close(): void { this.#closed = true; this.stop(); this.#listeners.clear(); }
  /**
   * FR-032 (D68) "replace the cloud version after review": the person saw the newer cloud head and chose to replace it
   * with this device's drawing. One save goes on top of that head; it can still conflict if the cloud moved again.
   */
  replaceCloudAfterReview(): boolean {
    const cloudRevision = this.#state.cloudRevision;
    if (this.#closed || this.#state.phase !== 'conflict' || cloudRevision === undefined) return false;
    this.#override = cloudRevision; this.#unsubscribe ??= this.store.subscribe(() => this.#changed());
    this.#set({ phase: 'idle' }); this.#schedule(0); return true;
  }
  /** FR-032 (D68) the drawing was just replaced by its cloud head (a restore): nothing to upload until it changes. */
  markInSync(): void {
    const snapshot = this.store.getSnapshot(); this.#memory.set(snapshot.document.id, { revision: snapshot.document.revision, hash: contentTag(snapshot.document) }); this.#retry = null; this.#override = null; this.#attempts = 0; this.#cancelTimer();
    this.#set({ phase: 'saved', ackedGeneration: snapshot.localGeneration, serverRevision: snapshot.document.revision });
  }
  /** FR-032 (D68) the cloud moved on while this device kept newer edits: pause exactly like a save conflict. */
  markConflict(cloudRevision: number): void { this.#retry = null; this.#override = null; this.#cancelTimer(); this.#set({ phase: 'conflict', cloudRevision }); }
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
    // A replace-after-review save goes on top of the reviewed cloud head, with the document claiming that revision.
    const base = this.#override ?? document.revision; this.#override = null;
    const { request, generation } = this.#retry ?? { request: { projectId: document.id, expectedServerRevision: base, commandId: this.#newKey(), document: base === document.revision ? document : { ...document, revision: base } }, generation: snapshot.localGeneration };
    const tag = this.#retry?.tag ?? contentTag(request.document), known = this.#memory.get(request.projectId);
    if (!this.#retry) {
      // An earlier unanswered save on the same base is kept: it is the one that may already be in the cloud.
      if (known?.pending?.base !== request.expectedServerRevision) this.#memory.set(request.projectId, { revision: known?.revision ?? -1, hash: known?.hash ?? '', pending: { base: request.expectedServerRevision, hash: tag } });
    }
    this.#inFlight = true; this.#set({ phase: 'saving' });
    try { await this.#reply(request, generation, tag); } finally { this.#inFlight = false; }
  }
  async #reply(request: SaveRequest, generation: number, tag: string): Promise<void> {
    const reply = await this.api.save(request);
    if (this.#closed) return;
    if (reply.ok) {
      this.#retry = null; this.#attempts = 0; this.#memory.set(request.projectId, { revision: reply.serverRevision, hash: tag });
      const now = this.store.getSnapshot().document.revision;
      const moved = now === reply.serverRevision || (request.expectedServerRevision === now ? this.store.confirmServerRevision(now, reply.serverRevision) : this.store.adoptServerRevision(now, reply.serverRevision));
      if (!moved) { this.#set({ phase: 'error' }); return; }
      const current = this.store.getSnapshot().localGeneration;
      this.#set({ phase: current === generation ? 'saved' : 'waiting', serverRevision: reply.serverRevision, ackedGeneration: generation, savedAt: reply.savedAt });
      if (current !== generation && this.#unsubscribe) this.#schedule(this.#delay);
      return;
    }
    if (reply.code === 'NETWORK') { this.#retry = { request, generation, tag }; this.#attempts++; this.#set({ phase: 'offline' }); this.#schedule(this.#retryMs(this.#attempts)); return; }
    this.#retry = null; this.#attempts = 0;
    const cloudRevision = typeof reply.details?.currentServerRevision === 'number' ? reply.details.currentServerRevision : undefined;
    const pending = this.#memory.get(request.projectId)?.pending;
    if (reply.code === 'REVISION_CONFLICT' && cloudRevision !== undefined && pending?.base === request.expectedServerRevision && cloudRevision > pending.base && await this.#ownLostSave(request.projectId, pending, cloudRevision)) return;
    const known = this.#memory.get(request.projectId);
    if (known) this.#memory.set(request.projectId, { revision: known.revision, hash: known.hash });
    this.#set({ phase: STOPPED[reply.code] ?? 'error', ...cloudRevision !== undefined ? { cloudRevision } : {} });
  }
  /**
   * The cloud head is exactly the content of a save whose answer never arrived: it is this device's own save, not a
   * conflict. The drawing takes that revision and keeps saving any newer edits on top of it.
   */
  async #ownLostSave(projectId: string, pending: { base: number; hash: string }, cloudRevision: number): Promise<boolean> {
    const head = await this.api.load(projectId);
    if (this.#closed || !head.ok || head.serverRevision !== cloudRevision || !pending.hash || contentTag(head.document) !== pending.hash) return false;
    const now = this.store.getSnapshot().document.revision;
    if (now !== pending.base || !this.store.adoptServerRevision(now, cloudRevision)) return false;
    this.#memory.set(projectId, { revision: cloudRevision, hash: pending.hash });
    const snapshot = this.store.getSnapshot(), same = contentTag(snapshot.document) === pending.hash;
    this.#set({ phase: same ? 'saved' : 'waiting', serverRevision: cloudRevision, ackedGeneration: same ? snapshot.localGeneration : null });
    if (!same && this.#unsubscribe) this.#schedule(0);
    return true;
  }
}
