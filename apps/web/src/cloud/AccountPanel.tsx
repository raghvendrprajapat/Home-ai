import { useState } from 'react';
import { message } from '../i18n/messages';
import type { Locale } from '../i18n/messages';
import type { CloudApi, CloudUser } from './api';
import type { CloudSession } from './session';
import { forgetLinked } from './linked';

/** FR-043 (D70) deleting needs a sign-in from the last 10 minutes (§D.8 "recent auth"). */
export const RECENT_SIGN_IN_MS = 10 * 60 * 1000;
export const signedInRecently = (user: Pick<CloudUser, 'lastSignInAt'>, now: number): boolean => {
  const at = user.lastSignInAt ? Date.parse(user.lastSignInAt) : NaN;
  return Number.isFinite(at) && now - at >= -60_000 && now - at <= RECENT_SIGN_IN_MS;
};
export interface CloudExport { format: 'gharplan-cloud-export'; version: 1; exportedAt: string; account: { id: string; email: string | null }; projects: { id: string; name: string; serverRevision: number; document: unknown }[]; missing: string[] }
/** Every cloud drawing (trash included) as one JSON file; drawings that could not be read are listed, never hidden. */
export async function exportCloudData(api: CloudApi, user: CloudUser, now: () => string = () => new Date().toISOString()): Promise<CloudExport | null> {
  const listed = await api.listProjects(true);
  if (!listed.ok) return null;
  const result: CloudExport = { format: 'gharplan-cloud-export', version: 1, exportedAt: now(), account: { id: user.id, email: user.email }, projects: [], missing: [] };
  for (const project of listed.projects) {
    const loaded = await api.load(project.id);
    if (loaded.ok) result.projects.push({ id: project.id, name: loaded.name, serverRevision: loaded.serverRevision, document: loaded.document }); else result.missing.push(project.id);
  }
  return result;
}

/** FR-043 (D70) "Your account and data": download everything in the cloud, or delete the account and all cloud data. */
export function AccountPanel({ cloud, user, locale, onDeleted }: { cloud: CloudSession; user: CloudUser; locale: Locale; onDeleted(text: string): void }) {
  const [confirm, setConfirm] = useState(false), [typed, setTyped] = useState(''), [busy, setBusy] = useState(false), [note, setNote] = useState<string | null>(null);
  const download = async () => {
    setBusy(true); setNote(null);
    try {
      const api = await cloud.ensure(), data = api ? await exportCloudData(api, user) : null;
      if (!data) { setNote(message(locale, 'accountExportFailed')); return; }
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })), link = document.createElement('a');
      link.href = url; link.download = 'gharplan-cloud-export.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNote(message(locale, data.missing.length ? 'accountExportPartial' : 'accountExported', { count: data.projects.length, missing: data.missing.length }));
    } finally { setBusy(false); }
  };
  const remove = async () => {
    if (typed !== 'DELETE') return;
    setBusy(true); setNote(null);
    try {
      const api = await cloud.ensure(), result = api ? await api.deleteAccount() : null;
      // The database checks the sign-in time itself (§D.8); an old sign-in asks for a new one, nothing is deleted.
      if (!result?.ok) { setNote(message(locale, result?.code === 'REAUTH_REQUIRED' ? 'accountSignInAgain' : 'accountDeleteFailed')); return; }
      // Signing out closes this section, so the confirmation is shown by the cloud panel itself.
      forgetLinked(); onDeleted(message(locale, 'accountDeleted')); await api!.signOut();
    } finally { setBusy(false); }
  };
  const again = async () => { const api = await cloud.ensure(); if (!api) return; await api.signOut(); await api.signInWithGoogle(location.origin + location.pathname); };
  const recent = signedInRecently(user, Date.now());
  return <details className="account-panel"><summary>{message(locale, 'accountTitle')}</summary>
    <p className="structure-note">{message(locale, 'accountExportHelp')}</p>
    <button disabled={busy} onClick={() => { void download(); }}>{message(locale, 'accountExport')}</button>
    {!confirm ? <button disabled={busy} onClick={() => setConfirm(true)}>{message(locale, 'accountDelete')}</button> : <div role="alert" className="account-delete">
      <p>{message(locale, 'accountDeleteWhat')}</p><p>{message(locale, 'accountDeleteKept')}</p>
      {!recent ? <><p>{message(locale, 'accountSignInAgain')}</p><button className="primary-button" onClick={() => { void again(); }}>{message(locale, 'cloudSignIn')}</button></> : <>
        <label>{message(locale, 'accountTypeDelete')}<input value={typed} autoComplete="off" onChange={event => setTyped(event.target.value)} /></label>
        <button className="primary-button" disabled={busy || typed !== 'DELETE'} onClick={() => { void remove(); }}>{message(locale, 'accountDeleteForever')}</button>
      </>}
      <button onClick={() => { setConfirm(false); setTyped(''); }}>{message(locale, 'cancel')}</button>
    </div>}
    {note && <p role="status">{note}</p>}
  </details>;
}
