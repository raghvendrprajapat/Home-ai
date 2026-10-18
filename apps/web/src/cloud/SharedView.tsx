import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { parseProject, ProjectStore } from '@gharplan/core-model';
import type { ProjectDoc } from '@gharplan/core-model';
import { renderPlanImage } from '../editor/plan-image';
import { areaDisplay, message } from '../i18n/messages';
import { useUi } from '../ui/state';
import { createWorkspace, inspectWorkspace } from '../storage/workspace';
import { cloudCopy } from './linked';
import { CLOUD_OFF, cloud as defaultCloud, noSubscription } from './session';
import type { CloudSession } from './session';
const cloudOff = () => CLOUD_OFF;

/**
 * FR-033 (D69) the page a view-only link opens. Nothing here can change the shared drawing: it shows the plan as an
 * image with its rooms, and "Save a copy on this device" makes an ordinary local drawing with a new project id.
 */
export function SharedView({ token, cloud = defaultCloud }: { token: string; cloud?: CloudSession | null }) {
  const ui = useUi(), locale = ui.locale;
  useSyncExternalStore(cloud?.subscribe ?? noSubscription, cloud?.getSnapshot ?? cloudOff);
  const [doc, setDoc] = useState<ProjectDoc | null>(null), [state, setState] = useState<'loading' | 'ready' | 'missing' | 'off' | 'failed'>(cloud ? 'loading' : 'off');
  const [image, setImage] = useState<string | null>(null), [saving, setSaving] = useState(false), [saveFailed, setSaveFailed] = useState(false);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  useEffect(() => {
    if (!cloud) return;
    let live = true;
    void cloud.ensure().then(async api => {
      if (!api) { if (live) setState('failed'); return; }
      const shared = await api.getShared(token);
      if (!live) return;
      if (!shared.ok) { setState(shared.code === 'NETWORK' || shared.code === 'UNEXPECTED' ? 'failed' : 'missing'); return; }
      const parsed = parseProject(JSON.stringify(shared.document));
      if (parsed.ok) { setDoc(parsed.document); setState('ready'); } else setState('failed');
    });
    return () => { live = false; };
  }, [cloud, token]);
  const store = useMemo(() => doc ? new ProjectStore(doc, `shared_${crypto.randomUUID()}`) : null, [doc]);
  useEffect(() => {
    if (!store) return;
    let url: string | null = null, live = true;
    void renderPlanImage(store.getSnapshot(), locale, 1000).then(result => { if (!live) return; url = URL.createObjectURL(result.blob); setImage(url); }).catch(() => undefined);
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
  }, [store, locale]);
  const saveCopy = async () => {
    if (!doc || saving) return; setSaving(true); setSaveFailed(false);
    try {
      const opened = await createWorkspace(await inspectWorkspace(), cloudCopy(doc));
      if (!opened.saving) throw new Error('local-save');
      await opened.saving.flush(); opened.saving.close();
      location.replace(location.pathname); // the copy is now this device's active drawing
    } catch { setSaveFailed(true); setSaving(false); }
  };
  const snapshot = store?.getSnapshot();
  return <main className="workspace shell-page shared-view" data-shared-state={state}>
    <header className="app-header"><h1>GharPlan</h1><span className="project-label">{message(locale, 'sharedBadge')}</span></header>
    {state === 'loading' && <p role="status">{message(locale, 'sharedLoading')}</p>}
    {state === 'off' && <p role="alert">{message(locale, 'cloudOff')}</p>}
    {state === 'missing' && <p role="alert">{message(locale, 'sharedMissing')}</p>}
    {state === 'failed' && <p role="alert">{message(locale, 'sharedFailed')}</p>}
    {state === 'ready' && doc && snapshot && <section className="settings-card">
      <h2>{doc.name}</h2><p>{message(locale, 'sharedHelp')}</p>
      {image ? <img className="shared-plan" src={image} alt={message(locale, 'sharedPlanAlt', { name: doc.name })} width={1000} height={1000} /> : <p role="status">{message(locale, 'sharedLoading')}</p>}
      <ul className="shared-rooms">{snapshot.derived.faces.map(face => { const room = snapshot.document.rooms.find(r => r.id === face.roomId), area = areaDisplay(face.clearAreaMm2, snapshot.document.units);
        return room ? <li key={room.id}>{room.name}: {area.value} {area.unit}</li> : null; })}</ul>
      <button className="primary-button" disabled={saving} onClick={() => { void saveCopy(); }}>{message(locale, 'sharedSaveCopy')}</button>
      {saveFailed && <p role="alert">{message(locale, 'sharedSaveFailed')}</p>}
    </section>}
    <p><a href={location.pathname}>{message(locale, 'sharedOpenApp')}</a></p>
  </main>;
}
