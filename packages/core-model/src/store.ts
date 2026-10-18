import { applyGeometry, GeometryError } from '@gharplan/geometry';
import type { DerivedPlan } from '@gharplan/geometry';
import { applyPatches, enablePatches, freeze, produceWithPatches } from 'immer';
import type { Immutable, Patch } from 'immer';
import { applyCommand } from './commands';
import type { Command } from './commands';
import { dependencyHash, utf8Bytes } from './serialization';
import { validateProject } from './validation';
import type { AsyncTag, ProjectDoc, ValidationIssue } from './types';

enablePatches();
export interface EditorSnapshot { document: ProjectDoc; derived: DerivedPlan; localGeneration: number; sessionId: string; canUndo: boolean; canRedo: boolean; historyTruncated: boolean }
export interface ModelChange { document: Immutable<ProjectDoc>; patches: readonly Patch[]; source: 'command' | 'undo' | 'redo' | 'server'; localGeneration: number; sessionId: string }
export type CommitResult = { ok: true; changed: boolean; changedIds: string[]; patches: Patch[]; inverse: Patch[]; checkRoomNamesHint: boolean } |
  { ok: false; errors: ValidationIssue[] };
export type PreviewResult = { ok: true; document: Immutable<ProjectDoc>; derived: Immutable<DerivedPlan> } | { ok: false; errors: ValidationIssue[] };
interface HistoryEntry { patches: Patch[]; inverse: Patch[]; bytes: number }
const HISTORY_LIMIT = 20 * 1024 * 1024;
function deriveDocument(document: ProjectDoc): DerivedPlan {
  const result = applyGeometry(document, { op: 'analyze' });
  if (!result.accepted) throw result.error; return result.derived;
}
function errorMessage(error: unknown): string {
  try { if (error instanceof Error && typeof error.message === 'string') return error.message; } catch { /* diagnostics cannot disrupt a committed edit */ }
  return 'Adapter listener failed.';
}

export class ProjectStore {
  #now: () => string; #document: ProjectDoc; #derived: DerivedPlan; #generation = 0; #sessionId: string;
  #undo: HistoryEntry[] = []; #redo: HistoryEntry[] = []; #historyBytes = 0; #truncated = false;
  #listeners = new Set<() => void>(); #changes = new Set<(change: Immutable<ModelChange>) => void>(); #listenerErrors: string[] = []; #publishing = false; #snapshot: Immutable<EditorSnapshot>;
  constructor(document: ProjectDoc, sessionId: string, options: { now?: () => string } = {}) {
    const errors = validateProject(document); if (errors.length) throw new GeometryError('project', errors.map(e => e.message).join('; '));
    if (!sessionId) throw new GeometryError('session', 'An editor session ID is required.');
    this.#now = options.now ?? (() => new Date().toISOString());
    this.#document = freeze(JSON.parse(JSON.stringify(document)) as ProjectDoc, true); this.#sessionId = sessionId;
    this.#derived = freeze(deriveDocument(this.#document), true); this.#snapshot = this.#makeSnapshot();
  }
  #makeSnapshot(): Immutable<EditorSnapshot> {
    return freeze({ document: this.#document, derived: this.#derived, localGeneration: this.#generation, sessionId: this.#sessionId,
      canUndo: this.#undo.length > 0, canRedo: this.#redo.length > 0, historyTruncated: this.#truncated }, true);
  }
  #publish(patches: readonly Patch[], source: ModelChange['source']): void {
    this.#snapshot = this.#makeSnapshot();
    this.#publishing = true;
    try {
      const change = freeze({ document: this.#document, patches, source, localGeneration: this.#generation, sessionId: this.#sessionId }, true);
      for (const listener of [...this.#changes]) {
        try { listener(change); } catch (error) { this.#listenerErrors.push(errorMessage(error)); this.#listenerErrors = this.#listenerErrors.slice(-20); }
      }
      for (const listener of [...this.#listeners]) {
        try { listener(); } catch (error) { this.#listenerErrors.push(errorMessage(error)); this.#listenerErrors = this.#listenerErrors.slice(-20); }
      }
    } finally { this.#publishing = false; }
  }
  getListenerErrors(): readonly string[] { return [...this.#listenerErrors]; }
  getSnapshot = (): Immutable<EditorSnapshot> => this.#snapshot;
  subscribe = (listener: () => void): (() => void) => { this.#listeners.add(listener); return () => this.#listeners.delete(listener); };
  subscribeChanges = (listener: (change: Immutable<ModelChange>) => void): (() => void) => { this.#changes.add(listener); return () => this.#changes.delete(listener); };
  /** Isolated Phase 0 candidate: use the exact commit rules without changing this store. */
  preview(command: Command): PreviewResult {
    if (!command || typeof command !== 'object' || command.baseGeneration !== this.#generation) return { ok: false, errors: [{ code: 'stale', message: 'This preview was based on an older project.', entityIds: [] }] };
    const candidate = new ProjectStore(this.#document, this.#sessionId, { now: () => this.#document.updatedAt });
    const result = candidate.execute({ ...command, baseGeneration: 0 });
    return result.ok ? { ok: true, document: candidate.#document, derived: candidate.#derived } : result;
  }
  execute(command: Command): CommitResult {
    if (this.#publishing) return { ok: false, errors: [{ code: 'reentrant', message: 'Queue this edit until the current commit notification completes.', entityIds: [] }] };
    if (!command || typeof command !== 'object' || Array.isArray(command) || typeof command.type !== 'string' ||
      typeof command.id !== 'string' || !Number.isSafeInteger(command.baseGeneration))
      return { ok: false, errors: [{ code: 'command', message: 'Invalid command envelope.', entityIds: [] }] };
    if (command.baseGeneration !== this.#generation) return { ok: false, errors: [{ code: 'stale', message: 'This edit was based on an older project state.', entityIds: [] }] };
    if (!/^[A-Za-z0-9_-]{2,80}$/.test(command.id)) return { ok: false, errors: [{ code: 'command-id', message: 'A command ID is required.', entityIds: [] }] };
    try {
      let effects = { changedIds: [] as string[], checkRoomNamesHint: false };
      const [next, patches, inverse] = produceWithPatches(this.#document, draft => {
        effects = applyCommand(draft, this.#document, command);
        if (effects.changedIds.length || draft.name !== this.#document.name || draft.units !== this.#document.units) draft.updatedAt = this.#now();
      });
      const errors = validateProject(next); if (errors.length) return { ok: false, errors };
      if (!patches.length) return { ok: true, changed: false, changedIds: [], patches: [], inverse: [], checkRoomNamesHint: false };
      const derived = freeze(deriveDocument(next), true);
      const entry = { patches, inverse, bytes: utf8Bytes(JSON.stringify({ patches, inverse })) };
      if (entry.bytes > HISTORY_LIMIT) return { ok: false, errors: [{ code: 'history-size', message: 'This edit exceeds the 20 MiB undo-memory limit.', entityIds: [] }] };
      // Persistence/adapter consumers receive these same patches: make history immutable.
      freeze(entry, true);
      this.#redo = []; this.#undo.push(entry); this.#historyBytes = this.#undo.reduce((s, e) => s + e.bytes, 0);
      while (this.#historyBytes > HISTORY_LIMIT && this.#undo.length > 1) { this.#historyBytes -= this.#undo.shift()!.bytes; this.#truncated = true; }
      this.#document = next; this.#derived = derived; this.#generation++; this.#publish(patches, 'command');
      return { ok: true, changed: true, changedIds: effects.changedIds, patches, inverse, checkRoomNamesHint: effects.checkRoomNamesHint };
    } catch (error) {
      return { ok: false, errors: [{ code: error instanceof GeometryError ? error.code : 'command', message: error instanceof Error ? error.message : 'Edit failed.', entityIds: error instanceof GeometryError ? error.entityIds : [] }] };
    }
  }
  #history(direction: 'undo' | 'redo'): boolean {
    if (this.#publishing) return false;
    const source = direction === 'undo' ? this.#undo : this.#redo, entry = source.at(-1); if (!entry) return false;
    const patches = direction === 'undo' ? entry.inverse : entry.patches;
    const next = applyPatches(this.#document, patches);
    const errors = validateProject(next); if (errors.length) throw new GeometryError('history', 'History would produce an invalid document.');
    const derived = freeze(deriveDocument(next), true);
    source.pop(); (direction === 'undo' ? this.#redo : this.#undo).push(entry);
    this.#document = next; this.#derived = derived; this.#generation++; this.#publish(patches, direction); return true;
  }
  undo(): boolean { return this.#history('undo'); }
  redo(): boolean { return this.#history('redo'); }
  confirmServerRevision(expectedPreviousRevision: number, confirmedRevision: number): boolean {
    if (this.#publishing) return false;
    if (!Number.isSafeInteger(expectedPreviousRevision) || !Number.isSafeInteger(confirmedRevision) || expectedPreviousRevision < 0 ||
      confirmedRevision !== expectedPreviousRevision + 1 || this.#document.revision !== expectedPreviousRevision) return false;
    const [document, patches] = produceWithPatches(this.#document, draft => { draft.revision = confirmedRevision; });
    this.#document = document; this.#publish(patches, 'server'); return true;
  }
  /**
   * FR-032 (D68) "replace the cloud version after review": the server stored this drawing on top of a newer head, so
   * only `document.revision` jumps forward from `expectedCurrentRevision` to `confirmedRevision`; geometry is untouched.
   */
  adoptServerRevision(expectedCurrentRevision: number, confirmedRevision: number): boolean {
    if (this.#publishing) return false;
    if (!Number.isSafeInteger(expectedCurrentRevision) || !Number.isSafeInteger(confirmedRevision) || expectedCurrentRevision < 0 ||
      confirmedRevision <= expectedCurrentRevision || this.#document.revision !== expectedCurrentRevision) return false;
    const [document, patches] = produceWithPatches(this.#document, draft => { draft.revision = confirmedRevision; });
    this.#document = document; this.#publish(patches, 'server'); return true;
  }
  /**
   * FR-032 (D68) restore: the drawing becomes a server-confirmed head of the same project. This is a new local state, so
   * the generation advances; undo/redo are cleared because their patches belong to the replaced drawing.
   */
  replaceFromServer(document: ProjectDoc): CommitResult {
    if (this.#publishing) return { ok: false, errors: [{ code: 'reentrant', message: 'Try again after the current change.', entityIds: [] }] };
    const errors = validateProject(document); if (errors.length) return { ok: false, errors };
    if (document.id !== this.#document.id || document.revision <= this.#document.revision)
      return { ok: false, errors: [{ code: 'server-document', message: 'Only a newer cloud version of this drawing can replace it.', entityIds: [] }] };
    const incoming = JSON.parse(JSON.stringify(document)) as ProjectDoc;
    const [next, patches] = produceWithPatches(this.#document, draft => {
      const target = draft as unknown as Record<string, unknown>, source = incoming as unknown as Record<string, unknown>;
      for (const key of Object.keys(target)) if (!(key in source)) delete target[key];
      for (const [key, value] of Object.entries(source)) if (JSON.stringify(target[key]) !== JSON.stringify(value)) target[key] = value;
    });
    this.#undo = []; this.#redo = []; this.#historyBytes = 0; this.#truncated = false;
    this.#document = next; this.#derived = freeze(deriveDocument(next), true); this.#generation++; this.#publish(patches, 'server');
    return { ok: true, changed: true, changedIds: [], patches, inverse: [], checkRoomNamesHint: false };
  }
  asyncTag(dependencies: unknown = this.#document): AsyncTag {
    return { projectId: this.#document.id, sessionId: this.#sessionId, localGeneration: this.#generation, dependencyHash: dependencyHash(dependencies) };
  }
  acceptsAsync(tag: AsyncTag, dependencies: unknown = this.#document): boolean {
    const expected = this.asyncTag(dependencies);
    return tag.projectId === expected.projectId && tag.sessionId === expected.sessionId && tag.localGeneration === expected.localGeneration && tag.dependencyHash === expected.dependencyHash;
  }
}
