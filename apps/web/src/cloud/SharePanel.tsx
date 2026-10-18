import { useEffect, useState } from 'react';
import { message } from '../i18n/messages';
import type { Locale } from '../i18n/messages';
import type { CloudShare } from './api';
import type { CloudSession } from './session';
import { shareLink } from './share-link';

/**
 * FR-033 (D69) view-only links for a drawing saved in the cloud. A new link is shown once (only its hash is stored);
 * live links can be stopped at any time. A link always shows the newest cloud version.
 */
export function SharePanel({ projectId, cloud, locale, available }: { projectId: string; cloud: CloudSession; locale: Locale; available: boolean }) {
  const [open, setOpen] = useState(false), [shares, setShares] = useState<CloudShare[] | null>(null), [link, setLink] = useState<string | null>(null), [note, setNote] = useState<string | null>(null), [busy, setBusy] = useState(false), [round, setRound] = useState(0);
  useEffect(() => {
    if (!open) return;
    let live = true;
    void cloud.ensure().then(api => api?.listShares(projectId)).then(result => { if (live) setShares(result?.ok ? result.shares : []); });
    return () => { live = false; };
  }, [open, cloud, projectId, round]);
  const create = async () => {
    setBusy(true); setNote(null);
    try {
      const api = await cloud.ensure(), result = api ? await api.createShare(projectId) : null;
      if (result?.ok) { setLink(shareLink(location.origin, location.pathname, result.token)); setRound(n => n + 1); }
      else setNote(message(locale, result && !result.ok && result.code === 'SHARE_LIMIT' ? 'shareLimit' : 'shareFailed'));
    } finally { setBusy(false); }
  };
  const stop = async (id: string) => {
    setBusy(true);
    try { const api = await cloud.ensure(), result = api ? await api.revokeShare(id) : null; setNote(message(locale, result?.ok ? 'shareStopped' : 'shareFailed')); if (result?.ok) { setLink(null); setRound(n => n + 1); } }
    finally { setBusy(false); }
  };
  const copy = () => { if (!link) return; if (!navigator.clipboard?.writeText) { setNote(message(locale, 'copyUnavailable')); return; } void navigator.clipboard.writeText(link).then(() => setNote(message(locale, 'shareCopied'))).catch(() => setNote(message(locale, 'copyDenied'))); };
  const when = (iso: string) => { const date = new Date(iso); return Number.isNaN(date.getTime()) ? iso : date.toLocaleString(locale === 'hi' ? 'hi-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short' }); };
  return <details className="share-panel" onToggle={event => setOpen(event.currentTarget.open)}><summary>{message(locale, 'shareTitle')}</summary>
    <p className="structure-note">{message(locale, 'shareHelp')}</p>
    {!available ? <p>{message(locale, 'shareNeedsCloud')}</p> : <button className="primary-button" disabled={busy} onClick={() => { void create(); }}>{message(locale, 'shareCreate')}</button>}
    {link && <div className="share-link"><label>{message(locale, 'shareLinkLabel')}<input readOnly value={link} onFocus={event => event.currentTarget.select()} /></label>
      <button onClick={copy}>{message(locale, 'shareCopy')}</button><p className="structure-note">{message(locale, 'shareOnce')}</p></div>}
    {note && <p role="status">{note}</p>}
    {shares && shares.length > 0 && <ul className="share-list">{shares.map(share => <li key={share.id} data-share-id={share.id}>
      <span>{message(locale, 'shareItem', { time: when(share.createdAt) })}</span><button disabled={busy} onClick={() => { void stop(share.id); }}>{message(locale, 'shareStop')}</button></li>)}</ul>}
  </details>;
}
