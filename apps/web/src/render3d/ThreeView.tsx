import {FurniturePointer} from './furniture-pointer';
import type {FurniturePointerMode} from './furniture-pointer';
import {FurnitureAdvisories} from '../editor/furniture-advisories';
import type {FurnitureAdvisory} from '../editor/furniture-advisories';
import {FurnitureWarning} from '../editor/FurnitureWarning';
import {FurnitureAssets} from './furniture-assets';
import type {FurnitureStatus} from './furniture-assets';
import type {FurnitureAssetSource} from './types';
import {pickRay,furnitureRayHit,PickGesture} from './picking';
import {SelectionOutline} from './selection-outline';
import {PlacementGhost} from './placement-ghost';
import type {FurnitureGhost} from './placement-ghost';
import type {Pick} from '../editor/hit-test';
import {ShaderTextures} from './shader-textures';
import {releaseOnce} from './resources';
import {ContextRecovery} from './recovery';
import {sunPlacement} from './lighting';
import {BoundedPointLights,lightSources,mood} from './night-lighting';
import type {LightingMode} from './night-lighting';
import {clampOrbit,stablePose,fitPose,openingBounds,BOOKMARK_TOLERANCE} from './camera';
import type {CameraPose,Bounds3} from './camera';
import {deviceHints,profiles,pixelRatio,resolveQuality} from './quality';
import type {QualityChoice} from './quality';
import {captureFrame} from './capture';
import {advance,buildWalkWorld,walkPose,walkStart} from './walk';
import {floorSnapshot} from '../editor/floor-scope';
import type {WalkInput,WalkState,WalkWorld} from './walk';
import type {ThreeControlsApi} from './types';
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
/** D76 R2: CC0 studio HDRI (Poly Haven, rights in docs/assets/texture-rights.json), used on mid/high only. */
const ENVIRONMENT={id:'studio_small_09',path:'env/studio_small_09_1k.hdr'};
import type { ProjectStore } from '@gharplan/core-model';
import { SceneAdapter } from './scene';
import { ScenePipeline } from './pipeline';
import { LOW_WALL_MM } from './cutaway';
import type { SceneBundle,CeilingWarning } from './types';
import type { RenderReading } from '../perf/metrics';
import { editError,message } from '../i18n/messages';
import type { Locale } from '../i18n/messages';

/** D76: the "Low walls" view choice is remembered on this device (on by default); it is a view setting, never saved in the drawing. */
const LOW_WALLS_KEY='gharplan-low-walls';
function readLowWalls():boolean{try{return localStorage.getItem(LOW_WALLS_KEY)!=='0';}catch{return true;}}
/** D79: original line icons for the compact 3D tool bar (24 px grid, currentColor). */
const TOOL_ICONS={walk:'M13 4.5a1.5 1.5 0 1 0 0 .01M10 21l2-6 3 3v3M8 11l4-3 3 2 2 3M12 8l-1.5 6.5',orbit:'M4 12c0-3.9 3.6-7 8-7s8 3.1 8 7-3.6 7-8 7M4 12l-2-2.5M4 12l2.5-2M12 10.5v3',move:'M12 3v18M3 12h18M12 3 9.5 5.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5',rotate:'M19.5 12A7.5 7.5 0 1 1 17 6.4M19.5 3.5v4.5H15'} as const;
const toolIcon=(name:keyof typeof TOOL_ICONS)=><svg className="icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={TOOL_ICONS[name]}/></svg>;
export default function ThreeView({ activeFloorId,advisories:providedAdvisories,store, fitRequest, onMessage, onFrame, onUnavailable, onScenePending, autoOrbit = false, locale = 'en',quality='auto',lighting='day',onControlsReady,onFallback2d,onPick,selectedPick,placementPreview,assetSource,onEditStart }: {
  activeFloorId?:string;onEditStart?:()=>void;advisories?:FurnitureAdvisories;store: ProjectStore; fitRequest: number; onMessage(text: string): void; onFrame?: (reading: RenderReading) => void; onUnavailable?: (reason: string) => void; onScenePending?: () => void; autoOrbit?: boolean; locale?: Locale;quality?:QualityChoice;lighting?:LightingMode;onControlsReady?:(api:ThreeControlsApi|null)=>void;onFallback2d?:()=>void;onPick?:(pick:Pick|null,additive?:boolean)=>void;selectedPick?:Pick|undefined;placementPreview?:FurnitureGhost|undefined;assetSource?:FurnitureAssetSource;
}) {
  const [nightLights,setNightLights]=useState(true),nightLightsRef=useRef(nightLights);nightLightsRef.current=nightLights;
  const lightingRef=useRef(lighting),lightingUpdate=useRef<()=>void>(()=>{});lightingRef.current=lighting;
  const [furnitureMode,setFurnitureMode]=useState<FurniturePointerMode>('orbit'),[freeTransform,setFreeTransform]=useState(false);
  // FR-019: 3D Move/Rotate on a grouped item act on its whole group (MoveFurniture/RotateFurniture).
  const groupedPick=useSyncExternalStore(store.subscribe,()=>{if(selectedPick?.kind!=='furniture')return false;const furniture=store.getSnapshot().document.furniture,group=furniture.find(f=>f.id===selectedPick.id)?.groupId;return group!==undefined&&furniture.filter(f=>f.groupId===group).length>=2;}),editablePick=selectedPick?.kind==='furniture';
  const transformRef=useRef<FurniturePointer|null>(null),modeRef=useRef(furnitureMode),freeRef=useRef(freeTransform),editStartRef=useRef(onEditStart);modeRef.current=furnitureMode;freeRef.current=freeTransform;editStartRef.current=onEditStart;
  const [ownAdvisories]=useState(()=>new FurnitureAdvisories()),advisories=providedAdvisories??ownAdvisories;
  const [selectionAdvisory,setSelectionAdvisory]=useState<FurnitureAdvisory|null>(null);
  const [modelPage,setModelPage]=useState(0);
  const [modelStatus,setModelStatus]=useState<FurnitureStatus[]>([]);const retryModel=useRef<(id:string)=>void>(()=>{});
  const [downgraded,setDowngraded]=useState(false);
  // Walk mode (FR-026): the view owns the camera only while active; the canonical model is never written.
  const [walking,setWalking]=useState(false),[knob,setKnob]=useState<[number,number]>([0,0]);
  // FR-034: 3D always shows the whole house; walking, placement and the cutaway follow the active floor.
  const floorRef=useRef(activeFloorId);floorRef.current=activeFloorId;
  const [showAbove,setShowAbove]=useState(false),showAboveRef=useRef(showAbove);showAboveRef.current=showAbove;const clipRef=useRef<()=>void>(()=>{});
  const floorCount=useSyncExternalStore(store.subscribe,()=>store.getSnapshot().document.floors.length);
  const walkControl=useRef<{enter():'ok'|'empty'|'unavailable';exit():void;axes(forward:number,strafe:number):void;eye(step:-1|1):void}|null>(null);
  // D76: the overview starts with low walls (furniture by the near walls stays visible); walking always uses full walls.
  const [lowWalls,setLowWalls]=useState(readLowWalls),lowWallsRef=useRef(lowWalls),pipelineRef=useRef<ScenePipeline|null>(null);lowWallsRef.current=lowWalls;
  const [ceilings,setCeilings]=useState(false),[ceilingWarnings,setCeilingWarnings]=useState<CeilingWarning[]>([]);
  const poseRef=useRef<CameraPose|null>(null),apiCallback=useRef(onControlsReady);apiCallback.current=onControlsReady;
  const adapterRef=useRef<SceneAdapter|null>(null),invalidateRef=useRef<()=>void>(()=>{});
  const host = useRef<HTMLDivElement>(null), mount = useRef<HTMLDivElement>(null), fit = useRef<() => void>(() => undefined);
  const [status, setStatus] = useState<'building3d' | 'updating3d' | 'threeUnavailable' | 'threeLost' | 'threeFailed' | 'threePrevious' | null>('building3d');
  const language = useRef(locale); language.current = locale;
  const orbit = useRef<OrbitControls | null>(null), frameCallback = useRef(onFrame); frameCallback.current = onFrame;
  const pickCallback=useRef(onPick);pickCallback.current=onPick;const selectedRef=useRef(selectedPick);selectedRef.current=selectedPick;const selectionUpdate=useRef<()=>void>(()=>{});
  const ghostRef=useRef(placementPreview);ghostRef.current=placementPreview;const ghostUpdate=useRef<()=>void>(()=>{});
  const fallbackCallback=useRef(onFallback2d);fallbackCallback.current=onFallback2d;
  const problemCallback = useRef(onUnavailable); problemCallback.current = onUnavailable;
  const pendingCallback = useRef(onScenePending); pendingCallback.current = onScenePending;
  // OrbitControls removes root-node keyboard listeners. Tear down before React
  // detaches the canvas, otherwise getRootNode() no longer returns its document.
  useLayoutEffect(() => {
    const element = host.current!, container = mount.current!;setCeilingWarnings([]);setDowngraded(false);setStatus('building3d');element.dataset.sceneState='pending';element.dataset.renderedGeneration='';element.dataset.previousGeneration='';
    setModelStatus([]);setModelPage(0);let disposed=false,frame=0;const teardown:(()=>void)[]=[];
    const cleanup=()=>{if(disposed)return;disposed=true;cancelAnimationFrame(frame);for(const release of teardown.reverse())try{release();}catch{/* Continue releasing independent owners. */}apiCallback.current?.(null);walkControl.current=null;adapterRef.current=null;invalidateRef.current=()=>{};fit.current=()=>{};orbit.current=null;transformRef.current=null;lightingUpdate.current=()=>{};};
    const fallback=()=>{if(disposed)return;element.dataset.sceneState='failed';element.dataset.renderedGeneration='';setStatus('threeFailed');onMessage(message(language.current,'threeFallback'));problemCallback.current?.('3D unavailable; drawing retained.');cleanup();fallbackCallback.current?.();};
    try{
    const initialPose=poseRef.current;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: profiles[resolveQuality(quality,undefined,deviceHints()).tier].antialias, powerPreference: quality==='high'?'high-performance':'low-power' }); }
    catch { element.dataset.sceneState='failed';setStatus('threeUnavailable'); onMessage(message(language.current, 'threeUnavailable')); problemCallback.current?.('WebGL2 initialization failed.');cleanup();return cleanup; }
    const ownRenderer=(owned:THREE.WebGLRenderer)=>{const release=releaseOnce([()=>owned.dispose(),()=>{element.dataset.disposedGpu=JSON.stringify(owned.info.memory);},()=>owned.forceContextLoss(),()=>owned.domElement.remove()]);teardown.push(release);return release;};
    let releaseRenderer=ownRenderer(renderer);
    const context=renderer.getContext() as WebGL2RenderingContext,gpu={maxTextureSize:Number(context.getParameter(context.MAX_TEXTURE_SIZE)),maxRenderbufferSize:Number(context.getParameter(context.MAX_RENDERBUFFER_SIZE)),maxSamples:Number(context.getParameter(context.MAX_SAMPLES))},resolved=resolveQuality(quality,gpu,deviceHints()),tier=resolved.tier,profile=profiles[tier];setDowngraded(resolved.downgraded);element.dataset.qualityTier=tier;element.dataset.qualityDowngraded=String(resolved.downgraded);element.dataset.gpuCapabilities=JSON.stringify(gpu);
    if(resolved.downgraded&&profiles[resolveQuality(quality,undefined,deviceHints()).tier].antialias){releaseRenderer();try{renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'low-power'});releaseRenderer=ownRenderer(renderer);}catch{element.dataset.sceneState='failed';setStatus('threeUnavailable');problemCallback.current?.('Quality fallback failed.');fallback();return cleanup;}}
    element.dataset.antialias=String(renderer.getContext().getContextAttributes()?.antialias??false);
    renderer.shadowMap.enabled=profile.shadows;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
    element.dataset.toneMapping='aces';element.dataset.shadows=profile.shadows?'on':'off';element.dataset.environment='none';element.dataset.texturedMaterials='0';element.dataset.textureBytes='0';
    const gl = renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
    const gpuRenderer = debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : 'unknown', graphicsVersion = String(gl.getParameter(gl.VERSION));
    renderer.domElement.setAttribute('aria-label', message(language.current, 'canvas3d')); renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.tabIndex = 0; container.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#f1f2ee');
    const shaderTextures=new ShaderTextures();teardown.push(()=>shaderTextures.close());
    const assetBase=new URL(import.meta.env.BASE_URL,window.location.href);
    const adapter = new SceneAdapter(tier,uniforms=>shaderTextures.observe(uniforms),{baseUrl:assetBase,onReady:()=>{if(!disposed){publishTextures();invalidate();}}});teardown.push(()=>{adapter.dispose();element.dataset.resourceStats=JSON.stringify(adapter.resourceStats);});adapterRef.current=adapter;adapter.setCeilingsVisible(ceilings);scene.add(adapter.group);
    const outline=new SelectionOutline();scene.add(outline.group);teardown.push(()=>{outline.dispose();element.dataset.selectionResources=JSON.stringify(outline.resourceStats);selectionUpdate.current=()=>{};});
    const ghost=new PlacementGhost();scene.add(ghost.group);teardown.push(()=>{ghost.dispose();element.dataset.placementResources=JSON.stringify(ghost.resourceStats);ghostUpdate.current=()=>{};});
    const hemisphere=new THREE.HemisphereLight('#ffffff', '#87987b', 2.1);scene.add(hemisphere);
    // Mid/high: image-based light from the HDRI, so surfaces get soft fill and real reflections; Low skips the download.
    if(tier!=='low'){
      const pmrem=new THREE.PMREMGenerator(renderer);let environment:THREE.Texture|null=null;teardown.push(()=>{environment?.dispose();pmrem.dispose();});
      void new HDRLoader().loadAsync(new URL(ENVIRONMENT.path,assetBase).href).then(hdr=>{
        try{if(disposed)return;environment=pmrem.fromEquirectangular(hdr).texture;scene.environment=environment;updateLights();element.dataset.environment=`hdri:${ENVIRONMENT.id}`;publishTextures();invalidate();}finally{hdr.dispose();}
      },()=>{/* Without the HDRI the hemisphere light stays as before. */});
    }
    const sun = new THREE.DirectionalLight('#fff1dc', 3.3); sun.position.set(-6, 12, 8);sun.castShadow=profile.shadows;sun.shadow.mapSize.set(profile.shadowSize||1,profile.shadowSize||1);sun.shadow.camera.left=-20;sun.shadow.camera.right=20;sun.shadow.camera.top=20;sun.shadow.camera.bottom=-20;sun.shadow.camera.far=80;sun.shadow.bias=-.0004;sun.shadow.normalBias=.02;scene.add(sun,sun.target);
    teardown.push(()=>sun.shadow.dispose());
    const pointLights=new BoundedPointLights(scene);teardown.push(()=>{pointLights.close();element.dataset.lampSources='[]';element.dataset.pointLights='0';});
    const updateLights=(document=previewDocument??appliedDocument??store.getSnapshot().document)=>{
      if(disposed)return;
      const mode=lightingRef.current,settings=mood(mode,scene.environment!==null);
      (scene.background as THREE.Color).set(settings.background);sun.color.set(settings.sunColor);sun.intensity=settings.sun;hemisphere.intensity=settings.hemisphere;scene.environmentIntensity=settings.environment;
      pointLights.set(mode==='night'&&!nightLightsRef.current?[]:lightSources(document,tier,mode,floorRef.current??document.floors[0]!.id,pipelineRef.current?.lowWallsMm));
      element.dataset.lighting=mode;element.dataset.pointLights=String(pointLights.snapshot.length);element.dataset.lampSources=JSON.stringify(pointLights.snapshot);element.dataset.shadowLights=String(profile.shadows?1:0);
      invalidate();
    };
    lightingUpdate.current=()=>{transform?.cancel();updateLights();};
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000), controls = new OrbitControls(camera, renderer.domElement);
    teardown.push(()=>controls.dispose());
    orbit.current = controls; controls.autoRotate = autoOrbit; controls.autoRotateSpeed = 1.2;
    camera.position.set(8, 9, 12);
    controls.enableDamping = true; controls.dampingFactor = 0.09; controls.minDistance = 1; controls.maxDistance = 200;
    controls.maxPolarAngle = 85*Math.PI/180;
    let needsRender = true, lost = false, bundle: SceneBundle | undefined, first = true, generation = -1, sceneState:'pending'|'current'|'stale'|'failed'='pending';
    const invalidate = () => { needsRender = true; };
    // D76: true statements about the live scene for the acceptance tests (textures and the HDRI's half-float PMREM).
    const publishTextures=()=>{const t=adapter.textureStats,env=scene.environment?.image as {width?:number;height?:number}|undefined;element.dataset.texturedMaterials=String(t.texturedMaterials);element.dataset.textureBytes=String(t.textureBytes+(env?.width&&env.height?env.width*env.height*8:0));};
    const activeFloor=()=>{const d=store.getSnapshot().document;return d.floors.find(f=>f.id===floorRef.current)??d.floors[0]!;};
    // Cutaway: hide everything above the active floor's walls unless the viewer asks to see upper floors.
    const updateClip=()=>{if(!renderer)return;const d=store.getSnapshot().document,floor=activeFloor(),higher=d.floors.some(f=>f.level>floor.level);try{adapter.setHiddenFloors(new Set(showAboveRef.current?[]:d.floors.filter(f=>f.level>floor.level).map(f=>f.id)),previewDocument??appliedDocument);}catch{fallback();return;}element.dataset.hiddenFloors=String(adapter.hiddenFloors.size);renderer.clippingPlanes=higher&&!showAboveRef.current?[new THREE.Plane(new THREE.Vector3(0,-1,0),(floor.elevation+floor.defaultWallHeight)/1000+0.005)]:[];element.dataset.clipHeight=renderer.clippingPlanes.length?String(floor.elevation+floor.defaultWallHeight):'';updateLights();invalidate();};
    clipRef.current=updateClip;teardown.push(store.subscribe(updateClip));
    let appliedTag='';let appliedDocument:ReturnType<ProjectStore['getSnapshot']>['document']|null=null,previewDocument:ReturnType<ProjectStore['getSnapshot']>['document']|null=null,transform:FurniturePointer|undefined;
    const effectiveDocument=()=>previewDocument??store.getSnapshot().document;
    const syncModels=()=>{if(disposed)return;try{if(sceneState==='current'&&!lost&&appliedTag===JSON.stringify(store.asyncTag()))adapter.refreshFurniture(effectiveDocument());setModelStatus(models?.getSnapshot()??[]);element.dataset.modelAttached=JSON.stringify(models?.renderingStats.ids??[]);element.dataset.modelScene=JSON.stringify(models?.renderingStats??null);element.dataset.modelResources=JSON.stringify(models?.resourceStats??null);invalidate();}catch{fallback();}};
    const models:FurnitureAssets|undefined=assetSource?new FurnitureAssets(assetSource,tier==='low'?1:0,syncModels,uniforms=>shaderTextures.observe(uniforms)):undefined;
    if(models){adapter.furnitureAssets=models;adapter.group.add(models.group);retryModel.current=id=>models.retry(id);teardown.push(()=>{models.close();retryModel.current=()=>{};element.dataset.modelResources=JSON.stringify(models.resourceStats);});}

    const syncGhost=()=>{if(disposed)return;try{ghost.set(ghostRef.current,store.asyncTag(),activeFloor().elevation,sceneState==='current'&&!lost&&!transform?.active&&generation===store.getSnapshot().localGeneration);element.dataset.placementId=ghost.group.visible?ghostRef.current?.item.id??'':'';element.dataset.placementOverlap=String(ghost.group.visible&&ghostRef.current?.warning===true);element.dataset.placementResources=JSON.stringify(ghost.resourceStats);selectionUpdate.current();invalidate();}catch{fallback();}};ghostUpdate.current=syncGhost;
    const gesture=new PickGesture(),tag=()=>JSON.stringify(store.asyncTag());teardown.push(()=>gesture.clear());
    const selectOutline=()=>{if(disposed)return;if(sceneState!=='current'||lost||generation!==store.getSnapshot().localGeneration){outline.group.visible=false;setSelectionAdvisory(null);element.dataset.furnitureOverlap='false';invalidate();return;}try{const document=effectiveDocument(),item=selectedRef.current?.kind==='furniture'?document.furniture.find(f=>f.id===selectedRef.current!.id):undefined,advisory=item?advisories.check(document,item):null;const effective=previewDocument?advisory:ghost.group.visible?ghostRef.current?.advisory??advisory:advisory;setSelectionAdvisory(effective);element.dataset.furnitureOverlap=String(effective?.overlap??false);outline.set(selectedRef.current,adapter,document,advisory?.overlap??false);element.dataset.selectedEntity=selectedRef.current?.id??'';element.dataset.selectedKind=selectedRef.current?.kind??'';element.dataset.selectionResources=JSON.stringify(outline.resourceStats);invalidate();}catch{fallback();}};selectionUpdate.current=selectOutline;
    let fittedPose:number[]|null=null;
    const applyPose=(p:CameraPose)=>{camera.position.fromArray(p.position);controls.target.fromArray(p.target);};
    const guard=()=>{const p=stablePose(clampOrbit({position:camera.position.toArray() as CameraPose['position'],target:controls.target.toArray() as CameraPose['target']},bundle?.bounds??null,store.getSnapshot().document.floors[0]!.elevation/1000));applyPose(p);if(bundle&&sceneState==='current')poseRef.current=p;const poseText=JSON.stringify(p);if(element.dataset.cameraPose!==poseText)element.dataset.cameraPose=poseText;};invalidateRef.current=invalidate; controls.addEventListener('change', invalidate);teardown.push(()=>controls.removeEventListener('change',invalidate));
    // D76: frame what is actually drawn (low walls, hidden ceilings and upper floors excluded), not the whole model box.
    const visibleBounds=():Bounds3|null=>{const box=new THREE.Box3();adapter.group.traverseVisible(o=>{if((o as THREE.Mesh).isMesh)box.expandByObject(o);});return box.isEmpty()?bundle?.bounds??null:[box.min.x,box.min.y,box.min.z,box.max.x,box.max.y,box.max.z];};
    fit.current = () => {transform?.cancel();const bounds=bundle?.bounds?visibleBounds():null;if(!bounds)return;const fitted=fitPose(bounds,camera.aspect);applyPose(fitted.pose);controls.update();guard();fittedPose=[...camera.position.toArray(),...controls.target.toArray()];if(fitted.capped)onMessage(message(language.current,'cameraFitCapped'));invalidate();};
    // D79: while the camera still shows the fitted view (nobody moved it), a new canvas size (a phone sheet opening or
    // closing, a rotated phone) refits, so the house stays whole and as large as the space allows.
    const stillFitted=()=>fittedPose!==null&&[...camera.position.toArray(),...controls.target.toArray()].every((v,i)=>Math.abs(v-fittedPose![i]!)<1e-6);
    const resize = () => { const width = element.clientWidth, height = element.clientHeight; if (!width || !height) return; const refit=stillFitted();renderer.setPixelRatio(pixelRatio(tier,width,height,window.devicePixelRatio||1));renderer.setSize(width, height);element.dataset.pixelRatio=String(renderer.getPixelRatio());camera.aspect = width / height; camera.updateProjectionMatrix(); if(refit)fit.current(); invalidate(); };
    const observer = new ResizeObserver(()=>{try{if(!disposed)resize();}catch{fallback();}});teardown.push(()=>observer.disconnect());observer.observe(element);resize();
    const recovery=new ContextRecovery(fallback);teardown.push(()=>recovery.close());
    const contextLost = (event: Event) => {
      if(disposed)return;transform?.cancel();gesture.cancel();setSelectionAdvisory(null);element.dataset.furnitureOverlap='false';event.preventDefault();lost=true;needsRender=true;
      element.dataset.renderedGeneration='';element.dataset.drawCalls='';
      setStatus('threeLost');element.dataset.contextState='lost';syncGhost();
      recovery.lost();pendingCallback.current?.();problemCallback.current?.('Graphics context lost.');
    };
    const contextRestored = () => {
      if(disposed)return;lost=false;element.dataset.contextState='restoring';
      setStatus(sceneState==='stale'?'threePrevious':sceneState==='failed'?'threeFailed':'threeLost');syncModels();syncGhost();invalidate();
    };
    renderer.domElement.addEventListener('webglcontextlost',contextLost);renderer.domElement.addEventListener('webglcontextrestored',contextRestored);
    teardown.push(()=>{renderer.domElement.removeEventListener('webglcontextlost',contextLost);renderer.domElement.removeEventListener('webglcontextrestored',contextRestored);});
    // ---- Walk mode ----
    let walkActive=false,walkState:WalkState|null=null,walkWorld:WalkWorld|null=null,walkGeneration=-1,walkLast=0,saved:CameraPose|null=null,look:{id:number;x:number;y:number}|null=null;
    const held=new Set<string>();let lookX=0,lookY=0,eyePress=0,padForward=0,padStrafe=0;
    let walkFloor:string|undefined;const walkWorldFor=()=>{const snap=floorSnapshot(store.getSnapshot(),floorRef.current);if(!walkWorld||walkGeneration!==snap.localGeneration||walkFloor!==floorRef.current){walkWorld=buildWalkWorld(snap.document,snap.derived.footprints);walkFloor=floorRef.current;walkGeneration=snap.localGeneration;}return walkWorld;};
    const publishWalk=()=>{if(!walkState){element.dataset.walkActive='false';element.dataset.walkPose='';return;}element.dataset.walkActive='true';element.dataset.walkPose=JSON.stringify({x:Math.round(walkState.x*10)/10,y:Math.round(walkState.y*10)/10,yaw:Math.round(walkState.yaw*1000)/1000,pitch:Math.round(walkState.pitch*1000)/1000,eye:walkState.eye,floorElevation:activeFloor().elevation});};
    const clearWalkInput=()=>{held.clear();lookX=0;lookY=0;eyePress=0;padForward=0;padStrafe=0;look=null;};
    const exitWalk=()=>{
      if(!walkActive)return;walkActive=false;walkState=null;walkWorld=null;clearWalkInput();controls.enabled=true;camera.fov=45;camera.updateProjectionMatrix();
      if(saved&&!disposed){applyPose(saved);controls.update();guard();}saved=null;publishWalk();setWalking(false);pipelineRef.current?.setLowWalls(lowWallsRef.current?LOW_WALL_MM:undefined);invalidate();
    };
    const enterWalk=():'ok'|'empty'|'unavailable'=>{
      if(walkActive)return 'ok';if(disposed||lost||recovery.active||sceneState!=='current'||generation!==store.getSnapshot().localGeneration)return 'unavailable';
      const start=walkStart(floorSnapshot(store.getSnapshot(),floorRef.current),walkWorldFor());if(!start)return 'empty';
      transform?.cancel();gesture.cancel();saved={position:camera.position.toArray() as CameraPose['position'],target:controls.target.toArray() as CameraPose['target']};
      walkState=start;walkActive=true;walkLast=performance.now();clearWalkInput();controls.enabled=false;camera.fov=65;camera.updateProjectionMatrix();publishWalk();setWalking(true);pipelineRef.current?.setLowWalls(undefined);invalidate();return 'ok';
    };
    const walkFrame=()=>{
      if(!walkState)return;const now=performance.now(),dt=now-walkLast;walkLast=now;
      const key=(a:string,b:string)=>(held.has(a)?1:0)-(held.has(b)?1:0);
      const input:WalkInput={forward:Math.max(-1,Math.min(1,key('w','s')+key('ArrowUp','ArrowDown')+padForward)),strafe:Math.max(-1,Math.min(1,key('d','a')+padStrafe)),turn:key('ArrowRight','ArrowLeft'),lookX,lookY,eyeStep:Math.sign(eyePress)};
      lookX=0;lookY=0;eyePress-=Math.sign(eyePress); // presses queue: one 100 mm step per frame, none lost
      const before=JSON.stringify(walkState);walkState=advance(walkState,input,dt,walkWorldFor());
      const pose=walkPose(walkState,activeFloor().elevation);camera.position.fromArray(pose.position);camera.lookAt(pose.target[0],pose.target[1],pose.target[2]);
      if(JSON.stringify(walkState)!==before){publishWalk();invalidate();}
    };
    const walkKeyDown=(event:KeyboardEvent)=>{
      if(!walkActive||event.ctrlKey||event.metaKey||event.altKey)return;const target=event.target;
      if(target instanceof HTMLInputElement||target instanceof HTMLSelectElement||target instanceof HTMLTextAreaElement||target instanceof HTMLElement&&target.isContentEditable)return;
      const k=event.key.length===1?event.key.toLowerCase():event.key;
      if(k==='Escape'){event.preventDefault();exitWalk();return;}
      if(k==='+'||k==='='){event.preventDefault();if(!event.repeat)eyePress=Math.min(20,eyePress+1);return;}
      if(k==='-'||k==='_'){event.preventDefault();if(!event.repeat)eyePress=Math.max(-20,eyePress-1);return;}
      if(['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(k)){event.preventDefault();held.add(k);}
    };
    const walkKeyUp=(event:KeyboardEvent)=>{held.delete(event.key.length===1?event.key.toLowerCase():event.key);};
    const walkPointer=(kind:'down'|'move'|'up'|'cancel',event:PointerEvent)=>{
      if(kind==='down'){if(event.target===renderer.domElement&&event.button===0&&!look){look={id:event.pointerId,x:event.clientX,y:event.clientY};}return;}
      if(!look||look.id!==event.pointerId)return;
      if(kind==='move'){lookX+=event.clientX-look.x;lookY+=event.clientY-look.y;look={...look,x:event.clientX,y:event.clientY};return;}
      look=null;
    };
    window.addEventListener('keydown',walkKeyDown);window.addEventListener('keyup',walkKeyUp);window.addEventListener('blur',clearWalkInput);
    const walkHidden=()=>{if(document.hidden)clearWalkInput();};document.addEventListener('visibilitychange',walkHidden);
    teardown.push(()=>{window.removeEventListener('keydown',walkKeyDown);window.removeEventListener('keyup',walkKeyUp);window.removeEventListener('blur',clearWalkInput);document.removeEventListener('visibilitychange',walkHidden);if(walkActive){walkActive=false;walkState=null;controls.enabled=true;setWalking(false);}element.dataset.walkActive='false';element.dataset.walkPose='';walkControl.current=null;});
    walkControl.current={enter:enterWalk,exit:exitWalk,axes:(f,s)=>{padForward=f;padStrafe=s;},eye:step=>{eyePress=Math.max(-20,Math.min(20,eyePress+step));}};element.dataset.walkActive='false';
    const keyboard = (event: KeyboardEvent) => {
      if(walkActive)return;
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
    }; renderer.domElement.addEventListener('keydown', keyboard);teardown.push(()=>renderer.domElement.removeEventListener('keydown',keyboard));
    const pointerDown=(event:PointerEvent)=>{if(walkActive){walkPointer('down',event);return;}if(disposed||transform?.dispatch('down',event))return;gesture.begin(event.pointerId,[event.clientX,event.clientY],tag(),event.target===renderer.domElement&&event.button===0&&!lost&&!recovery.active&&sceneState==='current'&&element.dataset.renderedGeneration===String(store.getSnapshot().localGeneration));};
    const pointerMove=(event:PointerEvent)=>{if(walkActive){walkPointer('move',event);return;}if(!transform?.dispatch('move',event))gesture.move(event.pointerId,[event.clientX,event.clientY]);};
    const pointerEnd=(event:PointerEvent)=>{if(walkActive){walkPointer('up',event);return;}if(disposed||transform?.dispatch('up',event))return;const accepted=gesture.end(event.pointerId,[event.clientX,event.clientY],tag());if(!accepted||lost||recovery.active||sceneState!=='current'||generation!==store.getSnapshot().localGeneration)return;
      const rect=renderer.domElement.getBoundingClientRect();if(!rect.width||!rect.height||event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)return;
      const raycaster=new THREE.Raycaster();raycaster.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),camera);
      const picked=pickRay(raycaster,adapter.group,store.getSnapshot().document,adapter.hiddenFloors);pickCallback.current?.(picked,false);if(picked)onMessage(message(language.current,'threeSelected',{kind:message(language.current,picked.kind==='furniture'?'pickFurniture':picked.kind==='wall'?'pickWall':picked.kind==='opening'?'pickOpening':'pickRoom')}));
    };
    const pointerCancel=()=>gesture.cancel();const pointerCancelled=(event:PointerEvent)=>{if(walkActive){walkPointer('cancel',event);return;}if(transform?.dispatch('cancel',event))return;gesture.cancel();gesture.end(event.pointerId,[event.clientX,event.clientY],tag());};document.addEventListener('pointerdown',pointerDown,true);document.addEventListener('pointermove',pointerMove,true);document.addEventListener('pointerup',pointerEnd,true);document.addEventListener('pointercancel',pointerCancelled,true);window.addEventListener('blur',pointerCancel);window.addEventListener('scroll',pointerCancel,true);document.addEventListener('visibilitychange',pointerCancel);
    teardown.push(()=>{document.removeEventListener('pointerdown',pointerDown,true);document.removeEventListener('pointermove',pointerMove,true);document.removeEventListener('pointerup',pointerEnd,true);document.removeEventListener('pointercancel',pointerCancelled,true);window.removeEventListener('blur',pointerCancel);window.removeEventListener('scroll',pointerCancel,true);document.removeEventListener('visibilitychange',pointerCancel);});
    const observeModels=()=>{models?.observe(store.getSnapshot().document,store.asyncTag().sessionId);setModelStatus(models?.getSnapshot()??[]);};
    observeModels();teardown.push(store.subscribe(observeModels));
    const worker=new Worker(new URL('./mesh.worker.ts',import.meta.url),{type:'module'});
    let pipelineOwnsWorker=false;teardown.push(()=>{if(!pipelineOwnsWorker){worker.onmessage=null;worker.onerror=null;worker.terminate();}});
    const pipeline = new ScenePipeline(store, worker, {
      pending: () => {if(disposed)return;transform?.cancel();gesture.cancel();outline.group.visible=false;setSelectionAdvisory(null);element.dataset.furnitureOverlap='false';sceneState='pending';syncGhost();element.dataset.sceneState=sceneState;setCeilingWarnings([]);adapter.group.visible = false; element.dataset.renderedGeneration = ''; setStatus('updating3d'); pendingCallback.current?.(); invalidate(); },
      ready: result => {
        if(disposed)return;try{
        bundle = result;appliedDocument=store.getSnapshot().document; sceneState='current';appliedTag=JSON.stringify(store.asyncTag());generation=store.getSnapshot().localGeneration;element.dataset.sceneState=sceneState;element.dataset.invalidation=JSON.stringify(result.invalidation??null);adapter.setLowWalls(pipelineRef.current?.lowWallsMm);adapter.apply(result, store.getSnapshot().document);setModelStatus(models?.getSnapshot()??[]);element.dataset.modelResources=JSON.stringify(models?.resourceStats??null);element.dataset.modelAttached=JSON.stringify(models?.renderingStats.ids??[]);element.dataset.modelScene=JSON.stringify(models?.renderingStats??null);setCeilingWarnings(result.ceilingWarnings??[]);element.dataset.ceilingCount=String(result.meshes.filter(m=>m.category==='ceiling').length);element.dataset.structureMeshes=JSON.stringify(result.meshes.filter(m=>m.category==='stair'||m.category==='roof').map(m=>m.id).sort()); adapter.group.visible = true; generation = store.getSnapshot().localGeneration;updateLights();const placement=sunPlacement(bundle.bounds,store.getSnapshot().document.floors[0]!.elevation/1000);sun.position.fromArray(placement.position);sun.target.position.fromArray(placement.target);sun.shadow.camera.left=-placement.coverage;sun.shadow.camera.right=placement.coverage;sun.shadow.camera.top=placement.coverage;sun.shadow.camera.bottom=-placement.coverage;sun.shadow.camera.updateProjectionMatrix();element.dataset.shadowCoverage=placement.partial?'central':'full';
        element.dataset.meshChanges = JSON.stringify(adapter.lastChanges); element.dataset.vertexCount = String(result.stats.vertices);
        element.dataset.meshesBuilt = String(result.stats.meshesBuilt);
        if(first){first=false;if(initialPose){applyPose(initialPose);controls.update();guard();}else fit.current();}
        guard();selectOutline();syncGhost();element.dataset.resourceStats=JSON.stringify(adapter.resourceStats);if (!lost&&!recovery.active){setStatus(null);onMessage(message(language.current,'threeReady'));} invalidate();
        }catch{fallback();}
      },
      failed: reason => {if(disposed)return;transform?.cancel();gesture.cancel();outline.group.visible=false;setSelectionAdvisory(null);element.dataset.furnitureOverlap='false';sceneState=bundle?'stale':'failed';syncGhost();element.dataset.sceneState=sceneState;element.dataset.renderedGeneration='';element.dataset.previousGeneration=bundle?String(generation):'';adapter.group.visible=!!bundle;setStatus(bundle?'threePrevious':'threeFailed');onMessage(message(language.current,bundle?'threePrevious':'threeFailed'));problemCallback.current?.(reason);invalidate();},
    },lowWallsRef.current?LOW_WALL_MM:undefined);
    pipelineRef.current=pipeline;pipelineOwnsWorker=true;teardown.push(()=>{pipelineRef.current=null;pipeline.dispose();});if(disposed){pipeline.dispose();return cleanup;}
    transform=new FurniturePointer(store,renderer.domElement,camera,controls,{
      eligible:()=>!disposed&&!lost&&!recovery.active&&sceneState==='current'&&generation===store.getSnapshot().localGeneration&&appliedTag===JSON.stringify(store.asyncTag())&&(transform?.active||element.dataset.renderedGeneration===String(generation)),
      selected:()=>selectedRef.current?.kind==='furniture'?selectedRef.current.id:undefined,
      start:()=>{gesture.cancel();editStartRef.current?.();},
      hit:client=>{const r=renderer.domElement.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((client[0]-r.left)/r.width*2-1,1-(client[1]-r.top)/r.height*2),camera);return furnitureRayHit(ray,adapter.group,store.getSnapshot().document,adapter.hiddenFloors);},
      preview:result=>{previewDocument=result?.document??null;const document=previewDocument??appliedDocument;if(document){adapter.refreshFurniture(document);updateLights(document);}element.dataset.furniturePreview=JSON.stringify(previewDocument?.furniture.find(f=>f.id===selectedRef.current?.id)??null);element.dataset.modelScene=JSON.stringify(models?.renderingStats??null);selectOutline();invalidate();},
      status:(phase,errors)=>{syncGhost();element.dataset.furnitureGesture=phase;if(phase!=='idle'){element.dataset.renderedGeneration='';onMessage(message(language.current,phase==='invalid'?'furnitureValuesInvalid':'furniture3dHelp'));if(errors?.[0])onMessage(editError(language.current,errors[0]));}invalidate();},
      committed:result=>onMessage(result.ok?message(language.current,result.changed?'furnitureApplied':'furnitureUnchanged'):editError(language.current,result.errors[0])),failed:fallback,
    });transformRef.current=transform;transform.setMode(modeRef.current,freeRef.current);teardown.push(()=>{transform?.dispose();transform=undefined;});
    const animate = () => {
      if (disposed) return; frame = requestAnimationFrame(animate);
      try{
        if(walkActive)walkFrame();else{transform?.tick();if(!transform?.active){controls.update();guard();}}
        if(!lost&&needsRender){
          if(renderer.getContext().isContextLost()){contextLost(new Event('webglcontextlost',{cancelable:true}));return;}
          renderer.render(scene,camera);shaderTextures.sample();
          if(renderer.getContext().isContextLost()){contextLost(new Event('webglcontextlost',{cancelable:true}));return;}
          needsRender=false;
          const current=!transform?.active&&adapter.group.visible&&sceneState==='current'&&generation===store.getSnapshot().localGeneration;
          if(current&&recovery.drawn(generation,store.getSnapshot().localGeneration)&&!disposed){
            if(element.dataset.contextState==='restoring')element.dataset.contextState='restored';
            element.dataset.renderedGeneration=String(generation);setStatus(null);
            frameCallback.current?.({at:performance.now(),generation,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,renderer:gpuRenderer,graphicsVersion});
          }
          if(disposed)return;
          element.dataset.drawCalls=current?String(renderer.info.render.calls):'';
          element.dataset.gpuMemory=JSON.stringify(renderer.info.memory);publishTextures();
        }
      }catch{fallback();}
    };
    apiCallback.current?.({
      pose:()=>({position:camera.position.toArray() as CameraPose['position'],target:controls.target.toArray() as CameraPose['target']}),
      restore:p=>{
        transform?.cancel();if(disposed||lost||recovery.active||sceneState!=='current')throw new Error('camera-unavailable');
        const checked=clampOrbit(p,bundle?.bounds??null,store.getSnapshot().document.floors[0]!.elevation/1000);
        if(p.position.some((v,i)=>Math.abs(v-checked.position[i]!)>BOOKMARK_TOLERANCE)||p.target.some((v,i)=>Math.abs(v-checked.target[i]!)>BOOKMARK_TOLERANCE))throw new Error('camera-bookmark');
        applyPose(checked);controls.update();guard();invalidate();
      },
      reset:()=>{transform?.cancel();if(disposed||lost||recovery.active)throw new Error('camera-unavailable');fit.current();},
      focus:id=>{
        transform?.cancel();if(disposed||lost||recovery.active||sceneState!=='current')throw new Error('camera-unavailable');
        const selected=new THREE.Box3(),opening=openingBounds(store.getSnapshot().document,id);
        if(opening)selected.set(new THREE.Vector3(opening[0],opening[1],opening[2]),new THREE.Vector3(opening[3],opening[4],opening[5]));
        adapter.group.traverse(o=>{if(o instanceof THREE.Mesh&&o.userData.entityId===id)selected.union(new THREE.Box3().setFromObject(o));});
        if(selected.isEmpty()){
          const f=store.getSnapshot().document.furniture.find(f=>f.id===id);
          if(f){const p=new THREE.Vector3(f.position.x/1000,((store.getSnapshot().document.floors.find(floor=>floor.id===f.floorId)??store.getSnapshot().document.floors[0]!).elevation+f.elevation+f.size.h/2)/1000,f.position.y/1000);selected.setFromCenterAndSize(p,new THREE.Vector3(Math.hypot(f.size.w,f.size.d)/1000,f.size.h/1000,Math.hypot(f.size.w,f.size.d)/1000));}
        }
        if(selected.isEmpty())throw new Error('camera-selection');
        const b:Bounds3=[selected.min.x,selected.min.y,selected.min.z,selected.max.x,selected.max.y,selected.max.z],fitted=fitPose(b,camera.aspect);
        applyPose(fitted.pose);controls.update();guard();invalidate();if(fitted.capped)onMessage(message(language.current,'cameraFitCapped'));
      },
      capture:(edge,copy)=>{
        if(transform?.active||disposed||lost||recovery.active||sceneState!=='current'||generation!==store.getSnapshot().localGeneration||!bundle||!bundle.meshes.length&&!store.getSnapshot().document.furniture.length)throw new Error('capture-unavailable');
        const aspect=camera.aspect,width=aspect>=1?edge:Math.max(1,Math.round(edge*aspect)),height=aspect>=1?Math.max(1,Math.round(edge/aspect)):edge;
        const selectionVisible=outline.group.visible,ghostVisible=ghost.group.visible;outline.group.visible=false;ghost.group.visible=false;
        try{return captureFrame(renderer,scene,camera,width,height,generation,tier,gpu,copy);}
        catch(e){if(e instanceof Error&&e.message==='capture-restore')fallback();throw e;}
        finally{if(!disposed){outline.group.visible=selectionVisible;ghost.group.visible=ghostVisible;}invalidate();}
      },
    });
    animate();
    return cleanup;
    }catch{fallback();return cleanup;}
  }, [store, onMessage,quality,assetSource]);
  useLayoutEffect(()=>{lightingUpdate.current();},[lighting,nightLights]);
  useEffect(()=>{transformRef.current?.tick();selectionUpdate.current();if(!editablePick){transformRef.current?.setMode('orbit',freeRef.current);setFurnitureMode('orbit');}},[selectedPick,editablePick]);
  useEffect(()=>{clipRef.current();},[activeFloorId,showAbove]);
  useEffect(()=>{walkControl.current?.exit();},[activeFloorId]); // walking always starts again on the floor being edited
  useEffect(()=>{transformRef.current?.setMode(furnitureMode,freeTransform);},[furnitureMode,freeTransform]);
  useEffect(()=>{ghostUpdate.current();},[placementPreview]);
  useEffect(()=>{try{localStorage.setItem(LOW_WALLS_KEY,lowWalls?'1':'0');}catch{/* the choice lasts for this view only */}},[lowWalls]);
  useEffect(()=>{if(host.current)host.current.dataset.lowWalls=String(lowWalls);if(!walking)pipelineRef.current?.setLowWalls(lowWalls?LOW_WALL_MM:undefined);},[lowWalls,walking]);
  useEffect(()=>{adapterRef.current?.setCeilingsVisible(ceilings);if(host.current)host.current.dataset.ceilingsVisible=String(ceilings);invalidateRef.current();},[ceilings]);
  useEffect(() => { fit.current(); }, [fitRequest]);
  useEffect(() => { host.current?.querySelector('canvas')?.setAttribute('aria-label', message(locale, 'canvas3d')); }, [locale]);
  useEffect(() => { if (orbit.current){transformRef.current?.cancel();orbit.current.autoRotate = autoOrbit;} }, [autoOrbit]);
  const moveStick=(event:React.PointerEvent<HTMLDivElement>)=>{
    const rect=event.currentTarget.getBoundingClientRect();let dx=(event.clientX-(rect.left+rect.width/2))/(rect.width/2),dy=(event.clientY-(rect.top+rect.height/2))/(rect.height/2);
    const length=Math.hypot(dx,dy);if(length>1){dx/=length;dy/=length;}setKnob([dx,dy]);
    walkControl.current?.axes(length<0.15?0:-dy,length<0.15?0:dx);
  };
  const releaseStick=(event:React.PointerEvent<HTMLDivElement>)=>{if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);walkControl.current?.axes(0,0);setKnob([0,0]);};
  const modelPages=Math.max(1,Math.ceil(modelStatus.length/20)),currentModelPage=Math.min(modelPage,modelPages-1);
  return <div className="plan-canvas three-canvas" ref={host} data-testid="three-view">
    <div className="three-mount" ref={mount} />
    {!walking&&<div className="furniture-three-tools" role="group" aria-label={message(locale,'furniture3dTools')}><button type="button" className="three-tool walk-button" data-testid="walk-enter" onClick={()=>{const result=walkControl.current?.enter()??'unavailable';onMessage(message(locale,result==='ok'?'walkStarted':result==='empty'?'walkNeedsRoom':'walkUnavailable'));}}>{toolIcon('walk')}<span>{message(locale,'walkEnter')}</span></button>
      {/* D79: the furniture tools appear only while a piece can be moved, as compact icon buttons with their full names for screen readers. */}
      {(editablePick||furnitureMode!=='orbit')&&<>{(['orbit','move','rotate'] as const).map(mode=>{const label=message(locale,mode==='orbit'?'furniture3dOrbit':mode==='move'?'furniture3dMove':'furniture3dRotate');return <button type="button" className="three-tool" key={mode} disabled={mode!=='orbit'&&!editablePick} aria-pressed={furnitureMode===mode} aria-label={label} title={label} onClick={()=>{transformRef.current?.setMode(mode,freeTransform);setFurnitureMode(mode);}}>{toolIcon(mode)}</button>;})}<label className="free-toggle" title={message(locale,'furniture3dFree')}><input type="checkbox" aria-label={message(locale,'furniture3dFree')} checked={freeTransform} onChange={e=>{transformRef.current?.setMode(furnitureMode,e.target.checked);setFreeTransform(e.target.checked);}}/><span aria-hidden="true">{message(locale,'furniture3dFreeShort')}</span></label></>}
      {groupedPick&&<p role="status" data-testid="group-3d-together">{message(locale,'group3dTogether')}</p>}{selectionAdvisory&&<FurnitureWarning advisory={selectionAdvisory} locale={locale}/>}</div>}
    {downgraded&&<p className="three-status" role="status">{message(locale,'qualityLowered')}</p>}
    {status && <div className="three-status" role="status">{message(locale, status)}</div>}
    {walking&&<div className="walk-tools" role="group" aria-label={message(locale,'walkTools')}>
      <button type="button" className="walk-exit" data-testid="walk-exit" onClick={()=>{walkControl.current?.exit();setKnob([0,0]);onMessage(message(locale,'walkEnded'));}}>{message(locale,'walkExit')}</button>
      <button type="button" aria-label={message(locale,'walkEyeUp')} onClick={()=>walkControl.current?.eye(1)}>{message(locale,'walkEyeUp')}</button>
      <button type="button" aria-label={message(locale,'walkEyeDown')} onClick={()=>walkControl.current?.eye(-1)}>{message(locale,'walkEyeDown')}</button>
      <div className="walk-joystick" data-testid="walk-joystick" role="application" aria-label={message(locale,'walkJoystick')}
        onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);moveStick(e);}}
        onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))moveStick(e);}}
        onPointerUp={e=>{releaseStick(e);}} onPointerCancel={e=>{releaseStick(e);}} onLostPointerCapture={()=>{walkControl.current?.axes(0,0);setKnob([0,0]);}}>
        <span className="walk-knob" style={{transform:`translate(${knob[0]*28}px,${knob[1]*28}px)`}} />
      </div>
      <p className="walk-hint" role="status">{message(locale,'walkHint')}</p>
    </div>}
    <div className="three-toggles">{lighting==='night'&&<label className="snap-toggle"><input type="checkbox" checked={nightLights} onChange={e=>setNightLights(e.target.checked)}/>{message(locale,'nightLights')}</label>}<label className="low-walls-toggle snap-toggle"><input type="checkbox" checked={lowWalls} onChange={e=>setLowWalls(e.target.checked)}/>{message(locale,'lowWalls')}</label><label className="ceiling-toggle snap-toggle"><input type="checkbox" checked={ceilings} onChange={e=>setCeilings(e.target.checked)}/>{message(locale,'showCeilings')}</label>{floorCount>1&&<label className="upper-floors-toggle snap-toggle"><input type="checkbox" checked={showAbove} onChange={e=>setShowAbove(e.target.checked)}/>{message(locale,'showUpperFloors')}</label>}</div>
    {ceilingWarnings.length>0&&<div className="ceiling-warnings" role="status" tabIndex={0} aria-label={message(locale,'ceilingWarningDetails')}>{ceilingWarnings.map(w=><p key={w.roomIds.join(':')}>{message(locale,'ceilingHeightsDiffer',{a:store.getSnapshot().document.rooms.find(r=>r.id===w.roomIds[0])?.name??w.roomIds[0],b:store.getSnapshot().document.rooms.find(r=>r.id===w.roomIds[1])?.name??w.roomIds[1],ha:w.heightsMm[0],hb:w.heightsMm[1]})}</p>)}</div>}
    {modelStatus.length>0&&<details className={modelStatus.every(m=>m.phase==='ready'&&!m.sizeMismatch&&!m.unsupportedFinish)?'furniture-models all-ready':'furniture-models'}><summary>{message(locale,'furnitureModels')}</summary><ul>{modelStatus.slice(currentModelPage*20,(currentModelPage+1)*20).map((m,i)=><li key={m.id} data-model-id={m.id} data-model-phase={m.phase}>{message(locale,'furnitureModelNumber',{n:currentModelPage*20+i+1})}: {message(locale,m.sizeMismatch?'furnitureModelSize':m.unsupportedFinish?'furnitureModelFinish':m.phase==='ready'?'furnitureModelReady':m.phase==='error'?'furnitureModelFailed':'furnitureModelLoading')}{m.phase==='loading'&&m.total?` ${Math.min(100,Math.floor(m.received/m.total*100))}%`:''}{m.retryable&&<button onClick={()=>retryModel.current(m.id)}>{message(locale,'furnitureModelRetry')}</button>}</li>)}</ul>{modelPages>1&&<nav aria-label={message(locale,'furnitureModelPages')}><button disabled={currentModelPage===0} onClick={()=>setModelPage(currentModelPage-1)}>{message(locale,'catalogPrevious')}</button><span>{message(locale,'catalogPage',{page:currentModelPage+1,pages:modelPages})}</span><button disabled={currentModelPage===modelPages-1} onClick={()=>setModelPage(currentModelPage+1)}>{message(locale,'catalogNext')}</button></nav>}</details>}
    <div className="canvas-hint">{message(locale, 'threeHint')}</div>
  </div>;
}
