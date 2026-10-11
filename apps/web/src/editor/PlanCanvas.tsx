import { useEffect, useRef, useState } from 'react';
import type { ProjectStore, PreviewResult } from '@gharplan/core-model';
import { formatArea } from '@gharplan/geometry';
import type Konva from 'konva';
import { fitView, junctionMoves, screenToWorld, snapPointer, worldToScreen, zoomAt } from './view2d';
import type { Point2, Viewport } from './view2d';

type Snapshot = ReturnType<ProjectStore['getSnapshot']>;
interface Props { store: ProjectStore; snapshot: Snapshot; selected: string; onSelect(id: string): void; onMessage(text: string): void; zoomRequest: number; showGrid: boolean; onTiming?: (kind: 'preview' | 'command', durationMs: number) => void }
interface Drag { pointerId: number; junction: string; generation: number; start: Point2; last: Point2; pointerStart: Point2; snapTarget?: string }
export function PlanCanvas({ store, snapshot, selected, onSelect, onMessage, zoomRequest, showGrid, onTiming }: Props) {
  const host = useRef<HTMLDivElement>(null), mount = useRef<HTMLDivElement>(null), stage = useRef<Konva.Stage | null>(null), library = useRef<typeof Konva | null>(null);
  const drag = useRef<Drag | null>(null), pan = useRef<{ id: number; start: Point2; view: Viewport } | null>(null);
  const touches = useRef(new Set<number>()), touchBlocked = useRef(false);
  const [size, setSize] = useState({ width: 0, height: 0 }), [view, setView] = useState<Viewport>({ x: 0, y: 0, scale: 0.06 });
  const [preview, setPreview] = useState<PreviewResult | null>(null), [ready, setReady] = useState(false);
  const localPoint = (event: { clientX: number; clientY: number }): Point2 => {
    const rect = host.current!.getBoundingClientRect(); return [event.clientX - rect.left, event.clientY - rect.top];
  };
  const cancel = () => {
    const ids = [drag.current?.pointerId, pan.current?.id]; drag.current = null; pan.current = null; setPreview(null);
    for (const id of ids) if (id !== undefined && host.current?.hasPointerCapture(id)) host.current.releasePointerCapture(id);
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
      stage.current = new K.Stage({ container: mount.current, width: size.width, height: size.height }); setReady(true);
    }).catch(() => onMessage('The drawing view could not load. Reload to retry; the project remains in memory.'));
    return () => { disposed = true; stage.current?.destroy(); stage.current = null; };
  }, [size.width, size.height, onMessage]);
  useEffect(() => {
    if (drag.current || pan.current) cancel();
    if (size.width && size.height) setView(fitView(snapshot.document, size.width, size.height));
    // Fit only on viewport resizing / explicit fit; edits must not jump the camera.
  }, [size.width, size.height, zoomRequest]);
  useEffect(() => {
    if (drag.current && drag.current.generation !== snapshot.localGeneration) { cancel(); onMessage('The project changed during the drag. Preview cancelled.'); }
  }, [snapshot.localGeneration, onMessage]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') cancel(); };
    const endTouch = (event: PointerEvent) => { touches.current.delete(event.pointerId); if (!touches.current.size) touchBlocked.current = false; };
    window.addEventListener('keydown', escape); window.addEventListener('pointerup', endTouch); window.addEventListener('pointercancel', endTouch);
    return () => { window.removeEventListener('keydown', escape); window.removeEventListener('pointerup', endTouch); window.removeEventListener('pointercancel', endTouch); };
  }, []);
  useEffect(() => {
    const element = host.current!;
    const wheel = (event: WheelEvent) => {
      event.preventDefault(); if (drag.current || pan.current || touchBlocked.current) return;
      const point = localPoint(event); setView(v => zoomAt(v, point, Math.exp(-event.deltaY * 0.001)));
    };
    element.addEventListener('wheel', wheel, { passive: false }); return () => element.removeEventListener('wheel', wheel);
  }, []);
  useEffect(() => {
    const K = library.current, canvas = stage.current; if (!K || !canvas) return;
    canvas.destroyChildren(); const layer = new K.Layer({ listening: false }); canvas.add(layer);
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
      for (const polygon of face.clearPolygons) layer.add(new K.Line({ points: polygon.flatMap(p => [...worldToScreen(p, view)]), closed: true, fill: i % 2 ? '#e9ede2' : '#e5efe9', stroke: '#c9dacf', strokeWidth: 1 }));
      const biggest = [...face.clearRects].sort((a, b) => (b[2] - b[0]) * (b[3] - b[1]) - (a[2] - a[0]) * (a[3] - a[1]))[0]!;
      const p = worldToScreen([(biggest[0] + biggest[2]) / 2, (biggest[1] + biggest[3]) / 2], view);
      const width = Math.min(140, (biggest[2] - biggest[0]) * view.scale - 12);
      if (width >= 60) labels.push({ x: p[0] - width / 2, y: p[1] - 21, width, text: `${room.name}\n${formatArea(face.clearAreaMm2)} m²` });
    }
    for (const { rect: [x1, y1, x2, y2] } of derived.footprints) {
      const p = worldToScreen([x1, y1], view); layer.add(new K.Rect({ x: p[0], y: p[1], width: (x2 - x1) * view.scale, height: (y2 - y1) * view.scale, fill: '#42534b' }));
    }
    for (const object of document.furniture) {
      const p = worldToScreen([object.position.x, object.position.y], view);
      layer.add(new K.Rect({ x: p[0], y: p[1], width: object.size.w * view.scale, height: object.size.d * view.scale, offsetX: object.size.w * view.scale / 2, offsetY: object.size.d * view.scale / 2, rotation: object.rotationDeg, fill: '#c8af90', stroke: '#a38a6d', strokeWidth: 1, cornerRadius: 3 }));
    }
    for (const opening of document.openings) {
      const wall = document.walls.find(w => w.id === opening.wallId)!, a = document.junctions.find(j => j.id === wall.a)!, b = document.junctions.find(j => j.id === wall.b)!;
      const length = Math.abs(b.x - a.x) + Math.abs(b.y - a.y), dx = (b.x - a.x) / length, dy = (b.y - a.y) / length;
      const p = worldToScreen([a.x + dx * opening.offset, a.y + dy * opening.offset], view), rotation = Math.atan2(dy, dx) * 180 / Math.PI;
      layer.add(new K.Rect({ x: p[0], y: p[1], width: opening.width * view.scale, height: wall.thickness * view.scale + 2, offsetX: opening.width * view.scale / 2, offsetY: wall.thickness * view.scale / 2 + 1, rotation, fill: opening.kind === 'window' ? '#c5dfe6' : '#f7faf7', stroke: opening.kind === 'window' ? '#5994a5' : '#668370', strokeWidth: 1 }));
    }
    for (const label of labels) {
      layer.add(new K.Rect({ x: label.x, y: label.y - 4, width: label.width, height: 49, fill: 'rgba(255,255,255,0.92)', cornerRadius: 6 }));
      layer.add(new K.Text({ ...label, align: 'center', fontFamily: 'system-ui', fontSize: 13, lineHeight: 1.6, fill: '#416052' }));
    }
    for (const j of document.junctions) {
      const p = worldToScreen([j.x, j.y], view); layer.add(new K.Circle({ x: p[0], y: p[1], radius: j.id === selected ? 7 : 5, fill: '#fff', stroke: j.id === selected ? '#b6723f' : '#6c8979', strokeWidth: 2 }));
    }
    canvas.batchDraw();
  }, [ready, preview, snapshot, selected, view, size, showGrid]);
  return <div ref={host} className="plan-canvas" role="application" aria-label="2D floor plan. Drag a corner, or select a corner in the controls and enter coordinates." tabIndex={0} data-testid="plan-canvas"
    onPointerDown={event => {
      if (event.pointerType === 'touch') {
        touches.current.add(event.pointerId);
        if (touches.current.size > 1) { touchBlocked.current = true; cancel(); onMessage('Two-finger gesture: edit cancelled.'); }
        if (touchBlocked.current) return;
      }
      if (drag.current || pan.current) return;
      if (event.button !== 0 && event.button !== 1) return;
      const point = localPoint(event), tolerance = event.pointerType === 'touch' ? 24 : 14;
      const nearest = snapshot.document.junctions.map(j => ({ j, p: worldToScreen([j.x, j.y], view) })).sort((a, b) => Math.hypot(a.p[0] - point[0], a.p[1] - point[1]) - Math.hypot(b.p[0] - point[0], b.p[1] - point[1]))[0];
      event.currentTarget.setPointerCapture(event.pointerId);
      if (event.button === 0 && nearest && Math.hypot(nearest.p[0] - point[0], nearest.p[1] - point[1]) <= tolerance) {
        onSelect(nearest.j.id); drag.current = { pointerId: event.pointerId, junction: nearest.j.id, generation: snapshot.localGeneration, start: [nearest.j.x, nearest.j.y], last: [nearest.j.x, nearest.j.y], pointerStart: screenToWorld(point, view) }; onMessage('Preview only. Release to apply; Escape cancels.');
      } else pan.current = { id: event.pointerId, start: point, view };
    }}
    onPointerMove={event => {
      if (touchBlocked.current) return;
      const point = localPoint(event);
      if (pan.current?.id === event.pointerId) { const p = pan.current; setView({ ...p.view, x: p.view.x + point[0] - p.start[0], y: p.view.y + point[1] - p.start[1] }); }
      const d = drag.current; if (!d || d.pointerId !== event.pointerId) return;
      if (snapshot.localGeneration !== d.generation) { cancel(); onMessage('The project changed during this drag. Try again.'); return; }
      const pointer = screenToWorld(point, view), raw: Point2 = [d.start[0] + pointer[0] - d.pointerStart[0], d.start[1] + pointer[1] - d.pointerStart[1]];
      const to: Point2 = event.shiftKey ? [Math.round(raw[0]), Math.round(raw[1])] : snapPointer(snapshot.document, raw, view, d.junction, 12, d.snapTarget); d.last = to;
      const target = !event.shiftKey && snapshot.document.junctions.find(j => j.id !== d.junction && j.x === to[0] && j.y === to[1]);
      if (target) d.snapTarget = target.id; else delete d.snapTarget;
      const started = performance.now();
      const result = store.preview({ id: 'drag_preview', baseGeneration: d.generation, type: 'MoveJunctions', moves: junctionMoves(snapshot.document, d.junction, to) }); setPreview(result);
      onTiming?.('preview', performance.now() - started);
      if (!result.ok) onMessage(result.errors[0]?.message ?? 'Invalid drawing.');
    }}
    onPointerUp={event => {
      if (touchBlocked.current) return;
      if (drag.current && drag.current.pointerId !== event.pointerId || pan.current && pan.current.id !== event.pointerId) return;
      const d = drag.current; if (d?.pointerId === event.pointerId && (d.last[0] !== d.start[0] || d.last[1] !== d.start[1])) {
        const started = performance.now();
        const result = store.execute({ id: `drag_${d.generation}`, baseGeneration: d.generation, type: 'MoveJunctions', moves: junctionMoves(snapshot.document, d.junction, d.last) });
        onTiming?.('command', performance.now() - started);
        onMessage(result.ok ? 'Corner updated. Undo is available.' : result.errors[0]?.message ?? 'Edit rejected.');
      }
      cancel(); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    }} onPointerCancel={event => {
      if (drag.current?.pointerId === event.pointerId || pan.current?.id === event.pointerId) { cancel(); onMessage('Drag cancelled. Project unchanged.'); }
    }} onLostPointerCapture={event => { if (drag.current?.pointerId === event.pointerId || pan.current?.id === event.pointerId) cancel(); }}>
    <div ref={mount} className="konva-mount" />
    {!ready && <span className="canvas-loading">Loading floor plan…</span>}
    <span className="canvas-hint">Drag a corner to resize · Drag empty space to pan · Scroll to zoom</span>
    <span className="canvas-scale">{Math.round(view.scale * 1000)} px / m</span>
  </div>;
}
