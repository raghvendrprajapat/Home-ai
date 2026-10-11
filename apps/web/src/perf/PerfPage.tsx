import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { dependencyHash, ProjectStore } from '@gharplan/core-model';
import type { AsyncTag, ProjectDoc } from '@gharplan/core-model';
import { PlanCanvas } from '../editor/PlanCanvas';
import { junctionMoves } from '../editor/view2d';
import { BenchmarkRun, heapReading } from './metrics';
import type { DeviceMetadata, RenderReading } from './metrics';
import { perfFixture } from './fixtures';
import '../app.css';
import './perf.css';

function FailedThreeEngine({ onUnavailable }: { onUnavailable?: (reason: string) => void }) {
  useEffect(() => { onUnavailable?.('3D engine could not load.'); }, [onUnavailable]);
  return <p role="status">3D engine could not load. Use 2D or retry after reloading this disposable test page.</p>;
}
const ThreeView = lazy(() => import('../render3d/ThreeView').catch(() => ({ default: FailedThreeEngine })));
const newStore = (kind: 'sample' | 'large') => new ProjectStore(perfFixture(kind), `perf_${crypto.randomUUID()}`);
const emptyDevice: DeviceMetadata = { model: '', ram: '', os: '', browserOrWebView: '', container: 'browser', thermalStart: '', thermalEnd: '' };
type Report = ReturnType<BenchmarkRun['report']>;
interface RunInput { document: ProjectDoc; tag: AsyncTag; device: DeviceMetadata; scriptedEdits: boolean; autoOrbit: boolean; selected: string; fixtureKind: 'sample' | 'large'; viewport: { width: number; height: number; devicePixelRatio: number }; viewportChanges: { offsetMs: number; width: number; height: number; devicePixelRatio: number }[]; history: { canUndo: boolean; canRedo: boolean; truncated: boolean } }
interface SavedReport { device: DeviceMetadata & { source: 'tester-reported'; complete: boolean }; [key: string]: unknown }
const metadataComplete = (d: DeviceMetadata) => (['model', 'ram', 'os', 'browserOrWebView', 'container', 'thermalStart', 'thermalEnd'] as const).every(key => d[key].trim().length > 0);
export default function PerfPage() {
  const [kind, setKind] = useState<'sample' | 'large'>('sample'), [store, setStore] = useState(() => newStore('sample'));
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const initial = useMemo(() => perfFixture(kind), [kind]);
  const [mode, setMode] = useState<'2d' | '3d'>('2d'), [selected, setSelected] = useState('j2'), [message, setMessage] = useState('Test projects are disposable; this page never edits your main project.');
  const [duration, setDuration] = useState(300_000), [warmup, setWarmup] = useState(20_000), [scriptedEdits, setScriptedEdits] = useState(true);
  const [running, setRunning] = useState(false), [elapsed, setElapsed] = useState(0), [fit, setFit] = useState(0), [device, setDevice] = useState(emptyDevice);
  const [reports, setReports] = useState<SavedReport[]>([]), [latest, setLatest] = useState<Report | null>(null), [engineReady, setEngineReady] = useState(false);
  const available = useRef(false);
  const run = useRef<BenchmarkRun | null>(null), heapStart = useRef<ReturnType<typeof heapReading> | null>(null), metadata = useRef(device), reportCallback = useRef<() => void>(() => undefined);
  const runInput = useRef<RunInput | null>(null);
  metadata.current = device;
  const onTiming = useCallback((type: 'preview' | 'command', ms: number) => {
    if (type === 'preview') run.current?.preview(performance.now(), ms); else run.current?.command(performance.now(), ms);
  }, []);
  const onFrame = useCallback((reading: RenderReading) => { if (!available.current) { available.current = true; setEngineReady(true); } run.current?.rendered(reading); }, []);
  const onUnavailable = useCallback((reason: string) => { available.current = false; setEngineReady(false); setMessage(reason); run.current?.scenePending(performance.now()); run.current?.interruptions.push(reason); }, []);
  const onScenePending = useCallback(() => { available.current = false; setEngineReady(false); run.current?.scenePending(performance.now()); }, []);
  const stop = useCallback((reason?: string) => {
    const current = run.current, input = runInput.current; if (!current || !input) return;
    if (reason) current.interruptions.push(reason);
    const result = current.report(performance.now()), reportedDevice = { ...input.device, thermalEnd: metadata.current.thermalEnd };
    const report: SavedReport = { schemaVersion: 1, capturedAt: new Date().toISOString(), build: import.meta.env.VITE_BUILD_SHA ?? 'unknown', fixture: { kind: input.fixtureKind, templateHash: dependencyHash(perfFixture(input.fixtureKind)), inputHash: dependencyHash(input.document), walls: input.document.walls.length, rooms: input.document.rooms.length, furniture: input.document.furniture.length },
      initialDocument: input.document, initialTag: input.tag, finalTag: store.asyncTag(), workload: { scriptedEdits: input.scriptedEdits, autoOrbit: input.autoOrbit, selectedCorner: input.selected, editIntervalMs: input.scriptedEdits ? 1000 : null },
      device: { ...reportedDevice, source: 'tester-reported', complete: metadataComplete(reportedDevice) }, userAgent: navigator.userAgent, viewport: input.viewport, viewportChanges: input.viewportChanges, historyAtStart: input.history,
      measurements: result, heapStart: heapStart.current, heapEnd: heapReading(performance),
      limitations: ['Local diagnostic only; no automatic release pass.', '3D latency is commit-to-submitted-draw, not GPU completion or physical display latency.', 'FPS uses the whole measured window; 2D measures RAF cadence, while 3D counts valid-scene draw submissions. observedIntervalFps is a separate interval statistic.', 'editingFrameMs selects intervals within 250 ms of a preview. Command timings include attempted commands; committedChanges counts accepted model changes. 2D sufficientInteraction requires at least one accepted change.', 'Main-frame JS heap is browser-reported and approximate; it excludes worker/GPU/native memory. GPU bytes/time are unknown.', 'Real-device release evidence needs three uninterrupted five-minute runs after warm-up, complete device/thermal metadata, and Chrome/WebView comparison.'] };
    run.current = null; setRunning(false); setLatest(result); setReports(all => [...all, report]); setMessage('Run recorded. Export the JSON; results do not automatically pass a release gate.');
  }, [store]);
  reportCallback.current = () => stop();
  useLayoutEffect(() => {
    let previous = store.getSnapshot().localGeneration;
    return store.subscribe(() => { const generation = store.getSnapshot().localGeneration; if (generation !== previous) run.current?.committed(generation, performance.now()); previous = generation; });
  }, [store]);
  useEffect(() => {
    if (!running) return;
    let frame = 0;
    const raf = (at: number) => { if (mode === '2d') run.current?.frame(at); frame = requestAnimationFrame(raf); }; frame = requestAnimationFrame(raf);
    const tick = setInterval(() => {
      const current = run.current; if (!current) return;
      const passed = performance.now() - current.start; setElapsed(passed);
      if (passed >= current.warmupMs + current.durationMs) reportCallback.current();
    }, 100);
    const hidden = () => { if (document.hidden) stop('Page was hidden; run interrupted.'); };
    const resized = () => { const current = run.current, input = runInput.current; if (!current || !input) return; input.viewportChanges.push({ offsetMs: performance.now() - current.start, width: innerWidth, height: innerHeight, devicePixelRatio }); if (!current.interruptions.includes('Viewport changed during run.')) current.interruptions.push('Viewport changed during run.'); };
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('resize', resized);
    return () => { cancelAnimationFrame(frame); clearInterval(tick); document.removeEventListener('visibilitychange', hidden); window.removeEventListener('resize', resized); };
  }, [running, mode, stop]);
  const shift = useCallback(() => {
    const document = store.getSnapshot().document, corner = document.junctions.find(j => j.id === selected); if (!corner) return;
    const original = initial.junctions.find(j => j.id === selected)?.x ?? corner.x, delta = corner.x === original ? 100 : -100, generation = store.getSnapshot().localGeneration;
    const started = performance.now();
    const result = store.execute({ type: 'MoveJunctions', moves: junctionMoves(document, selected, [corner.x + delta, corner.y]), id: `perf_edit_${generation}`, baseGeneration: generation });
    onTiming('command', performance.now() - started); if (!result.ok) setMessage(result.errors[0]?.message ?? 'Test edit rejected.');
  }, [initial, store, selected, onTiming]);
  useEffect(() => { if (!running || mode !== '3d' || !scriptedEdits) return; const timer = setInterval(shift, 1000); return () => clearInterval(timer); }, [running, mode, scriptedEdits, shift]);
  useEffect(() => () => { run.current = null; }, []);
  const changeFixture = (next: 'sample' | 'large') => { setKind(next); setStore(newStore(next)); setSelected(next === 'sample' ? 'j2' : 'pj_0_1'); setLatest(null); available.current = false; setEngineReady(false); };
  const start = () => {
    if (mode === '3d' && !available.current) return;
    runInput.current = { document: structuredClone(snapshot.document) as ProjectDoc, tag: store.asyncTag(), device: { ...device }, scriptedEdits: mode === '3d' && scriptedEdits, autoOrbit: mode === '3d', selected, fixtureKind: kind, viewport: { width: innerWidth, height: innerHeight, devicePixelRatio }, viewportChanges: [], history: { canUndo: snapshot.canUndo, canRedo: snapshot.canRedo, truncated: snapshot.historyTruncated } };
    run.current = new BenchmarkRun(mode, performance.now(), warmup, duration); heapStart.current = heapReading(performance); setElapsed(0); setRunning(true); setLatest(null); setMessage(mode === '2d' ? 'Drag a corner repeatedly through the measured period. Frame/preview timings exclude warm-up.' : 'Automatic orbit is active. Scripted edits, if selected, move a wall once per second.');
  };
  const download = () => { const blob = new Blob([JSON.stringify({ reports }, null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = 'gharplan-performance.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  const recordEndingThermal = () => setReports(all => all.map((report, i) => { if (i !== all.length - 1) return report; const d = { ...report.device, thermalEnd: device.thermalEnd }; return { ...report, device: { ...d, complete: metadataComplete(d) }, endingThermalAnnotation: { recordedAt: new Date().toISOString(), source: 'tester-reported-after-run' } }; }));
  return <main className="perf-page">
    <header><div><span className="eyebrow">ENGINEERING TEST PAGE</span><h1>GharPlan performance lab</h1><p>Local measurements from disposable projects. No data is uploaded.</p></div><a href="/">Back to editor</a></header>
    <section className="perf-controls" aria-label="Benchmark setup">
      <label>Project<select aria-label="Benchmark project" disabled={running} value={kind} onChange={e => changeFixture(e.target.value as 'sample' | 'large')}><option value="sample">Sample: 7 walls / 4 objects</option><option value="large">Large: 200 walls / 100 objects</option></select></label>
      <label>View<select aria-label="Benchmark view" disabled={running} value={mode} onChange={e => { setMode(e.target.value as '2d' | '3d'); available.current = false; setEngineReady(false); }}><option value="2d">2D corner drag</option><option value="3d">3D orbit + wall edits</option></select></label>
      <label>Measured time<select aria-label="Run duration" disabled={running} value={duration} onChange={e => setDuration(Number(e.target.value))}><option value={300000}>5 min — device protocol</option><option value={30000}>30 s — quick diagnostic</option><option value={5000}>5 s — instrumentation check</option></select></label>
      <label>Warm-up<select aria-label="Warm-up" disabled={running} value={warmup} onChange={e => setWarmup(Number(e.target.value))}><option value={20000}>20 seconds</option><option value={0}>None — diagnostic only</option></select></label>
      <label className="perf-checkbox"><input type="checkbox" disabled={running} checked={scriptedEdits} onChange={e => setScriptedEdits(e.target.checked)} /> Scripted 3D wall edits</label>
      <div className="perf-buttons"><button className="primary-button" disabled={running || mode === '3d' && !engineReady} onClick={start}>Start run</button><button disabled={!running} onClick={() => stop('Stopped by tester before automatic completion.')}>Stop run</button><button disabled={running} onClick={() => changeFixture(kind)}>Reset test project</button></div>
    </section>
    <section className="perf-device" aria-label="Device metadata"><h2>Record the actual device</h2><p>Fill device/start fields before Start. After completion, enter ending thermal state and record it below. Values are tester-reported.</p>
      {(['model', 'ram', 'os', 'browserOrWebView', 'thermalStart', 'thermalEnd'] as const).map(key => <label key={key}>{({ model: 'Exact model', ram: 'RAM', os: 'OS / Android version', browserOrWebView: 'Chrome / WebView version', thermalStart: 'Thermal state at start', thermalEnd: 'Thermal state at end' })[key]}<input value={device[key]} onChange={e => setDevice(d => ({ ...d, [key]: e.target.value }))} /></label>)}
      <label>Container<select value={device.container} onChange={e => setDevice(d => ({ ...d, container: e.target.value as DeviceMetadata['container'] }))}><option value="browser">Browser</option><option value="Android WebView">Android WebView</option></select></label>
      <button disabled={running || !reports.length || !device.thermalEnd.trim()} onClick={recordEndingThermal}>Record end thermal state for last run</button>
    </section>
    <section className="drawing-panel" aria-label="Benchmark editor"><div className="editor-toolbar"><strong data-testid="perf-counts">{snapshot.document.walls.length} walls · {snapshot.document.furniture.length} objects</strong><div className="perf-buttons"><button onClick={() => setFit(n => n + 1)}>Fit</button><button onClick={shift}>Move wall ±100 mm</button><button disabled={!snapshot.canUndo} onClick={() => { const at = performance.now(); store.undo(); onTiming('command', performance.now() - at); }}>Undo test edit</button></div></div>
      {mode === '2d' ? <PlanCanvas store={store} snapshot={snapshot} selected={selected} onSelect={setSelected} onMessage={setMessage} zoomRequest={fit} showGrid={false} onTiming={onTiming} /> : <Suspense fallback={<div className="plan-canvas" role="status">Loading 3D…</div>}><ThreeView store={store} fitRequest={fit} onMessage={setMessage} onFrame={onFrame} onUnavailable={onUnavailable} onScenePending={onScenePending} autoOrbit={running} /></Suspense>}
      <footer className="editor-footer"><span role="status">{message}</span><span data-testid="perf-timer">{running ? `${Math.round(elapsed / 1000)}s · ${elapsed < warmup ? 'warm-up' : 'measuring'}` : 'Idle'}</span></footer>
    </section>
    <section className="perf-output" aria-label="Benchmark results"><div><h2>Measured results</h2><button disabled={!reports.length} onClick={download}>Export JSON</button></div>
      <p>{reports.length} recorded runs. Repeat three 5-minute runs after warm-up on each real phone, in Chrome and Android WebView.</p>
      {latest && <div className="perf-numbers"><span>FPS: {latest.fps?.toFixed(1) ?? 'unknown'}</span><span>p95 frame: {latest.frameMs.p95?.toFixed(2) ?? 'unknown'} ms</span><span>p95 command: {latest.commandMs.p95?.toFixed(2) ?? 'unknown'} ms</span><span>p95 commit → submitted 3D: {latest.commitToSubmitted3dMs.p95?.toFixed(2) ?? 'unknown'} ms</span></div>}
      <pre data-testid="perf-json">{JSON.stringify({ reports }, null, 2)}</pre>
    </section>
  </main>;
}
