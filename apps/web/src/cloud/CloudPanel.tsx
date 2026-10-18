import { useEffect, useState, useSyncExternalStore } from 'react';
import type { ProjectDoc, ProjectStore } from '@gharplan/core-model';
import { message } from '../i18n/messages';
import type { Locale, MessageKey } from '../i18n/messages';
import { CloudSaver } from './cloud-save';
import type { CloudPhase, CloudSaveState } from './cloud-save';
import { CLOUD_OFF, cloud as defaultCloud, cloudWasUsed, noSubscription } from './session';
import type { CloudSession } from './session';
const cloudOff = () => CLOUD_OFF;
import { isLinked, setLinked, takeInSync } from './linked';

const idleState: CloudSaveState = { phase: 'idle', serverRevision: 0, ackedGeneration: null }, idleSaver = { getSnapshot: () => idleState, subscribe: () => () => undefined };
const PLAIN: Record<Exclude<CloudPhase, 'saved' | 'conflict'>, MessageKey & `cloud${string}`> = { idle: 'cloudSaving', waiting: 'cloudSaving', saving: 'cloudSaving', offline: 'cloudOffline',
  'not-in-cloud': 'cloudNotInCloud', taken: 'cloudNotInCloud', trashed: 'cloudTrashed', 'too-large': 'cloudTooLarge', limit: 'cloudLimit', invalid: 'cloudInvalid', 'signed-out': 'cloudSignedOut', error: 'cloudError' };
function phaseText(locale: Locale, state: CloudSaveState): string {
  if (state.phase === 'saved') return message(locale, 'cloudSaved', { revision: state.serverRevision });
  if (state.phase === 'conflict') return message(locale, 'cloudConflict', { cloud: state.cloudRevision ?? '?' });
  return message(locale, PLAIN[state.phase] as 'cloudOffline');
}
/**
 * FR-031 (D67) cloud panel: Google sign-in, "save this drawing to the cloud", and the live cloud status next to the
 * device status. Works on the whole-project store. Without cloud configuration it only says the cloud is not set up.
 */
export function CloudPanel({ store, locale, flush, onSaveAsNew, cloud = defaultCloud }: { store: ProjectStore; locale: Locale; flush(): Promise<void>; onSaveAsNew(document: ProjectDoc): void; cloud?: CloudSession | null }) {
  const session = useSyncExternalStore(cloud?.subscribe ?? noSubscription, cloud?.getSnapshot ?? cloudOff);
  const projectId = useSyncExternalStore(store.subscribe, () => store.getSnapshot().document.id);
  const [linked, setLinkedState] = useState(() => isLinked(projectId)), [saver, setSaver] = useState<CloudSaver | null>(null), [busy, setBusy] = useState(false), [failed, setFailed] = useState(false);
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
  const signIn = async () => {
    if (!cloud || busy) return; setBusy(true); setFailed(false);
    try {
      const api = await cloud.ensure(); if (!api) { setFailed(true); return; }
      await flush(); // the drawing is safely on this device before the page goes to Google
      if (await api.signInWithGoogle(location.origin + location.pathname)) setFailed(true);
    } finally { setBusy(false); }
  };
  if (!cloud) return <section className="cloud-panel" aria-label={message(locale, 'cloudTitle')}><h3>{message(locale, 'cloudTitle')}</h3><p data-testid="cloud-status" data-phase="off">{message(locale, 'cloudOff')}</p></section>;
  const user = session.user;
  return <section className="cloud-panel" aria-label={message(locale, 'cloudTitle')} data-cloud-session={session.status}><h3>{message(locale, 'cloudTitle')}</h3>
    {session.status === 'signed-in' && user ? <>
      <p>{message(locale, 'cloudSignedInAs', { name: user.name ?? user.email ?? user.id.slice(0, 8) })}</p>
      {linked ? <p data-testid="cloud-status" data-phase={state.phase} aria-live="polite">{phaseText(locale, state)}</p>
        : <p data-testid="cloud-status" data-phase="unlinked">{message(locale, 'cloudNotLinked')}</p>}
      <div className="history-buttons">
        {!linked && <button className="primary-button" onClick={() => { setLinked(projectId, true); setLinkedState(true); }}>{message(locale, 'cloudSaveThis')}</button>}
        {linked && (state.phase === 'not-in-cloud' || state.phase === 'taken') && <button className="primary-button" onClick={() => onSaveAsNew(store.getSnapshot().document as ProjectDoc)}>{message(locale, 'cloudSaveAsNew')}</button>}
        {linked && (state.phase === 'signed-out' || state.phase === 'error') && <button onClick={() => saver?.start()}>{message(locale, 'cloudRetry')}</button>}
        {linked && <button onClick={() => { setLinked(projectId, false); setLinkedState(false); }}>{message(locale, 'cloudStop')}</button>}
        <button onClick={() => { void cloud.ensure().then(api => api?.signOut()); }}>{message(locale, 'cloudSignOut')}</button>
      </div>
    </> : <>
      <p data-testid="cloud-status" data-phase={session.status === 'loading' ? 'connecting' : 'signed-out'}>{session.status === 'loading' ? message(locale, 'cloudConnecting') : message(locale, 'cloudSignInHelp')}</p>
      <button className="primary-button" disabled={busy || session.status === 'loading'} onClick={() => { void signIn(); }}>{message(locale, 'cloudSignIn')}</button>
      {(failed || session.status === 'failed') && <p role="alert">{message(locale, 'cloudConnectFailed')}</p>}
    </>}
  </section>;
}
