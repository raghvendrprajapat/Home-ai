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
export function SaveControls({ store, session }: { store: ProjectStore; session?: WorkspaceSession }) {
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
  return <section className="local-saving" aria-label={message(locale, 'saveSection')}>
    <p data-testid="save-status" data-phase={status.phase} aria-live="polite">{locale === 'en' ? status.message : message(locale, phases[status.phase])}</p>
    {session?.warning && <p role="alert">{locale === 'en' ? session.warning : message(locale, 'recoveryWarning')}</p>}
    <div className="history-buttons"><button disabled={exporting} onClick={() => { void exportDrawing(); }}>{message(locale, 'exportDrawing')}</button>{saving && status.phase !== 'saved' && <button onClick={() => { void saving.retry(); }}>{message(locale, 'retrySave')}</button>}</div>
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
