import { bounds, pointKey, rectArea, signedArea, simplifyCorners } from './primitives';
import { GeometryError } from './types';
import type { FootprintPiece, Point, Rect } from './types';

export interface OwnedRect { ownerId: string; rect: Rect }
function unique(values: number[]): number[] { return [...new Set(values)].sort((a, b) => a - b); }

/** Sweep x events, then y events among active strips; emit disjoint owned rectangles. */
export function partitionRectangles(input: readonly OwnedRect[]): FootprintPiece[] {
  const events = new Map<number, { add: number[]; remove: number[] }>();
  input.forEach(({ rect: r }, i) => {
    if (!rectArea(r)) return;
    for (const x of [r[0], r[2]]) if (!events.has(x)) events.set(x, { add: [], remove: [] });
    events.get(r[0])!.add.push(i); events.get(r[2])!.remove.push(i);
  });
  const xs = [...events.keys()].sort((a, b) => a - b);
  const active = new Set<number>(); const result: FootprintPiece[] = [];
  let previous = new Map<string, number>();
  for (let i = 0; i < xs.length - 1; i++) {
    const x = xs[i]!, nextX = xs[i + 1]!, event = events.get(x)!;
    for (const n of event.remove) active.delete(n);
    for (const n of event.add) active.add(n);
    const yEvents = new Map<number, { add: number[]; remove: number[] }>();
    for (const n of active) {
      const r = input[n]!.rect;
      for (const y of [r[1], r[3]]) if (!yEvents.has(y)) yEvents.set(y, { add: [], remove: [] });
      yEvents.get(r[1])!.add.push(n); yEvents.get(r[3])!.remove.push(n);
    }
    const ys = [...yEvents.keys()].sort((a, b) => a - b), owners = new Set<number>();
    const slab: { ownerId: string; y0: number; y1: number }[] = [];
    for (let j = 0; j < ys.length - 1; j++) {
      const y = ys[j]!, e = yEvents.get(y)!;
      for (const n of e.remove) owners.delete(n);
      for (const n of e.add) owners.add(n);
      if (!owners.size) continue;
      const ownerId = input[Math.min(...owners)]!.ownerId, y1 = ys[j + 1]!;
      const last = slab.at(-1);
      if (last && last.ownerId === ownerId && last.y1 === y) last.y1 = y1;
      else slab.push({ ownerId, y0: y, y1 });
    }
    const current = new Map<string, number>();
    for (const { ownerId, y0, y1 } of slab) {
      const key = `${ownerId}:${y0}:${y1}`, old = previous.get(key);
      if (old !== undefined && result[old]!.rect[2] === x) {
        const r = result[old]!.rect; result[old] = { ownerId, rect: [r[0], y0, nextX, y1] }; current.set(key, old);
      } else { current.set(key, result.length); result.push({ ownerId, rect: [x, y0, nextX, y1] }); }
    }
    previous = current;
  }
  return result;
}

/** Orthogonal polygon interior minus wall strips, with no coordinate raster approximation. */
export function clearRegion(polygon: readonly Point[], walls: readonly Rect[]): Rect[] {
  const box = bounds(polygon);
  const relevant = walls.filter(r => r[0] < box[2] && r[2] > box[0] && r[1] < box[3] && r[3] > box[1]);
  const xs = unique([...polygon.map(p => p[0]), ...relevant.flatMap(r => [Math.max(r[0], box[0]), Math.min(r[2], box[2])])]);
  const result: Rect[] = []; let previous = new Map<string, number>();
  for (let i = 0; i < xs.length - 1; i++) {
    const x0 = xs[i]!, x1 = xs[i + 1]!, probe = (x0 + x1) / 2;
    const crossings: number[] = [];
    for (let j = 0; j < polygon.length; j++) {
      const a = polygon[j]!, b = polygon[(j + 1) % polygon.length]!;
      if (a[1] === b[1] && probe > Math.min(a[0], b[0]) && probe < Math.max(a[0], b[0])) crossings.push(a[1]);
    }
    crossings.sort((a, b) => a - b);
    if (crossings.length % 2) throw new GeometryError('polygon', 'Invalid orthogonal room boundary.');
    const covered = relevant.filter(r => r[0] < probe && r[2] > probe).map(r => [r[1], r[3]] as [number, number]).sort(([a], [b]) => a - b);
    const merged: [number, number][] = [];
    for (const [a, b] of covered) {
      const last = merged.at(-1);
      if (last && a <= last[1]) last[1] = Math.max(last[1], b); else merged.push([a, b]);
    }
    const intervals: [number, number][] = [];
    for (let j = 0; j < crossings.length; j += 2) {
      let start = crossings[j]!; const end = crossings[j + 1]!;
      for (const [a, b] of merged) {
        if (b <= start || a >= end) continue;
        if (a > start) intervals.push([start, Math.min(a, end)]);
        start = Math.max(start, b); if (start >= end) break;
      }
      if (start < end) intervals.push([start, end]);
    }
    const current = new Map<string, number>();
    for (const [y0, y1] of intervals) {
      const key = `${y0}:${y1}`, old = previous.get(key);
      if (old !== undefined && result[old]![2] === x0) { result[old] = [result[old]![0], y0, x1, y1]; current.set(key, old); }
      else { current.set(key, result.length); result.push([x0, y0, x1, y1]); }
    }
    previous = current;
  }
  return result;
}

/** Cancel shared interval edges, then trace the boundary of disjoint rectangles. */
export function regionPolygons(rects: readonly Rect[]): Point[][] {
  const lines = new Map<string, { axis: 'x' | 'y'; at: number; events: Map<number, number> }>();
  const edge = (axis: 'x' | 'y', at: number, from: number, to: number) => {
    const key = `${axis}:${at}`, line = lines.get(key) ?? { axis, at, events: new Map<number, number>() };
    const sign = to > from ? 1 : -1, lo = Math.min(from, to), hi = Math.max(from, to);
    line.events.set(lo, (line.events.get(lo) ?? 0) + sign); line.events.set(hi, (line.events.get(hi) ?? 0) - sign); lines.set(key, line);
  };
  for (const [x0, y0, x1, y1] of rects) { edge('y', y0, x0, x1); edge('x', x1, y0, y1); edge('y', y1, x1, x0); edge('x', x0, y1, y0); }
  const segments: [Point, Point][] = [];
  for (const { axis, at, events } of lines.values()) {
    const positions = [...events.keys()].sort((a, b) => a - b); let winding = 0;
    for (let i = 0; i < positions.length - 1; i++) {
      const p = positions[i]!, q = positions[i + 1]!; winding += events.get(p)!;
      if (!winding) continue;
      if (Math.abs(winding) !== 1) throw new GeometryError('ownership', 'Region rectangles overlap.');
      const a: Point = axis === 'y' ? [p, at] : [at, p], b: Point = axis === 'y' ? [q, at] : [at, q];
      segments.push(winding > 0 ? [a, b] : [b, a]);
    }
  }
  const outgoing = new Map<string, number[]>();
  segments.forEach(([a], i) => outgoing.set(pointKey(a), [...(outgoing.get(pointKey(a)) ?? []), i]));
  const used = new Set<number>(), polygons: Point[][] = [];
  for (let start = 0; start < segments.length; start++) {
    if (used.has(start)) continue;
    const polygon: Point[] = []; let current = start;
    for (let steps = 0; steps <= segments.length; steps++) {
      if (used.has(current)) { if (current !== start) throw new GeometryError('polygon', 'Non-manifold region.'); break; }
      used.add(current); const [a, b] = segments[current]!; polygon.push(a);
      const options = outgoing.get(pointKey(b)) ?? [];
      if (!options.length) throw new GeometryError('polygon', 'Open region boundary.');
      const reverse = Math.atan2(a[1] - b[1], a[0] - b[0]);
      current = [...options].sort((u, v) => {
        const angle = (n: number) => { const p = segments[n]![1]; return (reverse - Math.atan2(p[1] - b[1], p[0] - b[0]) + 2 * Math.PI) % (2 * Math.PI); };
        return angle(u) - angle(v);
      })[0]!;
    }
    polygons.push(simplifyCorners(polygon));
  }
  if (polygons.reduce((sum, p) => sum + signedArea(p), 0) !== rects.reduce((sum, r) => sum + rectArea(r), 0))
    throw new GeometryError('polygon-area', 'Region boundary does not match its occupied area.');
  return polygons;
}
