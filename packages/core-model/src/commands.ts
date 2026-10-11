import { assignRooms, bounds, candidatePairs, derivePlan, endpoints, freshId, GeometryError, normalizePlan, wallLength } from '@gharplan/geometry';
import type { Draft } from 'immer';
import type { FurnitureItem, Opening, ProjectDoc, Room, RoomType, Wall } from './types';

interface CommandBase { id: string; baseGeneration: number }
export type Command = CommandBase & (
  | { type: 'AddWall'; from: readonly [number, number]; to: readonly [number, number]; thickness: number; height: number }
  | { type: 'AddRectangle'; x: number; y: number; width: number; depth: number; thickness: number; height: number }
  | { type: 'MoveJunctions'; moves: { junction: string; to: readonly [number, number] }[] }
  | { type: 'MoveWall'; wallId: string; dx: number; dy: number }
  | { type: 'DeleteWall'; wallId: string; deleteDependents: boolean }
  | { type: 'ReverseWall'; wallId: string }
  | { type: 'UpdateWall'; wallId: string; properties: Partial<Pick<Wall, 'thickness' | 'height' | 'leftMaterial' | 'rightMaterial'>> }
  | { type: 'AddOpening'; opening: Omit<Opening, 'rev'> }
  | { type: 'UpdateOpening'; openingId: string; properties: Partial<Pick<Opening, 'offset' | 'width' | 'height' | 'sill' | 'flipX' | 'flipY'>> }
  | { type: 'DeleteOpening'; openingId: string }
  | { type: 'AddFurniture'; furniture: Omit<FurnitureItem, 'rev'> }
  | { type: 'UpdateFurniture'; furnitureId: string; properties: Partial<Pick<FurnitureItem, 'position' | 'elevation' | 'rotationDeg' | 'size' | 'materialOverrides'>> }
  | { type: 'DeleteFurniture'; furnitureId: string }
  | { type: 'UpdateRoom'; roomId: string; properties: Partial<Pick<Room, 'name' | 'ceilingHeight' | 'floorMaterial'>> & { type?: RoomType } }
  | { type: 'RenameProject'; name: string }
  | { type: 'SetUnits'; units: 'metric' | 'imperial' }
);
export interface CommandEffects { changedIds: string[]; checkRoomNamesHint: boolean }
function requireEntity<T extends { id: string }>(entities: T[], id: string): T {
  const entity = entities.find(e => e.id === id);
  if (!entity) throw new GeometryError('entity', 'The selected entity no longer exists.', [id]); return entity;
}
function assignProperties<T extends object>(entity: T, properties: object, allowed: readonly string[]): void {
  if (Object.keys(properties).some(key => !allowed.includes(key))) throw new GeometryError('command-properties', 'This command contains unsupported property changes.');
  Object.assign(entity, properties);
}
function syncEntities<T extends { id: string }>(target: T[], values: T[]): void {
  // Preserve unchanged object identity and produce small patches when IDs/order are stable.
  for (let i = 0; i < values.length; i++) {
    const wanted = values[i]!;
    if (target[i]?.id !== wanted.id) {
      const existing = target.findIndex((v, n) => n >= i && v.id === wanted.id);
      if (existing >= 0) target.splice(i, 0, target.splice(existing, 1)[0]!); else target.splice(i, 0, wanted);
    }
    const item = target[i]!;
    for (const key of Object.keys(wanted) as (keyof T)[]) if (JSON.stringify(item[key]) !== JSON.stringify(wanted[key])) item[key] = wanted[key];
  }
  if (target.length > values.length) target.splice(values.length);
}
export function applyCommand(draft: Draft<ProjectDoc>, previous: ProjectDoc, command: Command): CommandEffects {
  let geometryChanged = false;
  const wall = (id: string) => requireEntity(draft.walls, id);
  const addWall = (from: readonly [number, number], to: readonly [number, number], thickness: number, height: number) => {
    const used = new Set([draft.id, ...[draft.floors, draft.junctions, draft.walls, draft.openings, draft.rooms, draft.furniture, draft.materials, draft.lights, draft.cameras].flat().map(e => e.id)]);
    const endpoint = ([x, y]: readonly [number, number]) => {
      const existing = draft.junctions.find(j => j.x === x && j.y === y && j.floorId === draft.floors[0]!.id);
      if (existing) return existing.id;
      const id = freshId('junction', used); draft.junctions.push({ id, floorId: draft.floors[0]!.id, x, y }); return id;
    };
    const a = endpoint(from), b = endpoint(to);
    draft.walls.push({ id: freshId('wall', used), floorId: draft.floors[0]!.id, a, b, thickness, height,
      leftMaterial: draft.materials[0]!.id, rightMaterial: draft.materials[0]!.id, rev: 0 }); geometryChanged = true;
  };
  switch (command.type) {
    case 'AddWall': addWall(command.from, command.to, command.thickness, command.height); break;
    case 'AddRectangle': {
      if (command.width < 300 || command.depth < 300) throw new GeometryError('rectangle-size', 'Room centreline width and depth must be at least 300 mm.');
      const { x, y, width: w, depth: d, thickness: t, height: h } = command;
      addWall([x, y], [x + w, y], t, h); addWall([x + w, y], [x + w, y + d], t, h);
      addWall([x + w, y + d], [x, y + d], t, h); addWall([x, y + d], [x, y], t, h); break;
    }
    case 'MoveJunctions': {
      const seen = new Set<string>();
      for (const move of command.moves) {
        if (seen.has(move.junction)) throw new GeometryError('duplicate-move', 'A junction can only be moved once.'); seen.add(move.junction);
        const j = requireEntity(draft.junctions, move.junction); j.x = move.to[0]; j.y = move.to[1];
      }
      geometryChanged = true; break;
    }
    case 'MoveWall': {
      if (!Number.isSafeInteger(command.dx) || !Number.isSafeInteger(command.dy)) throw new GeometryError('command-delta', 'Wall movement must use integer mm.');
      const selected = wall(command.wallId);
      for (const id of [selected.a, selected.b]) { const j = requireEntity(draft.junctions, id); j.x += command.dx; j.y += command.dy; }
      geometryChanged = true; break;
    }
    case 'DeleteWall': {
      if (typeof command.deleteDependents !== 'boolean') throw new GeometryError('command-consent', 'Dependent deletion requires a boolean confirmation.');
      const index = draft.walls.findIndex(w => w.id === command.wallId); wall(command.wallId);
      if (draft.openings.some(o => o.wallId === command.wallId) && !command.deleteDependents)
        throw new GeometryError('dependent-openings', 'Confirm deletion of this wall and its doors/windows.', [command.wallId]);
      draft.openings = draft.openings.filter(o => o.wallId !== command.wallId); draft.walls.splice(index, 1); geometryChanged = true; break;
    }
    case 'ReverseWall': {
      const w = wall(command.wallId), length = wallLength(draft, w);
      [w.a, w.b] = [w.b, w.a]; [w.leftMaterial, w.rightMaterial] = [w.rightMaterial, w.leftMaterial];
      for (const o of draft.openings.filter(o => o.wallId === w.id)) { o.offset = length - o.offset; o.flipX = !o.flipX; }
      geometryChanged = true; break;
    }
    case 'UpdateWall': assignProperties(wall(command.wallId), command.properties, ['thickness', 'height', 'leftMaterial', 'rightMaterial']); geometryChanged = true; break;
    case 'AddOpening': draft.openings.push({ ...command.opening, rev: 0 }); break;
    case 'UpdateOpening': assignProperties(requireEntity(draft.openings, command.openingId), command.properties, ['offset', 'width', 'height', 'sill', 'flipX', 'flipY']); break;
    case 'DeleteOpening': requireEntity(draft.openings, command.openingId); draft.openings.splice(draft.openings.findIndex(o => o.id === command.openingId), 1); break;
    case 'AddFurniture': draft.furniture.push({ ...command.furniture, rev: 0 }); break;
    case 'UpdateFurniture': assignProperties(requireEntity(draft.furniture, command.furnitureId), command.properties, ['position', 'elevation', 'rotationDeg', 'size', 'materialOverrides']); break;
    case 'DeleteFurniture': requireEntity(draft.furniture, command.furnitureId); draft.furniture.splice(draft.furniture.findIndex(f => f.id === command.furnitureId), 1); break;
    case 'UpdateRoom': assignProperties(requireEntity(draft.rooms, command.roomId), command.properties, ['name', 'type', 'ceilingHeight', 'floorMaterial']); break;
    case 'RenameProject': draft.name = command.name; break;
    case 'SetUnits': draft.units = command.units; break;
    default: throw new GeometryError('command', 'Unsupported project command.');
  }
  let checkRoomNamesHint = false;
  if (geometryChanged) {
    const reservedIds = [draft.id, ...[draft.floors, draft.openings, draft.furniture, draft.materials, draft.lights, draft.cameras].flat().map(e => e.id)];
    const normalized = normalizePlan(draft, reservedIds);
    if ((command.type === 'AddWall' || command.type === 'AddRectangle') && JSON.stringify(normalized.plan.walls) === JSON.stringify(previous.walls))
      normalized.plan.junctions = previous.junctions.map(j => ({ ...j }));
    const derived = derivePlan(normalized.plan), assignment = assignRooms(previous, normalized.plan, derived, reservedIds);
    const rooms = assignment.rooms.map(r => ({ ...r, floorMaterial: r.floorMaterial === 'm_default' && !draft.materials.some(m => m.id === 'm_default') ? draft.materials[0]!.id : r.floorMaterial }));
    for (const o of draft.openings) {
      const lineage = normalized.lineage.find(l => l.wallId === o.wallId);
      if (!lineage) throw new GeometryError('opening-host', 'Opening host was removed without explicit deletion.', [o.id]);
      const child = lineage.children.find(c => o.offset - o.width / 2 >= c.start && o.offset + o.width / 2 <= c.end);
      if (!child) throw new GeometryError('opening-split', 'A wall split passes through a door/window.', [o.id]);
      const offset = child.reversed ? child.end - o.offset : o.offset - child.start;
      o.wallId = child.id; o.offset = offset; if (child.reversed) o.flipX = !o.flipX;
    }
    syncEntities(draft.junctions, normalized.plan.junctions); syncEntities(draft.walls, normalized.plan.walls); syncEntities(draft.rooms, rooms);
    checkRoomNamesHint = assignment.checkRoomNamesHint;
  }
  const changed = new Set<string>();
  // Mesh cache dependencies include cutouts and neighbour-owned junction footprints.
  const dirtyWalls = new Set<string>();
  for (const o of draft.openings) {
    const old = previous.openings.find(p => p.id === o.id);
    if (JSON.stringify(o) !== JSON.stringify(old)) { dirtyWalls.add(o.wallId); if (old) dirtyWalls.add(old.wallId); }
  }
  for (const o of previous.openings) if (!draft.openings.some(n => n.id === o.id)) dirtyWalls.add(o.wallId);
  if (geometryChanged) {
    const before = derivePlan(previous).footprints, after = derivePlan(draft).footprints;
    for (const w of draft.walls) if (JSON.stringify(before.filter(p => p.ownerId === w.id)) !== JSON.stringify(after.filter(p => p.ownerId === w.id))) dirtyWalls.add(w.id);
    // Geometry changes may be masked at ground level by a short wide wall. Conservatively
    // invalidate nearby owners in all height bands; 500 mm encloses every allowed cap.
    const signature = (plan: ProjectDoc, w: Wall) => JSON.stringify([endpoints(plan, w).map(j => [j.x, j.y]), w.thickness, w.height]);
    const changedGeometry = new Set(previous.walls.filter(w => {
      const next = draft.walls.find(n => n.id === w.id); return !next || signature(previous, w) !== signature(draft, next);
    }).map(w => w.id));
    for (const w of draft.walls) if (!previous.walls.some(o => o.id === w.id)) changedGeometry.add(w.id);
    if (changedGeometry.size) {
      const entries = [...previous.walls.map(w => ({ w, plan: previous })), ...draft.walls.map(w => ({ w, plan: draft }))];
      const boxes = entries.map(({ w, plan }) => {
        const r = bounds(endpoints(plan, w).map(j => [j.x, j.y]));
        return [r[0] - 500, r[1] - 500, r[2] + 500, r[3] + 500] as const;
      });
      for (const [a, b] of candidatePairs(boxes)) {
        const x = entries[a]!.w.id, y = entries[b]!.w.id;
        if (changedGeometry.has(x) || changedGeometry.has(y)) { dirtyWalls.add(x); dirtyWalls.add(y); }
      }
    }
  }
  const oldJunctions = new Map(previous.junctions.map(j => [j.id, j]));
  for (const j of draft.junctions) if (JSON.stringify(j) !== JSON.stringify(oldJunctions.get(j.id))) changed.add(j.id);
  for (const j of previous.junctions) if (!draft.junctions.some(n => n.id === j.id)) changed.add(j.id);
  const groups = ['walls', 'openings', 'rooms', 'furniture', 'lights', 'materials', 'cameras'] as const;
  for (const group of groups) {
    const old = new Map<string, { id: string }>(previous[group].map(e => [e.id, e]));
    for (const e of draft[group]) {
      const oldEntity = old.get(e.id), ownChange = JSON.stringify(e) !== JSON.stringify(oldEntity);
      const geometryDependency = group === 'walls' && (dirtyWalls.has(e.id) || changed.has((e as Wall).a) || changed.has((e as Wall).b)) ||
        group === 'rooms' && ((e as Room).boundary.some(id => changed.has(id)) || draft.walls.some(w => changed.has(w.id) && (e as Room).boundary.includes(w.a) && (e as Room).boundary.includes(w.b))) ||
        group === 'openings' && changed.has((e as Opening).wallId);
      if (ownChange || geometryDependency) {
        changed.add(e.id);
        if ('rev' in e) e.rev = oldEntity && 'rev' in oldEntity ? (oldEntity.rev as number) + 1 : 0;
      }
    }
    for (const id of old.keys()) if (!draft[group].some(e => e.id === id)) changed.add(id);
  }
  return { changedIds: [...changed], checkRoomNamesHint };
}
