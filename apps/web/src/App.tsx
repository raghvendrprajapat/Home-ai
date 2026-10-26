import {SurfaceControls} from './editor/SurfaceControls';
import {materialColor} from './editor/surface-materials';
import {FurnitureAdvisories} from './editor/furniture-advisories';
import {FurniturePlacementControls} from './editor/FurniturePlacementControls';
import {beginPlacement} from './editor/furniture-placement';
import type {PlacementIntent} from './editor/furniture-placement';
import type {FurnitureGhost} from './render3d/placement-ghost';
import type {PlanUnderlay,Point2} from './editor/view2d';
import {CatalogApi,CatalogSource} from './catalog/api';
import {CatalogControls} from './catalog/CatalogControls';
import {AiFurniturePanel} from './ai/AiFurniturePanel';
import {CopilotPanel} from './ai/CopilotPanel';
import {standInCopilot} from './ai/copilot';
import {PhotoPlanPanel} from './ai/PhotoPlanPanel';
import {RoomPhotoPanel} from './visualizer/RoomPhotoPanel';
import {standInAi} from './ai/stand-in';
import {FurnitureControls} from './editor/FurnitureControls';
import {CameraControls} from './editor/CameraControls';
import {ThreeImageControls} from './export/ThreeImageControls';
import type {ThreeControlsApi} from './render3d/types';
import type {QualityChoice} from './render3d/quality';
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useState, useRef, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { parseProject, ProjectStore } from '@gharplan/core-model';
import type { ProjectDoc } from '@gharplan/core-model';
import { firstRunSample } from './samples/showcase';
import { PlanCanvas } from './editor/PlanCanvas';
import { createFloorScope } from './editor/floor-scope';
import { FloorControls } from './editor/FloorControls';
import { StructureControls } from './editor/StructureControls';
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
import { CloudPanel } from './cloud/CloudPanel';
import {PlanImageControls} from './export/PlanImageControls';
import type { WorkspaceSession } from './storage/workspace';
import { areaDisplay, editError, message } from './i18n/messages';
import type { MessageArgs, MessageKey } from './i18n/messages';
import { useUi } from './ui/state';
import { Icon } from './ui/Icon';
import { useNarrow } from './ui/useNarrow';
type ToolId='draw'|'openings'|'furniture'|'materials'|'photo'|'copilot'|'project';
import './app.css';
function EngineLoadError() {
  const { locale } = useUi();
  return <div className="plan-canvas"><div className="three-status" role="status">{message(locale, 'engineLoadFailed')}</div></div>;
}
const ThreeView = lazy(() => import('./render3d/ThreeView').catch(() => ({ default: EngineLoadError })));

function createDemo(): ProjectStore {
  const parsed = parseProject(JSON.stringify(firstRunSample()));
  if (!parsed.ok) throw new Error('Bundled sample project failed validation.');
  return new ProjectStore(parsed.document, `editor_${crypto.randomUUID()}`);
}
/** D76 M2: the open tool panel survives the editor being remounted for the same project (a new session after sign-in or
 * recovery); another project, or a page reload, starts with no panel open. */
const openToolMemory:{projectId:string;tool:ToolId|null}={projectId:'',tool:null};
export function App({ session, navigation, onOpenDocument }: { session?: WorkspaceSession; navigation?: ReactNode; onOpenDocument?: (document: ProjectDoc, linkToCloud: boolean) => void } = {}) {
  const ui = useUi(), t = <K extends MessageKey>(key: K, ...args: MessageArgs<K>) => message(ui.locale, key, ...args);
  // FR-034: `baseStore`/`house` is the whole project (save, 3D, totals); `store`/`snapshot` is the active floor's view for 2D editing.
  const [baseStore] = useState(() => session?.store ?? createDemo()), house = useSyncExternalStore(baseStore.subscribe, baseStore.getSnapshot);
  const [activeFloor, setActiveFloor] = useState(() => [...baseStore.getSnapshot().document.floors].sort((a, b) => a.level - b.level)[0]!.id);
  const [floorScope] = useState(() => { const scope = createFloorScope(baseStore); scope.setFloor(activeFloor); return scope; }), store = floorScope.store, snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [advisories]=useState(()=>new FurnitureAdvisories()),[furnitureCancel,setFurnitureCancel]=useState(0);
  const [assetSource]=useState(()=>new CatalogSource(new CatalogApi(new URL('catalog/',new URL(import.meta.env.BASE_URL,window.location.href)))));
  const [threeApi,setThreeApi]=useState<ThreeControlsApi|null>(null),[quality,setQuality]=useState<QualityChoice>('auto'),[lighting,setLighting]=useState<'day'|'warm'|'night'>('day');
  const [drawing] = useState(()=>new DrawingTool(store));
  // A deleted or undone floor falls back to the lowest floor; switching floors drops tool drafts.
  useEffect(()=>{if(!house.document.floors.some(f=>f.id===activeFloor))setActiveFloor([...house.document.floors].sort((a,b)=>a.level-b.level)[0]!.id);},[house.document.floors,activeFloor]);
  useLayoutEffect(()=>{floorScope.setFloor(activeFloor);drawing.clear();},[floorScope,activeFloor,drawing]);
  const [selectedWall,setSelectedWall]=useState(()=>store.getSnapshot().document.walls[0]?.id??''),[precision,setPrecision]=useState<PrecisionPreview|null>(null),[precisionCancel,setPrecisionCancel]=useState(0);
  const [selectedFurniture,setSelectedFurniture]=useState(''),[activePick,setActivePick]=useState<Pick|undefined>(undefined);
  const [selectedOpening,setSelectedOpening]=useState(''),[openingCancel,setOpeningCancel]=useState(0);
  const browseButton=useRef<HTMLButtonElement>(null),viewCentre=useRef<Point2>([0,0]);
  const receiveCentre=useCallback((point:Point2)=>{viewCentre.current=point;},[]);
  const [placement,setPlacement]=useState<{intent:PlacementIntent;name_en:string;name_hi:string}|null>(null);
  const cancelPlacement=useCallback(()=>{setPlacement(null);setPrecision(old=>old?.owner==='furniture'?null:old);queueMicrotask(()=>{if(document.hasFocus())browseButton.current?.focus({preventScroll:true});});},[]);
  const furniturePreview=useCallback((value:PrecisionPreview|null)=>{setPrecision(old=>value?{...value,owner:'furniture'}:old?.owner==='furniture'?null:old);},[]);
  useEffect(()=>{let previous=drawing.getSnapshot().mode;return drawing.subscribe(()=>{const next=drawing.getSnapshot().mode;if(next===previous)return;previous=next;if(next!=='select'){setPlacement(null);setFurnitureCancel(n=>n+1);setPrecision(old=>old?.owner==='furniture'||old?.owner==='furniture-edit'?null:old);}});},[drawing]);
  const [selection,setSelection]=useState<EditablePick[]>([]),[multiple,setMultiple]=useState(false),[selectionCancel,setSelectionCancel]=useState(0);
  const cancelPrecision=useCallback(()=>{setFurnitureCancel(n=>n+1);setPlacement(null);setPrecision(null);setPrecisionCancel(n=>n+1);setOpeningCancel(n=>n+1);setSelectionCancel(n=>n+1);},[]);
  const wallPreview=useCallback((value:PrecisionPreview|null)=>{if(value){setFurnitureCancel(n=>n+1);setPlacement(null);drawing.clear();setOpeningCancel(n=>n+1);setSelectionCancel(n=>n+1);}setPrecision(current=>value?{...value,owner:'wall'}:current?.owner==='wall'?null:current);},[drawing]);
  const openingPreview=useCallback((value:PrecisionPreview|null)=>{if(value){setFurnitureCancel(n=>n+1);setPlacement(null);drawing.clear();setPrecisionCancel(n=>n+1);setSelectionCancel(n=>n+1);}setPrecision(current=>value?{...value,owner:'opening'}:current?.owner==='opening'?null:current);},[drawing]);
  const selectionPreview=useCallback((value:PrecisionPreview|null)=>{if(value){setFurnitureCancel(n=>n+1);setPlacement(null);drawing.clear();setPrecisionCancel(n=>n+1);setOpeningCancel(n=>n+1);}setPrecision(current=>value?{...value,owner:'selection'}:current?.owner==='selection'?null:current);},[drawing]);
  const startFurnitureEdit=useCallback(()=>{setPlacement(null);drawing.setMode('select');setPrecision(null);setPrecisionCancel(n=>n+1);setOpeningCancel(n=>n+1);setSelectionCancel(n=>n+1);},[drawing]);
  const furnitureEditPreview=useCallback((value:PrecisionPreview|null,token:string)=>{
    if(value){setPlacement(null);drawing.setMode('select');setPrecisionCancel(n=>n+1);setOpeningCancel(n=>n+1);setSelectionCancel(n=>n+1);}
    setPrecision(old=>value?{...value,owner:'furniture-edit',token}:old?.owner==='furniture-edit'&&old.token===token?null:old);
  },[drawing]);
  const selectEntities=(picks:EditablePick[])=>{setFurnitureCancel(n=>n+1);setPlacement(null);setPrecision(old=>old?.owner==='furniture'||old?.owner==='furniture-edit'?null:old);setSelection(picks);const active=picks.at(-1);setActivePick(active);setSelectedFurniture(active?.kind==='furniture'?active.id:'');};
  // FR-019: picking one grouped item picks its whole group; the touched item stays last (active).
  const withGroup=(p:EditablePick):EditablePick[]=>{const group=p.kind==='furniture'?snapshot.document.furniture.find(f=>f.id===p.id)?.groupId:undefined;return group?[...snapshot.document.furniture.filter(f=>f.groupId===group&&f.id!==p.id).map(f=>({kind:'furniture' as const,id:f.id})),p]:[p];};
  const unique=(picks:readonly EditablePick[])=>picks.filter((p,i)=>picks.findIndex(o=>o.id===p.id)===i);
  const choosePicks=(picks:readonly Pick[],additive:boolean)=>{const eligible=unique(picks.filter((p):p is EditablePick=>p.kind==='wall'||p.kind==='opening'||p.kind==='furniture').flatMap(withGroup));selectEntities(additive?[...selection,...eligible.filter(p=>!selection.some(o=>o.id===p.id))]:eligible);};
  const choosePick=(pick:Pick|null,additive=false)=>{setPlacement(null);setPrecision(old=>old?.owner==='furniture'?null:old);if(pick&&(pick.kind==='wall'||pick.kind==='opening'||pick.kind==='furniture')){const p=pick as EditablePick,group=withGroup(p),others=selection.filter(o=>!group.some(g=>g.id===o.id));selectEntities(additive?selection.some(o=>o.id===p.id)?others:[...others,...group]:group);}else{if(!additive)setSelection([]);setActivePick(pick??undefined);setSelectedFurniture('');}if(pick?.kind==='wall'){setSelectedWall(pick.id);setSelectedOpening('');}if(pick?.kind==='opening'){setSelectedOpening(pick.id);const opening=snapshot.document.openings.find(o=>o.id===pick.id);if(opening)setSelectedWall(opening.wallId);}};
  useEffect(()=>{const fields={wall:'walls',opening:'openings',furniture:'furniture'} as const;setSelection(old=>{const next=old.filter(p=>snapshot.document[fields[p.kind]].some(e=>e.id===p.id));return next.length===old.length?old:next;});},[snapshot.document]);
  useEffect(()=>{if(selectedOpening&&!snapshot.document.openings.some(o=>o.id===selectedOpening))setSelectedOpening('');},[selectedOpening,snapshot.document.openings]);
  useEffect(()=>{if(selectedFurniture&&!snapshot.document.furniture.some(f=>f.id===selectedFurniture))setSelectedFurniture('');if(activePick){const fields={wall:'walls',opening:'openings',furniture:'furniture',room:'rooms',junction:'junctions'} as const;if(!snapshot.document[fields[activePick.kind]].some(e=>e.id===activePick.id))setActivePick(undefined);}},[selectedFurniture,activePick,snapshot.document]);
  useEffect(()=>{if(!snapshot.document.walls.some(w=>w.id===selectedWall))setSelectedWall(snapshot.document.walls[0]?.id??'');},[snapshot.document.walls,selectedWall]);
  const [selected, setSelected] = useState(() => store.getSnapshot().document.junctions[1]?.id ?? ''), [notice, setMessage] = useState(() => t('chooseCorner'));
  const [x, setX] = useState(''), [y, setY] = useState(''), [showGrid, setShowGrid] = useState(true), [fit, setFit] = useState(0), [underlay, setUnderlay] = useState<PlanUnderlay | null>(null);
  const [view, setView] = useState<'2d' | '3d' | 'split'>('2d');
  // D76 M2: one tool panel at a time beside the canvas (a bottom sheet on phones); none open at first.
  const projectId=house.document.id,[tool,setToolState]=useState<ToolId|null>(()=>openToolMemory.projectId===projectId?openToolMemory.tool:null),narrow=useNarrow();
  const setTool=useCallback((next:ToolId|null|((old:ToolId|null)=>ToolId|null))=>setToolState(old=>{const value=typeof next==='function'?next(old):next;openToolMemory.projectId=projectId;openToolMemory.tool=value;return value;}),[projectId]),closeTool=useCallback(()=>setTool(null),[setTool]);
  // Escape also closes the open panel when focus is on the tool rail or nowhere in particular (inside a panel, the panel handles it).
  useEffect(()=>{if(!tool)return;const close=(event:KeyboardEvent)=>{if(event.key==='Escape'&&(event.target===document.body||event.target instanceof Element&&event.target.closest('.tool-rail')))closeTool();};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[tool,closeTool]);
  const drawingPanel=useRef<HTMLElement>(null),[splitAvailable,setSplitAvailable]=useState(false);
  useLayoutEffect(()=>{const panel=drawingPanel.current!;const measure=()=>setSplitAvailable(panel.clientWidth>=760);measure();if(typeof ResizeObserver==='undefined'){window.addEventListener('resize',measure);return()=>window.removeEventListener('resize',measure);}const observer=new ResizeObserver(measure);observer.observe(panel);return()=>observer.disconnect();},[]);
  useEffect(()=>{if(view==='split'&&!splitAvailable){drawing.clear();setView('2d');}},[view,splitAvailable,drawing]);
  const showPlan=view!=='3d',showThree=view!=='2d';
  const changeView=(next:typeof view)=>{drawing.setMode('select');setThreeFallback(false);setView(next);};
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
  const totalArea = house.derived.faces.reduce((n, r) => n + r.clearAreaMm2, 0);
  const totalLabel = areaDisplay(totalArea, house.document.units);
  const unclosedWalls=snapshot.document.walls.some(w=>!snapshot.derived.faces.some(face=>face.boundary.some((id,i)=>
    id===w.a&&face.boundary[(i+1)%face.boundary.length]===w.b||id===w.b&&face.boundary[(i+1)%face.boundary.length]===w.a)));
  const scopedPrecision=precision?.projectId===snapshot.document.id&&precision.sessionId===snapshot.sessionId&&precision.generation===snapshot.localGeneration&&precision.result.ok?precision:null;
  const ghostId=scopedPrecision?.owner==='furniture'&&placement?placement.intent.id:scopedPrecision?.owner==='furniture-edit'?selectedFurniture:undefined;
  const ghostItem=scopedPrecision?.result.ok?scopedPrecision.result.document.furniture.find(item=>item.id===ghostId):undefined;
  const ghostAdvisory=ghostItem&&scopedPrecision?.result.ok?advisories.check(scopedPrecision.result.document,ghostItem):undefined;
  const ghost:FurnitureGhost|undefined=ghostItem&&scopedPrecision?.result.ok&&ghostAdvisory?{tag:placement&&scopedPrecision.owner==='furniture'?placement.intent.tag:store.asyncTag(),item:ghostItem,warning:ghostAdvisory.overlap,advisory:ghostAdvisory}:undefined;
  const tools:readonly {id:ToolId;label:string}[]=[{id:'draw',label:t('toolDraw')},{id:'openings',label:t('toolOpenings')},{id:'furniture',label:t('toolFurniture')},{id:'materials',label:t('toolMaterials')},{id:'photo',label:t('toolPhoto')},{id:'copilot',label:t('toolCopilot')},{id:'project',label:t('toolProject')}];
  // Escape inside a panel first cancels an unfinished preview or drawing (the editors listen on window); only Escape with
  // nothing pending closes the panel.
  const hasDraft=()=>!!precision||!!placement||drawing.getSnapshot().mode!=='select'||!!drawing.getSnapshot().anchor;
  // D76 S3: every panel stays mounted (cloud saving, drafts and AI answers keep running); only the chosen one shows.
  const panel=(id:ToolId,children:ReactNode)=><section key={id} id={`panel-${id}`} className="tool-panel" role="region" aria-label={tools.find(x=>x.id===id)!.label} hidden={tool!==id} data-tool={id} onKeyDown={event=>{if(event.key==='Escape'&&!(event.target instanceof HTMLSelectElement)&&!hasDraft())closeTool();}}>
    <header className="tool-panel-head"><h3>{tools.find(x=>x.id===id)!.label}</h3><button className="icon-button" aria-label={t('closePanel')} onClick={closeTool}><Icon name="close"/></button></header>
    <div className="tool-panel-body">{children}</div>
  </section>;
  // D79: on phones Fit and Grid sit in the top bar's second row, so the canvas gets the strip they used.
  const canvasActions=<div className="canvas-actions"><button onClick={() => setFit(n => n + 1)} aria-label={t('fitPlanAria')}>{t('fitPlan')}</button>{showPlan && <button type="button" className="grid-toggle" aria-pressed={showGrid} onClick={() => setShowGrid(g => !g)}>{t('grid')}</button>}</div>;
  return <main className="workspace editor-app" data-tool={tool??'none'}>
    <header className="topbar" role="banner">
      <div className="topbar-start"><span className="brand-mark" aria-hidden="true">⌂</span><div className="topbar-title"><h1 className="topbar-brand">{t('brandName')}</h1><h2 className="project-name" title={house.document.name}>{house.document.name}</h2></div></div>
      <div className="topbar-center"><div className="view-tabs" role="group" aria-label={t('drawingView')}><button className={view === '2d' ? 'active-tab' : ''} aria-label={t('plan2d')} aria-pressed={view === '2d'} onClick={() => changeView('2d')}>▧ &nbsp; {t('plan2d')}</button><button className={view === '3d' ? 'active-tab' : ''} aria-pressed={view === '3d'} onClick={() => changeView('3d')}>{t('view3d')}</button>{splitAvailable&&<button className={view==='split'?'active-tab':''} aria-pressed={view==='split'} onClick={()=>changeView('split')}>{t('splitView')}</button>}</div>{narrow&&canvasActions}</div>
      <div className="topbar-end">
        <div className="history-buttons topbar-history"><button className="icon-button" disabled={!snapshot.canUndo} onClick={() => { store.undo(); setMessage(t('undone')); }} aria-label={t('undo')} title={t('undo')}><Icon name="undo"/></button><button className="icon-button" disabled={!snapshot.canRedo} onClick={() => { store.redo(); setMessage(t('redone')); }} aria-label={t('redo')} title={t('redo')}><Icon name="redo"/></button></div>
        <SaveControls compact store={baseStore} {...(session ? { session } : {})} />
        {!narrow&&navigation}
      </div>
    </header>
    <div className="editor-body">
      <nav className="tool-rail" aria-label={t('toolsNav')}>{tools.map(x=><button key={x.id} className={tool===x.id?'tool-button active-tool':'tool-button'} aria-pressed={tool===x.id} aria-controls={`panel-${x.id}`} onClick={()=>setTool(old=>old===x.id?null:x.id)}><Icon name={x.id}/><span>{x.label}</span></button>)}</nav>
      <div className="tool-panels">
        {panel('draw',<><FloorControls store={baseStore} activeFloorId={activeFloor} onActivate={setActiveFloor} locale={ui.locale} onMessage={setMessage}/>
          <StructureControls store={baseStore} activeFloorId={activeFloor} locale={ui.locale} onMessage={setMessage}/>
          <div className="inspector-title"><span className="eyebrow">{t('precision')}</span><h3>{t('shapeSpace')}</h3><p>{t('moveCornerHelp')}</p></div>
          {showPlan&&<DrawingControls tool={drawing} store={store} locale={ui.locale} onMessage={setMessage}/>}
          {showPlan&&<WallPrecision store={store} drawing={drawing} selected={selectedWall} onSelect={id=>{setSelectedWall(id);setSelectedOpening('');}} onPreview={wallPreview} cancelToken={precisionCancel} locale={ui.locale} onMessage={setMessage}/>}
          {showPlan&&<SelectionControls store={store} drawing={drawing} selected={selection} onSelect={selectEntities} multiple={multiple} onMultiple={setMultiple} onPreview={selectionPreview} cancelToken={selectionCancel} locale={ui.locale} onMessage={setMessage}/>}
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
          {snapshot.derived.faces.map(face => { const label = areaDisplay(face.clearAreaMm2, snapshot.document.units); return <div className="room-row" key={face.roomId}><span className="room-swatch" data-material-id={snapshot.document.rooms.find(r=>r.id===face.roomId)!.floorMaterial} style={{backgroundColor:materialColor(snapshot.document,snapshot.document.rooms.find(r=>r.id===face.roomId)!.floorMaterial)}} aria-hidden="true" /><div><strong>{snapshot.document.rooms.find(r => r.id === face.roomId)?.name}</strong><small>{face.smallSpaceWarning ? t('smallSpace') : t('insideArea')}</small></div><span data-testid={`area-${face.roomId}`}>{label.value} <small>{label.unit}</small></span></div>; })}
        </section>
          {unclosedWalls&&<p role="status">{t('incompletePlan')}</p>}
          <RoomControls selectedRoomId={activePick?.kind==='room'?activePick.id:undefined} store={store} locale={ui.locale} onMessage={setMessage}/></>)}
        {panel('openings',<>{showPlan&&<OpeningControls store={store} wallId={selectedWall} selected={selectedOpening} onSelect={setSelectedOpening} onPreview={openingPreview} cancelToken={openingCancel} locale={ui.locale} onMessage={setMessage}/>}{!showPlan&&<p className="structure-note">{t('openingsIn2d')}</p>}</>)}
        {panel('furniture',<><CatalogControls buttonRef={browseButton} locale={ui.locale} units={snapshot.document.units} onBrowse={()=>{drawing.setMode('select');cancelPrecision();}} onChoose={asset=>{drawing.setMode('select');cancelPrecision();try{const pose=view==='3d'?threeApi?.pose():undefined,centre:Point2=pose?[pose.target[0]*1000,pose.target[2]*1000]:viewCentre.current;setPlacement({intent:beginPlacement(store,asset,centre),name_en:asset.name_en,name_hi:asset.name_hi});}catch{setMessage(t('furnitureValuesInvalid'));}}}/>
          {placement&&<FurniturePlacementControls advisories={advisories} key={placement.intent.id} store={store} intent={placement.intent} label={ui.locale==='hi'?placement.name_hi:placement.name_en} locale={ui.locale} onPreview={furniturePreview} onCancel={cancelPlacement} onAdded={id=>{cancelPlacement();selectEntities([{kind:'furniture',id}]);setMessage(t('placementAdded'));}}/>}
          <FurnitureControls onEditStart={startFurnitureEdit} advisories={advisories} cancelToken={furnitureCancel} onPreview={furnitureEditPreview} store={store} selected={selectedFurniture} onSelect={id=>selectEntities(id?[{kind:'furniture',id}]:[])} locale={ui.locale} onMessage={setMessage}/></>)}
        {panel('materials',<SurfaceControls store={store} locale={ui.locale} view={view} picked={activePick} onSelect={choosePick} onEditStart={()=>{drawing.setMode('select');cancelPrecision();}} onMessage={setMessage}/>)}
        {/* D85: the Room photo visualizer gets no store, so it cannot change the drawing. */}
        {panel('photo',<RoomPhotoPanel locale={ui.locale}/>)}
        {panel('copilot',<><CopilotPanel store={store} locale={ui.locale} selectedRoomId={activePick?.kind==='room'?activePick.id:undefined} provider={standInCopilot} ai={standInAi} catalog={signal=>assetSource.catalog(signal)} onOpenDocument={onOpenDocument?document=>onOpenDocument(document,false):undefined}/>
          <AiFurniturePanel store={store} locale={ui.locale} selectedRoomId={activePick?.kind==='room'?activePick.id:undefined} provider={standInAi} catalog={signal=>assetSource.catalog(signal)} onPlace={(asset,centre)=>{drawing.setMode('select');cancelPrecision();setTool('furniture');try{setPlacement({intent:beginPlacement(store,asset,centre),name_en:asset.name_en,name_hi:asset.name_hi});}catch{setMessage(t('furnitureValuesInvalid'));}}}/>
          <PhotoPlanPanel locale={ui.locale} provider={standInAi} units={snapshot.document.units} onUnderlay={setUnderlay} onOpen={document=>onOpenDocument?.(document,false)}/></>)}
        {panel('project',<>{narrow&&navigation}
          <CloudPanel store={baseStore} locale={ui.locale} flush={() => session?.saving?.flush() ?? Promise.resolve()} onOpenDocument={(document, link) => onOpenDocument?.(document, link)} />
          <PlanImageControls store={store} locale={ui.locale}/>
          {showThree&&<><CameraControls store={baseStore} api={threeApi} quality={quality} onQuality={setQuality} lighting={lighting} onLighting={setLighting} locale={ui.locale}/><ThreeImageControls api={threeApi} store={baseStore} locale={ui.locale}/></>}
          <label>{t('currentProjectUnits')}<select aria-label={t('currentProjectUnits')} value={snapshot.document.units} onChange={event=>{const result=store.execute({id:`units_${crypto.randomUUID().replaceAll('-','')}`,baseGeneration:snapshot.localGeneration,type:'SetUnits',units:event.target.value as 'metric'|'imperial'});setMessage(result.ok?t('unitDisplayChanged'):editError(ui.locale,result.errors[0]));}}><option value="metric">{t('metric')}</option><option value="imperial">{t('imperial')}</option></select></label>
          <div className="tip"><span aria-hidden="true">✦</span><p><strong>{t('measured')}</strong><br />{t('measuredHelp')}</p></div>
          <p className="workbench-note">{session ? t('keepBackups') : t('memoryHelp')}</p></>)}
      </div>
      <section ref={drawingPanel} className="drawing-panel canvas-area" aria-label={t('floorEditor')}>
        {!narrow&&<div className="canvas-overlay canvas-actions-bar">{canvasActions}</div>}
        <div className={view==='split'?'editor-views split-views':'editor-views'} data-testid="editor-views" data-layout={view}>
          {showPlan&&<section className="editor-pane" aria-label={t('plan2d')} key={`${view}:plan`}>{view==='split'&&<h3 className="pane-title">{t('plan2d')}</h3>}<PlanCanvas selectedPick={activePick??null} advisories={advisories} previewFurnitureId={ghost?.item.id} onViewCentre={receiveCentre} drawing={drawing} precisionPreview={precision} onEditStart={cancelPrecision} onPick={choosePick} selection={selection} multiple={multiple} onBoxSelect={choosePicks} locale={ui.locale} store={store} snapshot={snapshot} selected={selected} onSelect={setSelected} onMessage={setMessage} zoomRequest={fit} showGrid={showGrid} underlay={underlay} /></section>}
          {showThree&&<section className="editor-pane" aria-label={t('view3d')} key={`${view}:three`}>{view==='split'&&<h3 className="pane-title">{t('view3d')}</h3>}<Suspense fallback={<div className="plan-canvas"><div className="three-status" role="status">{t('loading3d')}</div></div>}><ThreeView onEditStart={()=>{drawing.setMode('select');cancelPrecision();}} advisories={advisories} assetSource={assetSource} placementPreview={ghost} selectedPick={activePick} onPick={choosePick} onFallback2d={()=>{setThreeFallback(true);setView('2d');}} quality={quality} lighting={lighting} onControlsReady={setThreeApi} locale={ui.locale} store={baseStore} activeFloorId={activeFloor} onMessage={setMessage} fitRequest={fit} /></Suspense></section>}
        </div>
        {threeFallback&&<p role="status">{t('threeFallback')}</p>}
        <footer className="editor-footer"><span role="status" aria-live="polite">{notice}</span><span className="footer-summary"><span>{house.document.floors.length===1?t('oneFloor'):t('floorsCount',{count:house.document.floors.length})}</span> · <span>{house.document.rooms.length === 1 ? t('oneRoom') : t('roomsCount', { count: house.document.rooms.length })}</span> · <strong data-testid="total-area">{totalLabel.value} <small>{totalLabel.unit} {t('clearArea')}</small></strong> · <span>{house.document.floors.find(f=>f.id===activeFloor)?.name??t('groundFloor')} · {t('mm')}</span></span></footer>
      </section>
    </div>
  </main>;
}
