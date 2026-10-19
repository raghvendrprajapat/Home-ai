import { assignRooms, bounds, candidatePairs, derivePlan, detectFaces, endpoints, freshId, GeometryError, normalizePlan, wallLength } from '@gharplan/geometry';
import type { Draft } from 'immer';
import type { Floor, FurnitureItem, MaterialDef, Opening, ProjectDoc, Roof, Room, RoomType, Stair, Wall } from './types';
import {canonicalStringify} from './serialization';
import type { RoomIdentityChoice } from '@gharplan/geometry';

interface CommandBase { id: string; baseGeneration: number; roomChoices?: readonly RoomIdentityChoice[] }
export type FurnitureAlignMode = 'left' | 'right' | 'top' | 'bottom' | 'centreX' | 'centreY';
export const FURNITURE_ALIGN_MODES: readonly FurnitureAlignMode[] = ['left', 'right', 'top', 'bottom', 'centreX', 'centreY'];
/** FR-034: at most this many floors (ground + 5). */
export const MAX_FLOORS = 6;
/** D73: most furniture items one AddFurnitureBatch command may add. */
export const MAX_FURNITURE_BATCH = 20;
/** D76: most surfaces one ApplySurfaceMaterials command may paint. */
export const MAX_SURFACE_BATCH = 1000;
/** Pivot used by RotateFurniture: the integer-rounded centre of the items' combined axis-aligned footprint box. */
export function furnitureTurnPivot(items: readonly Pick<FurnitureItem, 'position' | 'size' | 'rotationDeg'>[]): [number, number] {
  if (!items.length) throw new GeometryError('selection', 'Choose furniture to turn.');
  const boxes = items.map(item => {
    const r = item.rotationDeg * Math.PI / 180, hx = (Math.abs(Math.cos(r)) * item.size.w + Math.abs(Math.sin(r)) * item.size.d) / 2, hy = (Math.abs(Math.sin(r)) * item.size.w + Math.abs(Math.cos(r)) * item.size.d) / 2;
    return [item.position.x - hx, item.position.y - hy, item.position.x + hx, item.position.y + hy] as const;
  });
  return [Math.round((Math.min(...boxes.map(b => b[0])) + Math.max(...boxes.map(b => b[2]))) / 2), Math.round((Math.min(...boxes.map(b => b[1])) + Math.max(...boxes.map(b => b[3]))) / 2)];
}
/** The one furniture override slot the renderer understands: the model's main (largest) material. */
export const FURNITURE_FINISH_SLOT = 'main';
export type SurfaceMaterialTarget={kind:'wall';id:string;side:'left'|'right'}|{kind:'floor';id:string};
export type Command = CommandBase & (
  | { type: 'AddWall'; from: readonly [number, number]; to: readonly [number, number]; thickness: number; height: number; floorId?: string }
  | { type: 'AddRectangle'; x: number; y: number; width: number; depth: number; thickness: number; height: number; floorId?: string }
  | { type: 'AddFloor'; name: string; copyOutlineFrom?: string }
  | { type: 'UpdateFloor'; floorId: string; properties: Partial<Pick<Floor, 'name' | 'elevation' | 'defaultWallHeight'>> }
  | { type: 'DeleteFloor'; floorId: string }
  | { type: 'MoveJunctions'; moves: { junction: string; to: readonly [number, number] }[]; openingPlacement?: 'a' | 'b' | 'centre' }
  | { type: 'MoveWall'; wallId: string; dx: number; dy: number }
  | { type: 'DeleteWall'; wallId: string; deleteDependents: boolean }
  | { type: 'ReverseWall'; wallId: string }
  | { type: 'UpdateWall'; wallId: string; properties: Partial<Pick<Wall, 'thickness' | 'height' | 'leftMaterial' | 'rightMaterial'>> }
  | { type:'ApplySurfaceMaterial';target:SurfaceMaterialTarget;material:MaterialDef }
  | { type:'ApplySurfaceMaterials';targets:readonly SurfaceMaterialTarget[];material:MaterialDef }
  | { type: 'SetFurnitureFinish'; furnitureIds: readonly string[]; material: MaterialDef | null }
  | { type: 'AddOpening'; opening: Omit<Opening, 'rev'> }
  | { type: 'UpdateOpening'; openingId: string; properties: Partial<Pick<Opening, 'offset' | 'width' | 'height' | 'sill' | 'flipX' | 'flipY'>> }
  | { type: 'DeleteOpening'; openingId: string }
  | { type: 'AddFurniture'; furniture: Omit<FurnitureItem, 'rev'> }
  | { type: 'AddFurnitureBatch'; furniture: readonly Omit<FurnitureItem, 'rev'>[] }
  | { type: 'UpdateFurniture'; furnitureId: string; properties: Partial<Pick<FurnitureItem, 'position' | 'elevation' | 'rotationDeg' | 'size' | 'materialOverrides'>> }
  | { type: 'DeleteFurniture'; furnitureId: string }
  | { type: 'DeleteSelection'; wallIds: readonly string[]; openingIds: readonly string[]; furnitureIds: readonly string[]; deleteDependents: boolean }
  | { type: 'DuplicateFurniture'; furnitureIds: readonly string[] }
  | { type: 'AlignFurniture'; furnitureIds: readonly string[]; mode: FurnitureAlignMode }
  | { type: 'RotateFurniture'; furnitureIds: readonly string[]; deltaDeg: number }
  | { type: 'GroupFurniture'; furnitureIds: readonly string[] }
  | { type: 'UngroupFurniture'; furnitureIds: readonly string[] }
  | { type: 'MoveFurniture'; furnitureIds: readonly string[]; dx: number; dy: number }
  | { type: 'UpdateRoom'; roomId: string; properties: Partial<Pick<Room, 'name' | 'ceilingHeight' | 'floorMaterial'>> & { type?: RoomType } }
  | { type:'AddCameraPreset'; camera:Omit<import('./types').CameraPreset,'id'> }
  | { type:'DeleteCameraPreset'; cameraId:string }
  | { type: 'AddStair'; stair: Omit<Stair, 'id' | 'rev' | 'material'>; material: MaterialDef }
  | { type: 'UpdateStair'; stairId: string; properties: Partial<Pick<Stair, 'position' | 'rotationDeg' | 'width' | 'length' | 'height' | 'steps'>> }
  | { type: 'DeleteStair'; stairId: string }
  | { type: 'SetRoof'; floorId: string; roof: Pick<Roof, 'kind' | 'pitchDeg' | 'overhang' | 'ridgeAxis'> | null; material?: MaterialDef }
  | { type: 'RenameProject'; name: string }
  | { type: 'SetUnits'; units: 'metric' | 'imperial' }
);
export interface CommandEffects { changedIds: string[]; checkRoomNamesHint: boolean }
/** Every entity ID in the document, for fresh-ID generation. Stairs and roofs (FR-035) are optional arrays. */
export function entityIds(d: ProjectDoc | Draft<ProjectDoc>): string[] {
  return [d.id, ...[d.floors, d.junctions, d.walls, d.openings, d.rooms, d.furniture, d.materials, d.lights, d.cameras, d.stairs ?? [], d.roofs ?? []].flat().map(e => e.id)];
}
function requireEntity<T extends { id: string }>(entities: T[], id: string): T {
  const entity = entities.find(e => e.id === id);
  if (!entity) throw new GeometryError('entity', 'The selected entity no longer exists.', [id]); return entity;
}
function floorName(name: unknown): string {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 60) throw new GeometryError('floor-name', 'Give the floor a name of 1-60 characters.');
  return name.trim();
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
  if ('openingPlacement' in command && command.openingPlacement !== undefined &&
      (command.type !== 'MoveJunctions' || !['a', 'b', 'centre'].includes(command.openingPlacement)))
    throw new GeometryError('opening-placement', 'Opening placement must be A, B or centre on a junction movement.');
  const wall = (id: string) => requireEntity(draft.walls, id);
  const installMaterial = (material: MaterialDef) => {
    if (!material || typeof material !== 'object' || Array.isArray(material) || typeof material.id !== 'string') throw new GeometryError('command-properties', 'Choose a valid material.');
    const existing = draft.materials.find(m => m.id === material.id);
    if (existing && canonicalStringify(existing) !== canonicalStringify(material)) throw new GeometryError('material-conflict', 'This material ID already has a different definition.', [material.id]);
    if (!existing) draft.materials.push({ ...material });
  };
  // FR-034: wall tools draw on the requested floor (default: the first floor, as before multi-floor projects).
  const floorId = (command.type === 'AddWall' || command.type === 'AddRectangle') && command.floorId !== undefined ? requireEntity(draft.floors, command.floorId).id : draft.floors[0]!.id;
  const addWall = (from: readonly [number, number], to: readonly [number, number], thickness: number, height: number, materials?: Pick<Wall, 'leftMaterial' | 'rightMaterial'>) => {
    const used = new Set([...entityIds(draft)]);
    const endpoint = ([x, y]: readonly [number, number]) => {
      const existing = draft.junctions.find(j => j.x === x && j.y === y && j.floorId === floorId);
      if (existing) return existing.id;
      const id = freshId('junction', used); draft.junctions.push({ id, floorId, x, y }); return id;
    };
    const a = endpoint(from), b = endpoint(to);
    draft.walls.push({ id: freshId('wall', used), floorId, a, b, thickness, height,
      leftMaterial: materials?.leftMaterial ?? draft.materials[0]!.id, rightMaterial: materials?.rightMaterial ?? draft.materials[0]!.id, rev: 0 }); geometryChanged = true;
  };
  switch (command.type) {
    case 'AddWall': addWall(command.from, command.to, command.thickness, command.height); break;
    case 'AddRectangle': {
      if (![command.x, command.y, command.width, command.depth, command.thickness, command.height].every(Number.isSafeInteger) ||
          Math.abs(command.x) > 100000 || Math.abs(command.y) > 100000 || Math.abs(command.x + command.width) > 100000 || Math.abs(command.y + command.depth) > 100000)
        throw new GeometryError('rectangle-coordinates', 'Room dimensions and coordinates must use integer mm within the drawing limits.');
      if (command.width < 300 || command.depth < 300) throw new GeometryError('rectangle-size', 'Room centreline width and depth must be at least 300 mm.');
      const { x, y, width: w, depth: d, thickness: t, height: h } = command;
      const side = (from: readonly [number, number], to: readonly [number, number]) => {
        const horizontal = from[1] === to[1], axis = horizontal ? 0 : 1, other = horizontal ? 1 : 0;
        const lo = Math.min(from[axis], to[axis]), hi = Math.max(from[axis], to[axis]), forward = to[axis] > from[axis];
        const shared = previous.walls.filter(wall => wall.floorId === floorId).flatMap(wall => {
          const [a, b] = endpoints(previous, wall), pa = [a.x, a.y] as const, pb = [b.x, b.y] as const;
          if (pa[other] !== from[other] || pb[other] !== from[other]) return [];
          const start = Math.max(lo, Math.min(pa[axis], pb[axis])), end = Math.min(hi, Math.max(pa[axis], pb[axis]));
          return end > start ? [{ wall, start, end, forward: pb[axis] > pa[axis] }] : [];
        });
        const cuts = [...new Set([lo, hi, ...shared.flatMap(s => [s.start, s.end])])].sort((a, b) => a - b);
        if (!forward) cuts.reverse();
        for (let i = 1; i < cuts.length; i++) {
          const start = cuts[i - 1]!, end = cuts[i]!, middle = (start + end) / 2;
          const old = shared.find(s => middle > s.start && middle < s.end);
          if (old && (old.wall.thickness !== t || old.wall.height !== h))
            throw new GeometryError('shared-wall-properties', 'Match the existing shared wall thickness and height before adjoining this room.', [old.wall.id]);
          const materials = old ? (forward === old.forward ? old.wall : { leftMaterial: old.wall.rightMaterial, rightMaterial: old.wall.leftMaterial }) : undefined;
          addWall(horizontal ? [start, from[1]] : [from[0], start], horizontal ? [end, from[1]] : [from[0], end], t, h, materials);
        }
      };
      side([x, y], [x + w, y]); side([x + w, y], [x + w, y + d]);
      side([x + w, y + d], [x, y + d]); side([x, y + d], [x, y]); break;
    }
    case 'AddFloor': {
      floorName(command.name);
      if (draft.floors.length >= MAX_FLOORS) throw new GeometryError('floor-limit', `A project can have at most ${MAX_FLOORS} floors.`);
      const top = [...draft.floors].sort((a, b) => b.level - a.level)[0]!;
      const used = new Set([...entityIds(draft)]);
      // The new floor sits on top: its floor level is the top floor's level plus that floor's wall height.
      const floor = { id: freshId('floor', used), name: command.name.trim(), level: top.level + 1, elevation: top.elevation + top.defaultWallHeight, defaultWallHeight: top.defaultWallHeight };
      draft.floors.push(floor); used.add(floor.id);
      if (command.copyOutlineFrom !== undefined) {
        const source = requireEntity(draft.floors, command.copyOutlineFrom);
        // The outline is every wall that borders at most one room: the outer walls, plus any open wall chains.
        const sourcePlan = { junctions: draft.junctions.filter(j => j.floorId === source.id), walls: draft.walls.filter(w => w.floorId === source.id), rooms: [] };
        const faceEdges = new Map<string, number>();
        for (const face of detectFaces(sourcePlan)) face.boundary.forEach((id, i) => { const key = [id, face.boundary[(i + 1) % face.boundary.length]!].sort().join('|'); faceEdges.set(key, (faceEdges.get(key) ?? 0) + 1); });
        const outline = sourcePlan.walls.filter(w => (faceEdges.get([w.a, w.b].sort().join('|')) ?? 0) < 2);
        const copies = new Map<string, string>();
        const copy = (id: string) => { let next = copies.get(id); if (!next) { const j = requireEntity(draft.junctions, id); next = freshId('junction', used); used.add(next); copies.set(id, next); draft.junctions.push({ id: next, floorId: floor.id, x: j.x, y: j.y }); } return next; };
        for (const w of outline) { const id = freshId('wall', used); used.add(id); draft.walls.push({ ...w, id, floorId: floor.id, a: copy(w.a), b: copy(w.b), height: floor.defaultWallHeight, rev: 0 }); }
        geometryChanged = outline.length > 0;
      }
      break;
    }
    case 'UpdateFloor': {
      const floor = requireEntity(draft.floors, command.floorId), properties = { ...command.properties };
      if ('name' in properties) properties.name = floorName(properties.name); // the same trimmed 1-60 rule as AddFloor
      assignProperties(floor, properties, ['name', 'elevation', 'defaultWallHeight']); break;
    }
    case 'DeleteFloor': {
      requireEntity(draft.floors, command.floorId);
      if (draft.floors.length < 2) throw new GeometryError('floor-last', 'A project needs at least one floor.');
      // Everything on the floor goes with it in one atomic, undoable step.
      const walls = new Set(draft.walls.filter(w => w.floorId === command.floorId).map(w => w.id));
      draft.openings = draft.openings.filter(o => !walls.has(o.wallId));
      const keep = <T extends { floorId: string }>(list: T[]) => list.filter(e => e.floorId !== command.floorId);
      draft.junctions = keep(draft.junctions); draft.walls = keep(draft.walls); draft.rooms = keep(draft.rooms); draft.furniture = keep(draft.furniture); draft.lights = keep(draft.lights);
      if (draft.stairs) { draft.stairs = keep(draft.stairs); if (!draft.stairs.length) delete draft.stairs; }
      if (draft.roofs) { draft.roofs = keep(draft.roofs); if (!draft.roofs.length) delete draft.roofs; }
      draft.floors = draft.floors.filter(f => f.id !== command.floorId);
      geometryChanged = true; break;
    }
    case 'MoveJunctions': {
      const seen = new Set<string>();
      for (const move of command.moves) {
        if (seen.has(move.junction)) throw new GeometryError('duplicate-move', 'A junction can only be moved once.'); seen.add(move.junction);
        const j = requireEntity(draft.junctions, move.junction); j.x = move.to[0]; j.y = move.to[1];
      }
      for (const opening of draft.openings) {
        const host = wall(opening.wallId), oldHost = requireEntity(previous.walls, opening.wallId);
        const delta = wallLength(draft, host) - wallLength(previous, oldHost);
        const shift = command.openingPlacement === 'b' ? delta : command.openingPlacement === 'centre' ? delta / 2 : 0;
        if (!Number.isSafeInteger(shift)) throw new GeometryError('opening-placement-integer', 'Centred opening placement requires a whole-mm offset; use an even-mm length change or end A/B.', [opening.id, host.id]);
        opening.offset += shift;
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
    case 'SetFurnitureFinish': {
      // FR-022 furniture colour variants: one main-colour override per item, or null for the model's own colours.
      if (!Array.isArray(command.furnitureIds) || command.furnitureIds.length < 1 || command.furnitureIds.length > 500 || command.furnitureIds.some(id => typeof id !== 'string') || new Set(command.furnitureIds).size !== command.furnitureIds.length)
        throw new GeometryError('selection', 'Choose 1 to 500 different furniture items.');
      const items = command.furnitureIds.map(id => requireEntity(draft.furniture, id)), material = command.material;
      if (material !== null && (!material || typeof material !== 'object' || Array.isArray(material))) throw new GeometryError('command-properties', 'Choose a valid finish material.');
      if (material) {
        const existing = draft.materials.find(m => m.id === material.id);
        if (existing && canonicalStringify(existing) !== canonicalStringify(material)) throw new GeometryError('material-conflict', 'This material ID already has a different definition.', [material.id]);
        if (!existing) draft.materials.push({ ...material });
      }
      const next = material ? { [FURNITURE_FINISH_SLOT]: material.id } : {};
      for (const item of items) if (canonicalStringify(item.materialOverrides) !== canonicalStringify(next)) item.materialOverrides = { ...next };
      break;
    }
    case 'ApplySurfaceMaterial':
    case 'ApplySurfaceMaterials': {
      // D76 M3: the batch form paints many surfaces as one Undo step; it is all-or-nothing like every command.
      const {material}=command,targets=command.type==='ApplySurfaceMaterial'?[command.target]:command.targets;
      if(!Array.isArray(targets)||targets.length<1||targets.length>MAX_SURFACE_BATCH)throw new GeometryError('selection',`Choose 1 to ${MAX_SURFACE_BATCH} surfaces.`);
      if(targets.some(target=>!target||typeof target!=='object'||!['wall','floor'].includes(target.kind)||typeof target.id!=='string'||target.kind==='wall'&&!['left','right'].includes(target.side))||!material||typeof material!=='object'||Array.isArray(material))throw new GeometryError('command-properties','Choose a valid wall side or room floor and material.');
      if(new Set(targets.map(t=>t.kind==='wall'?`w:${t.id}:${t.side}`:`f:${t.id}`)).size!==targets.length)throw new GeometryError('selection','Each surface may be chosen once.');
      const existing=draft.materials.find(m=>m.id===material.id);
      if(existing&&canonicalStringify(existing)!==canonicalStringify(material))throw new GeometryError('material-conflict','This material ID already has a different definition.',[material.id]);
      // One atomic paint transaction also installs a new local-library definition.
      // Existing definitions are never overwritten or silently recoloured elsewhere.
      if(!existing)draft.materials.push({...material});
      for(const target of targets){
        if(target.kind==='wall'){const w=wall(target.id);if(target.side==='left')w.leftMaterial=material.id;else w.rightMaterial=material.id;}
        else requireEntity(draft.rooms,target.id).floorMaterial=material.id;
      }
      break;
    }
    case 'AddOpening': draft.openings.push({ ...command.opening, rev: 0 }); break;
    case 'UpdateOpening': assignProperties(requireEntity(draft.openings, command.openingId), command.properties, ['offset', 'width', 'height', 'sill', 'flipX', 'flipY']); break;
    case 'DeleteOpening': requireEntity(draft.openings, command.openingId); draft.openings.splice(draft.openings.findIndex(o => o.id === command.openingId), 1); break;
    case 'AddFurniture': draft.furniture.push({ ...command.furniture, rev: 0 }); break;
    case 'AddFurnitureBatch': {
      // D73 AI-2: a suggested layout is one command, so one Undo removes all of it; validation rejects the whole batch.
      if (!Array.isArray(command.furniture) || command.furniture.length < 1 || command.furniture.length > MAX_FURNITURE_BATCH || command.furniture.some(f => !f || typeof f !== 'object'))
        throw new GeometryError('selection', `Add 1 to ${MAX_FURNITURE_BATCH} furniture items at once.`);
      for (const item of command.furniture) draft.furniture.push({ ...item, rev: 0 });
      break;
    }
    case 'UpdateFurniture': assignProperties(requireEntity(draft.furniture, command.furnitureId), command.properties, ['position', 'elevation', 'rotationDeg', 'size', 'materialOverrides']); break;
    case 'DeleteFurniture': requireEntity(draft.furniture, command.furnitureId); draft.furniture.splice(draft.furniture.findIndex(f => f.id === command.furnitureId), 1); break;
    case 'DeleteSelection': {
      const ids = (values: readonly string[], entities: { id: string }[]) => {
        if (!Array.isArray(values) || values.length > 500 || values.some(id => typeof id !== 'string') || new Set(values).size !== values.length)
          throw new GeometryError('selection', 'Selection IDs must be unique and bounded to 500 items.');
        for (const id of values) requireEntity(entities, id);
        return new Set(values);
      };
      const walls = ids(command.wallIds, draft.walls), openings = ids(command.openingIds, draft.openings), furniture = ids(command.furnitureIds, draft.furniture);
      if (walls.size + openings.size + furniture.size > 500 || typeof command.deleteDependents !== 'boolean')
        throw new GeometryError('selection', 'A bounded selection and explicit dependency confirmation are required.');
      if (!command.deleteDependents && draft.openings.some(o => walls.has(o.wallId) && !openings.has(o.id)))
        throw new GeometryError('dependent-openings', 'Confirm all selected walls and their hosted doors/windows before deleting.', [...walls]);
      if(!walls.size&&!openings.size&&!furniture.size)break;
      if(openings.size||walls.size)draft.openings = draft.openings.filter(o => !openings.has(o.id) && !walls.has(o.wallId));
      if(furniture.size)draft.furniture = draft.furniture.filter(f => !furniture.has(f.id));
      if (walls.size) { draft.walls = draft.walls.filter(w => !walls.has(w.id)); geometryChanged = true; }
      break;
    }
    case 'GroupFurniture': case 'UngroupFurniture': case 'MoveFurniture': {
      const minimum = command.type === 'GroupFurniture' ? 2 : 1;
      if (!Array.isArray(command.furnitureIds) || command.furnitureIds.length < minimum || command.furnitureIds.length > 500 || command.furnitureIds.some(id => typeof id !== 'string') || new Set(command.furnitureIds).size !== command.furnitureIds.length)
        throw new GeometryError('selection', `Choose ${minimum} to 500 different furniture items.`);
      const items = command.furnitureIds.map(id => requireEntity(draft.furniture, id));
      if (command.type === 'MoveFurniture') {
        if (!Number.isSafeInteger(command.dx) || !Number.isSafeInteger(command.dy)) throw new GeometryError('command-delta', 'Furniture movement must use integer mm.');
        for (const item of items) { item.position.x += command.dx; item.position.y += command.dy; }
        break;
      }
      // A group is the set of items sharing a groupId. Touching one member touches its whole group.
      const groups = new Set(items.flatMap(item => item.groupId ? [item.groupId] : [])), members = draft.furniture.filter(f => items.includes(f) || (f.groupId !== undefined && groups.has(f.groupId)));
      if (command.type === 'UngroupFurniture') { for (const item of members) delete item.groupId; break; }
      if (groups.size === 1 && members.every(f => f.groupId === [...groups][0])) break; // already exactly one group
      const used = new Set([...entityIds(draft), ...draft.furniture.flatMap(f => f.groupId ? [f.groupId] : [])]);
      const groupId = freshId('group', used);
      for (const item of members) item.groupId = groupId;
      break;
    }
    case 'DuplicateFurniture': {
      if (!Array.isArray(command.furnitureIds) || command.furnitureIds.length > 500 || command.furnitureIds.some(id => typeof id !== 'string') || new Set(command.furnitureIds).size !== command.furnitureIds.length)
        throw new GeometryError('selection', 'Furniture IDs must be unique and bounded to 500 items.');
      const source = command.furnitureIds.map(id => requireEntity(draft.furniture, id));
      const used = new Set([...entityIds(draft)]);
      for (const item of source) {
        const copy = JSON.parse(JSON.stringify(item)) as FurnitureItem;
        copy.id = freshId('furniture', used); copy.position.x += 200; copy.position.y += 200; copy.rev = 0; delete copy.groupId;
        draft.furniture.push(copy);
      }
      break;
    }
    case 'AlignFurniture': {
      // Axis-aligned bounding boxes of the rotated footprints. Positions stay integer mm,
      // so each result is rounded to the nearest mm (at most 0.5 mm from the exact edge).
      if (!Array.isArray(command.furnitureIds) || command.furnitureIds.length < 2 || command.furnitureIds.length > 500 || command.furnitureIds.some(id => typeof id !== 'string') || new Set(command.furnitureIds).size !== command.furnitureIds.length)
        throw new GeometryError('selection', 'Choose 2 to 500 different furniture items to align.');
      if (!FURNITURE_ALIGN_MODES.includes(command.mode)) throw new GeometryError('align-mode', 'Choose left, right, top, bottom or a centre line.');
      const items = command.furnitureIds.map(id => requireEntity(draft.furniture, id)), boxes = items.map(item => {
        const r = item.rotationDeg * Math.PI / 180, halfX = (Math.abs(Math.cos(r)) * item.size.w + Math.abs(Math.sin(r)) * item.size.d) / 2, halfY = (Math.abs(Math.sin(r)) * item.size.w + Math.abs(Math.cos(r)) * item.size.d) / 2;
        return { item, halfX, halfY };
      });
      // Reference lines are fixed before any item moves, from the original positions.
      const edge = (axis: 'x' | 'y', side: 'lo' | 'hi') => (side === 'lo' ? Math.min : Math.max)(...boxes.map(b => b.item.position[axis] + (side === 'lo' ? -1 : 1) * (axis === 'x' ? b.halfX : b.halfY)));
      const refs = { left: edge('x', 'lo'), right: edge('x', 'hi'), top: edge('y', 'lo'), bottom: edge('y', 'hi') };
      for (const { item, halfX, halfY } of boxes) {
        if (command.mode === 'left') item.position.x = Math.round(refs.left + halfX); else if (command.mode === 'right') item.position.x = Math.round(refs.right - halfX);
        else if (command.mode === 'top') item.position.y = Math.round(refs.top + halfY); else if (command.mode === 'bottom') item.position.y = Math.round(refs.bottom - halfY);
        else if (command.mode === 'centreX') item.position.x = Math.round((refs.left + refs.right) / 2); else item.position.y = Math.round((refs.top + refs.bottom) / 2);
      }
      break;
    }
    case 'RotateFurniture': {
      // Turn the items together, clockwise on screen for positive degrees (the footprint convention), about the
      // integer-rounded centre of their combined bounding box. Multiples of 90 degrees are exact; other angles round
      // each centre to the nearest mm (at most 0.5 mm per turn).
      if (!Array.isArray(command.furnitureIds) || command.furnitureIds.length < 1 || command.furnitureIds.length > 500 || command.furnitureIds.some(id => typeof id !== 'string') || new Set(command.furnitureIds).size !== command.furnitureIds.length)
        throw new GeometryError('selection', 'Choose 1 to 500 different furniture items to rotate.');
      if (typeof command.deltaDeg !== 'number' || !Number.isFinite(command.deltaDeg) || Math.abs(command.deltaDeg) > 360) throw new GeometryError('rotation', 'Rotation must be a finite angle between -360 and 360 degrees.');
      const items = command.furnitureIds.map(id => requireEntity(draft.furniture, id)), turn = ((command.deltaDeg % 360) + 360) % 360;
      if (turn === 0) break;
      const [cx, cy] = furnitureTurnPivot(items);
      const clean = (v: number) => Math.abs(v - Math.round(v)) < 1e-12 ? Math.round(v) : v, angle = turn * Math.PI / 180, c = clean(Math.cos(angle)), n = clean(Math.sin(angle));
      for (const item of items) {
        const dx = item.position.x - cx, dy = item.position.y - cy;
        item.position = { x: Math.round(cx + dx * c - dy * n) + 0, y: Math.round(cy + dx * n + dy * c) + 0 };
        const next = (item.rotationDeg + turn) % 360; item.rotationDeg = next >= 360 - 1e-9 ? 0 : next + 0;
      }
      break;
    }
    case 'UpdateRoom': assignProperties(requireEntity(draft.rooms, command.roomId), command.properties, ['name', 'type', 'ceilingHeight', 'floorMaterial']); break;
    case 'AddCameraPreset': {
      if(draft.cameras.length>=20||command.camera.mode!=='orbit'||typeof command.camera.name!=='string'||command.camera.name.trim().length<1||command.camera.name.trim().length>60)throw new GeometryError('camera-bookmark','Choose a name of1–60characters; at most20orbit bookmarks.');
      const {position,target}=command.camera;
      if(!Array.isArray(position)||!Array.isArray(target)||position.length!==3||target.length!==3||[...position,...target].some(v=>!Number.isSafeInteger(v)||Math.abs(v)>1_000_000))throw new GeometryError('camera-bookmark','Camera coordinates must be three bounded integer millimetres.');
      const delta=position.map((v,i)=>v-target[i]!),distance=Math.hypot(...delta);
      // Up to3mm covers integer quantization; runtime orbit always clamps to1–200metres.
      if(distance<997||distance>200_003||position[2]!<=draft.floors[0]!.elevation||target[2]!<draft.floors[0]!.elevation||delta[2]!<distance*Math.cos(85*Math.PI/180)-3)throw new GeometryError('camera-bookmark','Camera bookmark must be within orbit limits and above the floor.');
      const used=new Set([...entityIds(draft)]),id=freshId('camera',used);
      draft.cameras.push({...command.camera,name:command.camera.name.trim(),id});return {changedIds:[id],checkRoomNamesHint:false};
    }
    case 'DeleteCameraPreset': {
      requireEntity(draft.cameras,command.cameraId);draft.cameras=draft.cameras.filter(c=>c.id!==command.cameraId);return {changedIds:[command.cameraId],checkRoomNamesHint:false};
    }
    case 'AddStair': {
      // FR-035 (D66): ranges are checked by the schema after the command; here only shape and references.
      const { stair } = command;
      if (!stair || typeof stair !== 'object' || !stair.position || typeof stair.position !== 'object') throw new GeometryError('command-properties', 'Give the stairs a position and size.');
      requireEntity(draft.floors, stair.floorId); installMaterial(command.material);
      const id = freshId('stair', new Set(entityIds(draft)));
      (draft.stairs ??= []).push({ id, floorId: stair.floorId, position: { x: stair.position.x, y: stair.position.y }, rotationDeg: stair.rotationDeg, width: stair.width, length: stair.length, height: stair.height, steps: stair.steps, material: command.material.id, rev: 0 });
      break;
    }
    case 'UpdateStair': {
      const stair = requireEntity(draft.stairs ?? [], command.stairId);
      assignProperties(stair, command.properties, ['position', 'rotationDeg', 'width', 'length', 'height', 'steps']);
      if (command.properties.position) stair.position = { x: command.properties.position.x, y: command.properties.position.y };
      break;
    }
    case 'DeleteStair': {
      requireEntity(draft.stairs ?? [], command.stairId);
      draft.stairs = draft.stairs!.filter(s => s.id !== command.stairId); if (!draft.stairs.length) delete draft.stairs;
      break;
    }
    case 'SetRoof': {
      // One roof per floor: SetRoof adds, changes or (with null) removes it.
      requireEntity(draft.floors, command.floorId);
      const existing = draft.roofs?.find(r => r.floorId === command.floorId);
      if (command.roof === null) {
        if (!existing) break;
        draft.roofs = draft.roofs!.filter(r => r !== existing); if (!draft.roofs.length) delete draft.roofs; break;
      }
      const { kind, pitchDeg, overhang, ridgeAxis } = command.roof ?? {} as Partial<Roof>;
      if (command.material) installMaterial(command.material);
      const material = command.material?.id ?? existing?.material;
      if (material === undefined) throw new GeometryError('command-properties', 'Choose a roof material.');
      const next = { kind: kind!, pitchDeg: pitchDeg!, overhang: overhang!, ridgeAxis: ridgeAxis!, material };
      if (existing) Object.assign(existing, next);
      else (draft.roofs ??= []).push({ id: freshId('roof', new Set(entityIds(draft))), floorId: command.floorId, ...next, rev: 0 });
      break;
    }
    case 'RenameProject': draft.name = command.name; break;
    case 'SetUnits': draft.units = command.units; break;
    default: throw new GeometryError('command', 'Unsupported project command.');
  }
  let checkRoomNamesHint = false;
  if (command.roomChoices !== undefined && (!Array.isArray(command.roomChoices) || !geometryChanged || command.roomChoices.length > previous.rooms.length))
    throw new GeometryError('room-choice', 'Room identity choices must accompany a geometry edit.');
  if (geometryChanged) {
    const reservedIds = [draft.id, ...[draft.floors, draft.openings, draft.furniture, draft.materials, draft.lights, draft.cameras, draft.stairs ?? [], draft.roofs ?? []].flat().map(e => e.id)];
    const normalized = normalizePlan(draft, reservedIds);
    if ((command.type === 'AddWall' || command.type === 'AddRectangle') && JSON.stringify(normalized.plan.walls) === JSON.stringify(previous.walls))
      normalized.plan.junctions = previous.junctions.map(j => ({ ...j }));
    const derived = derivePlan(normalized.plan), assignment = assignRooms(previous, normalized.plan, derived, reservedIds, command.roomChoices);
    const rooms = assignment.rooms.map(r => ({ ...r, floorMaterial: r.floorMaterial === 'm_default' && !draft.materials.some(m => m.id === 'm_default') ? draft.materials[0]!.id : r.floorMaterial }));
    for (const o of draft.openings) {
      const lineage = normalized.lineage.find(l => l.wallId === o.wallId);
      if (!lineage) throw new GeometryError('opening-host', 'Opening host was removed without explicit deletion.', [o.id]);
      const child = lineage.children.find(c => o.offset - o.width / 2 >= c.start && o.offset + o.width / 2 <= c.end);
      if (!child) {
        const extent = Math.max(...lineage.children.map(c => c.end));
        if (o.offset - o.width / 2 < 0 || o.offset + o.width / 2 > extent)
          throw new GeometryError('opening-clearance', 'The door/window no longer fits on its resized wall.', [o.id, o.wallId]);
        throw new GeometryError('opening-split', 'A wall split passes through a door/window.', [o.id]);
      }
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
        if (entries[a]!.w.floorId !== entries[b]!.w.floorId) continue; // FR-034: walls on other floors never share geometry
        if (changedGeometry.has(x) || changedGeometry.has(y)) { dirtyWalls.add(x); dirtyWalls.add(y); }
      }
    }
  }
  const oldJunctions = new Map(previous.junctions.map(j => [j.id, j]));
  for (const j of draft.junctions) if (JSON.stringify(j) !== JSON.stringify(oldJunctions.get(j.id))) changed.add(j.id);
  for (const j of previous.junctions) if (!draft.junctions.some(n => n.id === j.id)) changed.add(j.id);
  const groups = ['floors', 'walls', 'openings', 'rooms', 'furniture', 'lights', 'materials', 'cameras', 'stairs', 'roofs'] as const;
  for (const group of groups) {
    const old = new Map<string, { id: string }>((previous[group] ?? []).map(e => [e.id, e]));
    for (const e of draft[group] ?? []) {
      const oldEntity = old.get(e.id), ownChange = JSON.stringify(e) !== JSON.stringify(oldEntity);
      // Surface paint changes one binding, not hosted geometry or room boundaries.
      // Scene material dependencies are derived separately from canonical IDs.
      const geometryDependency = command.type!=='ApplySurfaceMaterial'&&command.type!=='ApplySurfaceMaterials'&&(group === 'walls' && (dirtyWalls.has(e.id) || changed.has((e as Wall).a) || changed.has((e as Wall).b)) ||
        group === 'rooms' && ((e as Room).boundary.some(id => changed.has(id)) || draft.walls.some(w => changed.has(w.id) && (e as Room).boundary.includes(w.a) && (e as Room).boundary.includes(w.b))) ||
        group === 'openings' && changed.has((e as Opening).wallId));
      if (ownChange || geometryDependency) {
        changed.add(e.id);
        if ('rev' in e) e.rev = oldEntity && 'rev' in oldEntity ? (oldEntity.rev as number) + 1 : 0;
      }
    }
    for (const id of old.keys()) if (!(draft[group] ?? []).some(e => e.id === id)) changed.add(id);
  }
  return { changedIds: [...changed], checkRoomNamesHint };
}
