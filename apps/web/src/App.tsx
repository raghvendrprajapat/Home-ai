import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { parseProject, ProjectStore } from '@gharplan/core-model';
import sample from '../../../docs/examples/sample-project.json';
import { PlanCanvas } from './editor/PlanCanvas';
import { DrawingTool } from './editor/drawing-tools';
import { DrawingControls, RoomControls } from './editor/DrawingControls';
import { junctionMoves } from './editor/view2d';
import { SaveControls } from './storage/SaveControls';
import type { WorkspaceSession } from './storage/workspace';
import { areaDisplay, editError, message } from './i18n/messages';
import type { MessageArgs, MessageKey } from './i18n/messages';
import { useUi } from './ui/state';
import './app.css';
function EngineLoadError() {
  const { locale } = useUi();
  return <div className="plan-canvas"><div className="three-status" role="status">{message(locale, 'engineLoadFailed')}</div></div>;
}
const ThreeView = lazy(() => import('./render3d/ThreeView').catch(() => ({ default: EngineLoadError })));

function createDemo(): ProjectStore {
  const parsed = parseProject(JSON.stringify(sample));
  if (!parsed.ok) throw new Error('Bundled sample project failed validation.');
  return new ProjectStore(parsed.document, `editor_${crypto.randomUUID()}`);
}
export function App({ session, navigation }: { session?: WorkspaceSession; navigation?: ReactNode } = {}) {
  const ui = useUi(), t = <K extends MessageKey>(key: K, ...args: MessageArgs<K>) => message(ui.locale, key, ...args);
  const [store] = useState(() => session?.store ?? createDemo()), snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [drawing] = useState(()=>new DrawingTool(store));
  const [selected, setSelected] = useState(() => store.getSnapshot().document.junctions[1]?.id ?? ''), [notice, setMessage] = useState(() => t('chooseCorner'));
  const [x, setX] = useState(''), [y, setY] = useState(''), [showGrid, setShowGrid] = useState(true), [fit, setFit] = useState(0);
  const [view, setView] = useState<'2d' | '3d'>('2d');
  const corner = snapshot.document.junctions.find(j => j.id === selected);
  useEffect(() => { if (!corner && snapshot.document.junctions.length) setSelected(snapshot.document.junctions[1]?.id ?? snapshot.document.junctions[0]!.id); }, [corner, snapshot.document.junctions]);
  useEffect(() => { setMessage(message(ui.locale, 'chooseCorner')); }, [ui.locale]);
  useEffect(() => { setX(String(corner?.x ?? '')); setY(String(corner?.y ?? '')); }, [corner]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if(event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement||event.target instanceof HTMLSelectElement)return;
      if(!event.ctrlKey&&!event.metaKey&&!event.altKey){if(event.key.toLowerCase()==='w'){event.preventDefault();drawing.setMode('wall');}if(event.key.toLowerCase()==='r'){event.preventDefault();drawing.setMode('rectangle');}if(event.key==='Escape'||event.key.toLowerCase()==='v')drawing.setMode('select');}
      if (!(event.ctrlKey || event.metaKey) || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) store.redo(); else store.undo(); }
      if (event.key.toLowerCase() === 'y') { event.preventDefault(); store.redo(); }
    };
    window.addEventListener('keydown', shortcut); return () => window.removeEventListener('keydown', shortcut);
  }, [store,drawing]);
  const totalArea = snapshot.derived.faces.reduce((n, r) => n + r.clearAreaMm2, 0);
  const totalLabel = areaDisplay(totalArea, snapshot.document.units);
  const unclosedWalls=snapshot.document.walls.some(w=>!snapshot.derived.faces.some(face=>face.boundary.some((id,i)=>
    id===w.a&&face.boundary[(i+1)%face.boundary.length]===w.b||id===w.b&&face.boundary[(i+1)%face.boundary.length]===w.a)));
  return <main className="workspace">
    <header className="app-header">
      <div className="brand"><span className="brand-mark" aria-hidden="true">⌂</span><h1>GharPlan</h1><span className="brand-tag">{t('brandTag')}</span></div>
      {navigation}<div className="memory-status"><span aria-hidden="true" /> {session?.saving ? t('localDrawing') : t('demoMemory')}</div>
    </header>
    <section className="project-bar" aria-label={t('projectInfo')}>
      <div><span className="eyebrow">{t('workspace')}</span><h2>{snapshot.document.name}<span className="project-label">{t('oneFloor')}</span></h2></div>
      <div className="plan-summary"><span>{snapshot.document.rooms.length === 1 ? t('oneRoom') : t('roomsCount', { count: snapshot.document.rooms.length })}</span><strong data-testid="total-area">{totalLabel.value} <small>{totalLabel.unit} {t('clearArea')}</small></strong></div>
    </section>
    <div className="editor-layout">
      <section className="drawing-panel" aria-label={t('floorEditor')}>
        <div className="editor-toolbar">
          <div className="view-tabs" role="group" aria-label={t('drawingView')}><button className={view === '2d' ? 'active-tab' : ''} aria-label={t('plan2d')} aria-pressed={view === '2d'} onClick={() => setView('2d')}>▧ &nbsp; {t('plan2d')}</button><button className={view === '3d' ? 'active-tab' : ''} aria-pressed={view === '3d'} onClick={() => {drawing.setMode('select');setView('3d');}}>{t('view3d')}</button></div>
          <div className="canvas-actions"><button onClick={() => setFit(n => n + 1)} aria-label={t('fitPlanAria')}>{t('fitPlan')}</button>{view === '2d' && <label><input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} /> {t('grid')}</label>}</div>
        </div>
        {view === '2d' ? <PlanCanvas drawing={drawing} locale={ui.locale} store={store} snapshot={snapshot} selected={selected} onSelect={setSelected} onMessage={setMessage} zoomRequest={fit} showGrid={showGrid} /> : <Suspense fallback={<div className="plan-canvas"><div className="three-status" role="status">{t('loading3d')}</div></div>}><ThreeView locale={ui.locale} store={store} onMessage={setMessage} fitRequest={fit} /></Suspense>}
        <footer className="editor-footer"><span role="status" aria-live="polite">{notice}</span><span>{t('groundFloor')} · {t('mm')}</span></footer>
      </section>
      <aside className="inspector" aria-label={t('planControls')}>
        <SaveControls store={store} {...(session ? { session } : {})} />
        <div className="inspector-title"><span className="eyebrow">{t('precision')}</span><h3>{t('shapeSpace')}</h3><p>{t('moveCornerHelp')}</p></div>
        <div className="history-buttons"><button disabled={!snapshot.canUndo} onClick={() => { store.undo(); setMessage(t('undone')); }} aria-label={t('undo')}>↶ &nbsp; {t('undo')}</button><button disabled={!snapshot.canRedo} onClick={() => { store.redo(); setMessage(t('redone')); }} aria-label={t('redo')}>↷ &nbsp; {t('redo')}</button></div>
        {view==='2d'&&<DrawingControls tool={drawing} store={store} locale={ui.locale} onMessage={setMessage}/>}
        {!snapshot.document.walls.length && <div className="blank-plan"><p>{t('blankPlan')}</p><button className="primary-button" onClick={() => {
          const result = store.execute({ type: 'AddRectangle', id: `starter_${snapshot.localGeneration}`, baseGeneration: snapshot.localGeneration, x: 0, y: 0, width: 4000, depth: 4000, thickness: 200, height: 2700 });
          if (result.ok) setFit(n => n + 1);
          setMessage(result.ok ? t('starterAdded') : editError(ui.locale, result.errors[0]));
        }}>{t('starterRoom')}</button></div>}
        {corner && <form onSubmit={event => {
          event.preventDefault(); const point: [number, number] = [Number(x), Number(y)];
          if (!x.trim() || !y.trim() || !point.every(Number.isSafeInteger)) { setMessage(t('wholeCoordinates')); return; }
          const result = store.execute({ id: `coordinate_${snapshot.localGeneration}`, baseGeneration: snapshot.localGeneration, type: 'MoveJunctions', moves: junctionMoves(snapshot.document, selected, point) });
          setMessage(result.ok ? result.changed ? t('cornerUpdated') : t('cornerUnchanged') : editError(ui.locale, result.errors[0]));
        }}>
          <label className="field-label" htmlFor="corner">{t('selectedCorner')}</label>
          <select id="corner" value={selected} onChange={event => setSelected(event.target.value)}>{snapshot.document.junctions.map((j, i) => <option key={j.id} value={j.id}>{t('cornerOption', { number: i + 1, x: j.x, y: j.y })}</option>)}</select>
          <div className="coordinate-fields"><label>{t('xPosition')} <span>{t('mm')}</span><input aria-label={t('cornerX')} type="number" step="1" min="-100000" max="100000" value={x} onChange={e => setX(e.target.value)} required /></label><label>{t('yPosition')} <span>{t('mm')}</span><input aria-label={t('cornerY')} type="number" step="1" min="-100000" max="100000" value={y} onChange={e => setY(e.target.value)} required /></label></div>
          <button className="primary-button" type="submit">{t('applyCoordinates')} <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 13 13 3M3 3h10v10" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg></button>
        </form>}
        <section className="room-list" aria-label={t('roomAreas')}><div className="section-heading"><h3>{t('insidePlan')}</h3><span>{t('roomsCount', { count: snapshot.document.rooms.length })}</span></div>
          {snapshot.derived.faces.map((face, i) => { const label = areaDisplay(face.clearAreaMm2, snapshot.document.units); return <div className="room-row" key={face.roomId}><span className={`room-swatch swatch-${i % 2}`} aria-hidden="true" /><div><strong>{snapshot.document.rooms.find(r => r.id === face.roomId)?.name}</strong><small>{face.smallSpaceWarning ? t('smallSpace') : t('insideArea')}</small></div><span data-testid={`area-${face.roomId}`}>{label.value} <small>{label.unit}</small></span></div>; })}
        </section>
        {unclosedWalls&&<p role="status">{t('incompletePlan')}</p>}
        <RoomControls store={store} locale={ui.locale} onMessage={setMessage}/>
        <div className="tip"><span aria-hidden="true">✦</span><p><strong>{t('measured')}</strong><br />{t('measuredHelp')}</p></div>
      </aside>
    </div>
    <div className="workbench-note">{session ? t('keepBackups') : t('memoryHelp')}</div>
  </main>;
}
