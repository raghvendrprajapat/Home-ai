import { useEffect, useRef, useState } from 'react';
import { App } from '../App';
import { openWorkspace } from './workspace';
import type { StartupInspection, WorkspaceSession } from './workspace';

/** The inspection promise is created once by main, outside StrictMode effects. */
export function WorkspaceRoot({ startup }: { startup: Promise<StartupInspection> }) {
  const [inspection, setInspection] = useState<StartupInspection | null>(null), [session, setSession] = useState<WorkspaceSession | null>(null);
  const [busy, setBusy] = useState(false), [cancelled, setCancelled] = useState(false), [error, setError] = useState<string | null>(null);
  const opening = useRef(false);
  useEffect(() => {
    let live = true;
    void startup.then(async result => {
      if (!live) return; setInspection(result);
      if (result.automatic || !result.choices.length && !result.warnings.length) {
        opening.current = true; setBusy(true);
        try { const opened = await openWorkspace(result, result.automatic); if (live) setSession(opened); }
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
  if (session) return <App key={session.store.getSnapshot().sessionId} session={session} />;
  if (error) return <main className="workspace"><h1>GharPlan</h1><p role="alert">{error}</p><button onClick={() => location.reload()}>Retry opening</button></main>;
  if (!inspection) return <main className="workspace"><h1>GharPlan</h1><p role="status">Checking your saved drawing…</p></main>;
  const choose = async (index: number | null, asCopy = false) => {
    if (opening.current) return; opening.current = true; setBusy(true);
    try { setSession(await openWorkspace(inspection, index === null ? null : inspection.choices[index]!, index === null || asCopy)); }
    catch { setError('Recovery could not be opened. Existing files are retained. Reload to retry.'); }
    finally { opening.current = false; setBusy(false); }
  };
  return <main className="workspace"><h1>GharPlan</h1><section className="recovery-panel" role="dialog" aria-modal="true" aria-labelledby="recovery-title">
    <h2 id="recovery-title">Restore your drawing</h2><p>Choose a validated saved version before editing. Damaged files stay untouched; repaired drawings and phone backups open as separate copies.</p>
    {inspection.warnings.map(warning => <p key={warning} role="alert">{warning}</p>)}
    {!cancelled && inspection.choices.map((choice, index) => <div key={index}><strong>{choice.label}</strong>{choice.warning && <p>{choice.warning}</p>}<button disabled={busy} onClick={() => { void choose(index); }}>{choice.local?.complete && !choice.local.warning ? 'Restore saved changes' : 'Recover as a separate drawing'}</button>
      {inspection.nativeRequired && inspection.warnings.length > 0 && choice.local?.complete && !choice.local.warning && <button disabled={busy} onClick={() => { void choose(index, true); }}>Recover as a separate drawing</button>}
    </div>)}
    {cancelled ? <><p>Saved files are untouched. Reopen these choices or use a separate sample.</p><button disabled={busy} onClick={() => setCancelled(false)}>Show recovery choices</button></> : <button disabled={busy} onClick={() => setCancelled(true)}>Leave saved files untouched</button>}
    <button disabled={busy} onClick={() => { void choose(null); }}>Open a separate sample</button>
    {busy && <p role="status">Opening validated drawing…</p>}
  </section></main>;
}
