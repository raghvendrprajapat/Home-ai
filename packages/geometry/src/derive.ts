import { endpoints, validateTopology } from './graph';
import { bounds, insidePolygon, rectArea, signedArea, simplifyCorners } from './primitives';
import { clearRegion, partitionRectangles, regionPolygons } from './regions';
import { candidatePairs } from './spatial';
import { GeometryError, SMALL_SPACE_AREA } from './types';
import type { DerivedPlan, Face, Plan, Point } from './types';
import type { OwnedRect } from './regions';

/** Exact L0 offset intersections are rectangular strips with perpendicular end extents. */
export function wallStrips(plan: Plan, minHeight = 0): OwnedRect[] {
  const index = new Map(plan.junctions.map(j => [j.id, j]));
  const active = plan.walls.filter(w => w.height > minHeight);
  const incidence = new Map<string, typeof active>();
  for (const w of active) for (const id of [w.a, w.b]) incidence.set(id, [...(incidence.get(id) ?? []), w]);
  return active.map(w => {
    const [a, b] = endpoints(plan, w, index), horizontal = a.y === b.y;
    const extension = (id: string): number => {
      const neighbors = (incidence.get(id) ?? []).filter(v => v.id !== w.id);
      if (!neighbors.length) return w.thickness / 2; // D18 free square cap
      const perpendicular = neighbors.filter(v => {
        const [c, d] = endpoints(plan, v, index); return horizontal !== (c.y === d.y);
      });
      return perpendicular.length ? Math.max(...perpendicular.map(v => v.thickness / 2)) : 0;
    };
    const half = w.thickness / 2;
    const start = horizontal ? Math.min(a.x, b.x) : Math.min(a.y, b.y);
    const end = horizontal ? Math.max(a.x, b.x) : Math.max(a.y, b.y);
    const forward = horizontal ? b.x > a.x : b.y > a.y;
    const lowExtent = extension(forward ? a.id : b.id), highExtent = extension(forward ? b.id : a.id);
    return { ownerId: w.id, rect: horizontal ? [start - lowExtent, a.y - half, end + highExtent, a.y + half] :
      [a.x - half, start - lowExtent, a.x + half, end + highExtent] };
  });
}

/** Every directed edge is visited once; positive winding is bounded in Y-down coordinates. */
export function detectFaces(plan: Plan): { boundary: string[]; corners: Point[]; centrelineSignedAreaMm2: number }[] {
  const junctions = new Map(plan.junctions.map(j => [j.id, j]));
  const outgoing = new Map<string, string[]>();
  for (const w of plan.walls) {
    outgoing.set(w.a, [...(outgoing.get(w.a) ?? []), w.b]); outgoing.set(w.b, [...(outgoing.get(w.b) ?? []), w.a]);
  }
  for (const [id, destinations] of outgoing) {
    const a = junctions.get(id)!;
    destinations.sort((u, v) => {
      const b = junctions.get(u)!, c = junctions.get(v)!;
      return Math.atan2(b.y - a.y, b.x - a.x) - Math.atan2(c.y - a.y, c.x - a.x);
    });
  }
  const visited = new Set<string>(), faces: ReturnType<typeof detectFaces> = [];
  for (const [startA, neighbors] of outgoing) for (const startB of neighbors) {
    const startKey = `${startA}:${startB}`; if (visited.has(startKey)) continue;
    const boundary: string[] = []; let a = startA, b = startB;
    for (let n = 0; n <= plan.walls.length * 2; n++) {
      const key = `${a}:${b}`;
      if (visited.has(key)) { if (key !== startKey) throw new GeometryError('face-cycle', 'Invalid half-edge cycle.'); break; }
      visited.add(key); boundary.push(a);
      const options = outgoing.get(b)!, index = options.indexOf(a);
      const next = options[(index + options.length - 1) % options.length]!;
      a = b; b = next;
    }
    const points = boundary.map(id => { const j = junctions.get(id)!; return [j.x, j.y] as Point; });
    const area = signedArea(points);
    if (area > 0) faces.push({ boundary, corners: simplifyCorners(points), centrelineSignedAreaMm2: area });
  }
  return faces;
}

export function derivePlan(plan: Plan): DerivedPlan {
  validateTopology(plan);
  const strips = wallStrips(plan), footprints = partitionRectangles(strips);
  const cycles = detectFaces(plan);
  const faces: Face[] = cycles.map(cycle => {
    const clearRects = clearRegion(cycle.corners, strips.map(s => s.rect));
    const clearAreaMm2 = clearRects.reduce((area, r) => area + rectArea(r), 0);
    if (clearAreaMm2 <= 0)
      throw new GeometryError('no-usable-space', 'These walls leave no usable space inside the room.', cycle.boundary);
    const clearPolygons = regionPolygons(clearRects);
    if (clearPolygons.some(p => signedArea(p) < 0))
      throw new GeometryError('room-hole', 'Room islands and holes are not supported in L0.');
    return { ...cycle, clearRects, clearPolygons, clearAreaMm2, clearRect: bounds(clearPolygons.flat()),
      smallSpaceWarning: clearAreaMm2 < SMALL_SPACE_AREA, roomId: '' };
  });
  // A disconnected nested loop must not silently produce overlapping rooms.
  for (const [i, j] of candidatePairs(faces.map(face => bounds(face.corners)))) {
    const a = faces[i]!, b = faces[j]!;
    const p = a.clearRects[0]!, q = b.clearRects[0]!;
    if (insidePolygon([(p[0] + p[2]) / 2, (p[1] + p[3]) / 2], b.corners) ||
        insidePolygon([(q[0] + q[2]) / 2, (q[1] + q[3]) / 2], a.corners))
      throw new GeometryError('room-hole', 'Nested room loops are not supported in L0.');
  }
  return { faces, footprints, footprintUnionAreaMm2: footprints.reduce((sum, p) => sum + rectArea(p.rect), 0),
    outerBoundaryRect: footprints.length ? bounds(footprints.flatMap(({ rect: r }) => [[r[0], r[1]], [r[2], r[3]]] as Point[])) : null };
}
