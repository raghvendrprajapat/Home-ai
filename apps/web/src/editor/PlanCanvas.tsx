import { useEffect, useMemo, useRef, useState } from 'react';
import type { ProjectStore, PreviewResult } from '@gharplan/core-model';
import { areaDisplay, editError, message } from '../i18n/messages';
import type { Locale } from '../i18n/messages';
import type Konva from 'konva';
import { fitView, junctionMoves, screenToWorld, snapPointer, worldToScreen, zoomAt } from './view2d';
import { PlanGestures } from './gestures';
import type { GestureStep, DragMotion } from './gestures';
import { PickIndex, PickCycle } from './hit-test';
import type { Pick } from './hit-test';
import { TouchLoupe } from './TouchLoupe';
import type { Point2, Viewport } from './view2d';

type Snapshot = ReturnType<ProjectStore['getSnapshot']>;
interface Props { store: ProjectStore; snapshot: Snapshot; selected: string; onSelect(id: string): void; onMessage(text: string): void; zoomRequest: number; showGrid: boolean; locale?: Locale; onTiming?: (kind: 'preview' | 'command', durationMs: number) => void }
interface Drag { pointerId: number; junction: string; generation: number; start: Point2; last: Point2; snapTarget?: string; touch: boolean; store: ProjectStore }
export function PlanCanvas({ store, snapshot, selected, onSelect, onMessage, zoomRequest, showGrid, onTiming, locale = 'en' }: Props) {
  const language = useRef(locale); language.current = locale;
  const host = useRef<HTMLDivElement>(null), mount = useRef<HTMLDivElement>(null), stage = useRef<Konva.Stage | null>(null), drawingLayer = useRef<Konva.Layer | null>(null), library = useRef<typeof Konva | null>(null);
  const drag = useRef<Drag | null>(null), gestures = useRef(new PlanGestures()), cycle = useRef(new PickCycle());
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null), frame = useRef<number | null>(null), latestMotion = useRef<{motion:DragMotion;shift:boolean}|null>(null);
  const panKey = useRef(false);
  const activeStore = useRef(store); activeStore.current = store;
  const index = useMemo(() => new PickIndex(snapshot), [snapshot]);
  const [picked, setPicked] = useState<Pick | null>(null), [loupe,setLoupe] = useState<{point:Point2;world:Point2}|null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 }), [view, setView] = useState<Viewport>({ x: 0, y: 0, scale: 0.06 });
  const viewRef = useRef(view); viewRef.current = view;
  const changeView = (next:Viewport) => { if(next.x===viewRef.current.x&&next.y===viewRef.current.y&&next.scale===viewRef.current.scale)return;viewRef.current=next;setView(next);cycle.current.clear(); };
  const [preview, setPreview] = useState<PreviewResult | null>(null), [ready, setReady] = useState(false);
  const localPoint = (event: { clientX: number; clientY: number }): Point2 => {
    const rect = host.current!.getBoundingClientRect(); return [event.clientX - rect.left, event.clientY - rect.top];
  };
  const clearEdit = () => {
    if(holdTimer.current!==null)clearTimeout(holdTimer.current);holdTimer.current=null;
    if(frame.current!==null)cancelAnimationFrame(frame.current);frame.current=null;latestMotion.current=null;
    drag.current=null;setPreview(null);setLoupe(null);
  };
  const cancel = () => {
    gestures.current.cancel();clearEdit();cycle.current.clear();
    for(const id of gestures.current.ids())if(host.current?.hasPointerCapture(id))host.current.releasePointerCapture(id);
  };
  const targetFor = (motion:DragMotion,shift:boolean):Point2|null => {
    const d=drag.current;if(!d||d.pointerId!==motion.pointerId)return null;
    const current=d.store.getSnapshot();
    if(d.store!==activeStore.current||current.localGeneration!==d.generation){cancel();onMessage(message(language.current,'dragRetry'));return null;}
    const raw:Point2=[d.start[0]+motion.delta[0]/viewRef.current.scale,d.start[1]+motion.delta[1]/viewRef.current.scale];
    const target=shift?[Math.round(raw[0]),Math.round(raw[1])] as Point2:snapPointer(current.document,raw,viewRef.current,d.junction,12,d.snapTarget);d.last=target;
    const snap=!shift&&current.document.junctions.find(j=>j.id!==d.junction&&j.x===target[0]&&j.y===target[1]);if(snap)d.snapTarget=snap.id;else delete d.snapTarget;
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
    if(step.cancelEdit)clearEdit();if(step.view)changeView(step.view);if(step.drag)schedule(step.drag,shift);
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
    if (gestures.current.phase!=='idle') cancel();
    if (size.width && size.height) changeView(fitView(snapshot.document, size.width, size.height));
    // Fit only on viewport resizing / explicit fit; edits must not jump the camera.
  }, [size.width, size.height, zoomRequest]);
  useEffect(() => {
    cancel();gestures.current.clear();setPicked(null);
    return () => { cancel();gestures.current.clear(); };
  }, [store]);
  useEffect(() => {
    if (drag.current && drag.current.generation !== snapshot.localGeneration) { cancel(); onMessage(message(language.current, 'dragChanged')); }
    cycle.current.clear();
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
      if(gestures.current.phase!=='idle')return;
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
    const outsideTouch = (event:PointerEvent) => {if(event.pointerType==='touch'&&gestures.current.phase!=='idle'&&!host.current?.contains(event.target as Node)){cancel();gestures.current.begin(event.pointerId,true,localPoint(event),viewRef.current,false,performance.now());}};
    const scrolled=()=>{if(gestures.current.phase!=='idle')cancel();};
    document.addEventListener('visibilitychange',hidden);window.addEventListener('blur',blurred);window.addEventListener('keyup',releaseSpace);window.addEventListener('scroll',scrolled,true);window.addEventListener('keydown',escape);window.addEventListener('pointerup',outsideEnd);window.addEventListener('pointercancel',outsideEnd);window.addEventListener('pointerdown',outsideTouch);
    return()=>{document.removeEventListener('visibilitychange',hidden);window.removeEventListener('blur',blurred);window.removeEventListener('keyup',releaseSpace);window.removeEventListener('scroll',scrolled,true);window.removeEventListener('keydown',escape);window.removeEventListener('pointerup',outsideEnd);window.removeEventListener('pointercancel',outsideEnd);window.removeEventListener('pointerdown',outsideTouch);};
  }, []);
  useEffect(() => {
    const element = host.current!;
    const wheel = (event: WheelEvent) => {
      event.preventDefault(); if (gestures.current.phase!=='idle') return;
      const point = localPoint(event); changeView(zoomAt(viewRef.current, point, Math.exp(-event.deltaY * 0.001)));
    };
    element.addEventListener('wheel', wheel, { passive: false }); return () => element.removeEventListener('wheel', wheel);
  }, []);
  useEffect(() => {
    const K = library.current, canvas = stage.current, layer=drawingLayer.current; if (!K || !canvas || !layer) return;
    // Keep the DOM canvas stable: removing a native touch target cancels its touch stream.
    layer.destroyChildren();
    if (showGrid) {
      const spacing = [100, 500, 1000, 5000, 10000, 50000].find(n => n * view.scale >= 28) ?? 50000;
      const [left, top] = screenToWorld([0, 0], view), [right, bottom] = screenToWorld([size.width, size.height], view);
      for (let x = Math.floor(left / spacing) * spacing; x <= right; x += spacing) {
        const sx = worldToScreen([x, 0], view)[0]; layer.add(new K.Line({ points: [sx, 0, sx, size.height], stroke: '#e4e9e5', strokeWidth: 1 }));
      }
      for (let y = Math.floor(top / spacing) * spacing; y <= bottom; y += spacing) {
        const sy = worldToScreen([0, y], view)[1]; layer.add(new K.Line({ points: [0, sy, size.width, sy], stroke: '#e4e9e5', strokeWidth: 1 }));
      }
    }
    const currentPreview = preview?.ok && drag.current?.generation === snapshot.localGeneration ? preview : null;
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
      const p = worldToScreen([x1, y1], view); layer.add(new K.Rect({ x: p[0], y: p[1], width: (x2 - x1) * view.scale, height: (y2 - y1) * view.scale, fill: picked?.kind==='wall'&&picked.id===ownerId?'#b6723f':'#42534b' }));
    }
    for (const object of document.furniture) {
      const p = worldToScreen([object.position.x, object.position.y], view);
      layer.add(new K.Rect({ x: p[0], y: p[1], width: object.size.w * view.scale, height: object.size.d * view.scale, offsetX: object.size.w * view.scale / 2, offsetY: object.size.d * view.scale / 2, rotation: object.rotationDeg, fill: '#c8af90', stroke: picked?.kind==='furniture'&&picked.id===object.id?'#b6723f':'#a38a6d', strokeWidth: 1, cornerRadius: 3 }));
    }
    for (const opening of document.openings) {
      const wall = document.walls.find(w => w.id === opening.wallId)!, a = document.junctions.find(j => j.id === wall.a)!, b = document.junctions.find(j => j.id === wall.b)!;
      const length = Math.abs(b.x - a.x) + Math.abs(b.y - a.y), dx = (b.x - a.x) / length, dy = (b.y - a.y) / length;
      const p = worldToScreen([a.x + dx * opening.offset, a.y + dy * opening.offset], view), rotation = Math.atan2(dy, dx) * 180 / Math.PI;
      layer.add(new K.Rect({ x: p[0], y: p[1], width: opening.width * view.scale, height: wall.thickness * view.scale + 2, offsetX: opening.width * view.scale / 2, offsetY: wall.thickness * view.scale / 2 + 1, rotation, fill: opening.kind === 'window' ? '#c5dfe6' : '#f7faf7', stroke: picked?.kind==='opening'&&picked.id===opening.id?'#b6723f':opening.kind === 'window' ? '#5994a5' : '#668370', strokeWidth: 1 }));
    }
    if(picked?.kind==='furniture'){
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
    canvas.batchDraw();
  }, [ready, preview, snapshot, selected, view, size, showGrid, picked, locale]);
  return <div ref={host} className="plan-canvas" role="application" aria-label={message(locale, 'canvas2d')} tabIndex={0} data-testid="plan-canvas"
    data-view-x={view.x} data-view-y={view.y} data-view-scale={view.scale} data-picked-kind={picked?.kind} data-picked-id={picked?.id}
    onPointerDown={event=>{
      if(event.button!==0&&event.button!==1)return;
      const point=localPoint(event),touch=event.pointerType==='touch',pick=index.picks(point,viewRef.current,touch)[0],now=performance.now();
      const canDrag=event.button===0&&!panKey.current&&pick?.kind==='junction';
      const step=gestures.current.begin(event.pointerId,touch,point,viewRef.current,canDrag,now);
      event.currentTarget.focus({preventScroll:true});event.currentTarget.setPointerCapture(event.pointerId);applyStep(step);
      if(step.cancelEdit){onMessage(message(locale,'twoFingerCancel'));return;}
      if(pick?.kind==='junction'&&canDrag){
        const j=snapshot.document.junctions.find(j=>j.id===pick.id)!;
        onSelect(j.id);setPicked(pick);drag.current={pointerId:event.pointerId,junction:j.id,generation:snapshot.localGeneration,start:[j.x,j.y],last:[j.x,j.y],touch,store};
        if(step.phase==='pending')holdTimer.current=setTimeout(()=>applyStep(gestures.current.hold(performance.now())),151);
        onMessage(message(locale,touch?'touchHold':'previewHelp'));
      }
    }}
    onPointerMove={event=>applyStep(gestures.current.move(event.pointerId,localPoint(event),performance.now()),event.shiftKey)}
    onPointerUp={event=>{
      const point=localPoint(event),step=gestures.current.end(event.pointerId,point,performance.now());
      if(step.commit){
        const to=targetFor(step.commit,event.shiftKey),d=drag.current;clearEdit();
        if(to&&d&&(to[0]!==d.start[0]||to[1]!==d.start[1])){
          const current=store.getSnapshot(),started=performance.now(),result=store.execute({id:`drag_${crypto.randomUUID().replaceAll('-','')}`,baseGeneration:d.generation,type:'MoveJunctions',moves:junctionMoves(current.document,d.junction,to)});
          onTiming?.('command',performance.now()-started);onMessage(result.ok?message(locale,'cornerUpdated'):editError(locale,result.errors[0]));
        }
      }else applyStep(step);
      if(step.tap&&event.button===0&&!panKey.current){const chosen=cycle.current.next(index.picks(point,viewRef.current,event.pointerType==='touch'),point,performance.now());setPicked(chosen);if(chosen?.kind==='junction')onSelect(chosen.id);if(chosen)onMessage(message(locale,'pickedItem',{kind:message(locale,chosen.kind==='junction'?'pickJunction':chosen.kind==='opening'?'pickOpening':chosen.kind==='furniture'?'pickFurniture':chosen.kind==='wall'?'pickWall':'pickRoom')}));}
      if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    }} onPointerCancel={event=>{gestures.current.cancel();gestures.current.end(event.pointerId,localPoint(event),performance.now());clearEdit();onMessage(message(locale,'dragCancelled'));}}
    onLostPointerCapture={event=>{if(gestures.current.has(event.pointerId))cancel();}}>
    <div ref={mount} className="konva-mount" />
    {!ready && <span className="canvas-loading">{message(locale, 'loadingPlan')}</span>}
    <span className="canvas-hint">{message(locale, 'planHint')}</span>
    {loupe&&<TouchLoupe point={loupe.point} world={loupe.world} view={view} size={size} snapshot={snapshot} preview={preview} locale={locale} />}
    <span className="canvas-scale">{Math.round(view.scale * 1000)} {message(locale, 'pixelsPerMetre')}</span>
  </div>;
}
