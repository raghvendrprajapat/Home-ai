import type { ProjectDoc } from '@gharplan/core-model';
import type { Immutable } from 'immer';
import { pack } from './codec';
import { assertMeta, sameHead, StorageError, validId } from './types';
import type { Bundle, Checkpoint, Head, Prepared, ProjectMeta } from './types';

const stores = ['projects', 'checkpoints', 'journal'] as const;
function databaseError(error: unknown): StorageError {
  if (error instanceof StorageError) return error;
  return new StorageError('io', 'Local storage write failed or was aborted. Your in-memory drawing is unchanged; export it now.');
}
/** No crypto, compression or unrelated async work occurs inside a transaction. */
export class IndexedProjectStorage {
  constructor(readonly db: IDBDatabase) { db.onversionchange = () => db.close(); }
  static open(factory: IDBFactory = indexedDB, name = 'gharplan'): Promise<IndexedProjectStorage> {
    return new Promise((resolve, reject) => {
      const request = factory.open(name, 2); let abandoned = false;
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'projectId' });
        if (!db.objectStoreNames.contains('checkpoints')) db.createObjectStore('checkpoints', { keyPath: ['projectId', 'seq'] });
        if (!db.objectStoreNames.contains('journal')) db.createObjectStore('journal', { keyPath: ['projectId', 'seq'] });
      };
      request.onblocked = () => { abandoned = true; reject(new StorageError('unavailable', 'Another tab blocks local storage setup. Close that tab and retry.')); };
      request.onerror = () => reject(new StorageError('unavailable', 'Local storage is unavailable. Keep this page open and export your drawing.'));
      request.onsuccess = () => { if (abandoned) request.result.close(); else resolve(new IndexedProjectStorage(request.result)); };
    });
  }
  close(): void { this.db.close(); }
  readActive(): Promise<Bundle | null> {
    return this.#read();
  }
  readProject(projectId: string): Promise<Bundle | null> {
    if (!validId(projectId)) return Promise.reject(new StorageError('corrupt', 'Invalid project selection.'));
    return this.#read(projectId);
  }
  #read(projectId?: string): Promise<Bundle | null> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(stores, 'readonly'), projects = tx.objectStore('projects');
      let bundle: Bundle | null = null, error: unknown;
      tx.onabort = () => reject(databaseError(error ?? tx.error));
      tx.oncomplete = () => resolve(bundle);
      const active = projects.get(projectId ?? '@active');
      active.onsuccess = () => {
        if (!active.result) return;
        const target = projectId ?? active.result.target;
        if (!validId(target)) { error = new StorageError('corrupt', 'Local project selection is damaged. Original data is retained.'); tx.abort(); return; }
        const meta = projects.get(target);
        meta.onsuccess = () => {
          try {
            if (!meta.result) throw new StorageError('corrupt', 'The selected local project is missing. Original data is retained.');
            assertMeta(meta.result); bundle = { meta: meta.result, checkpoints: [], journal: [] };
            const range = IDBKeyRange.bound([bundle.meta.projectId, 0], [bundle.meta.projectId, Number.MAX_SAFE_INTEGER]);
            const checkpoints = tx.objectStore('checkpoints').getAll(range, 3), journal = tx.objectStore('journal').getAll(range, 101);
            checkpoints.onsuccess = () => { bundle!.checkpoints = checkpoints.result; };
            journal.onsuccess = () => { bundle!.journal = journal.result; };
          } catch (e) { error = e; tx.abort(); }
        };
      };
    });
  }
  listProjects(): Promise<{ projects: ProjectMeta[]; warnings: string[] }> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('projects', 'readonly'), projects: ProjectMeta[] = [], warnings: string[] = []; let count = 0;
      tx.oncomplete = () => resolve({ projects, warnings }); tx.onabort = () => reject(new StorageError('size', 'Project list could not be read within its limit. Original data is retained.'));
      const request = tx.objectStore('projects').openCursor();
      request.onsuccess = () => {
        const cursor = request.result; if (!cursor) return;
        if (cursor.key !== '@active') {
          if (++count > 1000) { tx.abort(); return; }
          try { assertMeta(cursor.value); if (cursor.key !== cursor.value.projectId) throw new Error('Identity mismatch.'); projects.push(cursor.value); }
          catch { warnings.push('A saved project needs recovery. Its original data is retained.'); }
        }
        cursor.continue();
      };
    });
  }
  activate(expected: Head): Promise<void> { return this.#selectOrTrash(expected, null); }
  setTrashed(expected: Head, trashed: boolean): Promise<void> { return this.#selectOrTrash(expected, trashed); }
  #selectOrTrash(expected: Head, trashed: boolean | null): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('projects', 'readwrite', { durability: 'strict' }), store = tx.objectStore('projects'); let error: unknown;
      tx.oncomplete = () => resolve(); tx.onabort = () => reject(databaseError(error ?? tx.error));
      const request = store.get(expected.projectId);
      request.onsuccess = () => {
        try {
          assertMeta(request.result); if (!sameHead(request.result, expected)) throw new StorageError('conflict', 'The saved project changed. Refresh before selecting it.');
          if (trashed === null) {
            if (request.result.trashedAt) throw new StorageError('conflict', 'Restore this project from trash before opening it.');
            store.put({ projectId: '@active', target: expected.projectId }); return;
          }
          const meta: ProjectMeta = { ...request.result };
          if (trashed) meta.trashedAt ??= new Date().toISOString(); else delete meta.trashedAt;
          store.put(meta);
          if (trashed) { const active = store.get('@active'); active.onsuccess = () => { if (active.result?.target === expected.projectId) store.delete('@active'); }; }
        } catch (e) { error = e; tx.abort(); }
      };
    });
  }
  async initialize(document: Immutable<ProjectDoc>, nativeHead?: Head): Promise<ProjectMeta> {
    const packed = await pack(document), now = Date.now();
    const head: Head = nativeHead ?? { projectId: document.id, epoch: crypto.randomUUID(), seq: 0, hash: packed.hash };
    if (head.projectId !== document.id || head.hash !== packed.hash) throw new StorageError('corrupt', 'Native recovery identity differs from the drawing.');
    const meta: ProjectMeta = { ...head, storageVersion: 1, name: document.name, savedAt: new Date(now).toISOString(), checkpointAt: now, checkpointSeqs: [head.seq] }; assertMeta(meta);
    const checkpoint: Checkpoint = { ...head, packed };
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(stores, 'readwrite', { durability: 'strict' }), projects = tx.objectStore('projects'); let error: unknown;
      tx.oncomplete = () => resolve(meta); tx.onabort = () => reject(databaseError(error ?? tx.error));
      const previous = projects.get(document.id);
      previous.onsuccess = () => {
        if (previous.result) { error = new StorageError('conflict', 'A saved drawing already uses this ID. It has not been replaced.'); tx.abort(); return; }
        tx.objectStore('checkpoints').put(checkpoint); projects.put(meta); projects.put({ projectId: '@active', target: document.id });
      };
    });
  }
  /** CAS protects separate connections/tabs; an abort leaves the previous head intact. */
  commit(prepared: Prepared, fault?: () => void): Promise<ProjectMeta> {
    assertMeta(prepared.meta);
    if (prepared.meta.projectId !== prepared.expected.projectId || prepared.meta.epoch !== prepared.expected.epoch || prepared.meta.seq <= prepared.expected.seq)
      throw new StorageError('conflict', 'Invalid local commit identity or sequence.');
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(stores, 'readwrite', { durability: 'strict' }), projects = tx.objectStore('projects'); let error: unknown;
      tx.oncomplete = () => resolve(prepared.meta); tx.onabort = () => reject(databaseError(error ?? tx.error));
      const previous = projects.get(prepared.expected.projectId);
      previous.onsuccess = () => {
        try {
          if (!previous.result || previous.result.trashedAt || !sameHead(previous.result, prepared.expected)) throw new StorageError('conflict', 'Another tab changed or trashed this drawing. Your edits remain in memory; export them or reopen the saved drawing.');
          const journal = tx.objectStore('journal'), checkpoints = tx.objectStore('checkpoints');
          for (const entry of prepared.entries) journal.put(entry);
          for (const checkpoint of prepared.checkpoints) if (prepared.meta.checkpointSeqs.includes(checkpoint.seq)) checkpoints.put(checkpoint);
          fault?.(); // Synchronous injected failure exercises actual rollback, never used by the app.
          projects.put(prepared.meta);
          const range = IDBKeyRange.bound([prepared.meta.projectId, 0], [prepared.meta.projectId, Number.MAX_SAFE_INTEGER]);
          const oldCheckpoints = checkpoints.openCursor(range), oldJournal = journal.openCursor(range);
          oldCheckpoints.onsuccess = () => { const c = oldCheckpoints.result; if (!c) return; if (!prepared.meta.checkpointSeqs.includes(c.value.seq)) c.delete(); c.continue(); };
          oldJournal.onsuccess = () => { const c = oldJournal.result; if (!c) return; if (c.value.seq <= prepared.meta.checkpointSeqs.at(-1)!) c.delete(); c.continue(); };
        } catch (e) { error = e; tx.abort(); }
      };
    });
  }
}
