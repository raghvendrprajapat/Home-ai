import { useEffect, useRef, useState } from 'react';
import { AppShell } from '../ui/AppShell';
import { useUi } from '../ui/state';
import { message } from '../i18n/messages';
import { openWorkspace } from './workspace';
import type { StartupInspection, WorkspaceSession } from './workspace';

/** The inspection promise is created once by main, outside StrictMode effects. */
export function WorkspaceRoot({ startup }: { startup: Promise<StartupInspection> }) {
  const ui = useUi(), t = (key: 'openingFailed' | 'retryOpen' | 'checking' | 'recoveryTitle' | 'recoveryHelp' | 'recoveryWarning' | 'restoreSaved' | 'recoverCopy' | 'recoveryCancelled' | 'showRecovery' | 'leaveFiles' | 'separateSample' | 'opening') => message(ui.locale, key);
  const [inspection, setInspection] = useState<StartupInspection | null>(null), [session, setSession] = useState<WorkspaceSession | null>(null);
  const [busy, setBusy] = useState(false), [cancelled, setCancelled] = useState(false), [error, setError] = useState<string | null>(null);
  const opening = useRef(false);
  const [ready, setReady] = useState(false);
  useEffect(() => { document.documentElement.lang = ui.locale; document.documentElement.dir = 'ltr'; }, [ui.locale]);
  useEffect(() => {
    let live = true;
    void startup.then(async result => {
      if (!live) return; setInspection(result);
      if (!result.automatic && !result.choices.length && !result.warnings.length && result.hasProjects) { setReady(true); return; }
      if (result.automatic || !result.choices.length && !result.warnings.length) {
        opening.current = true; setBusy(true);
        try { const opened = await openWorkspace(result, result.automatic); if (live) { setSession(opened); setReady(true); } else opened.saving?.close(); }
        finally { opening.current = false; if (live) setBusy(false); }
      }
    }).catch(() => { if (live) setError('The saved workspace could not be opened. Reload to retry; existing files are retained.'); });
    return () => { live = false; };
  }, [startup]);
  useEffect(() => {
    if (!session?.saving) return;
    const saving = session.saving, flush = () => { void saving.flush(); };
    const hidden = () => { if (document.hidden) flush(); };
    window.addEventListener('pagehide', flush); document.addEventListener('visibilitychange', hidden);
    return () => { window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', hidden); };
  }, [session]);
  if (ready && inspection) return <AppShell inspection={inspection} session={session} onSession={setSession} />;
  if (error) return <main className="workspace"><h1>GharPlan</h1><p role="alert">{t('openingFailed')}</p><button onClick={() => location.reload()}>{t('retryOpen')}</button></main>;
  if (!inspection) return <main className="workspace"><h1>GharPlan</h1><p role="status">{t('checking')}</p></main>;
  const choose = async (index: number | null, asCopy = false) => {
    if (opening.current) return; opening.current = true; setBusy(true);
    try { setSession(await openWorkspace(inspection, index === null ? null : inspection.choices[index]!, index === null || asCopy)); setReady(true); }
    catch { setError('Recovery could not be opened. Existing files are retained. Reload to retry.'); }
    finally { opening.current = false; setBusy(false); }
  };
  return <main className="workspace"><h1>GharPlan</h1><section className="recovery-panel" role="dialog" aria-modal="true" aria-labelledby="recovery-title">
    <h2 id="recovery-title">{t('recoveryTitle')}</h2><p>{t('recoveryHelp')}</p>
    {inspection.warnings.map(warning => <p key={warning} role="alert">{ui.locale === 'en' ? warning : t('recoveryWarning')}</p>)}
    {!cancelled && inspection.choices.map((choice, index) => <div key={index}><strong>{choice.document.name}</strong><p>{message(ui.locale, choice.native ? 'nativeSource' : 'localSource')}</p>{choice.warning && <p>{ui.locale === 'en' ? choice.warning : t('recoveryWarning')}</p>}{choice.local?.roomRepair && <p>{message(ui.locale, 'repairedSource')}</p>}<button disabled={busy} onClick={() => { void choose(index); }}>{choice.local?.complete && !choice.local.warning ? t('restoreSaved') : t('recoverCopy')}</button>
      {inspection.nativeRequired && inspection.warnings.length > 0 && choice.local?.complete && !choice.local.warning && <button disabled={busy} onClick={() => { void choose(index, true); }}>{t('recoverCopy')}</button>}
    </div>)}
    {cancelled ? <><p>{t('recoveryCancelled')}</p><button disabled={busy} onClick={() => setCancelled(false)}>{t('showRecovery')}</button></> : <button disabled={busy} onClick={() => setCancelled(true)}>{t('leaveFiles')}</button>}
    <button disabled={busy} onClick={() => { void choose(null); }}>{t('separateSample')}</button>
    {busy && <p role="status">{t('opening')}</p>}
  </section></main>;
}
