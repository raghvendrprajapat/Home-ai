import { assertCoordinate, bounds, freshId, pointKey, simplifyCorners } from './primitives';
import { candidatePairs } from './spatial';
import { GeometryError, MIN_WALL_LENGTH } from './types';
import type { Junction, Lineage, Plan, Point, Wall } from './types';

export function endpoints(plan: Plan, wall: Wall, index?: ReadonlyMap<string, Junction>): [Junction, Junction] {
  const a = index ? index.get(wall.a) : plan.junctions.find(j => j.id === wall.a);
  const b = index ? index.get(wall.b) : plan.junctions.find(j => j.id === wall.b);
  if (!a || !b) throw new GeometryError('dangling-reference', 'Wall endpoints must exist.', [wall.id]);
  return [a, b];
}
export function wallLength(plan: Plan, wall: Wall): number {
  const [a, b] = endpoints(plan, wall); return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
export function validateInputs(plan: Plan): void {
  if (plan.walls.length > 2000 || plan.junctions.length > 4000)
    throw new GeometryError('capacity', 'L0 supports at most 2000 walls and 4000 junctions.');
  const ids = new Set<string>();
  for (const entity of [...plan.junctions, ...plan.walls, ...plan.rooms]) {
    if (typeof entity.id !== 'string' || !entity.id.length || ids.has(entity.id))
      throw new GeometryError('duplicate-id', 'Every geometry entity needs a unique ID.');
    ids.add(entity.id);
  }
  for (const j of plan.junctions) { assertCoordinate(j.x); assertCoordinate(j.y); }
  const index = new Map(plan.junctions.map(j => [j.id, j]));
  const roomCycles = new Set<string>();
  for (const room of plan.rooms) {
    // Transitional room boundaries may reference removed junctions during normalization;
    // core-model validates final references after room recomputation. Check intact cycles here.
    const points = room.boundary.map(id => index.get(id));
    if (points.some(p => !p)) continue;
    if (points.some(p => p!.floorId !== room.floorId))
      throw new GeometryError('room-floor', 'A room boundary must be on its own floor.', [room.id]);
    const corners = simplifyCorners(points.map(p => [p!.x, p!.y]));
    const keys = corners.map(pointKey);
    const rotations = (ids: string[]) => ids.map((_, i) => [...ids.slice(i), ...ids.slice(0, i)].join(';'));
    const key = `${room.floorId}:` + [...rotations(keys), ...rotations([...keys].reverse())].sort()[0];
    if (roomCycles.has(key)) throw new GeometryError('duplicate-room', 'Two rooms cannot own the same bounded face.', [room.id]);
    roomCycles.add(key);
  }
  for (const w of plan.walls) {
    const [a, b] = endpoints(plan, w, index);
    if (w.a === w.b || (a.x === b.x && a.y === b.y))
      throw new GeometryError('zero-length', 'Wall endpoints must differ.', [w.id]);
    if (w.floorId !== a.floorId || w.floorId !== b.floorId)
      throw new GeometryError('floor', 'Wall endpoints must be on the same floor.', [w.id]);
    if (a.x !== b.x && a.y !== b.y)
      throw new GeometryError('non-orthogonal', 'L0 walls must be horizontal or vertical.', [w.id]);
    if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) < MIN_WALL_LENGTH)
      throw new GeometryError('too-short', 'Walls must be at least 10 mm long.', [w.id]);
    if (!Number.isInteger(w.thickness) || w.thickness < 50 || w.thickness > 1000)
      throw new GeometryError('thickness', 'Wall thickness must be 50–1000 integer mm.', [w.id]);
    if (!Number.isInteger(w.height) || w.height < 1000 || w.height > 6000)
      throw new GeometryError('height', 'Wall height must be 1000–6000 integer mm.', [w.id]);
  }
}
function onSegment(p: Junction, a: Junction, b: Junction): boolean {
  return p.floorId === a.floorId &&
    ((a.x === b.x && p.x === a.x && p.y >= Math.min(a.y, b.y) && p.y <= Math.max(a.y, b.y)) ||
     (a.y === b.y && p.y === a.y && p.x >= Math.min(a.x, b.x) && p.x <= Math.max(a.x, b.x)));
}
function sameProperties(a: Wall, b: Wall, reversed: boolean): boolean {
  return a.thickness === b.thickness && a.height === b.height && a.floorId === b.floorId &&
    a.leftMaterial === (reversed ? b.rightMaterial : b.leftMaterial) &&
    a.rightMaterial === (reversed ? b.leftMaterial : b.rightMaterial);
}
function wallBoxes(plan: Plan) {
  const index = new Map(plan.junctions.map(j => [j.id, j]));
  return plan.walls.map(w => bounds(endpoints(plan, w, index).map(j => [j.x, j.y] as Point)));
}

/** One union pass + one node/split pass, with exact integer positions; no convergence loop. */
export function normalizePlan(input: Plan): { plan: Plan; lineage: Lineage[] } {
  validateInputs(input);
  const plan: Plan = { junctions: input.junctions.map(j => ({ ...j })), walls: input.walls.map(w => ({ ...w })), rooms: input.rooms.map(r => ({ ...r, boundary: [...r.boundary] })) };
  const used = new Set([...plan.junctions, ...plan.walls, ...plan.rooms].map(e => e.id));
  const coords = new Map<string, Junction>(); const remap = new Map<string, string>();
  plan.junctions = plan.junctions.filter(j => {
    const key = `${j.floorId}:${pointKey([j.x, j.y])}`, old = coords.get(key);
    if (old) { remap.set(j.id, old.id); return false; }
    coords.set(key, j); return true;
  });
  for (const w of plan.walls) { w.a = remap.get(w.a) ?? w.a; w.b = remap.get(w.b) ?? w.b; }
  const index = new Map(plan.junctions.map(j => [j.id, j]));
  const parent = plan.walls.map((_, i) => i);
  const root = (i: number): number => { while (parent[i] !== i) i = parent[i]!; return i; };
  for (const [i, j] of candidatePairs(wallBoxes(plan))) {
    const w = plan.walls[i]!, v = plan.walls[j]!;
    if (w.floorId !== v.floorId) continue;
    const [a, b] = endpoints(plan, w, index), [c, d] = endpoints(plan, v, index);
    const horizontal = a.y === b.y;
    if (horizontal !== (c.y === d.y)) continue;
    const lo1 = horizontal ? Math.min(a.x, b.x) : Math.min(a.y, b.y);
    const hi1 = horizontal ? Math.max(a.x, b.x) : Math.max(a.y, b.y);
    const lo2 = horizontal ? Math.min(c.x, d.x) : Math.min(c.y, d.y);
    const hi2 = horizontal ? Math.max(c.x, d.x) : Math.max(c.y, d.y);
    if (Math.min(hi1, hi2) <= Math.max(lo1, lo2)) continue;
    const reversed = horizontal ? (b.x - a.x) * (d.x - c.x) < 0 : (b.y - a.y) * (d.y - c.y) < 0;
    if (!sameProperties(w, v, reversed))
      throw new GeometryError('collinear-conflict', 'Overlapping walls have conflicting properties.', [w.id, v.id]);
    const r1 = root(i), r2 = root(j); parent[Math.max(r1, r2)] = Math.min(r1, r2);
  }
  const groups = new Map<number, Wall[]>();
  plan.walls.forEach((w, i) => { const r = root(i); groups.set(r, [...(groups.get(r) ?? []), w]); });
  plan.walls = [...groups.values()].map(group => {
    const first = group[0]!; if (group.length === 1) return first;
    const [a, b] = endpoints(plan, first, index); const horizontal = a.y === b.y;
    const all = group.flatMap(w => endpoints(plan, w, index));
    all.sort((p, q) => horizontal ? p.x - q.x : p.y - q.y);
    const forward = horizontal ? b.x > a.x : b.y > a.y;
    return { ...first, a: (forward ? all[0]! : all.at(-1)!).id, b: (forward ? all.at(-1)! : all[0]!).id };
  });
  const splits = new Map<string, Set<string>>(plan.walls.map(w => [w.id, new Set([w.a, w.b])]));
  for (const [i, j] of candidatePairs(wallBoxes(plan))) {
    const w = plan.walls[i]!, v = plan.walls[j]!;
    if (w.floorId !== v.floorId) continue;
    const [a, b] = endpoints(plan, w, index), [c, d] = endpoints(plan, v, index);
    if ((a.y === b.y) !== (c.y === d.y)) {
      const [h1, h2, v1, v2] = a.y === b.y ? [a, b, c, d] : [c, d, a, b];
      if (v1.x > Math.min(h1.x, h2.x) && v1.x < Math.max(h1.x, h2.x) &&
          h1.y > Math.min(v1.y, v2.y) && h1.y < Math.max(v1.y, v2.y))
        throw new GeometryError('x-crossing', 'X-crossings are not supported in L0.', [w.id, v.id]);
    }
    for (const p of [c, d]) if (onSegment(p, a, b)) splits.get(w.id)!.add(p.id);
    for (const p of [a, b]) if (onSegment(p, c, d)) splits.get(v.id)!.add(p.id);
  }
  plan.walls = plan.walls.flatMap(w => {
    const [a] = endpoints(plan, w, index);
    const sorted = [...splits.get(w.id)!].map(id => index.get(id)!).sort((p, q) =>
      (Math.abs(p.x - a.x) + Math.abs(p.y - a.y)) - (Math.abs(q.x - a.x) + Math.abs(q.y - a.y)));
    const parts = sorted.slice(1).map((b, i) => ({ a: sorted[i]!, b }));
    const lengths = parts.map(({ a, b }) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y));
    const longest = lengths.indexOf(Math.max(...lengths));
    return parts.map(({ a, b }, i) => ({ ...w, id: i === longest ? w.id : freshId(w.id, used), a: a.id, b: b.id }));
  });
  const referenced = new Set(plan.walls.flatMap(w => [w.a, w.b]));
  plan.junctions = plan.junctions.filter(j => referenced.has(j.id));
  validateInputs(plan); validateTopology(plan);
  const oldIndex = new Map(input.junctions.map(j => [j.id, j]));
  const lineKey = (w: Wall, a: Junction, b: Junction) => `${w.floorId}:${a.y === b.y ? `y:${a.y}` : `x:${a.x}`}`;
  const lines = new Map<string, Wall[]>();
  for (const w of plan.walls) {
    const [a, b] = endpoints(plan, w, index), key = lineKey(w, a, b);
    lines.set(key, [...(lines.get(key) ?? []), w]);
  }
  const lineage = input.walls.map(old => {
    const [a, b] = endpoints(input, old, oldIndex); const horizontal = a.y === b.y;
    const direction = horizontal ? Math.sign(b.x - a.x) : Math.sign(b.y - a.y);
    const length = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    const children = (lines.get(lineKey(old, a, b)) ?? []).flatMap(w => {
      if (w.floorId !== old.floorId) return [];
      const [c, d] = endpoints(plan, w, index);
      if (horizontal ? c.y !== a.y || d.y !== a.y : c.x !== a.x || d.x !== a.x) return [];
      const s = (horizontal ? c.x - a.x : c.y - a.y) * direction;
      const e = (horizontal ? d.x - a.x : d.y - a.y) * direction;
      if (Math.min(s, e) >= length || Math.max(s, e) <= 0) return [];
      return [{ id: w.id, start: Math.min(s, e), end: Math.max(s, e), reversed: e < s }];
    }).sort((c, d) => c.start - d.start);
    return { wallId: old.id, children };
  });
  return { plan, lineage };
}

export function validateTopology(plan: Plan): void {
  validateInputs(plan);
  const coords = new Set<string>();
  const index = new Map(plan.junctions.map(j => [j.id, j]));
  const degrees = new Map<string, number>();
  for (const w of plan.walls) for (const id of [w.a, w.b]) degrees.set(id, (degrees.get(id) ?? 0) + 1);
  for (const j of plan.junctions) {
    const key = `${j.floorId}:${pointKey([j.x, j.y])}`;
    if (coords.has(key)) throw new GeometryError('duplicate-junction', 'Coincident junctions must share one ID.');
    coords.add(key);
    const degree = degrees.get(j.id) ?? 0;
    if (degree > 3) throw new GeometryError('x-junction', 'Four-way junctions are not supported in L0.', [j.id]);
  }
  for (const [i, j] of candidatePairs(wallBoxes(plan))) {
    const w = plan.walls[i]!, v = plan.walls[j]!;
    if (w.floorId !== v.floorId) continue;
    const [a, b] = endpoints(plan, w, index), [c, d] = endpoints(plan, v, index);
    const shared = [w.a, w.b].filter(id => id === v.a || id === v.b);
    if (shared.length === 2) throw new GeometryError('duplicate-wall', 'Duplicate wall endpoints.', [w.id, v.id]);
    if ((a.y === b.y) === (c.y === d.y)) {
      const horizontal = a.y === b.y;
      const overlap = horizontal ? Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) - Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)) :
        Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) - Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y));
      if (overlap > 0) throw new GeometryError('overlap', 'Collinear overlap must be normalized.', [w.id, v.id]);
    } else if (!shared.length) throw new GeometryError('unjoined', 'Intersecting walls must share a junction.', [w.id, v.id]);
  }
}
