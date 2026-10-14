import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { ProjectStore } from '@gharplan/core-model';
import { SceneAdapter } from './scene';
import { ScenePipeline } from './pipeline';
import type { SceneBundle,CeilingWarning } from './types';
import type { RenderReading } from '../perf/metrics';
import { message } from '../i18n/messages';
import type { Locale } from '../i18n/messages';

export default function ThreeView({ store, fitRequest, onMessage, onFrame, onUnavailable, onScenePending, autoOrbit = false, locale = 'en' }: {
  store: ProjectStore; fitRequest: number; onMessage(text: string): void; onFrame?: (reading: RenderReading) => void; onUnavailable?: (reason: string) => void; onScenePending?: () => void; autoOrbit?: boolean; locale?: Locale;
}) {
  const [ceilings,setCeilings]=useState(false),[ceilingWarnings,setCeilingWarnings]=useState<CeilingWarning[]>([]);
  const adapterRef=useRef<SceneAdapter|null>(null),invalidateRef=useRef<()=>void>(()=>{});
  const host = useRef<HTMLDivElement>(null), mount = useRef<HTMLDivElement>(null), fit = useRef<() => void>(() => undefined);
  const [status, setStatus] = useState<'building3d' | 'updating3d' | 'threeUnavailable' | 'threeLost' | 'threeFailed' | 'threePrevious' | null>('building3d');
  const language = useRef(locale); language.current = locale;
  const orbit = useRef<OrbitControls | null>(null), frameCallback = useRef(onFrame); frameCallback.current = onFrame;
  const problemCallback = useRef(onUnavailable); problemCallback.current = onUnavailable;
  const pendingCallback = useRef(onScenePending); pendingCallback.current = onScenePending;
  useEffect(() => {
    const element = host.current!, container = mount.current!;setCeilingWarnings([]);
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'low-power' }); }
    catch { setStatus('threeUnavailable'); onMessage(message(language.current, 'threeUnavailable')); problemCallback.current?.('WebGL2 initialization failed.'); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
    const gl = renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
    const gpuRenderer = debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : 'unknown', graphicsVersion = String(gl.getParameter(gl.VERSION));
    renderer.domElement.setAttribute('aria-label', message(language.current, 'canvas3d')); renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.tabIndex = 0; container.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#eef2e9');
    const adapter = new SceneAdapter();adapterRef.current=adapter;adapter.setCeilingsVisible(ceilings);scene.add(adapter.group);
    scene.add(new THREE.HemisphereLight('#ffffff', '#87987b', 2.1));
    const sun = new THREE.DirectionalLight('#fff5e6', 2.8); sun.position.set(-6, 12, 8); scene.add(sun);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000), controls = new OrbitControls(camera, renderer.domElement);
    orbit.current = controls; controls.autoRotate = autoOrbit; controls.autoRotateSpeed = 1.2;
    camera.position.set(8, 9, 12);
    controls.enableDamping = true; controls.dampingFactor = 0.09; controls.minDistance = 0.4; controls.maxDistance = 400;
    controls.maxPolarAngle = Math.PI * 0.49;
    let needsRender = true, lost = false, disposed = false, frame = 0, bundle: SceneBundle | undefined, first = true, generation = -1, sceneState:'pending'|'current'|'stale'|'failed'='pending';
    const invalidate = () => { needsRender = true; };invalidateRef.current=invalidate; controls.addEventListener('change', invalidate);
    fit.current = () => {
      const b = bundle?.bounds; if (!b) return;
      const centre = new THREE.Vector3((b[0] + b[3]) / 2, b[1], (b[2] + b[5]) / 2);
      const span = Math.max(b[3] - b[0], b[5] - b[2], b[4] - b[1], 1), narrow = Math.min(1, camera.aspect);
      const distance = span / Math.tan(camera.fov * Math.PI / 360) / narrow;
      controls.target.copy(centre); camera.position.copy(centre).add(new THREE.Vector3(-0.6, 0.9, 1).normalize().multiplyScalar(distance));
      camera.near = Math.max(0.01, span / 10_000); camera.far = Math.max(1000, distance * 10); camera.updateProjectionMatrix(); controls.update(); invalidate();
    };
    const resize = () => { const width = element.clientWidth, height = element.clientHeight; if (!width || !height) return; renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); invalidate(); };
    const observer = new ResizeObserver(resize); observer.observe(element); resize();
    const contextLost = (event: Event) => { event.preventDefault(); lost = true; setStatus('threeLost'); element.dataset.contextState = 'lost'; problemCallback.current?.('Graphics context lost.'); };
    const contextRestored = () => { lost = false; element.dataset.contextState = 'restored'; setStatus(sceneState==='current'?null:sceneState==='stale'?'threePrevious':sceneState==='failed'?'threeFailed':'building3d'); invalidate(); };
    renderer.domElement.addEventListener('webglcontextlost', contextLost); renderer.domElement.addEventListener('webglcontextrestored', contextRestored);
    const keyboard = (event: KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-', '='].includes(event.key)) return;
      event.preventDefault();
      const offset = camera.position.clone().sub(controls.target), spherical = new THREE.Spherical().setFromVector3(offset);
      if (event.key === 'ArrowLeft') spherical.theta -= 0.08;
      if (event.key === 'ArrowRight') spherical.theta += 0.08;
      if (event.key === 'ArrowUp') spherical.phi = Math.max(0.05, spherical.phi - 0.08);
      if (event.key === 'ArrowDown') spherical.phi = Math.min(controls.maxPolarAngle, spherical.phi + 0.08);
      if (event.key === '+' || event.key === '=') spherical.radius = Math.max(controls.minDistance, spherical.radius * 0.9);
      if (event.key === '-') spherical.radius = Math.min(controls.maxDistance, spherical.radius / 0.9);
      camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical)); controls.update(); invalidate();
    }; renderer.domElement.addEventListener('keydown', keyboard);
    let worker: Worker;
    try { worker = new Worker(new URL('./mesh.worker.ts', import.meta.url), { type: 'module' }); }
    catch {
      observer.disconnect(); controls.removeEventListener('change', invalidate); controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', contextLost); renderer.domElement.removeEventListener('webglcontextrestored', contextRestored); renderer.domElement.removeEventListener('keydown', keyboard);
      adapterRef.current=null;invalidateRef.current=()=>{};adapter.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); fit.current = () => undefined;
      orbit.current = null; setStatus('threeUnavailable'); onMessage(message(language.current, 'threeUnavailable')); problemCallback.current?.('3D worker startup failed.'); return;
    }
    const pipeline = new ScenePipeline(store, worker, {
      pending: () => {sceneState='pending';element.dataset.sceneState=sceneState;setCeilingWarnings([]);adapter.group.visible = false; element.dataset.renderedGeneration = ''; setStatus('updating3d'); pendingCallback.current?.(); invalidate(); },
      ready: result => {
        bundle = result; sceneState='current';element.dataset.sceneState=sceneState;element.dataset.invalidation=JSON.stringify(result.invalidation??null);adapter.apply(result, store.getSnapshot().document);setCeilingWarnings(result.ceilingWarnings??[]);element.dataset.ceilingCount=String(result.meshes.filter(m=>m.category==='ceiling').length); adapter.group.visible = true; generation = store.getSnapshot().localGeneration;
        element.dataset.meshChanges = JSON.stringify(adapter.lastChanges); element.dataset.vertexCount = String(result.stats.vertices);
        element.dataset.meshesBuilt = String(result.stats.meshesBuilt);
        if (first) { first = false; fit.current(); }
        if (!lost) setStatus(null); onMessage(message(language.current, 'threeReady')); invalidate();
      },
      failed: reason => {sceneState=bundle?'stale':'failed';element.dataset.sceneState=sceneState;element.dataset.renderedGeneration='';element.dataset.previousGeneration=bundle?String(generation):'';adapter.group.visible=!!bundle;setStatus(bundle?'threePrevious':'threeFailed');onMessage(message(language.current,bundle?'threePrevious':'threeFailed'));problemCallback.current?.(reason);invalidate();},
    });
    const animate = () => {
      if (disposed) return; frame = requestAnimationFrame(animate);
      controls.update(); if (!lost && needsRender) {
        renderer.render(scene, camera); needsRender = false;
        if (adapter.group.visible&&sceneState==='current') element.dataset.renderedGeneration = String(generation);
        element.dataset.drawCalls = String(renderer.info.render.calls);
        if (adapter.group.visible&&sceneState==='current') frameCallback.current?.({ at: performance.now(), generation, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, renderer: gpuRenderer, graphicsVersion });
      }
    }; animate();
    return () => {
      disposed = true; cancelAnimationFrame(frame); pipeline.dispose(); observer.disconnect();
      controls.removeEventListener('change', invalidate); controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', contextLost); renderer.domElement.removeEventListener('webglcontextrestored', contextRestored); renderer.domElement.removeEventListener('keydown', keyboard);
      adapterRef.current=null;invalidateRef.current=()=>{};adapter.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); fit.current = () => undefined; orbit.current = null;
    };
  }, [store, onMessage]);
  useEffect(()=>{adapterRef.current?.setCeilingsVisible(ceilings);if(host.current)host.current.dataset.ceilingsVisible=String(ceilings);invalidateRef.current();},[ceilings]);
  useEffect(() => { fit.current(); }, [fitRequest]);
  useEffect(() => { host.current?.querySelector('canvas')?.setAttribute('aria-label', message(locale, 'canvas3d')); }, [locale]);
  useEffect(() => { if (orbit.current) orbit.current.autoRotate = autoOrbit; }, [autoOrbit]);
  return <div className="plan-canvas three-canvas" ref={host} data-testid="three-view">
    <div className="three-mount" ref={mount} />
    {status && <div className="three-status" role="status">{message(locale, status)}</div>}
    <label className="ceiling-toggle snap-toggle"><input type="checkbox" checked={ceilings} onChange={e=>setCeilings(e.target.checked)}/>{message(locale,'showCeilings')}</label>
    {ceilingWarnings.length>0&&<div className="ceiling-warnings" role="status" tabIndex={0} aria-label={message(locale,'ceilingWarningDetails')}>{ceilingWarnings.map(w=><p key={w.roomIds.join(':')}>{message(locale,'ceilingHeightsDiffer',{a:store.getSnapshot().document.rooms.find(r=>r.id===w.roomIds[0])?.name??w.roomIds[0],b:store.getSnapshot().document.rooms.find(r=>r.id===w.roomIds[1])?.name??w.roomIds[1],ha:w.heightsMm[0],hb:w.heightsMm[1]})}</p>)}</div>}
    <div className="canvas-hint">{message(locale, 'threeHint')}<br />{message(locale, 'dimensionsFurniture')}</div>
  </div>;
}
