import {CatalogControls} from './catalog/CatalogControls';
import {FurnitureControls} from './editor/FurnitureControls';
import {CameraControls} from './editor/CameraControls';
import {ThreeImageControls} from './export/ThreeImageControls';
import type {ThreeControlsApi} from './render3d/types';
import type {QualityChoice} from './render3d/quality';
import { lazy, Suspense, useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { parseProject, ProjectStore } from '@gharplan/core-model';
import sample from '../../../docs/examples/sample-project.json';
import { PlanCanvas } from './editor/PlanCanvas';
import { DrawingTool } from './editor/drawing-tools';
import { DrawingControls, RoomControls } from './editor/DrawingControls';
import { WallPrecision } from './editor/WallPrecision';
import { OpeningControls } from './editor/OpeningControls';
import {SelectionControls} from './editor/SelectionControls';
import type {EditablePick} from './editor/SelectionControls';
import type {Pick} from './editor/hit-test';
import type { PrecisionPreview } from './editor/WallPrecision';
import { junctionMoves } from './editor/view2d';
import { SaveControls } from './storage/SaveControls';
import {PlanImageControls} from './export/PlanImageControls';
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
  const [threeApi,setThreeApi]=useState<ThreeControlsApi|null>(null),[quality,setQuality]=useState<QualityChoice>('auto'),[lighting,setLighting]=useState<'day'|'warm'>('day');
  const [drawing] = useState(()=>new DrawingTool(store));
  const [selectedWall,setSelectedWall]=useState(()=>store.getSnapshot().document.walls[0]?.id??''),[precision,setPrecision]=useState<PrecisionPreview|null>(null),[precisionCancel,setPrecisionCancel]=useState(0);
  const [selectedFurniture,setSelectedFurniture]=useState(''),[activePick,setActivePick]=useState<Pick|undefined>(undefined);
  const [selectedOpening,setSelectedOpening]=useState(''),[openingCancel,setOpeningCancel]=useState(0);
  const [selection,setSelection]=useState<EditablePick[]>([]),[multiple,setMultiple]=useState(false),[selectionCancel,setSelectionCancel]=useState(0);
  const cancelPrecision=useCallback(()=>{setPrecision(null);setPrecisionCancel(n=>n+1);setOpeningCancel(n=>n+1);setSelectionCancel(n=>n+1);},[]);
  const wallPreview=useCallback((value:PrecisionPreview|null)=>{if(value){drawing.clear();setOpeningCancel(n=>n+1);setSelectionCancel(n=>n+1);}setPrecision(current=>value?{...value,owner:'wall'}:current?.owner==='wall'?null:current);},[drawing]);
  const openingPreview=useCallback((value:PrecisionPreview|null)=>{if(value){drawing.clear();setPrecisionCancel(n=>n+1);setSelectionCancel(n=>n+1);}setPrecision(current=>value?{...value,owner:'opening'}:current?.owner==='opening'?null:current);},[drawing]);
  const selectionPreview=useCallback((value:PrecisionPreview|null)=>{if(value){drawing.clear();setPrecisionCancel(n=>n+1);setOpeningCancel(n=>n+1);}setPrecision(current=>value?{...value,owner:'selection'}:current?.owner==='selection'?null:current);},[drawing]);
  const selectEntities=(picks:EditablePick[])=>{setSelection(picks);const active=picks.at(-1);setActivePick(active);setSelectedFurniture(active?.kind==='furniture'?active.id:'');};
  const choosePicks=(picks:readonly Pick[],additive:boolean)=>{const eligible=picks.filter((p):p is EditablePick=>p.kind==='wall'||p.kind==='opening'||p.kind==='furniture');selectEntities(additive?[...selection,...eligible.filter(p=>!selection.some(o=>o.id===p.id))]:eligible);};
  const choosePick=(pick:Pick|null,additive=false)=>{if(pick&&(pick.kind==='wall'||pick.kind==='opening'||pick.kind==='furniture')){const p=pick as EditablePick;selectEntities(additive?selection.some(o=>o.id===p.id)?selection.filter(o=>o.id!==p.id):[...selection,p]:[p]);}else{if(!additive)setSelection([]);setActivePick(pick??undefined);setSelectedFurniture('');}if(pick?.kind==='wall'){setSelectedWall(pick.id);setSelectedOpening('');}if(pick?.kind==='opening'){setSelectedOpening(pick.id);const opening=snapshot.document.openings.find(o=>o.id===pick.id);if(opening)setSelectedWall(opening.wallId);}};
  useEffect(()=>{const fields={wall:'walls',opening:'openings',furniture:'furniture'} as const;setSelection(old=>{const next=old.filter(p=>snapshot.document[fields[p.kind]].some(e=>e.id===p.id));return next.length===old.length?old:next;});},[snapshot.document]);
  useEffect(()=>{if(selectedOpening&&!snapshot.document.openings.some(o=>o.id===selectedOpening))setSelectedOpening('');},[selectedOpening,snapshot.document.openings]);
  useEffect(()=>{if(selectedFurniture&&!snapshot.document.furniture.some(f=>f.id===selectedFurniture))setSelectedFurniture('');if(activePick){const fields={wall:'walls',opening:'openings',furniture:'furniture',room:'rooms',junction:'junctions'} as const;if(!snapshot.document[fields[activePick.kind]].some(e=>e.id===activePick.id))setActivePick(undefined);}},[selectedFurniture,activePick,snapshot.document]);
  useEffect(()=>{if(!snapshot.document.walls.some(w=>w.id===selectedWall))setSelectedWall(snapshot.document.walls[0]?.id??'');},[snapshot.document.walls,selectedWall]);
  const [selected, setSelected] = useState(() => store.getSnapshot().document.junctions[1]?.id ?? ''), [notice, setMessage] = useState(() => t('chooseCorner'));
  const [x, setX] = useState(''), [y, setY] = useState(''), [showGrid, setShowGrid] = useState(true), [fit, setFit] = useState(0);
  const [view, setView] = useState<'2d' | '3d'>('2d');
  const [threeFallback,setThreeFallback]=useState(false);
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
          <div className="view-tabs" role="group" aria-label={t('drawingView')}><button className={view === '2d' ? 'active-tab' : ''} aria-label={t('plan2d')} aria-pressed={view === '2d'} onClick={() => setView('2d')}>▧ &nbsp; {t('plan2d')}</button><button className={view === '3d' ? 'active-tab' : ''} aria-pressed={view === '3d'} onClick={() => {drawing.setMode('select');setThreeFallback(false);setView('3d');}}>{t('view3d')}</button></div>
          <div className="canvas-actions"><button onClick={() => setFit(n => n + 1)} aria-label={t('fitPlanAria')}>{t('fitPlan')}</button>{view === '2d' && <label><input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} /> {t('grid')}</label>}</div>
        </div>
        {view === '2d' ? <PlanCanvas drawing={drawing} precisionPreview={precision} onEditStart={cancelPrecision} onPick={choosePick} selection={selection} multiple={multiple} onBoxSelect={choosePicks} locale={ui.locale} store={store} snapshot={snapshot} selected={selected} onSelect={setSelected} onMessage={setMessage} zoomRequest={fit} showGrid={showGrid} /> : <Suspense fallback={<div className="plan-canvas"><div className="three-status" role="status">{t('loading3d')}</div></div>}><ThreeView selectedPick={activePick} onPick={choosePick} onFallback2d={()=>{setThreeFallback(true);setView('2d');}} quality={quality} lighting={lighting} onControlsReady={setThreeApi} locale={ui.locale} store={store} onMessage={setMessage} fitRequest={fit} /></Suspense>}
        {threeFallback&&<p role="status">{t('threeFallback')}</p>}
        <footer className="editor-footer"><span role="status" aria-live="polite">{notice}</span><span>{t('groundFloor')} · {t('mm')}</span></footer>
      </section>
      <aside className="inspector" aria-label={t('planControls')}>
        <SaveControls store={store} {...(session ? { session } : {})} />
        <CatalogControls locale={ui.locale} units={snapshot.document.units}/>
        <FurnitureControls store={store} selected={selectedFurniture} onSelect={id=>selectEntities(id?[{kind:'furniture',id}]:[])} locale={ui.locale} onMessage={setMessage}/>
        <PlanImageControls store={store} locale={ui.locale}/>
        {view==='3d'&&<><CameraControls store={store} api={threeApi} quality={quality} onQuality={setQuality} lighting={lighting} onLighting={setLighting} locale={ui.locale}/><ThreeImageControls api={threeApi} store={store} locale={ui.locale}/></>}
        <label>{t('currentProjectUnits')}<select aria-label={t('currentProjectUnits')} value={snapshot.document.units} onChange={event=>{const result=store.execute({id:`units_${crypto.randomUUID().replaceAll('-','')}`,baseGeneration:snapshot.localGeneration,type:'SetUnits',units:event.target.value as 'metric'|'imperial'});setMessage(result.ok?t('unitDisplayChanged'):editError(ui.locale,result.errors[0]));}}><option value="metric">{t('metric')}</option><option value="imperial">{t('imperial')}</option></select></label>
        <div className="inspector-title"><span className="eyebrow">{t('precision')}</span><h3>{t('shapeSpace')}</h3><p>{t('moveCornerHelp')}</p></div>
        <div className="history-buttons"><button disabled={!snapshot.canUndo} onClick={() => { store.undo(); setMessage(t('undone')); }} aria-label={t('undo')}>↶ &nbsp; {t('undo')}</button><button disabled={!snapshot.canRedo} onClick={() => { store.redo(); setMessage(t('redone')); }} aria-label={t('redo')}>↷ &nbsp; {t('redo')}</button></div>
        {view==='2d'&&<DrawingControls tool={drawing} store={store} locale={ui.locale} onMessage={setMessage}/>}
        {view==='2d'&&<WallPrecision store={store} drawing={drawing} selected={selectedWall} onSelect={id=>{setSelectedWall(id);setSelectedOpening('');}} onPreview={wallPreview} cancelToken={precisionCancel} locale={ui.locale} onMessage={setMessage}/>}
        {view==='2d'&&<OpeningControls store={store} wallId={selectedWall} selected={selectedOpening} onSelect={setSelectedOpening} onPreview={openingPreview} cancelToken={openingCancel} locale={ui.locale} onMessage={setMessage}/>}
        {view==='2d'&&<SelectionControls store={store} drawing={drawing} selected={selection} onSelect={selectEntities} multiple={multiple} onMultiple={setMultiple} onPreview={selectionPreview} cancelToken={selectionCancel} locale={ui.locale} onMessage={setMessage}/>}
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
        <RoomControls selectedRoomId={activePick?.kind==='room'?activePick.id:undefined} store={store} locale={ui.locale} onMessage={setMessage}/>
        <div className="tip"><span aria-hidden="true">✦</span><p><strong>{t('measured')}</strong><br />{t('measuredHelp')}</p></div>
      </aside>
    </div>
    <div className="workbench-note">{session ? t('keepBackups') : t('memoryHelp')}</div>
  </main>;
}
