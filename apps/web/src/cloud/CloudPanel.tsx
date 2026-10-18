import { useEffect, useState, useSyncExternalStore } from 'react';
import { parseProject } from '@gharplan/core-model';
import type { ProjectDoc, ProjectStore } from '@gharplan/core-model';
import { message } from '../i18n/messages';
import type { Locale, MessageKey } from '../i18n/messages';
import type { CloudApi, CloudVersion } from './api';
import { CloudSaver } from './cloud-save';
import type { CloudPhase, CloudSaveState } from './cloud-save';
import { CLOUD_OFF, cloud as defaultCloud, cloudWasUsed, noSubscription } from './session';
import type { CloudSession } from './session';
import { cloudCopy, isLinked, setLinked, takeInSync } from './linked';
const cloudOff = () => CLOUD_OFF;

const idleState: CloudSaveState = { phase: 'idle', serverRevision: 0, ackedGeneration: null }, idleSaver = { getSnapshot: () => idleState, subscribe: () => () => undefined };
const PLAIN: Record<Exclude<CloudPhase, 'saved' | 'conflict'>, MessageKey & `cloud${string}`> = { idle: 'cloudSaving', waiting: 'cloudSaving', saving: 'cloudSaving', offline: 'cloudOffline',
  'not-in-cloud': 'cloudNotInCloud', taken: 'cloudNotInCloud', trashed: 'cloudTrashed', 'too-large': 'cloudTooLarge', limit: 'cloudLimit', invalid: 'cloudInvalid', 'signed-out': 'cloudSignedOut', error: 'cloudError' };
function phaseText(locale: Locale, state: CloudSaveState): string {
  if (state.phase === 'saved') return message(locale, 'cloudSaved', { revision: state.serverRevision });
  if (state.phase === 'conflict') return message(locale, 'cloudConflict', { cloud: state.cloudRevision ?? '?' });
  return message(locale, PLAIN[state.phase] as 'cloudOffline');
}
/** A cloud document is only used after the normal parser accepts it and it is the drawing that was asked for. */
async function cloudDocument(api: CloudApi, projectId: string, revision?: number): Promise<ProjectDoc | null> {
  const loaded = revision === undefined ? await api.load(projectId) : await api.loadVersion(projectId, revision);
  if (!loaded.ok) return null;
  const parsed = parseProject(JSON.stringify(loaded.document));
  return parsed.ok && parsed.document.id === projectId && (revision === undefined || parsed.document.revision === revision) ? parsed.document : null;
}
type OpenDocument = (document: ProjectDoc, linkToCloud: boolean) => void;
/**
 * FR-031 (D67) cloud panel: Google sign-in, "save this drawing to the cloud", and the live cloud status next to the
 * device status. FR-032 (D68) adds the three conflict choices and the version history. Works on the whole-project
 * store. Without cloud configuration it only says the cloud is not set up.
 */
export function CloudPanel({ store, locale, flush, onOpenDocument, cloud = defaultCloud }: { store: ProjectStore; locale: Locale; flush(): Promise<void>; onOpenDocument: OpenDocument; cloud?: CloudSession | null }) {
  const session = useSyncExternalStore(cloud?.subscribe ?? noSubscription, cloud?.getSnapshot ?? cloudOff);
  const projectId = useSyncExternalStore(store.subscribe, () => store.getSnapshot().document.id);
  const [linked, setLinkedState] = useState(() => isLinked(projectId)), [saver, setSaver] = useState<CloudSaver | null>(null), [busy, setBusy] = useState(false), [failed, setFailed] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false), [notice, setNotice] = useState<string | null>(null);
  useEffect(() => setLinkedState(isLinked(projectId)), [projectId]);
  useEffect(() => {
    // Someone who signed in before (or is coming back from Google) reconnects without another tap.
    if (!cloud || !cloudWasUsed(globalThis.localStorage ?? null, location.search)) return;
    void cloud.ensure().then(() => { if (/[?&]code=/.test(location.search)) history.replaceState(history.state, '', location.pathname + location.hash); });
  }, [cloud]);
  useEffect(() => {
    if (session.status !== 'signed-in' || !linked || !cloud) return;
    let live = true, created: CloudSaver | null = null;
    void cloud.ensure().then(api => {
      if (!live || !api) return;
      created = new CloudSaver(store, api); setSaver(created); created.start(takeInSync(projectId));
    });
    const online = () => created?.online(); window.addEventListener('online', online);
    return () => { live = false; window.removeEventListener('online', online); created?.close(); setSaver(null); };
  }, [session.status, linked, store, projectId, cloud]);
  const state = useSyncExternalStore(saver?.subscribe ?? idleSaver.subscribe, saver?.getSnapshot ?? idleSaver.getSnapshot);
  useEffect(() => { if (state.phase !== 'conflict') setConfirmReplace(false); }, [state.phase]);
  const signIn = async () => {
    if (!cloud || busy) return; setBusy(true); setFailed(false);
    try {
      const api = await cloud.ensure(); if (!api) { setFailed(true); return; }
      await flush(); // the drawing is safely on this device before the page goes to Google
      if (await api.signInWithGoogle(location.origin + location.pathname)) setFailed(true);
    } finally { setBusy(false); }
  };
  const openCloudCopy = async (revision?: number) => {
    const api = await cloud?.ensure(), document = api ? await cloudDocument(api, projectId, revision) : null;
    if (document) onOpenDocument(cloudCopy(document), false); else setNotice(message(locale, 'cloudCopyFailed'));
  };
  if (!cloud) return <section className="cloud-panel" aria-label={message(locale, 'cloudTitle')}><h3>{message(locale, 'cloudTitle')}</h3><p data-testid="cloud-status" data-phase="off">{message(locale, 'cloudOff')}</p></section>;
  const user = session.user, mine = () => store.getSnapshot().document as ProjectDoc;
  return <section className="cloud-panel" aria-label={message(locale, 'cloudTitle')} data-cloud-session={session.status}><h3>{message(locale, 'cloudTitle')}</h3>
    {session.status === 'signed-in' && user ? <>
      <p>{message(locale, 'cloudSignedInAs', { name: user.name ?? user.email ?? user.id.slice(0, 8) })}</p>
      {linked ? <p data-testid="cloud-status" data-phase={state.phase} aria-live="polite">{phaseText(locale, state)}</p>
        : <p data-testid="cloud-status" data-phase="unlinked">{message(locale, 'cloudNotLinked')}</p>}
      {notice && <p role="status">{notice}</p>}
      {linked && state.phase === 'conflict' && <div className="cloud-conflict" role="group" aria-label={message(locale, 'cloudConflictChoices')}>
        <button onClick={() => { void openCloudCopy(); }}>{message(locale, 'cloudInspect')}</button>
        <button onClick={() => onOpenDocument(cloudCopy(mine()), true)}>{message(locale, 'cloudKeepMine')}</button>
        {!confirmReplace ? <button onClick={() => setConfirmReplace(true)}>{message(locale, 'cloudReplace')}</button> : <div role="alert">
          <p>{message(locale, 'cloudReplaceConfirm', { cloud: state.cloudRevision ?? '?' })}</p>
          <button className="primary-button" onClick={() => { setConfirmReplace(false); saver?.replaceCloudAfterReview(); }}>{message(locale, 'cloudReplaceYes')}</button>
          <button onClick={() => setConfirmReplace(false)}>{message(locale, 'cancel')}</button>
        </div>}
      </div>}
      <div className="history-buttons">
        {!linked && <button className="primary-button" onClick={() => { setLinked(projectId, true); setLinkedState(true); }}>{message(locale, 'cloudSaveThis')}</button>}
        {linked && (state.phase === 'not-in-cloud' || state.phase === 'taken') && <button className="primary-button" onClick={() => onOpenDocument(cloudCopy(mine()), true)}>{message(locale, 'cloudSaveAsNew')}</button>}
        {linked && (state.phase === 'signed-out' || state.phase === 'error') && <button onClick={() => saver?.start()}>{message(locale, 'cloudRetry')}</button>}
        {linked && <button onClick={() => { setLinked(projectId, false); setLinkedState(false); }}>{message(locale, 'cloudStop')}</button>}
        <button onClick={() => { void cloud.ensure().then(api => api?.signOut()); }}>{message(locale, 'cloudSignOut')}</button>
      </div>
      {linked && saver && <VersionHistory key={projectId} store={store} saver={saver} state={state} cloud={cloud} locale={locale} onOpenCopy={revision => { void openCloudCopy(revision); }} onNotice={setNotice} />}
    </> : <>
      <p data-testid="cloud-status" data-phase={session.status === 'loading' ? 'connecting' : 'signed-out'}>{session.status === 'loading' ? message(locale, 'cloudConnecting') : message(locale, 'cloudSignInHelp')}</p>
      <button className="primary-button" disabled={busy || session.status === 'loading'} onClick={() => { void signIn(); }}>{message(locale, 'cloudSignIn')}</button>
      {(failed || session.status === 'failed') && <p role="alert">{message(locale, 'cloudConnectFailed')}</p>}
    </>}
  </section>;
}

/**
 * FR-032 (D68) the kept cloud versions of this drawing. "Open as a copy" never touches this drawing; "Restore" makes an
 * old version the new cloud head (§H.5, head never moves backwards) and then loads it here, only when everything here
 * was already saved and nothing changed while the restore ran.
 */
function VersionHistory({ store, saver, state, cloud, locale, onOpenCopy, onNotice }: { store: ProjectStore; saver: CloudSaver; state: CloudSaveState; cloud: CloudSession; locale: Locale; onOpenCopy(revision: number): void; onNotice(text: string): void }) {
  const [versions, setVersions] = useState<CloudVersion[] | null>(null), [failed, setFailed] = useState(false), [open, setOpen] = useState(false), [confirm, setConfirm] = useState<number | null>(null), [busy, setBusy] = useState(false);
  const projectId = store.getSnapshot().document.id;
  useEffect(() => {
    if (!open) return;
    let live = true; setFailed(false);
    void cloud.ensure().then(api => api?.listVersions(projectId)).then(result => { if (!live) return; if (result?.ok) setVersions(result.versions); else setFailed(true); });
    return () => { live = false; };
  }, [open, cloud, projectId, state.serverRevision]);
  const restore = async (revision: number) => {
    setConfirm(null); setBusy(true);
    try {
      const api = await cloud.ensure(), start = store.getSnapshot(), head = state.serverRevision;
      if (!api || state.phase !== 'saved') { onNotice(message(locale, 'versionRestoreBlocked')); return; }
      const reply = await api.restore(projectId, revision, head, `restore-${crypto.randomUUID().replaceAll('-', '')}`);
      if (!reply.ok) { if (reply.code === 'REVISION_CONFLICT' && typeof reply.details?.currentServerRevision === 'number') saver.markConflict(reply.details.currentServerRevision); onNotice(message(locale, 'versionRestoreFailed')); return; }
      const document = await cloudDocument(api, projectId);
      // Edits made here while the restore ran are never thrown away: cloud saving pauses as a conflict instead.
      if (!document || document.revision !== reply.serverRevision || store.getSnapshot().localGeneration !== start.localGeneration || !store.replaceFromServer(document).ok) {
        saver.markConflict(reply.serverRevision); onNotice(message(locale, 'versionMovedOn')); return;
      }
      saver.markInSync(); onNotice(message(locale, 'versionRestored', { revision, next: reply.serverRevision }));
    } finally { setBusy(false); }
  };
  const when = (iso: string) => { const date = new Date(iso); return Number.isNaN(date.getTime()) ? iso : date.toLocaleString(locale === 'hi' ? 'hi-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short' }); };
  return <details className="version-history" onToggle={event => setOpen(event.currentTarget.open)}><summary>{message(locale, 'versionHistory')}</summary>
    {failed ? <p role="alert">{message(locale, 'versionLoadFailed')}</p> : versions === null ? <p role="status">{message(locale, 'versionsLoading')}</p> :
      <ol className="version-list">{versions.map(version => <li key={version.revision} data-revision={version.revision}>
        <span>{message(locale, 'versionItem', { revision: version.revision, time: when(version.createdAt) })}{version.revision === state.serverRevision ? ` ${message(locale, 'versionCurrent')}` : ''}</span>
        <button disabled={busy} onClick={() => onOpenCopy(version.revision)}>{message(locale, 'versionOpenCopy')}</button>
        {version.revision !== state.serverRevision && <button disabled={busy || state.phase !== 'saved'} onClick={() => setConfirm(version.revision)}>{message(locale, 'versionRestore')}</button>}
        {confirm === version.revision && <div role="alert"><p>{message(locale, 'versionRestoreConfirm', { revision: version.revision, next: state.serverRevision + 1 })}</p>
          <button className="primary-button" onClick={() => { void restore(version.revision); }}>{message(locale, 'versionRestoreYes')}</button><button onClick={() => setConfirm(null)}>{message(locale, 'cancel')}</button></div>}
      </li>)}</ol>}
    {state.phase !== 'saved' && <p className="structure-note">{message(locale, 'versionRestoreBlocked')}</p>}
  </details>;
}
