import { useState, useSyncExternalStore } from 'react';
import { Capacitor } from '@capacitor/core';
import { serializeProject } from '@gharplan/core-model';
import type { ProjectStore } from '@gharplan/core-model';
import type { SaveStatus } from '@gharplan/persistence';
import type { WorkspaceSession } from './workspace';
import { message } from '../i18n/messages';
import { useUi } from '../ui/state';
import { exportNativeProject } from './native-export';

const memory: SaveStatus = { phase: 'memory', message: 'In memory only — export before closing.', pending: 0, diskSequence: 0 };
const nothing = () => () => undefined;
/** `compact` (D76 M2): the top-bar form — a status pill and an Export button whose text hides on phones. */
export function SaveControls({ store, session, compact = false }: { store: ProjectStore; session?: WorkspaceSession; compact?: boolean }) {
  const { locale } = useUi();
  const saving = session?.saving;
  const status = useSyncExternalStore(saving?.subscribe ?? nothing, saving?.getSnapshot ?? (() => memory));
  const [backup, setBackup] = useState<string | null>(null), [copyKey, setCopyKey] = useState<'noDownload' | 'copyUnavailable' | 'copySuccess' | 'copyDenied' | 'exportBusy' | 'exportVerified' | 'exportFailed' | 'exportCancelled'>('noDownload'), [exporting, setExporting] = useState(false);
  const phases = { memory: 'inMemory', saving: 'saving', saved: saving?.options.nativeRequired ? 'savedPhone' : 'savedBrowser', partial: 'partialSave', error: 'saveFailed', conflict: 'saveConflict' } as const;
  const exportDrawing = async () => {
    if (exporting) return;
    const text = serializeProject(store.getSnapshot().document);
    if (Capacitor.getPlatform() === 'android') {
      setBackup(text); setCopyKey('noDownload');
      if (!Capacitor.isPluginAvailable('ProjectFiles')) return;
      setExporting(true); setCopyKey('exportBusy');
      try { await saving?.flush(); await exportNativeProject(text); setCopyKey('exportVerified'); }
      catch (e) { setCopyKey(e && typeof e === 'object' && 'code' in e && e.code === 'EXPORT_CANCELLED' ? 'exportCancelled' : 'exportFailed'); }
      finally { setExporting(false); }
      return;
    }
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })), link = document.createElement('a');
    link.href = url; link.download = 'gharplan-project.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <section className={compact ? 'local-saving save-compact' : 'local-saving'} aria-label={message(locale, 'saveSection')}>
    <p data-testid="save-status" data-phase={status.phase} aria-live="polite" title={locale === 'en' ? status.message : message(locale, phases[status.phase])}><span className="save-dot" aria-hidden="true" /><span className="save-text">{locale === 'en' ? status.message : message(locale, phases[status.phase])}</span></p>
    {session?.warning && <p role="alert">{locale === 'en' ? session.warning : message(locale, 'recoveryWarning')}</p>}
    <div className="history-buttons"><button className="export-button" disabled={exporting} aria-label={message(locale, 'exportDrawing')} onClick={() => { void exportDrawing(); }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg><span className="button-text">{message(locale, 'exportDrawing')}</span></button>{saving && status.phase !== 'saved' && !(compact && status.phase === 'saving') && <button onClick={() => { void saving.retry(); }}>{message(locale, 'retrySave')}</button>}</div>
    {backup !== null && <div className="backup-copy" role="dialog" aria-labelledby="backup-copy-title"><h3 id="backup-copy-title">{message(locale, 'backupTitle')}</h3><p aria-live="polite">{message(locale, copyKey)}</p><p>{message(locale, 'exportSnapshot')}</p>
      <textarea aria-label={message(locale, 'backupJson')} readOnly value={backup} rows={6} onFocus={event => event.currentTarget.select()} />
      <button onClick={() => {
        if (!navigator.clipboard?.writeText) { setCopyKey('copyUnavailable'); return; }
        void navigator.clipboard.writeText(backup).then(() => setCopyKey('copySuccess')).catch(() => setCopyKey('copyDenied'));
      }}>{message(locale, 'copyData')}</button>
      <button onClick={() => setBackup(null)}>{message(locale, 'closeBackup')}</button>
    </div>}
  </section>;
}
