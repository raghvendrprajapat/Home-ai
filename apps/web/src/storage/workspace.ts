import { Capacitor } from '@capacitor/core';
import { parseProject, ProjectStore, recoveryCopy, serializeProject } from '@gharplan/core-model';
import type { ProjectDoc } from '@gharplan/core-model';
import { canOpenLocalAutomatically, capacitorMirror, IndexedProjectStorage, recover, sameHead, SaveCoordinator, sha256 } from '@gharplan/persistence';
import type { MirrorCandidate, NativeMirror, Recovered } from '@gharplan/persistence';
import { firstRunSample } from '../samples/showcase';

export interface WorkspaceSession { store: ProjectStore; saving: SaveCoordinator | null; warning: string | null }
export interface StartupChoice { label: string; warning: string | null; document: ProjectDoc; local: Recovered | null; native: MirrorCandidate | null }
export interface StartupInspection {
  storage: IndexedProjectStorage | null; mirror: NativeMirror | null; nativeRequired: boolean;
  choices: StartupChoice[]; warnings: string[]; automatic: StartupChoice | null;
  hasProjects?: boolean;
}
const demoDocument = (): ProjectDoc => {
  const parsed = parseProject(JSON.stringify(firstRunSample())); if (!parsed.ok) throw new Error('Bundled sample failed validation.'); return parsed.document;
};
export async function inspectWorkspace(): Promise<StartupInspection> {
  const result: StartupInspection = { storage: null, mirror: null, nativeRequired: Capacitor.getPlatform() === 'android', choices: [], warnings: [], automatic: null };
  let local: Recovered | null = null, mirrors: MirrorCandidate[] = [];
  try {
    result.storage = await IndexedProjectStorage.open();
    try {
      const listed = await result.storage.listProjects(); result.hasProjects = !!listed.projects.length || !!listed.warnings.length;
      result.warnings.push(...listed.warnings);
    } catch { result.hasProjects = true; result.warnings.push('The saved project list could not be read. Original data is retained.'); }
    const bundle = await result.storage.readActive();
    if (bundle) local = await recover(bundle);
  } catch { result.warnings.push('Saved drawing could not be read. Its stored files have not been replaced. Use a backup or a separate sample.'); }
  if (result.nativeRequired) {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    try {
      result.mirror = await capacitorMirror();
      mirrors = await Promise.race([result.mirror.read(local?.head.projectId), new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('Phone backup inspection timed out.')), 1500); })]);
      if (result.storage) { const listed = await result.storage.listProjects(); const trash = new Set(listed.projects.filter(p => p.trashedAt).map(p => p.projectId)); mirrors = mirrors.filter(c => !trash.has(c.head.projectId)); }
      result.warnings.push(...result.mirror.getWarnings());
    }
    catch { result.warnings.push('Phone backup could not be read. Existing files are retained. Restore a separate drawing or keep an exported copy.'); }
    finally { if (timeout) clearTimeout(timeout); }
  }
  if (local) result.choices.push({ label: `${local.document.name} — local saved drawing`, warning: local.warning ?? (local.journalNewer ? 'Changes from your previous session are available to restore.' : null), document: local.document, local, native: null });
  for (const candidate of mirrors) if (!local || !sameHead(local.head, candidate.head)) result.choices.push({ label: `${candidate.document.name} — phone backup`, warning: candidate.warning ? 'Some older backup files are damaged. This valid version can be recovered as a separate drawing.' : 'Recover this backup as a separate drawing; existing files stay untouched.', document: candidate.document, local: null, native: candidate });
  if (!result.warnings.length && canOpenLocalAutomatically(local, mirrors)) result.automatic = result.choices.find(c => c.local === local)!;
  // Persistence permission is best effort; denial never means cloud backup or
  // lets us hide an actual write failure. It is not an OS deletion guarantee.
  try { await navigator.storage?.persist?.(); } catch { /* Truthful status depends on actual writes. */ }
  return result;
}
export async function openWorkspace(inspection: StartupInspection, choice: StartupChoice | null, separateSample = false): Promise<WorkspaceSession> {
  const mustCopy = separateSample || !!choice && (!choice.local || !choice.local.complete || !!choice.local.warning);
  let document = choice?.document ?? demoDocument(); if (mustCopy) document = recoveryCopy(document, new Date().toISOString(), () => `cp_${crypto.randomUUID().replaceAll('-', '')}`);
  return attachWorkspace(inspection, document, choice?.local && !mustCopy ? choice.local.bundle.meta : null);
}
export async function createWorkspace(inspection: StartupInspection, document: ProjectDoc): Promise<WorkspaceSession> {
  return attachWorkspace(inspection, document, null);
}
async function attachWorkspace(inspection: StartupInspection, document: ProjectDoc, existing: import('@gharplan/persistence').ProjectMeta | null): Promise<WorkspaceSession> {
  const store = new ProjectStore(document, `editor_${crypto.randomUUID()}`);
  let warning = inspection.warnings.join(' ') || null;
  if (!inspection.storage) return { store, saving: null, warning: warning ?? 'Local saving is unavailable. Keep this page open and export your drawing.' };
  try {
    const meta = existing ?? await inspection.storage.initialize(store.getSnapshot().document);
    if (await sha256(serializeProject(store.getSnapshot().document)) !== meta.hash) throw new Error('Startup document differs from its stored head.');
    if (existing) await inspection.storage.activate(meta);
    const saving = new SaveCoordinator(store, inspection.storage, meta, { mirror: inspection.mirror, nativeRequired: inspection.nativeRequired,
      mirrorMatches: false });
    // Rechecking/copying an already valid native head is harmless and verifies
    // the initial backup without marking an unexecuted write as completed.
    void saving.flush();
    return { store, saving, warning };
  } catch { warning = 'Local saving failed. Your drawing remains in memory; existing files are retained. Export a copy before closing.'; return { store, saving: null, warning }; }
}
