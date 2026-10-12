import { useState, useSyncExternalStore } from 'react';
import { Capacitor } from '@capacitor/core';
import { serializeProject } from '@gharplan/core-model';
import type { ProjectStore } from '@gharplan/core-model';
import type { SaveStatus } from '@gharplan/persistence';
import type { WorkspaceSession } from './workspace';

const memory: SaveStatus = { phase: 'memory', message: 'In memory only — export before closing.', pending: 0, diskSequence: 0 };
const nothing = () => () => undefined;
export function SaveControls({ store, session }: { store: ProjectStore; session?: WorkspaceSession }) {
  const saving = session?.saving;
  const status = useSyncExternalStore(saving?.subscribe ?? nothing, saving?.getSnapshot ?? (() => memory));
  const [backup, setBackup] = useState<string | null>(null), [copyMessage, setCopyMessage] = useState('');
  const exportDrawing = () => {
    const text = serializeProject(store.getSnapshot().document);
    if (Capacitor.getPlatform() === 'android') { setBackup(text); setCopyMessage('No file was downloaded. Copy the complete data below into a safe backup file.'); return; }
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })), link = document.createElement('a');
    link.href = url; link.download = 'gharplan-project.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <section className="local-saving" aria-label="Drawing save and recovery">
    <p data-testid="save-status" data-phase={status.phase} aria-live="polite">{status.message}</p>
    {session?.warning && <p role="alert">{session.warning}</p>}
    <div className="history-buttons"><button onClick={exportDrawing}>Export drawing</button>{saving && status.phase !== 'saved' && <button onClick={() => { void saving.retry(); }}>Retry local save</button>}</div>
    {backup !== null && <div className="backup-copy" role="dialog" aria-labelledby="backup-copy-title"><h3 id="backup-copy-title">Copy drawing backup</h3><p aria-live="polite">{copyMessage}</p>
      <textarea aria-label="Complete drawing backup JSON" readOnly value={backup} rows={6} onFocus={event => event.currentTarget.select()} />
      <button onClick={() => {
        if (!navigator.clipboard?.writeText) { setCopyMessage('Copy is unavailable. Select all data above and copy it manually. Keep this page open until the backup is safe.'); return; }
        void navigator.clipboard.writeText(backup).then(() => setCopyMessage('Complete drawing data copied. Keep it in a safe backup file.')).catch(() => setCopyMessage('Copy permission was denied. Select all data above and copy it manually. Keep this page open until the backup is safe.'));
      }}>Copy complete data</button>
      <button onClick={() => setBackup(null)}>Close backup copy</button>
    </div>}
  </section>;
}
