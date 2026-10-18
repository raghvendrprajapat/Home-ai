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
export function forgetLinked(): void { try { localStorage.removeItem(KEY); } catch { /* nothing stored */ } }
/** Drawings just opened from their cloud head: the first save waits for a real change (no duplicate version). */
const inSync = new Set<string>();
export const markInSync = (projectId: string): void => { inSync.add(projectId); };
export const takeInSync = (projectId: string): boolean => inSync.delete(projectId);
/** The same drawing under a fresh project id and server revision 0, to start a separate cloud project. */
export function cloudCopy(document: ProjectDoc, newId: string = `prj_${crypto.randomUUID().replaceAll('-', '').slice(0, 24)}`): ProjectDoc {
  return { ...JSON.parse(JSON.stringify(document)) as ProjectDoc, id: newId, revision: 0 };
}
