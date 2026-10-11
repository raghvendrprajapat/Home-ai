import { wallStrips } from './derive';
import { bounds, freshId, rectArea, rectIntersection } from './primitives';
import { clearRegion } from './regions';
import { candidatePairs } from './spatial';
import { GeometryError } from './types';
import type { DerivedPlan, Plan, Point, Room } from './types';

function cycleKey(boundary: string[], plan: Plan): string {
  const j = new Map(plan.junctions.map(p => [p.id, p]));
  const corners = boundary.filter((id, i) => {
    const a = j.get(boundary[(i + boundary.length - 1) % boundary.length]!), b = j.get(id), c = j.get(boundary[(i + 1) % boundary.length]!);
    if (!a || !b || !c) return true;
    return (b.x - a.x) * (c.y - b.y) !== (b.y - a.y) * (c.x - b.x) ||
      (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y) < 0;
  });
  return corners.map((_, i) => [...corners.slice(i), ...corners.slice(0, i)].join(':')).sort()[0] ?? '';
}

/** Exact cycle first, conservative overlap next, then explicit split/merge rules. */
export function assignRooms(oldPlan: Plan, plan: Plan, derived: DerivedPlan): { rooms: Room[]; checkRoomNamesHint: boolean } {
  const oldStrips = wallStrips(oldPlan).map(s => s.rect);
  const old = oldPlan.rooms.map(room => {
    const polygon = room.boundary.map(id => {
      const j = oldPlan.junctions.find(j => j.id === id);
      if (!j) throw new GeometryError('room-boundary', 'Room boundary references a missing junction.', [room.id]);
      return [j.x, j.y] as Point;
    });
    return { room, rects: polygon.length ? clearRegion(polygon, oldStrips) : [], key: cycleKey(room.boundary, oldPlan), box: bounds(polygon) };
  });
  const exact = new Map(old.map((o, i) => [o.key, i]));
  const faceKeys = derived.faces.map(face => cycleKey(face.boundary, plan));
  const overlaps = derived.faces.map(() => new Map<number, number>());
  const siblingsByOld = new Map<number, { n: number; overlap: number }[]>();
  const oldAreas = old.map(o => o.rects.reduce((sum, r) => sum + rectArea(r), 0));
  const count = derived.faces.length;
  for (const [i, j] of candidatePairs([...derived.faces.map(f => f.clearRect), ...old.map(o => o.box)])) {
    if (i >= count || j < count || exact.has(faceKeys[i]!)) continue;
    const source = j - count;
    const overlap = derived.faces[i]!.clearRects.reduce((sum, r) => sum + old[source]!.rects.reduce((s, q) => s + rectArea(rectIntersection(r, q)), 0), 0);
    if (overlap > 0) {
      overlaps[i]!.set(source, overlap);
      siblingsByOld.set(source, [...(siblingsByOld.get(source) ?? []), { n: i, overlap }]);
    }
  }
  const used = new Set([...plan.junctions, ...plan.walls, ...oldPlan.rooms].map(e => e.id));
  const assigned = new Set<number>(); let checkRoomNamesHint = false;
  const rooms = derived.faces.map((face, i) => {
    let source = exact.get(faceKeys[i]!) ?? -1;
    let inherit = source >= 0;
    if (!inherit) {
      const candidates = [...overlaps[i]!].map(([n, overlap]) => ({ n, overlap, area: oldAreas[n]! }))
        .sort((a, b) => b.overlap - a.overlap || a.n - b.n);
      if (candidates.length) {
        source = candidates[0]!.n;
        const candidate = candidates[0]!, union = candidate.area + face.clearAreaMm2 - candidate.overlap;
        const siblings = siblingsByOld.get(source) ?? [];
        if (candidates.length > 1 && siblings.length === 1) {
          // Merge: larger original clear area wins, not centroid or incidental overlap order.
          const byArea = [...candidates].sort((a, b) => b.area - a.area || a.n - b.n);
          if (byArea.length > 1 && byArea[0]!.area === byArea[1]!.area)
            throw new GeometryError('ambiguous-room', 'Choose which room name and material to keep.');
          source = byArea[0]!.n; inherit = true; checkRoomNamesHint = true;
        } else if (candidate.overlap / union >= 0.8 && (candidates.length === 1 || candidate.overlap > candidates[1]!.overlap)) inherit = true;
        else if (siblings.length > 1) {
          const majority = siblings.filter(s => s.overlap >= candidate.area / 2);
          if (majority.length !== 1) throw new GeometryError('ambiguous-room', 'Choose which split room keeps the original name and material.');
          inherit = majority[0]!.n === i; checkRoomNamesHint = true;
        } else throw new GeometryError('ambiguous-room', 'This edit changes the room identity; choose which properties to retain.');
      }
    }
    if (inherit && assigned.has(source)) throw new GeometryError('ambiguous-room', 'More than one room would inherit the same identity.');
    if (inherit) assigned.add(source);
    const properties = source >= 0 ? old[source]!.room : null;
    const id = inherit ? properties!.id : freshId('room', used);
    face.roomId = id;
    const room: Room = properties ? { ...properties, id, boundary: [...face.boundary] } : {
      id, floorId: plan.junctions.find(j => j.id === face.boundary[0])!.floorId, boundary: [...face.boundary],
      name: 'Room', type: 'other', ceilingHeight: 3000, floorMaterial: 'm_default', rev: 0,
    };
    return room;
  });
  return { rooms, checkRoomNamesHint };
}

