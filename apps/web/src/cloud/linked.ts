import type { ProjectDoc } from '@gharplan/core-model';

/**
 * FR-031 (D67) which drawings this device keeps saving to the cloud. A per-device convenience only: losing it just
 * means tapping "Save to cloud" again, which continues from the drawing's own server revision.
 */
const KEY = 'gharplan.cloud.linked';
const read = (): string[] => { try { const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]'); return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []; } catch { return []; } };
export const isLinked = (projectId: string): boolean => read().includes(projectId);
export function setLinked(projectId: string, linked: boolean): void {
  const next = read().filter(id => id !== projectId); if (linked) next.push(projectId);
  try { localStorage.setItem(KEY, JSON.stringify(next.slice(-500))); } catch { /* still linked for this page */ }
}
/** FR-043: after account deletion this device stops trying to save any drawing to the cloud. */
export function forgetLinked(): void { try { localStorage.removeItem(KEY); localStorage.removeItem(SYNC_KEY); } catch { /* nothing stored */ } }
/**
 * §H.5 local recovery, per drawing on this device: the last cloud-acknowledged revision with a tag of its content, and
 * the content tag of a save still waiting for its answer when the app closed. Losing it only costs one extra upload.
 */
export interface CloudSyncRecord { readonly revision: number; readonly hash: string; readonly pending?: { readonly base: number; readonly hash: string } }
export interface CloudSyncMemory { get(projectId: string): CloudSyncRecord | undefined; set(projectId: string, record: CloudSyncRecord | undefined): void }
const SYNC_KEY = 'gharplan.cloud.sync';
const count = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= -1;
const validRecord = (value: unknown): value is CloudSyncRecord => {
  if (!value || typeof value !== 'object') return false;
  const { revision, hash, pending } = value as Record<string, unknown>;
  return count(revision) && typeof hash === 'string' && (pending === undefined || (!!pending && typeof pending === 'object' && count((pending as Record<string, unknown>).base) && typeof (pending as Record<string, unknown>).hash === 'string'));
};
const readSync = (): Record<string, unknown> => { try { const value: unknown = JSON.parse(localStorage.getItem(SYNC_KEY) ?? '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; } catch { return {}; } };
export const syncMemory: CloudSyncMemory = {
  get: projectId => { const record = readSync()[projectId]; return validRecord(record) ? record : undefined; },
  set(projectId, record) {
    const next = Object.entries(readSync()).filter(([id]) => id !== projectId); if (record) next.push([projectId, record]);
    try { localStorage.setItem(SYNC_KEY, JSON.stringify(Object.fromEntries(next.slice(-500)))); } catch { /* kept for this page only */ }
  },
};
/** Drawings just opened from their cloud head: the first save waits for a real change (no duplicate version). */
const inSync = new Set<string>();
export const markInSync = (projectId: string): void => { inSync.add(projectId); };
export const takeInSync = (projectId: string): boolean => inSync.delete(projectId);
/** The same drawing under a fresh project id and server revision 0, to start a separate cloud project. */
export function cloudCopy(document: ProjectDoc, newId: string = `prj_${crypto.randomUUID().replaceAll('-', '').slice(0, 24)}`): ProjectDoc {
  return { ...JSON.parse(JSON.stringify(document)) as ProjectDoc, id: newId, revision: 0 };
}
