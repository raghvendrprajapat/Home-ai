import {sunPlacement} from './lighting';
import {clampOrbit,fitPose,openingBounds,BOOKMARK_TOLERANCE} from './camera';
import type {CameraPose,Bounds3} from './camera';
import {profiles,pixelRatio,resolveQuality} from './quality';
import type {QualityChoice} from './quality';
import {captureFrame} from './capture';
import type {ThreeControlsApi} from './types';
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

export default function ThreeView({ store, fitRequest, onMessage, onFrame, onUnavailable, onScenePending, autoOrbit = false, locale = 'en',quality='auto',lighting='day',onControlsReady }: {
  store: ProjectStore; fitRequest: number; onMessage(text: string): void; onFrame?: (reading: RenderReading) => void; onUnavailable?: (reason: string) => void; onScenePending?: () => void; autoOrbit?: boolean; locale?: Locale;quality?:QualityChoice;lighting?:'day'|'warm';onControlsReady?:(api:ThreeControlsApi|null)=>void;
}) {
  const [downgraded,setDowngraded]=useState(false);
  const [ceilings,setCeilings]=useState(false),[ceilingWarnings,setCeilingWarnings]=useState<CeilingWarning[]>([]);
  const poseRef=useRef<CameraPose|null>(null),apiCallback=useRef(onControlsReady);apiCallback.current=onControlsReady;
  const adapterRef=useRef<SceneAdapter|null>(null),invalidateRef=useRef<()=>void>(()=>{});
  const host = useRef<HTMLDivElement>(null), mount = useRef<HTMLDivElement>(null), fit = useRef<() => void>(() => undefined);
  const [status, setStatus] = useState<'building3d' | 'updating3d' | 'threeUnavailable' | 'threeLost' | 'threeFailed' | 'threePrevious' | null>('building3d');
  const language = useRef(locale); language.current = locale;
  const orbit = useRef<OrbitControls | null>(null), frameCallback = useRef(onFrame); frameCallback.current = onFrame;
  const problemCallback = useRef(onUnavailable); problemCallback.current = onUnavailable;
  const pendingCallback = useRef(onScenePending); pendingCallback.current = onScenePending;
  useEffect(() => {
    const element = host.current!, container = mount.current!;setCeilingWarnings([]);setDowngraded(false);setStatus('building3d');element.dataset.sceneState='pending';element.dataset.renderedGeneration='';element.dataset.previousGeneration='';
    const initialPose=poseRef.current;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: profiles[resolveQuality(quality).tier].antialias, powerPreference: quality==='high'?'high-performance':'low-power' }); }
    catch { element.dataset.sceneState='failed';setStatus('threeUnavailable'); onMessage(message(language.current, 'threeUnavailable')); problemCallback.current?.('WebGL2 initialization failed.'); return; }
    const context=renderer.getContext() as WebGL2RenderingContext,gpu={maxTextureSize:Number(context.getParameter(context.MAX_TEXTURE_SIZE)),maxRenderbufferSize:Number(context.getParameter(context.MAX_RENDERBUFFER_SIZE)),maxSamples:Number(context.getParameter(context.MAX_SAMPLES))},resolved=resolveQuality(quality,gpu),tier=resolved.tier,profile=profiles[tier];setDowngraded(resolved.downgraded);element.dataset.qualityTier=tier;element.dataset.qualityDowngraded=String(resolved.downgraded);element.dataset.gpuCapabilities=JSON.stringify(gpu);
    if(resolved.downgraded&&profiles[resolveQuality(quality).tier].antialias){renderer.dispose();renderer.forceContextLoss();try{renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'low-power'});}catch{element.dataset.sceneState='failed';setStatus('threeUnavailable');problemCallback.current?.('Quality fallback failed.');return;}}
    element.dataset.antialias=String(renderer.getContext().getContextAttributes()?.antialias??false);
    renderer.shadowMap.enabled=profile.shadows;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
    const gl = renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
    const gpuRenderer = debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : 'unknown', graphicsVersion = String(gl.getParameter(gl.VERSION));
    renderer.domElement.setAttribute('aria-label', message(language.current, 'canvas3d')); renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.tabIndex = 0; container.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#eef2e9');
    const adapter = new SceneAdapter(tier);adapterRef.current=adapter;adapter.setCeilingsVisible(ceilings);scene.add(adapter.group);
    scene.add(new THREE.HemisphereLight('#ffffff', '#87987b', 2.1));
    const sun = new THREE.DirectionalLight('#fff5e6', 2.8); sun.position.set(-6, 12, 8);sun.castShadow=profile.shadows;sun.shadow.mapSize.set(profile.shadowSize||1,profile.shadowSize||1);sun.shadow.camera.left=-20;sun.shadow.camera.right=20;sun.shadow.camera.top=20;sun.shadow.camera.bottom=-20;sun.shadow.camera.far=80;scene.add(sun,sun.target);
    if(lighting==='warm'){sun.color.set('#ffd9ad');sun.intensity=2.2;}
    const pointLights:THREE.PointLight[]=[];const updateLights=()=>{for(const light of pointLights){scene.remove(light);light.dispose();}pointLights.length=0;for(const l of store.getSnapshot().document.lights.filter(l=>l.kind==='point').sort((a,b)=>a.id.localeCompare(b.id)).slice(0,profile.pointLights)){const light=new THREE.PointLight(l.colorTempK<4000?'#ffd9ad':'#fff5e6',Math.min(4,l.lumens/1000),12,2);light.position.set(l.position.x/1000,(store.getSnapshot().document.floors[0]!.elevation+l.height)/1000,l.position.y/1000);light.castShadow=false;pointLights.push(light);scene.add(light);}element.dataset.pointLights=String(pointLights.length);element.dataset.shadowLights=String(profile.shadows?1:0);};
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000), controls = new OrbitControls(camera, renderer.domElement);
    orbit.current = controls; controls.autoRotate = autoOrbit; controls.autoRotateSpeed = 1.2;
    camera.position.set(8, 9, 12);
    controls.enableDamping = true; controls.dampingFactor = 0.09; controls.minDistance = 1; controls.maxDistance = 200;
    controls.maxPolarAngle = 85*Math.PI/180;
    let needsRender = true, lost = false, disposed = false, frame = 0, bundle: SceneBundle | undefined, first = true, generation = -1, sceneState:'pending'|'current'|'stale'|'failed'='pending';
    const invalidate = () => { needsRender = true; };
    const applyPose=(p:CameraPose)=>{camera.position.fromArray(p.position);controls.target.fromArray(p.target);};
    const guard=()=>{const p=clampOrbit({position:camera.position.toArray() as CameraPose['position'],target:controls.target.toArray() as CameraPose['target']},bundle?.bounds??null,store.getSnapshot().document.floors[0]!.elevation/1000);applyPose(p);if(bundle&&sceneState==='current')poseRef.current=p;const poseText=JSON.stringify(p);if(element.dataset.cameraPose!==poseText)element.dataset.cameraPose=poseText;};invalidateRef.current=invalidate; controls.addEventListener('change', invalidate);
    fit.current = () => {if(!bundle?.bounds)return;const fitted=fitPose(bundle.bounds,camera.aspect);applyPose(fitted.pose);controls.update();guard();if(fitted.capped)onMessage(message(language.current,'cameraFitCapped'));invalidate();};
    const resize = () => { const width = element.clientWidth, height = element.clientHeight; if (!width || !height) return; renderer.setPixelRatio(pixelRatio(tier,width,height,window.devicePixelRatio||1));renderer.setSize(width, height);element.dataset.pixelRatio=String(renderer.getPixelRatio());camera.aspect = width / height; camera.updateProjectionMatrix(); invalidate(); };
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
      apiCallback.current?.(null);for(const light of pointLights)light.dispose();sun.shadow.dispose();adapterRef.current=null;invalidateRef.current=()=>{};adapter.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); fit.current = () => undefined;
      orbit.current = null; element.dataset.sceneState='failed';setStatus('threeUnavailable'); onMessage(message(language.current, 'threeUnavailable')); problemCallback.current?.('3D worker startup failed.'); return;
    }
    const pipeline = new ScenePipeline(store, worker, {
      pending: () => {sceneState='pending';element.dataset.sceneState=sceneState;setCeilingWarnings([]);adapter.group.visible = false; element.dataset.renderedGeneration = ''; setStatus('updating3d'); pendingCallback.current?.(); invalidate(); },
      ready: result => {
        bundle = result; sceneState='current';element.dataset.sceneState=sceneState;element.dataset.invalidation=JSON.stringify(result.invalidation??null);adapter.apply(result, store.getSnapshot().document);setCeilingWarnings(result.ceilingWarnings??[]);element.dataset.ceilingCount=String(result.meshes.filter(m=>m.category==='ceiling').length); adapter.group.visible = true; generation = store.getSnapshot().localGeneration;updateLights();const placement=sunPlacement(bundle.bounds,store.getSnapshot().document.floors[0]!.elevation/1000);sun.position.fromArray(placement.position);sun.target.position.fromArray(placement.target);sun.shadow.camera.left=-placement.coverage;sun.shadow.camera.right=placement.coverage;sun.shadow.camera.top=placement.coverage;sun.shadow.camera.bottom=-placement.coverage;sun.shadow.camera.updateProjectionMatrix();element.dataset.shadowCoverage=placement.partial?'central':'full';
        element.dataset.meshChanges = JSON.stringify(adapter.lastChanges); element.dataset.vertexCount = String(result.stats.vertices);
        element.dataset.meshesBuilt = String(result.stats.meshesBuilt);
        if(first){first=false;if(initialPose){applyPose(initialPose);controls.update();guard();}else fit.current();}
        guard();if (!lost) setStatus(null); onMessage(message(language.current, 'threeReady')); invalidate();
      },
      failed: reason => {sceneState=bundle?'stale':'failed';element.dataset.sceneState=sceneState;element.dataset.renderedGeneration='';element.dataset.previousGeneration=bundle?String(generation):'';adapter.group.visible=!!bundle;setStatus(bundle?'threePrevious':'threeFailed');onMessage(message(language.current,bundle?'threePrevious':'threeFailed'));problemCallback.current?.(reason);invalidate();},
    });
    const animate = () => {
      if (disposed) return; frame = requestAnimationFrame(animate);
      controls.update();guard(); if (!lost && needsRender) {
        renderer.render(scene, camera); needsRender = false;
        if (adapter.group.visible&&sceneState==='current') element.dataset.renderedGeneration = String(generation);
        element.dataset.drawCalls = String(renderer.info.render.calls);
        if (adapter.group.visible&&sceneState==='current') frameCallback.current?.({ at: performance.now(), generation, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, renderer: gpuRenderer, graphicsVersion });
      }
    };
    apiCallback.current?.({
      pose:()=>({position:camera.position.toArray() as CameraPose['position'],target:controls.target.toArray() as CameraPose['target']}),
      restore:p=>{
        if(lost||sceneState!=='current')throw new Error('camera-unavailable');
        const checked=clampOrbit(p,bundle?.bounds??null,store.getSnapshot().document.floors[0]!.elevation/1000);
        if(p.position.some((v,i)=>Math.abs(v-checked.position[i]!)>BOOKMARK_TOLERANCE)||p.target.some((v,i)=>Math.abs(v-checked.target[i]!)>BOOKMARK_TOLERANCE))throw new Error('camera-bookmark');
        applyPose(checked);controls.update();guard();invalidate();
      },
      reset:()=>{fit.current();},
      focus:id=>{
        if(lost||sceneState!=='current')throw new Error('camera-unavailable');
        const selected=new THREE.Box3(),opening=openingBounds(store.getSnapshot().document,id);
        if(opening)selected.set(new THREE.Vector3(opening[0],opening[1],opening[2]),new THREE.Vector3(opening[3],opening[4],opening[5]));
        adapter.group.traverse(o=>{if(o instanceof THREE.Mesh&&o.userData.entityId===id)selected.union(new THREE.Box3().setFromObject(o));});
        if(selected.isEmpty()){
          const f=store.getSnapshot().document.furniture.find(f=>f.id===id);
          if(f){const p=new THREE.Vector3(f.position.x/1000,(store.getSnapshot().document.floors[0]!.elevation+f.elevation+f.size.h/2)/1000,f.position.y/1000);selected.setFromCenterAndSize(p,new THREE.Vector3(Math.hypot(f.size.w,f.size.d)/1000,f.size.h/1000,Math.hypot(f.size.w,f.size.d)/1000));}
        }
        if(selected.isEmpty())throw new Error('camera-selection');
        const b:Bounds3=[selected.min.x,selected.min.y,selected.min.z,selected.max.x,selected.max.y,selected.max.z],fitted=fitPose(b,camera.aspect);
        applyPose(fitted.pose);controls.update();guard();invalidate();if(fitted.capped)onMessage(message(language.current,'cameraFitCapped'));
      },
      capture:(edge,copy)=>{
        if(lost||sceneState!=='current'||generation!==store.getSnapshot().localGeneration||!bundle||!bundle.meshes.length&&!store.getSnapshot().document.furniture.length)throw new Error('capture-unavailable');
        const aspect=camera.aspect,width=aspect>=1?edge:Math.max(1,Math.round(edge*aspect)),height=aspect>=1?Math.max(1,Math.round(edge/aspect)):edge;
        try{return captureFrame(renderer,scene,camera,width,height,generation,tier,gpu,copy);}
        catch(e){if(e instanceof Error&&e.message==='capture-restore'){sceneState='failed';element.dataset.sceneState=sceneState;element.dataset.renderedGeneration='';setStatus('threeFailed');problemCallback.current?.('Screenshot restore failed.');}throw e;}
        finally{invalidate();}
      },
    });
    animate();
    return () => {
      disposed = true; cancelAnimationFrame(frame); pipeline.dispose(); observer.disconnect();
      controls.removeEventListener('change', invalidate); controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', contextLost); renderer.domElement.removeEventListener('webglcontextrestored', contextRestored); renderer.domElement.removeEventListener('keydown', keyboard);
      apiCallback.current?.(null);for(const light of pointLights)light.dispose();sun.shadow.dispose();adapterRef.current=null;invalidateRef.current=()=>{};adapter.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); fit.current = () => undefined; orbit.current = null;
    };
  }, [store, onMessage,quality,lighting]);
  useEffect(()=>{adapterRef.current?.setCeilingsVisible(ceilings);if(host.current)host.current.dataset.ceilingsVisible=String(ceilings);invalidateRef.current();},[ceilings]);
  useEffect(() => { fit.current(); }, [fitRequest]);
  useEffect(() => { host.current?.querySelector('canvas')?.setAttribute('aria-label', message(locale, 'canvas3d')); }, [locale]);
  useEffect(() => { if (orbit.current) orbit.current.autoRotate = autoOrbit; }, [autoOrbit]);
  return <div className="plan-canvas three-canvas" ref={host} data-testid="three-view">
    <div className="three-mount" ref={mount} />
    {downgraded&&<p className="three-status" role="status">{message(locale,'qualityLowered')}</p>}
    {status && <div className="three-status" role="status">{message(locale, status)}</div>}
    <label className="ceiling-toggle snap-toggle"><input type="checkbox" checked={ceilings} onChange={e=>setCeilings(e.target.checked)}/>{message(locale,'showCeilings')}</label>
    {ceilingWarnings.length>0&&<div className="ceiling-warnings" role="status" tabIndex={0} aria-label={message(locale,'ceilingWarningDetails')}>{ceilingWarnings.map(w=><p key={w.roomIds.join(':')}>{message(locale,'ceilingHeightsDiffer',{a:store.getSnapshot().document.rooms.find(r=>r.id===w.roomIds[0])?.name??w.roomIds[0],b:store.getSnapshot().document.rooms.find(r=>r.id===w.roomIds[1])?.name??w.roomIds[1],ha:w.heightsMm[0],hb:w.heightsMm[1]})}</p>)}</div>}
    <div className="canvas-hint">{message(locale, 'threeHint')}<br />{message(locale, 'dimensionsFurniture')}</div>
  </div>;
}
