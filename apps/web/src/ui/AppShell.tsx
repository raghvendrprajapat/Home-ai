import { useCallback, useEffect, useRef, useState } from 'react';
import { createBlankProject, createTemplateProject, parseProject, ProjectStore, recoveryCopy, serializeProject, TEMPLATE_IDS } from '@gharplan/core-model';
import type { ProjectDoc, RoomType, TemplateId } from '@gharplan/core-model';
import { recover, sameHead } from '@gharplan/persistence';
import type { ProjectMeta, Recovered } from '@gharplan/persistence';
import { DiagnosticSettings } from '../diagnostics/Settings';
import { App } from '../App';
import { message } from '../i18n/messages';
import type { MessageArgs, MessageKey } from '../i18n/messages';
import { createWorkspace, openWorkspace } from '../storage/workspace';
import type { StartupInspection, WorkspaceSession } from '../storage/workspace';
import { Dialog } from './Dialog';
import { readProjectUpload } from '../storage/read-file';
import { useUi } from './state';
import { CloudProjects } from '../cloud/CloudProjects';
import { cloud } from '../cloud/session';
import { cloudCopy, markInSync, setLinked } from '../cloud/linked';
import type { CloudProjectSummary } from '../cloud/api';

const nextId = () => `cp_${crypto.randomUUID().replaceAll('-', '')}`;
const cloneDocument = (document: ReturnType<ProjectStore['getSnapshot']>['document']) => JSON.parse(serializeProject(document)) as ProjectDoc;
export function AppShell({ inspection, session, onSession }: { inspection: StartupInspection; session: WorkspaceSession | null; onSession(session: WorkspaceSession | null): void }) {
  const ui = useUi(), t = <K extends MessageKey>(key: K, ...args: MessageArgs<K>) => message(ui.locale, key, ...args);
  const screen = !session && ui.screen === 'editor' ? 'projects' : ui.screen;
  const [projects, setProjects] = useState<ProjectMeta[]>([]), [listWarnings, setListWarnings] = useState(false), [loading, setLoading] = useState(false);
  const [error, setError] = useState<'operationFailed' | 'nameRequired' | 'leaveBlocked' | 'projectListFailed' | 'importInvalid' | 'importSize' | 'importEncoding' | 'importFuture' | 'importRead' | 'cloudLoadFailed' | null>(null), [busy, setBusy] = useState(false), [showTrash, setShowTrash] = useState(false);
  const [modal, setModal] = useState<'create' | 'rename' | 'trash' | 'recover' | 'import' | 'cloud' | null>(null), [cloudChoice, setCloudChoice] = useState<ProjectDoc | null>(null), [target, setTarget] = useState<ProjectMeta | null>(null);
  const [imported, setImported] = useState<ProjectDoc | null>(null), [importCopyOnly, setImportCopyOnly] = useState(true);
  const fileInput = useRef<HTMLInputElement>(null), reading = useRef<AbortController | null>(null);
  useEffect(() => () => { reading.current?.abort(); }, []);
  const [name, setName] = useState(''), [template, setTemplate] = useState<'blank' | TemplateId>('blank'), [units, setUnits] = useState(ui.units), [proposal, setProposal] = useState<Recovered | null>(null);
  const flight = useRef(false), current = useRef(session); current.current = session;
  const refresh = useCallback(async () => {
    if (!inspection.storage) { setProjects([]); return; }
    setLoading(true);
    try { const listed = await inspection.storage.listProjects(); setProjects(listed.projects); setListWarnings(!!listed.warnings.length); }
    catch { setError('projectListFailed'); }
    finally { setLoading(false); }
  }, [inspection.storage]);
  useEffect(() => { if (screen === 'projects') { void refresh(); const focus = () => { void refresh(); }; window.addEventListener('focus', focus); return () => window.removeEventListener('focus', focus); } }, [screen, refresh]);
  const canLeave = async (): Promise<boolean> => {
    const active = current.current; if (!active) return true;
    if (!active.saving) { setError('leaveBlocked'); return false; }
    await active.saving.flush(); const phase = active.saving.getSnapshot().phase;
    if (phase !== 'saved' && phase !== 'partial') { setError('leaveBlocked'); return false; }
    return true;
  };
  const switchTo = (opened: WorkspaceSession) => {
    current.current?.saving?.close(); current.current = opened; onSession(opened); ui.setScreen('editor');
  };
  const perform = async (action: () => Promise<void>) => {
    if (flight.current) return; flight.current = true; setBusy(true); setError(null);
    try { await action(); } catch { setError('operationFailed'); }
    finally { flight.current = false; setBusy(false); }
  };
  const read = async (meta: ProjectMeta): Promise<Recovered> => {
    const bundle = await inspection.storage?.readProject(meta.projectId); if (!bundle || bundle.meta.trashedAt) throw new Error('Saved project is unavailable or trashed.');
    return recover(bundle);
  };
  const load = async (meta: ProjectMeta, loaded?: Recovered): Promise<WorkspaceSession | null> => {
    loaded ??= await read(meta);
    if (!loaded.complete || loaded.warning) { setProposal(loaded); setModal('recover'); return null; }
    const opened = await openWorkspace(inspection, { label: meta.name, warning: null, document: loaded.document, local: loaded, native: null });
    if (!opened.saving) throw new Error('Stored project cannot be safely activated.'); return opened;
  };
  const copied = (document: ProjectDoc, copyName: string): ProjectDoc => {
    const doc = recoveryCopy(document, new Date().toISOString(), nextId), store = new ProjectStore(doc, `copy_${crypto.randomUUID()}`);
    const result = store.execute({ type: 'RenameProject', name: copyName.slice(0, 120), id: 'copy_name', baseGeneration: 0 });
    if (!result.ok) throw new Error('Copy name is invalid.'); return cloneDocument(store.getSnapshot().document);
  };
  const importConflict = async (doc: ProjectDoc): Promise<boolean> => {
    if (!inspection.storage) return true;
    try {
      if (await inspection.storage.readProject(doc.id)) return true;
      if (inspection.nativeRequired) {
        if (!inspection.mirror) return true;
        let timer: ReturnType<typeof setTimeout> | undefined;
        try { return await Promise.race([inspection.mirror.hasProjectDirectory(doc.id), new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(true), 1500); })]); }
        finally { clearTimeout(timer); }
      }
      return false;
    } catch { return true; }
  };
  const selectImport = (file: File) => perform(async () => {
    const controller = new AbortController(); reading.current = controller;
    const parsed = await readProjectUpload(file, { signal: controller.signal });
    if (controller.signal.aborted) return;
    if (!parsed.ok) { const code = parsed.errors[0]?.code; setError(code === 'future-version' ? 'importFuture' : code === 'file-size' || code === 'size' ? 'importSize' : code === 'file-encoding' ? 'importEncoding' : code?.startsWith('file-') ? 'importRead' : 'importInvalid'); return; }
    setImported(parsed.document); setImportCopyOnly(await importConflict(parsed.document)); setModal('import');
  });
  const acceptImport = (asCopy: boolean) => perform(async () => {
    if (!imported || !await canLeave()) return;
    // Recheck after preview: another tab may have created this ID meanwhile.
    if (!asCopy && await importConflict(imported)) { setImportCopyOnly(true); return; }
    const doc = asCopy ? copied(imported, t('copiedName', { name: imported.name })) : imported;
    switchTo(await createWorkspace(inspection, doc)); setModal(null); setImported(null);
  });
  const open = (meta: ProjectMeta) => perform(async () => {
    if (!await canLeave()) return;
    const active = current.current, loaded = await read(meta);
    // Cards can be stale while a different tab saves or trashes a project.
    // Reuse undo history only after validating the current disk document/head.
    if (loaded.complete && !loaded.warning && active?.store.getSnapshot().document.id === meta.projectId && active.saving && sameHead(active.saving.getMeta(), loaded.head)) { await inspection.storage!.activate(loaded.bundle.meta); ui.setScreen('editor'); return; }
    const opened = await load(meta, loaded); if (opened) switchTo(opened);
  });
  // FR-031 (D67): a cloud drawing opens as a device project; if this device already has that project, the person
  // chooses this device's version or a separate copy of the cloud one. Nothing local is ever overwritten.
  const openCloud = (summary: CloudProjectSummary) => perform(async () => {
    const api = await cloud?.ensure(); if (!api) { setError('cloudLoadFailed'); return; }
    const loaded = await api.load(summary.id), parsed = loaded.ok ? parseProject(JSON.stringify(loaded.document)) : null;
    if (!loaded.ok || !parsed?.ok || parsed.document.id !== summary.id || parsed.document.revision !== loaded.serverRevision) { setError('cloudLoadFailed'); return; }
    if (!await canLeave()) return;
    if (await inspection.storage?.readProject(summary.id)) { setCloudChoice(parsed.document); setModal('cloud'); return; }
    markInSync(summary.id); setLinked(summary.id, true); switchTo(await createWorkspace(inspection, parsed.document));
  });
  const openDocument = (document: ProjectDoc, linkToCloud: boolean) => { void perform(async () => {
    if (!await canLeave()) return;
    switchTo(await createWorkspace(inspection, document)); if (linkToCloud) setLinked(document.id, true);
  }); };
  const duplicate = (meta: ProjectMeta) => perform(async () => {
    if (!await canLeave()) return;
    const bundle = await inspection.storage?.readProject(meta.projectId); if (!bundle) throw new Error('Saved project is unavailable.');
    const loaded = await recover(bundle); if (!loaded.complete || loaded.warning) { setProposal(loaded); setModal('recover'); return; }
    switchTo(await createWorkspace(inspection, copied(loaded.document, t('copiedName', { name: loaded.document.name }))));
  });
  const submit = () => perform(async () => {
    if (modal === 'create') {
      if (!name.trim() || name.trim().length > 120) { setError('nameRequired'); return; }
      if (!await canLeave()) return;
      const base = { name, units, now: new Date().toISOString(), nextId, floorName: t('groundFloor'), materialName: t('baseFinish') };
      const doc = template === 'blank' ? createBlankProject(base) : createTemplateProject({ ...base, template, roomName: (type: RoomType) => t(`room_${type}` as const) });
      switchTo(await createWorkspace(inspection, doc)); setModal(null); return;
    }
    if (!target || !inspection.storage || !await canLeave()) return;
    if (modal === 'trash') {
      const active = current.current, expected = active?.store.getSnapshot().document.id === target.projectId && active.saving ? active.saving.getMeta() : target;
      await inspection.storage.setTrashed(expected, true);
      if (active?.store.getSnapshot().document.id === target.projectId) { active.saving?.close(); current.current = null; onSession(null); }
      setModal(null); await refresh(); return;
    }
    if (modal === 'rename') {
      if (!name.trim() || name.trim().length > 120) { setError('nameRequired'); return; }
      const opened = await load(target); if (!opened) return;
      const snapshot = opened.store.getSnapshot(), result = opened.store.execute({ type: 'RenameProject', name, id: `rename_${snapshot.localGeneration}`, baseGeneration: snapshot.localGeneration });
      if (!result.ok) throw new Error('Rename rejected.');
      // Retain the session even if persistence subsequently fails; its edited
      // document must stay exportable instead of disappearing in a temp store.
      switchTo(opened); await opened.saving!.flush(); setModal(null);
    }
  });
  const navigation = <nav className="shell-nav" aria-label={t('workspace')}><button onClick={() => ui.setScreen('projects')}>{t('projects')}</button><button onClick={() => ui.setScreen('settings')}>{t('settings')}</button>{session && screen !== 'editor' && <button onClick={() => ui.setScreen('editor')}>{t('backEditor')}</button>}</nav>;
  const language = <label className="field-label">{t('language')}<select aria-label={t('language')} value={ui.locale} onChange={e => ui.setLocale(e.target.value as 'en' | 'hi')}><option value="en">{t('english')}</option><option value="hi">{t('hindi')}</option></select></label>;
  if (!ui.onboardingSeen) return <main className="workspace shell-page"><header className="app-header"><h1>GharPlan</h1>{language}</header><section className="welcome-card"><span className="brand-mark" aria-hidden="true">⌂</span><h2>{t('welcome')}</h2><p>{t('welcomeText')}</p><p>{t('welcomeTip')}</p><button className="primary-button" onClick={() => ui.dismissWelcome()}>{t('getStarted')}</button><button onClick={() => ui.dismissWelcome()}>{t('skipWelcome')}</button></section></main>;
  if (screen === 'editor' && session) return <><App key={session.store.getSnapshot().sessionId} session={session} navigation={navigation} onOpenDocument={openDocument} />{error && <p className="shell-alert" role="alert">{message(ui.locale, error)}</p>}</>;
  return <main className="workspace shell-page"><header className="app-header"><h1>GharPlan</h1>{navigation}</header>
    {error && <p role="alert">{message(ui.locale, error)}</p>}
    {screen === 'settings' ? <section className="settings-card"><h2>{t('settings')}</h2><p>{t('settingsText')}</p>{language}<label className="field-label">{t('defaultUnits')}<select aria-label={t('defaultUnits')} value={ui.units} onChange={e => ui.setUnits(e.target.value as 'metric' | 'imperial')}><option value="metric">{t('metric')}</option><option value="imperial">{t('imperial')}</option></select></label><DiagnosticSettings />{!ui.preferencesRemembered && <p role="alert">{t('preferenceWarning')}</p>}<button onClick={() => ui.setScreen(ui.returnTo)}>{t('back')}</button></section> : <section>
      <div className="project-list-heading"><div><h2>{showTrash ? t('trash') : t('projectList')}</h2><p>{t('projectListText')}</p></div><button className="primary-button" disabled={busy} onClick={() => { setName(t('unnamed')); setUnits(ui.units); setTemplate('blank'); setTarget(null); setModal('create'); setError(null); }}>{t('newProject')}</button></div>
      <div className="project-list-actions"><button onClick={() => { setShowTrash(v => !v); }}>{showTrash ? t('showProjects') : t('showTrash')}</button><button disabled={loading || busy} onClick={() => { void refresh(); }}>{t('refresh')}</button></div>
      <button disabled={busy} onClick={() => fileInput.current?.click()}>{t('importDrawing')}</button><input ref={fileInput} type="file" accept=".json,application/json" hidden aria-label={t('chooseBackup')} onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) void selectImport(file); }} />{busy && <p role="status">{t('working')}</p>}
      {loading && <p role="status">{t('loadingProjects')}</p>}{listWarnings && <p role="alert">{t('damagedProjects')}</p>}
      <div className="project-cards" role="list">{projects.filter(p => !!p.trashedAt === showTrash).map(meta => <article className="project-card" key={meta.projectId} role="listitem" data-project-id={meta.projectId}><div className="project-thumb" aria-hidden="true">⌂</div><h3>{meta.name}</h3><p>{t('onDevice')}</p><div className="project-card-actions">{meta.trashedAt ? <button disabled={busy} onClick={() => { void perform(async () => { await inspection.storage!.setTrashed(meta, false); await refresh(); }); }}>{t('restore')}</button> : <><button disabled={busy} aria-label={t('openNamed', { name: meta.name })} onClick={() => { void open(meta); }}>{t('open')}</button><button disabled={busy} onClick={() => { setTarget(meta); setName(meta.name); setModal('rename'); setError(null); }}>{t('rename')}</button><button disabled={busy} onClick={() => { void duplicate(meta); }}>{t('duplicate')}</button><button disabled={busy} onClick={() => { setTarget(meta); setModal('trash'); setError(null); }}>{t('moveTrash')}</button></>}</div></article>)}</div>
      {!loading && !projects.some(p => !!p.trashedAt === showTrash) && <p>{showTrash ? t('emptyTrash') : t('noProjects')}</p>}
      {!showTrash && <CloudProjects locale={ui.locale} busy={busy} onOpen={summary => { void openCloud(summary); }} />}
    </section>}
    {modal && <Dialog title={modal === 'create' ? t('newProject') : modal === 'rename' ? t('rename') : modal === 'trash' ? t('trash') : modal === 'import' ? t('importTitle') : modal === 'cloud' ? t('cloudProjects') : t('recoveryTitle')} busy={busy} onCancel={() => { setModal(null); setError(null); }}>
      {modal === 'import' && imported && <><p>{t('importPreview', { name: imported.name, count: imported.rooms.length, units: imported.units === 'metric' ? t('metric') : t('imperial') })}</p>{importCopyOnly ? <p>{t('importConflict')}</p> : <button disabled={busy} onClick={() => { void acceptImport(false); }}>{t('importExact')}</button>}<button disabled={busy} onClick={() => { void acceptImport(true); }}>{t('importCopy')}</button></>}
      {(modal === 'create' || modal === 'rename') && <form onSubmit={e => { e.preventDefault(); void submit(); }}><label className="field-label">{t('projectName')}<input value={name} maxLength={120} required onChange={e => setName(e.target.value)} /></label>{modal === 'create' && <label className="field-label">{t('templateLabel')}<select aria-label={t('templateLabel')} value={template} onChange={e => setTemplate(e.target.value as 'blank' | TemplateId)}><option value="blank">{t('template_blank')}</option>{TEMPLATE_IDS.map(id => <option key={id} value={id}>{t(`template_${id}` as const)}</option>)}</select></label>}{modal === 'create' && <p>{t('templateHint')}</p>}{modal === 'create' && <label className="field-label">{t('units')}<select aria-label={t('units')} value={units} onChange={e => setUnits(e.target.value as 'metric' | 'imperial')}><option value="metric">{t('metric')}</option><option value="imperial">{t('imperial')}</option></select></label>}<button className="primary-button" disabled={busy} type="submit">{busy ? t('working') : modal === 'create' ? t('create') : t('saveName')}</button></form>}
      {modal === 'cloud' && cloudChoice && <><p>{t('cloudLocalExists', { name: cloudChoice.name })}</p>
        <button disabled={busy} onClick={() => { const meta = projects.find(p => p.projectId === cloudChoice.id); setModal(null); if (meta) void open(meta); }}>{t('cloudOpenLocal')}</button>
        <button disabled={busy} onClick={() => { void perform(async () => { switchTo(await createWorkspace(inspection, cloudCopy(cloudChoice))); setModal(null); setCloudChoice(null); }); }}>{t('cloudOpenCopy')}</button></>}
      {modal === 'trash' && target && <><p>{t('trashConfirm', { name: target.name })}</p><p>{t('trashText')}</p><button disabled={busy} onClick={() => { void submit(); }}>{t('moveTrash')}</button></>}
      {modal === 'recover' && proposal && <><p>{t('recoveryHelp')}</p>{proposal.roomRepair && <p>{t('repairedSource')}</p>}<button disabled={busy} onClick={() => { void perform(async () => { if (!await canLeave()) return; switchTo(await createWorkspace(inspection, copied(proposal.document, t('copiedName', { name: proposal.document.name })))); setModal(null); }); }}>{t('recoverCopy')}</button></>}
      {error && <p role="alert">{message(ui.locale, error)}</p>}<button disabled={busy} onClick={() => { setModal(null); setError(null); }}>{t('cancel')}</button>
    </Dialog>}
  </main>;
}
