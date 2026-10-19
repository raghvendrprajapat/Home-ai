import { Fragment, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { parseProject, ProjectStore } from '@gharplan/core-model';
import type { ProjectDoc } from '@gharplan/core-model';
import { renderPlanImage } from '../editor/plan-image';
import { floorSnapshot } from '../editor/floor-scope';
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
 * FR-034: a project with several floors shows one plan and one room list per floor, lowest first, under the floor's name.
 */
export function SharedView({ token, cloud = defaultCloud }: { token: string; cloud?: CloudSession | null }) {
  const ui = useUi(), locale = ui.locale;
  useSyncExternalStore(cloud?.subscribe ?? noSubscription, cloud?.getSnapshot ?? cloudOff);
  const [doc, setDoc] = useState<ProjectDoc | null>(null), [state, setState] = useState<'loading' | 'ready' | 'missing' | 'off' | 'failed'>(cloud ? 'loading' : 'off');
  const [images, setImages] = useState<Record<string, string>>({}), [saving, setSaving] = useState(false), [saveFailed, setSaveFailed] = useState(false);
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
  const views = useMemo(() => {
    if (!store) return [];
    const snapshot = store.getSnapshot(), floors = [...snapshot.document.floors].sort((a, b) => a.level - b.level);
    return floors.length < 2 ? [{ key: 'plan', floor: null, snapshot }] : floors.map(floor => ({ key: floor.id, floor, snapshot: floorSnapshot(snapshot, floor.id) }));
  }, [store]);
  useEffect(() => {
    const urls: string[] = []; let live = true;
    for (const view of views) void renderPlanImage(view.snapshot, locale, 1000).then(result => { if (!live) return; const url = URL.createObjectURL(result.blob); urls.push(url); setImages(old => ({ ...old, [view.key]: url })); }).catch(() => undefined);
    return () => { live = false; for (const url of urls) URL.revokeObjectURL(url); };
  }, [views, locale]);
  const saveCopy = async () => {
    if (!doc || saving) return; setSaving(true); setSaveFailed(false);
    try {
      const opened = await createWorkspace(await inspectWorkspace(), cloudCopy(doc));
      if (!opened.saving) throw new Error('local-save');
      await opened.saving.flush(); opened.saving.close();
      location.replace(location.pathname); // the copy is now this device's active drawing
    } catch { setSaveFailed(true); setSaving(false); }
  };
  return <main className="workspace shell-page shared-view" data-shared-state={state}>
    <header className="app-header"><h1>GharPlan</h1><span className="project-label">{message(locale, 'sharedBadge')}</span></header>
    {state === 'loading' && <p role="status">{message(locale, 'sharedLoading')}</p>}
    {state === 'off' && <p role="alert">{message(locale, 'cloudOff')}</p>}
    {state === 'missing' && <p role="alert">{message(locale, 'sharedMissing')}</p>}
    {state === 'failed' && <p role="alert">{message(locale, 'sharedFailed')}</p>}
    {state === 'ready' && doc && views.length > 0 && <section className="settings-card">
      <h2>{doc.name}</h2><p>{message(locale, 'sharedHelp')}</p>
      {views.map(({ key, floor, snapshot }) => { const image = images[key], plan = <>
        {floor && <h3>{floor.name}</h3>}
        {image ? <img className="shared-plan" src={image} alt={floor ? message(locale, 'sharedFloorPlanAlt', { name: doc.name, floor: floor.name }) : message(locale, 'sharedPlanAlt', { name: doc.name })} width={1000} height={1000} /> : <p role="status">{message(locale, 'sharedLoading')}</p>}
        <ul className="shared-rooms">{snapshot.derived.faces.map(face => { const room = snapshot.document.rooms.find(r => r.id === face.roomId), area = areaDisplay(face.clearAreaMm2, snapshot.document.units);
          return room ? <li key={room.id}>{room.name}: {area.value} {area.unit}</li> : null; })}</ul></>;
        return floor ? <section key={key} className="shared-floor" aria-label={floor.name}>{plan}</section> : <Fragment key={key}>{plan}</Fragment>; })}
      <button className="primary-button" disabled={saving} onClick={() => { void saveCopy(); }}>{message(locale, 'sharedSaveCopy')}</button>
      {saveFailed && <p role="alert">{message(locale, 'sharedSaveFailed')}</p>}
    </section>}
    <p><a href={location.pathname}>{message(locale, 'sharedOpenApp')}</a></p>
  </main>;
}
