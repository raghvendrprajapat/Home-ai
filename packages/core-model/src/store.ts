import { applyGeometry, GeometryError } from '@gharplan/geometry';
import type { DerivedPlan } from '@gharplan/geometry';
import { applyPatches, enablePatches, freeze, produce, produceWithPatches } from 'immer';
import type { Immutable, Patch } from 'immer';
import { applyCommand } from './commands';
import type { Command } from './commands';
import { dependencyHash, utf8Bytes } from './serialization';
import { validateProject } from './validation';
import type { AsyncTag, ProjectDoc, ValidationIssue } from './types';

enablePatches();
export interface EditorSnapshot { document: ProjectDoc; derived: DerivedPlan; localGeneration: number; sessionId: string; canUndo: boolean; canRedo: boolean; historyTruncated: boolean }
export type CommitResult = { ok: true; changed: boolean; changedIds: string[]; patches: Patch[]; inverse: Patch[]; checkRoomNamesHint: boolean } |
  { ok: false; errors: ValidationIssue[] };
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
  #listeners = new Set<() => void>(); #listenerErrors: string[] = []; #publishing = false; #snapshot: Immutable<EditorSnapshot>;
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
  #publish(): void {
    this.#snapshot = this.#makeSnapshot();
    this.#publishing = true;
    try {
      for (const listener of [...this.#listeners]) {
        try { listener(); } catch (error) { this.#listenerErrors.push(errorMessage(error)); this.#listenerErrors = this.#listenerErrors.slice(-20); }
      }
    } finally { this.#publishing = false; }
  }
  getListenerErrors(): readonly string[] { return [...this.#listenerErrors]; }
  getSnapshot = (): Immutable<EditorSnapshot> => this.#snapshot;
  subscribe = (listener: () => void): (() => void) => { this.#listeners.add(listener); return () => this.#listeners.delete(listener); };
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
      this.#document = next; this.#derived = derived; this.#generation++; this.#publish();
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
    this.#document = next; this.#derived = derived; this.#generation++; this.#publish(); return true;
  }
  undo(): boolean { return this.#history('undo'); }
  redo(): boolean { return this.#history('redo'); }
  confirmServerRevision(expectedPreviousRevision: number, confirmedRevision: number): boolean {
    if (this.#publishing) return false;
    if (!Number.isSafeInteger(expectedPreviousRevision) || !Number.isSafeInteger(confirmedRevision) || expectedPreviousRevision < 0 ||
      confirmedRevision !== expectedPreviousRevision + 1 || this.#document.revision !== expectedPreviousRevision) return false;
    this.#document = produce(this.#document, draft => { draft.revision = confirmedRevision; }); this.#publish(); return true;
  }
  asyncTag(dependencies: unknown = this.#document): AsyncTag {
    return { projectId: this.#document.id, sessionId: this.#sessionId, localGeneration: this.#generation, dependencyHash: dependencyHash(dependencies) };
  }
  acceptsAsync(tag: AsyncTag, dependencies: unknown = this.#document): boolean {
    const expected = this.asyncTag(dependencies);
    return tag.projectId === expected.projectId && tag.sessionId === expected.sessionId && tag.localGeneration === expected.localGeneration && tag.dependencyHash === expected.dependencyHash;
  }
}
