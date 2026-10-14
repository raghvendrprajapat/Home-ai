import { useEffect, useMemo, useRef, useState } from 'react';
import type { ProjectStore, PreviewResult } from '@gharplan/core-model';
import { areaDisplay, editError, message } from '../i18n/messages';
import type { Locale } from '../i18n/messages';
import type Konva from 'konva';
import { fitView, junctionMoves, screenToWorld, worldToScreen, zoomAt } from './view2d';
import { PlanGestures } from './gestures';
import type { GestureStep, DragMotion } from './gestures';
import { PickIndex, PickCycle } from './hit-test';
import type { Pick } from './hit-test';
import { TouchLoupe } from './TouchLoupe';
import { resolveSnap, snapGridStep } from './snapping';
import type { SnapTarget } from './snapping';
import { formatLength } from './measurements';
import { openingSymbol } from './opening-symbol';
import type { PrecisionPreview } from './WallPrecision';
import type { DrawingTool } from './drawing-tools';
import type { Point2, Viewport } from './view2d';

type Snapshot = ReturnType<ProjectStore['getSnapshot']>;
interface Props { store: ProjectStore; snapshot: Snapshot; selected: string; onSelect(id: string): void; onMessage(text: string): void; zoomRequest: number; showGrid: boolean; locale?: Locale; drawing?: DrawingTool; precisionPreview?:PrecisionPreview|null; onEditStart?():void; onPick?(pick:Pick|null,additive?:boolean):void; selection?:readonly Pick[]; multiple?:boolean; onBoxSelect?(picks:readonly Pick[],additive:boolean):void; onTiming?: (kind: 'preview' | 'command', durationMs: number) => void }
interface Drag { pointerId: number; junction: string; generation: number; start: Point2; last: Point2; snapTarget?: string; touch: boolean; store: ProjectStore }
export function PlanCanvas({ store, snapshot, selected, onSelect, onMessage, zoomRequest, showGrid, onTiming, drawing, precisionPreview, onEditStart, onPick, selection, multiple=false, onBoxSelect, locale = 'en' }: Props) {
  const language = useRef(locale); language.current = locale;
  const host = useRef<HTMLDivElement>(null), mount = useRef<HTMLDivElement>(null), stage = useRef<Konva.Stage | null>(null), drawingLayer = useRef<Konva.Layer | null>(null), library = useRef<typeof Konva | null>(null);
  const boxDrag=useRef<{id:number;start:Point2;last:Point2;generation:number;additive:boolean}|null>(null),[boxPreview,setBoxPreview]=useState<{a:Point2;b:Point2}|null>(null);
  const drag = useRef<Drag | null>(null), gestures = useRef(new PlanGestures()), cycle = useRef(new PickCycle());
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null), frame = useRef<number | null>(null), latestMotion = useRef<{motion:DragMotion;shift:boolean}|null>(null);
  const panKey = useRef(false);
  const lastSnap=useRef<SnapTarget|null>(null),[snapTarget,setSnapTarget]=useState<SnapTarget|null>(null);
  const snapFrame=useRef<number|null>(null),pendingSnap=useRef<SnapTarget|null>(null);
  const snapAt=(raw:Point2,origin:Point2|null,orthogonal:boolean,disabled:boolean,excludeId?:string):Point2=>{
    const result=resolveSnap(activeStore.current.getSnapshot().document,raw,viewRef.current,{origin,orthogonal,disabled:disabled||toolRef.current?.getSnapshot().snappingEnabled===false,previous:lastSnap.current,...(excludeId?{excludeId}:{})});lastSnap.current=result.target;pendingSnap.current=result.target;if(snapFrame.current===null)snapFrame.current=requestAnimationFrame(()=>{snapFrame.current=null;setSnapTarget(pendingSnap.current);});return result.point;
  };
  const activeStore = useRef(store); activeStore.current = store;
  const toolRef=useRef(drawing);toolRef.current=drawing;
  const toolPointer=useRef<{id:number;point:Point2;world:Point2;generation:number;epoch:number}|null>(null),toolFrame=useRef<number|null>(null);
  const [toolState,setToolState]=useState(()=>drawing?.getSnapshot());
  useEffect(()=>{if(!drawing)return;setToolState(drawing.getSnapshot());return drawing.subscribe(()=>setToolState(drawing.getSnapshot()));},[drawing]);
  const index = useMemo(() => new PickIndex(snapshot), [snapshot]);
  const [picked, setPicked] = useState<Pick | null>(null), [loupe,setLoupe] = useState<{point:Point2;world:Point2}|null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 }), [view, setView] = useState<Viewport>({ x: 0, y: 0, scale: 0.06 });
  const viewRef = useRef(view); viewRef.current = view;
  const changeView = (next:Viewport) => { if(next.x===viewRef.current.x&&next.y===viewRef.current.y&&next.scale===viewRef.current.scale)return;viewRef.current=next;setView(next);cycle.current.clear(); };
  const [preview, setPreview] = useState<PreviewResult | null>(null), [ready, setReady] = useState(false);
  const localPoint = (event: { clientX: number; clientY: number }): Point2 => {
    const rect = host.current!.getBoundingClientRect(); return [event.clientX - rect.left, event.clientY - rect.top];
  };
  const resetSnap=()=>{if(snapFrame.current!==null)cancelAnimationFrame(snapFrame.current);snapFrame.current=null;pendingSnap.current=null;lastSnap.current=null;setSnapTarget(null);};
  const clearEdit = () => {
    if(holdTimer.current!==null)clearTimeout(holdTimer.current);holdTimer.current=null;
    if(frame.current!==null)cancelAnimationFrame(frame.current);frame.current=null;latestMotion.current=null;
    boxDrag.current=null;setBoxPreview(null);drag.current=null;setPreview(null);setLoupe(null);
    resetSnap();
    if(toolFrame.current!==null)cancelAnimationFrame(toolFrame.current);toolFrame.current=null;toolPointer.current=null;
  };
  const cancel = () => {
    const owned=[...gestures.current.ids(),...(boxDrag.current?[boxDrag.current.id]:[])];
    gestures.current.cancel();clearEdit();cycle.current.clear();
    toolRef.current?.clear();
    for(const id of owned)if(host.current?.hasPointerCapture(id))host.current.releasePointerCapture(id);
  };
  useEffect(()=>{if(gestures.current.phase!=='idle'||boxDrag.current)cancel();else resetSnap();},[toolState?.mode]);
  useEffect(()=>{if(gestures.current.phase!=='idle'||boxDrag.current)cancel();else resetSnap();},[toolState?.snappingEnabled]);
  useEffect(()=>{cancel();},[multiple]);
  useEffect(()=>{if(precisionPreview)cancel();},[precisionPreview]);
  const targetFor = (motion:DragMotion,shift:boolean):Point2|null => {
    const d=drag.current;if(!d||d.pointerId!==motion.pointerId)return null;
    const current=d.store.getSnapshot();
    if(d.store!==activeStore.current||current.localGeneration!==d.generation){cancel();onMessage(message(language.current,'dragRetry'));return null;}
    const raw:Point2=[d.start[0]+motion.delta[0]/viewRef.current.scale,d.start[1]+motion.delta[1]/viewRef.current.scale];
    const target=raw[0]===d.start[0]&&raw[1]===d.start[1]?d.start:snapAt(raw,null,false,shift,d.junction);d.last=target;
    if(d.touch)setLoupe({point:motion.point,world:target});return target;
  };
  const previewMotion = (motion:DragMotion,shift:boolean) => {
    const to=targetFor(motion,shift),d=drag.current;if(!to||!d)return;
    if(to[0]===d.start[0]&&to[1]===d.start[1]){setPreview(null);return;}
    const current=d.store.getSnapshot(),started=performance.now();
    const result=d.store.preview({id:'drag_preview',baseGeneration:d.generation,type:'MoveJunctions',moves:junctionMoves(current.document,d.junction,to)});setPreview(result);
    onTiming?.('preview',performance.now()-started);if(!result.ok)onMessage(editError(language.current,result.errors[0]));
  };
  const schedule = (motion:DragMotion,shift:boolean) => {
    latestMotion.current={motion,shift};if(frame.current!==null)return;
    frame.current=requestAnimationFrame(()=>{frame.current=null;const next=latestMotion.current;latestMotion.current=null;if(next)previewMotion(next.motion,next.shift);});
  };
  const applyStep = (step:GestureStep,shift=false) => {
    if(step.cancelEdit){clearEdit();if(step.phase==='pinch'||step.phase==='blocked')toolRef.current?.clear();}if(step.view&&!toolPointer.current)changeView(step.view);if(step.drag)schedule(step.drag,shift);
  };
  useEffect(() => {
    const element = host.current!;
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight }); measure();
    if (typeof ResizeObserver === 'undefined') { window.addEventListener('resize', measure); return () => window.removeEventListener('resize', measure); }
    const observer = new ResizeObserver(measure); observer.observe(element); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!size.width || !size.height) return;
    let disposed = false;
    setReady(false);
    void import('konva').then(({ default: K }) => {
      if (disposed || !mount.current) return;
      K.pixelRatio = Math.min(window.devicePixelRatio || 1, 2); library.current = K;
      stage.current = new K.Stage({ container: mount.current, width: size.width, height: size.height });drawingLayer.current=new K.Layer({listening:false});stage.current.add(drawingLayer.current);setReady(true);
    }).catch(() => onMessage(message(language.current, 'drawingLoadFailed')));
    return () => { disposed = true; stage.current?.destroy(); stage.current = null;drawingLayer.current=null; };
  }, [size.width, size.height, onMessage]);
  useEffect(() => {
    if (gestures.current.phase!=='idle'||boxDrag.current) cancel();
    if (size.width && size.height) changeView(fitView(snapshot.document, size.width, size.height));
    // Fit only on viewport resizing / explicit fit; edits must not jump the camera.
  }, [size.width, size.height, zoomRequest]);
  useEffect(() => {
    cancel();gestures.current.clear();setPicked(null);
    return () => { cancel();gestures.current.clear(); };
  }, [store]);
  useEffect(() => {
    if(boxDrag.current&&boxDrag.current.generation!==snapshot.localGeneration)cancel();
    if (drag.current && drag.current.generation !== snapshot.localGeneration) { cancel(); onMessage(message(language.current, 'dragChanged')); }
    cycle.current.clear();
    resetSnap();
  }, [snapshot.localGeneration, onMessage]);
  useEffect(()=>{
    const fields={junction:'junctions',opening:'openings',furniture:'furniture',wall:'walls',room:'rooms'} as const;
    if(picked&&!snapshot.document[fields[picked.kind]].some(entity=>entity.id===picked.id))setPicked(null);
  },[snapshot,picked]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if(event.key==='Escape'){cancel();return;}
      if(document.activeElement!==host.current)return;
      if(event.code==='Space'){event.preventDefault();panKey.current=true;return;}
      if(gestures.current.phase!=='idle'||boxDrag.current)return;
      const v=viewRef.current;
      const arrows:Record<string,Point2>={ArrowLeft:[50,0],ArrowRight:[-50,0],ArrowUp:[0,50],ArrowDown:[0,-50]};
      if(arrows[event.key]){event.preventDefault();const d=arrows[event.key]!;changeView({...v,x:v.x+d[0],y:v.y+d[1]});}
      else if(['+','=','-'].includes(event.key)){event.preventDefault();changeView(zoomAt(v,[host.current!.clientWidth/2,host.current!.clientHeight/2],event.key==='-'?0.8:1.25));}
    };
    const releaseSpace=(event:KeyboardEvent)=>{if(event.code==='Space')panKey.current=false;};
    const blurred=()=>{panKey.current=false;cancel();gestures.current.clear();};
    const hidden=()=>{if(document.hidden)blurred();};
    const outsideEnd = (event:PointerEvent) => {
      if(gestures.current.has(event.pointerId)&&!host.current?.contains(event.target as Node)){gestures.current.cancel();gestures.current.end(event.pointerId,[event.clientX,event.clientY],performance.now());clearEdit();}
    };
    const outsideTouch = (event:PointerEvent) => {if(event.pointerType==='touch'&&(gestures.current.phase!=='idle'||boxDrag.current)&&!host.current?.contains(event.target as Node)){cancel();gestures.current.begin(event.pointerId,true,localPoint(event),viewRef.current,false,performance.now());}};
    const scrolled=()=>{if(gestures.current.phase!=='idle'||boxDrag.current)cancel();};
    document.addEventListener('visibilitychange',hidden);window.addEventListener('blur',blurred);window.addEventListener('keyup',releaseSpace);window.addEventListener('scroll',scrolled,true);window.addEventListener('keydown',escape);window.addEventListener('pointerup',outsideEnd);window.addEventListener('pointercancel',outsideEnd);window.addEventListener('pointerdown',outsideTouch);
    return()=>{document.removeEventListener('visibilitychange',hidden);window.removeEventListener('blur',blurred);window.removeEventListener('keyup',releaseSpace);window.removeEventListener('scroll',scrolled,true);window.removeEventListener('keydown',escape);window.removeEventListener('pointerup',outsideEnd);window.removeEventListener('pointercancel',outsideEnd);window.removeEventListener('pointerdown',outsideTouch);};
  }, []);
  useEffect(() => {
    const element = host.current!;
    const wheel = (event: WheelEvent) => {
      event.preventDefault(); if (gestures.current.phase!=='idle'||boxDrag.current) return;
      const point = localPoint(event); changeView(zoomAt(viewRef.current, point, Math.exp(-event.deltaY * 0.001)));
    };
    element.addEventListener('wheel', wheel, { passive: false }); return () => element.removeEventListener('wheel', wheel);
  }, []);
  useEffect(() => {
    const K = library.current, canvas = stage.current, layer=drawingLayer.current; if (!K || !canvas || !layer) return;
    // Keep the DOM canvas stable: removing a native touch target cancels its touch stream.
    layer.destroyChildren();
    if (showGrid) {
      const step=snapGridStep(view.scale),spacing=step*Math.pow(10,Math.max(0,Math.ceil(Math.log10(28/(step*view.scale)))));
      const [left, top] = screenToWorld([0, 0], view), [right, bottom] = screenToWorld([size.width, size.height], view);
      for (let x = Math.floor(left / spacing) * spacing; x <= right; x += spacing) {
        const sx = worldToScreen([x, 0], view)[0]; layer.add(new K.Line({ points: [sx, 0, sx, size.height], stroke: '#e4e9e5', strokeWidth: 1 }));
      }
      for (let y = Math.floor(top / spacing) * spacing; y <= bottom; y += spacing) {
        const sy = worldToScreen([0, y], view)[1]; layer.add(new K.Line({ points: [0, sy, size.width, sy], stroke: '#e4e9e5', strokeWidth: 1 }));
      }
    }
    const precision=precisionPreview?.projectId===snapshot.document.id&&precisionPreview.sessionId===snapshot.sessionId&&precisionPreview.generation===snapshot.localGeneration&&precisionPreview.result.ok?precisionPreview.result:null;
    const currentPreview = toolState?.preview?.ok ? toolState.preview : preview?.ok && drag.current?.generation === snapshot.localGeneration ? preview : precision;
    const document = currentPreview ? currentPreview.document : snapshot.document, derived = currentPreview ? currentPreview.derived : snapshot.derived;
    const labels: { x: number; y: number; width: number; text: string }[] = [];
    for (const [i, face] of derived.faces.entries()) {
      const room = document.rooms.find(r => r.id === face.roomId)!;
      for (const polygon of face.clearPolygons) layer.add(new K.Line({ points: polygon.flatMap(p => [...worldToScreen(p, view)]), closed: true, fill: picked?.kind==='room'&&picked.id===room.id?'#f5e5ce':i % 2 ? '#e9ede2' : '#e5efe9', stroke: '#c9dacf', strokeWidth: 1 }));
      const biggest = [...face.clearRects].sort((a, b) => (b[2] - b[0]) * (b[3] - b[1]) - (a[2] - a[0]) * (a[3] - a[1]))[0]!;
      const p = worldToScreen([(biggest[0] + biggest[2]) / 2, (biggest[1] + biggest[3]) / 2], view);
      const width = Math.min(140, (biggest[2] - biggest[0]) * view.scale - 12);
      const area = areaDisplay(face.clearAreaMm2, document.units);
      if (width >= 60) labels.push({ x: p[0] - width / 2, y: p[1] - 21, width, text: `${room.name}\n${area.value} ${area.unit}` });
    }
    for (const { rect: [x1, y1, x2, y2], ownerId } of derived.footprints) {
      const p = worldToScreen([x1, y1], view); layer.add(new K.Rect({ x: p[0], y: p[1], width: (x2 - x1) * view.scale, height: (y2 - y1) * view.scale, fill: (selection?selection.some(p=>p.kind==='wall'&&p.id===ownerId):picked?.kind==='wall'&&picked.id===ownerId)?'#b6723f':'#42534b' }));
    }
    for (const object of document.furniture) {
      const p = worldToScreen([object.position.x, object.position.y], view);
      layer.add(new K.Rect({ x: p[0], y: p[1], width: object.size.w * view.scale, height: object.size.d * view.scale, offsetX: object.size.w * view.scale / 2, offsetY: object.size.d * view.scale / 2, rotation: object.rotationDeg, fill: '#c8af90', stroke: (selection?selection.some(p=>p.kind==='furniture'&&p.id===object.id):picked?.kind==='furniture'&&picked.id===object.id)?'#b6723f':'#a38a6d', strokeWidth: 1, cornerRadius: 3 }));
    }
    for (const opening of document.openings) {
      const wall = document.walls.find(w => w.id === opening.wallId)!, a = document.junctions.find(j => j.id === wall.a)!, b = document.junctions.find(j => j.id === wall.b)!;
      const length = Math.abs(b.x - a.x) + Math.abs(b.y - a.y), dx = (b.x - a.x) / length, dy = (b.y - a.y) / length;
      const p = worldToScreen([a.x + dx * opening.offset, a.y + dy * opening.offset], view), rotation = Math.atan2(dy, dx) * 180 / Math.PI;
      layer.add(new K.Rect({ x: p[0], y: p[1], width: opening.width * view.scale, height: wall.thickness * view.scale + 2, offsetX: opening.width * view.scale / 2, offsetY: wall.thickness * view.scale / 2 + 1, rotation, fill: opening.kind === 'window' ? '#c5dfe6' : '#f7faf7', stroke: (selection?selection.some(p=>p.kind==='opening'&&p.id===opening.id):picked?.kind==='opening'&&picked.id===opening.id)?'#b6723f':opening.kind === 'window' ? '#5994a5' : '#668370', strokeWidth: 1 }));
    }
    for(const opening of document.openings)if(opening.kind==='door'){
      const symbol=openingSymbol(document,opening),hinge=worldToScreen(symbol.hinge,view),leaf=worldToScreen(symbol.leaf,view);
      layer.add(new K.Line({points:symbol.arc.flatMap(p=>[...worldToScreen(p,view)]),stroke:'#668370',strokeWidth:1,dash:[3,2]}));
      layer.add(new K.Line({points:[...hinge,...leaf],stroke:'#668370',strokeWidth:2}));
    }
    if(picked?.kind==='furniture'&&(!selection||selection.some(p=>p.kind==='furniture'&&p.id===picked.id))){
      const object=document.furniture.find(f=>f.id===picked.id);
      if(object){const p=worldToScreen([object.position.x,object.position.y],view);layer.add(new K.Rect({x:p[0],y:p[1],width:object.size.w*view.scale,height:object.size.d*view.scale,offsetX:object.size.w*view.scale/2,offsetY:object.size.d*view.scale/2,rotation:object.rotationDeg,stroke:'#b6723f',strokeWidth:3,dash:[5,3]}));}
    }
    for (const label of labels) {
      layer.add(new K.Rect({ x: label.x, y: label.y - 4, width: label.width, height: 49, fill: 'rgba(255,255,255,0.92)', cornerRadius: 6 }));
      layer.add(new K.Text({ ...label, align: 'center', fontFamily: 'system-ui', fontSize: 13, lineHeight: 1.6, fill: '#416052' }));
    }
    for (const j of document.junctions) {
      const p = worldToScreen([j.x, j.y], view); layer.add(new K.Circle({ x: p[0], y: p[1], radius: j.id === selected ? 7 : 5, fill: '#fff', stroke: j.id === selected ? '#b6723f' : '#6c8979', strokeWidth: 2 }));
    }
    for(const wall of document.walls){const a=document.junctions.find(j=>j.id===wall.a)!,b=document.junctions.find(j=>j.id===wall.b)!,length=Math.abs(b.x-a.x)+Math.abs(b.y-a.y);if(length*view.scale<80)continue;const middle=worldToScreen([(a.x+b.x)/2,(a.y+b.y)/2],view);if(middle[0]<0||middle[0]>size.width||middle[1]<0||middle[1]>size.height)continue;layer.add(new K.Text({x:middle[0]-42,y:middle[1]-24,text:formatLength(length,document.units),width:84,align:'center',fontSize:11,fontFamily:'system-ui',fill:'#34563f'}));}
    if(snapTarget){const p=worldToScreen(snapTarget.point,view);if(snapTarget.guide){const guide=snapTarget.guide;layer.add(new K.Line({points:guide.axis==='x'?[p[0],0,p[0],size.height]:[0,p[1],size.width,p[1]],stroke:'#3b8a94',strokeWidth:1,dash:[5,4]}));}layer.add(new K.Circle({x:p[0],y:p[1],radius:9,stroke:'#3b8a94',strokeWidth:2}));}
    if(toolState?.anchor&&toolState.end){const a=worldToScreen(toolState.anchor,view),b=worldToScreen(toolState.end,view);layer.add(new K.Line({points:toolState.mode==='rectangle'?[a[0],a[1],b[0],a[1],b[0],b[1],a[0],b[1],a[0],a[1]]:[...a,...b],stroke:toolState.error?'#b33d3d':'#b6723f',strokeWidth:3,dash:[7,4]}));}
    if(boxPreview)layer.add(new K.Rect({x:Math.min(boxPreview.a[0],boxPreview.b[0]),y:Math.min(boxPreview.a[1],boxPreview.b[1]),width:Math.abs(boxPreview.a[0]-boxPreview.b[0]),height:Math.abs(boxPreview.a[1]-boxPreview.b[1]),fill:'rgba(59,138,148,0.1)',stroke:'#3b8a94',strokeWidth:1,dash:[5,3]}));
    canvas.batchDraw();
  }, [ready, preview, snapshot, selected, view, size, showGrid, picked, locale, toolState, precisionPreview, snapTarget, selection, boxPreview]);
  return <div ref={host} className="plan-canvas" role="application" aria-label={message(locale, 'canvas2d')} tabIndex={0} data-testid="plan-canvas"
    data-view-x={view.x} data-view-y={view.y} data-view-scale={view.scale} data-picked-kind={picked?.kind} data-picked-id={picked?.id} data-snap-kind={snapTarget?.kind} data-selection-count={selection?.length??0}
    onPointerDown={event=>{
      if(event.button!==0&&event.button!==1)return;
      const point=localPoint(event),touch=event.pointerType==='touch',pick=index.picks(point,viewRef.current,touch)[0],now=performance.now();
      if(boxDrag.current)cancel();
      const drawingMode=toolRef.current?.getSnapshot().mode;
      if((!drawingMode||drawingMode==='select')&&!touch&&event.button===0&&!panKey.current&&(multiple||event.shiftKey)){
        onEditStart?.();boxDrag.current={id:event.pointerId,start:point,last:point,generation:snapshot.localGeneration,additive:event.shiftKey};setBoxPreview({a:point,b:point});event.currentTarget.focus({preventScroll:true});event.currentTarget.setPointerCapture(event.pointerId);return;
      }
      if(drawingMode&&drawingMode!=='select'&&event.button===0&&!panKey.current){
        onEditStart?.();
        const step=gestures.current.begin(event.pointerId,touch,point,viewRef.current,false,now);
        event.currentTarget.focus({preventScroll:true});event.currentTarget.setPointerCapture(event.pointerId);
        if(step.cancelEdit){applyStep(step);return;}
        const state=toolRef.current!.getSnapshot(),world=snapAt(screenToWorld(point,viewRef.current),state.anchor,drawingMode==='wall',event.shiftKey);
        toolPointer.current={id:event.pointerId,point,world,generation:snapshot.localGeneration,epoch:state.epoch};if(touch)setLoupe({point,world});return;
      }
      const canDrag=event.button===0&&!panKey.current&&!multiple&&!event.shiftKey&&pick?.kind==='junction';
      if(canDrag)onEditStart?.();
      const step=gestures.current.begin(event.pointerId,touch,point,viewRef.current,canDrag,now);
      event.currentTarget.focus({preventScroll:true});event.currentTarget.setPointerCapture(event.pointerId);applyStep(step);
      if(step.cancelEdit){onMessage(message(locale,'twoFingerCancel'));return;}
      if(pick?.kind==='junction'&&canDrag){
        const j=snapshot.document.junctions.find(j=>j.id===pick.id)!;
        onPick?.(pick,false);onSelect(j.id);setPicked(pick);drag.current={pointerId:event.pointerId,junction:j.id,generation:snapshot.localGeneration,start:[j.x,j.y],last:[j.x,j.y],touch,store};
        if(step.phase==='pending')holdTimer.current=setTimeout(()=>applyStep(gestures.current.hold(performance.now())),151);
        onMessage(message(locale,touch?'touchHold':'previewHelp'));
      }
    }}
    onPointerMove={event=>{
      if(boxDrag.current?.id===event.pointerId){const point=localPoint(event);boxDrag.current.last=point;setBoxPreview({a:boxDrag.current.start,b:point});return;}
      const point=localPoint(event),step=gestures.current.move(event.pointerId,point,performance.now()),tool=toolRef.current,mode=tool?.getSnapshot().mode;
      if(tool&&mode!=='select'&&gestures.current.phase!=='pinch'&&gestures.current.phase!=='blocked'&&!panKey.current){
        const state=tool.getSnapshot(),pointer=toolPointer.current,world=snapAt(screenToWorld(point,viewRef.current),state.anchor,mode==='wall',event.shiftKey);
        if(pointer&&(pointer.generation!==store.getSnapshot().localGeneration||pointer.epoch!==state.epoch)){cancel();return;}
        if(pointer&&mode==='rectangle'&&!state.anchor&&Math.hypot(point[0]-pointer.point[0],point[1]-pointer.point[1])>3)tool.start(pointer.world);
        if(event.pointerType==='touch'&&pointer)setLoupe({point,world});
        if(toolFrame.current!==null)cancelAnimationFrame(toolFrame.current);
        const epoch=state.epoch;toolFrame.current=requestAnimationFrame(()=>{toolFrame.current=null;if(tool.getSnapshot().epoch===epoch)tool.hover(world);});return;
      }
      applyStep(step,event.shiftKey);
    }}
    onPointerUp={event=>{
      const box=boxDrag.current;
      if(box?.id===event.pointerId){const point=localPoint(event);clearEdit();if(box.generation===store.getSnapshot().localGeneration){if(Math.hypot(point[0]-box.start[0],point[1]-box.start[1])>3)onBoxSelect?.(index.contained(screenToWorld(box.start,viewRef.current),screenToWorld(point,viewRef.current)),box.additive);else{const chosen=cycle.current.next(index.picks(point,viewRef.current,false),point,performance.now());setPicked(chosen);onPick?.(chosen,true);}}if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);return;}
      const point=localPoint(event),pointer=toolPointer.current,wasPhase=gestures.current.phase,step=gestures.current.end(event.pointerId,point,performance.now()),tool=toolRef.current;
      if(pointer&&pointer.id===event.pointerId&&tool&&wasPhase==='pan'){
        const state=tool.getSnapshot();if(pointer.generation===store.getSnapshot().localGeneration&&pointer.epoch===state.epoch){const world=snapAt(screenToWorld(point,viewRef.current),state.anchor,state.mode==='wall',event.shiftKey);tool.point(world);}
        clearEdit();if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);return;
      }
      if(step.commit){
        const to=targetFor(step.commit,event.shiftKey),d=drag.current;clearEdit();
        if(to&&d&&(to[0]!==d.start[0]||to[1]!==d.start[1])){
          const current=store.getSnapshot(),started=performance.now(),result=store.execute({id:`drag_${crypto.randomUUID().replaceAll('-','')}`,baseGeneration:d.generation,type:'MoveJunctions',moves:junctionMoves(current.document,d.junction,to)});
          onTiming?.('command',performance.now()-started);onMessage(result.ok?message(locale,'cornerUpdated'):editError(locale,result.errors[0]));
        }
      }else applyStep(step);
      if(step.tap&&event.button===0&&!panKey.current){const chosen=cycle.current.next(index.picks(point,viewRef.current,event.pointerType==='touch'),point,performance.now());setPicked(chosen);onPick?.(chosen,multiple||event.shiftKey);if(chosen?.kind==='junction')onSelect(chosen.id);if(chosen)onMessage(message(locale,'pickedItem',{kind:message(locale,chosen.kind==='junction'?'pickJunction':chosen.kind==='opening'?'pickOpening':chosen.kind==='furniture'?'pickFurniture':chosen.kind==='wall'?'pickWall':'pickRoom')}));}
      if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    }} onDoubleClick={()=>toolRef.current?.clear()} onPointerCancel={event=>{gestures.current.cancel();gestures.current.end(event.pointerId,localPoint(event),performance.now());clearEdit();toolRef.current?.clear();onMessage(message(locale,'dragCancelled'));}}
    onLostPointerCapture={event=>{if(gestures.current.has(event.pointerId)||boxDrag.current?.id===event.pointerId)cancel();}}>
    <div ref={mount} className="konva-mount" />
    {!ready && <span className="canvas-loading">{message(locale, 'loadingPlan')}</span>}
    <span className="canvas-hint">{message(locale, 'planHint')}</span>
    {loupe&&<TouchLoupe point={loupe.point} world={loupe.world} view={view} size={size} snapshot={snapshot} preview={toolState?.preview??preview} locale={locale} />}
    <span className="canvas-scale">{Math.round(view.scale * 1000)} {message(locale, 'pixelsPerMetre')}</span>
    <span className="snap-grid-label">{message(locale,'snapGridLabel',{step:snapGridStep(view.scale)})}</span>
  </div>;
}
