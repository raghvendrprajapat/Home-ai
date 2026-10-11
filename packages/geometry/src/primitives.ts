import { DOMAIN, GeometryError } from './types';
import type { Point, Rect } from './types';

export function assertCoordinate(value: number): void {
  if (!Number.isFinite(value) || !Number.isInteger(value))
    throw new GeometryError('non-integer', 'Coordinates must be finite integer millimetres.');
  if (Math.abs(value) > DOMAIN)
    throw new GeometryError('out-of-domain', 'Coordinates must be within ±100000 mm.');
}
export function pointKey(p: Point): string { return `${p[0]},${p[1]}`; }
export function signedArea(points: readonly Point[]): number {
  let twice = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!; const b = points[(i + 1) % points.length]!;
    twice += a[0] * b[1] - b[0] * a[1];
  }
  return twice / 2;
}
export function simplifyCorners(points: readonly Point[]): Point[] {
  // Keep non-collinear turns, including a stem visited out and back by a face.
  return points.filter((b, i) => {
    const a = points[(i + points.length - 1) % points.length]!;
    const c = points[(i + 1) % points.length]!;
    return (b[0] - a[0]) * (c[1] - b[1]) !== (b[1] - a[1]) * (c[0] - b[0]) ||
      (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) < 0;
  });
}
export function bounds(points: readonly Point[]): Rect {
  if (!points.length) throw new GeometryError('empty-polygon', 'An empty polygon has no bounds.');
  return [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])),
    Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))];
}
export function rectArea(r: Rect): number { return Math.max(0, r[2] - r[0]) * Math.max(0, r[3] - r[1]); }
export function rectIntersection(a: Rect, b: Rect): Rect {
  return [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])];
}
export function insidePolygon(p: Point, polygon: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!; const b = polygon[j]!;
    if ((a[1] > p[1]) !== (b[1] > p[1]) &&
      p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
export function formatArea(areaMm2: number): string {
  if (!Number.isFinite(areaMm2) || areaMm2 < 0) throw new GeometryError('area', 'Invalid area.');
  // Quarter-mm² values are exact for the L0 domain. Round half up to hundredths.
  return (Math.floor(areaMm2 / 10_000 + 0.5) / 100).toFixed(2);
}
export function freshId(prefix: string, used: Set<string>): string {
  let n = 1; let id: string;
  do { id = `${prefix.slice(0, 30)}_${n++}`; } while (used.has(id));
  used.add(id); return id;
}
