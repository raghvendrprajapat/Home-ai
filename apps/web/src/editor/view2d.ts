import type { ProjectStore } from '@gharplan/core-model';
export type PlanDocument = ReturnType<ProjectStore['getSnapshot']>['document'];

export interface Viewport { x: number; y: number; scale: number }
export type Point2 = readonly [number, number];
export const MIN_SCALE = 0.001, MAX_SCALE = 1;
export function worldToScreen([x, y]: Point2, view: Viewport): Point2 { return [x * view.scale + view.x, y * view.scale + view.y]; }
export function screenToWorld([x, y]: Point2, view: Viewport): Point2 { return [(x - view.x) / view.scale, (y - view.y) / view.scale]; }
export function zoomAt(view: Viewport, point: Point2, factor: number): Viewport {
  const world = screenToWorld(point, view), scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, view.scale * factor));
  return { scale, x: point[0] - world[0] * scale, y: point[1] - world[1] * scale };
}
export function fitView(doc: PlanDocument, width: number, height: number): Viewport {
  const xs = doc.junctions.map(j => j.x), ys = doc.junctions.map(j => j.y);
  const left = Math.min(0, ...xs) - 600, top = Math.min(0, ...ys) - 600;
  const right = Math.max(4000, ...xs) + 600, bottom = Math.max(3000, ...ys) + 600;
  const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, (width - 100) / (right - left), (height - 100) / (bottom - top)));
  return { scale, x: (width - (right + left) * scale) / 2, y: (height - (bottom + top) * scale) / 2 };
}
/** Resolve raw floats in screen-pixel tolerance, then quantize once. Saved coordinates stay integer. */
export function snapPointer(doc: PlanDocument, point: Point2, view: Viewport, excludeId?: string, tolerancePx = 12, previousTarget?: string): Point2 {
  const old = doc.junctions.find(j => j.id === previousTarget && j.id !== excludeId);
  if (old) { const distance = Math.hypot(old.x - point[0], old.y - point[1]); if (distance <= 250 && distance * view.scale <= tolerancePx * 1.5) return [old.x, old.y]; }
  const target = doc.junctions.filter(j => j.id !== excludeId).map(j => ({ j, worldDistance: Math.hypot(j.x - point[0], j.y - point[1]) }))
    .filter(p => p.worldDistance <= 250 && p.worldDistance * view.scale <= tolerancePx).sort((a, b) => a.worldDistance - b.worldDistance || (a.j.id < b.j.id ? -1 : a.j.id > b.j.id ? 1 : 0))[0];
  return target ? [target.j.x, target.j.y] : [Math.round(point[0]), Math.round(point[1])];
}
/** Move all vertical-linked X coordinates and horizontal-linked Y coordinates together. */
export function junctionMoves(doc: PlanDocument, junctionId: string, to: Point2): { junction: string; to: [number, number] }[] {
  const index = new Map(doc.junctions.map(j => [j.id, j]));
  if (!index.has(junctionId)) throw new Error('Selected corner no longer exists.');
  if (!to.every(Number.isSafeInteger)) throw new Error('Corner coordinates must use integer mm.');
  const component = (horizontal: boolean) => {
    const adjacency = new Map<string, string[]>();
    for (const wall of doc.walls) {
      const a = index.get(wall.a)!, b = index.get(wall.b)!;
      if ((a.y === b.y) !== horizontal) continue;
      adjacency.set(a.id, [...(adjacency.get(a.id) ?? []), b.id]); adjacency.set(b.id, [...(adjacency.get(b.id) ?? []), a.id]);
    }
    const ids = new Set([junctionId]), queue = [junctionId];
    for (let i = 0; i < queue.length; i++) for (const id of adjacency.get(queue[i]!) ?? []) if (!ids.has(id)) { ids.add(id); queue.push(id); }
    return ids;
  };
  const changeX = component(false), changeY = component(true);
  return doc.junctions.filter(j => changeX.has(j.id) || changeY.has(j.id)).map(j => ({ junction: j.id, to: [changeX.has(j.id) ? to[0] : j.x, changeY.has(j.id) ? to[1] : j.y] }));
}
