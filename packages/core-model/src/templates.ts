import { createBlankProject } from './project-factory';
import { ProjectStore } from './store';
import { serializeProject } from './serialization';
import type { Command } from './commands';
import type { Opening, ProjectDoc, RoomType } from './types';

/** FR-003 starter layouts. Coordinates are integer-mm centrelines (X east, Y south). */
export type TemplateId = '1bhk' | '2bhk' | 'bedroom' | 'living' | 'kitchen' | 'bathroom';
export const TEMPLATE_IDS: readonly TemplateId[] = ['1bhk', '2bhk', 'bedroom', 'living', 'kitchen', 'bathroom'];

interface OpeningSpec { at: readonly [number, number]; kind: Opening['kind']; width: number; height?: number; sill?: number }
interface RoomSpec { at: readonly [number, number]; type: RoomType }
interface TemplateSpec {
  outer: { width: number; depth: number };
  /** Inner partitions as [x1, y1, x2, y2]. Every end lies on an existing wall (T junctions only). */
  partitions: readonly (readonly [number, number, number, number])[];
  rooms: readonly RoomSpec[];
  openings: readonly OpeningSpec[];
}
export const OUTER_THICKNESS = 230, INNER_THICKNESS = 115;
const door = (x: number, y: number, width: number): OpeningSpec => ({ at: [x, y], kind: 'door', width, height: 2100, sill: 0 });
const arch = (x: number, y: number, width: number): OpeningSpec => ({ at: [x, y], kind: 'opening', width, height: 2100, sill: 0 });
const window = (x: number, y: number, width: number, height = 1200, sill = 900): OpeningSpec => ({ at: [x, y], kind: 'window', width, height, sill });

// Partitions are staggered where two rooms meet a shared wall, so no junction ever has four walls.
export const TEMPLATES: Readonly<Record<TemplateId, TemplateSpec>> = {
  '1bhk': {
    outer: { width: 7200, depth: 6000 },
    partitions: [[4200, 0, 4200, 6000], [0, 3600, 4200, 3600], [4200, 3000, 7200, 3000], [5700, 3000, 5700, 6000]],
    rooms: [{ at: [2100, 1800], type: 'living' }, { at: [2100, 4800], type: 'kitchen' }, { at: [5700, 1500], type: 'bedroom' }, { at: [4950, 4500], type: 'utility' }, { at: [6450, 4500], type: 'bathroom' }],
    openings: [door(1500, 0, 1000), door(4200, 1500, 900), door(2100, 3600, 900), door(4200, 4800, 800), door(6450, 3000, 750),
      window(3200, 0, 1500), window(0, 1800, 1500), window(5700, 0, 1500), window(7200, 1500, 1200), window(0, 4800, 1200), window(4950, 6000, 900), window(7200, 4500, 600, 600, 1500)],
  },
  '2bhk': {
    outer: { width: 9600, depth: 6000 },
    partitions: [[4800, 0, 4800, 6000], [0, 3600, 4800, 3600], [2400, 3600, 2400, 6000], [4800, 3000, 9600, 3000], [7500, 3000, 7500, 6000]],
    rooms: [{ at: [2400, 1800], type: 'living' }, { at: [1200, 4800], type: 'kitchen' }, { at: [3600, 4800], type: 'dining' }, { at: [7200, 1500], type: 'bedroom' }, { at: [6150, 4500], type: 'bedroom' }, { at: [8550, 4500], type: 'bathroom' }],
    openings: [door(1800, 0, 1000), door(1200, 3600, 900), arch(3600, 3600, 1500), door(4800, 1500, 900), door(4800, 4800, 900), door(7500, 4500, 750),
      window(3600, 0, 1500), window(0, 1800, 1500), window(7200, 0, 1800), window(9600, 1500, 1200), window(0, 4800, 1200), window(3600, 6000, 1200), window(6150, 6000, 1200), window(9600, 4500, 600, 600, 1500)],
  },
  bedroom: { outer: { width: 3600, depth: 3300 }, partitions: [], rooms: [{ at: [1800, 1650], type: 'bedroom' }], openings: [door(900, 3300, 900), window(1800, 0, 1500)] },
  living: { outer: { width: 4800, depth: 3600 }, partitions: [], rooms: [{ at: [2400, 1800], type: 'living' }], openings: [door(1200, 3600, 1000), window(2400, 0, 1800)] },
  kitchen: { outer: { width: 3000, depth: 2400 }, partitions: [], rooms: [{ at: [1500, 1200], type: 'kitchen' }], openings: [door(800, 2400, 800), window(1500, 0, 1200)] },
  bathroom: { outer: { width: 1800, depth: 2400 }, partitions: [], rooms: [{ at: [900, 1200], type: 'bathroom' }], openings: [door(700, 2400, 700), window(900, 0, 600, 600, 1500)] },
};

export interface TemplateOptions {
  template: TemplateId; name: string; units: ProjectDoc['units']; now: string; nextId(): string;
  floorName?: string; materialName?: string;
  /** Localized room label for a room type; repeated types get " 2", " 3"… */
  roomName(type: RoomType): string;
}

/**
 * Builds a new editable project through the real core-model commands, so a template
 * passes exactly the validation a hand-drawn plan does. Throws if a template spec ever
 * becomes invalid; nothing is returned half-built.
 */
export function createTemplateProject(options: TemplateOptions): ProjectDoc {
  const spec = TEMPLATES[options.template];
  if (!spec) throw new Error('Unknown template.');
  const blank = createBlankProject({ name: options.name, units: options.units, now: options.now, nextId: options.nextId, ...(options.floorName ? { floorName: options.floorName } : {}), ...(options.materialName ? { materialName: options.materialName } : {}) });
  const store = new ProjectStore(blank, `template_${options.nextId()}`, { now: () => options.now });
  const height = blank.floors[0]!.defaultWallHeight;
  let step = 0;
  const execute = (command: Record<string, unknown>) => store.execute({ id: `template_${options.template}_${step++}`, baseGeneration: store.getSnapshot().localGeneration, ...command } as Command);
  const run = (command: Record<string, unknown>) => {
    const result = execute(command);
    if (!result.ok) throw new Error(`Template ${options.template} step ${step} failed: ${result.errors[0]?.message ?? 'rejected'}`);
  };
  const faceAt = (x: number, y: number) => store.getSnapshot().derived.faces.find(f => f.clearRects.some(r => x > r[0] && x < r[2] && y > r[1] && y < r[3]));
  run({ type: 'AddRectangle', x: 0, y: 0, width: spec.outer.width, depth: spec.outer.depth, thickness: OUTER_THICKNESS, height });
  for (const [x1, y1, x2, y2] of spec.partitions) {
    const wall = { type: 'AddWall', from: [x1, y1], to: [x2, y2], thickness: INNER_THICKNESS, height };
    let result = execute(wall);
    if (!result.ok && result.errors[0]?.code === 'ambiguous-room') {
      // An exactly even split has no natural "original" room. Rooms are still unnamed here,
      // so deterministically keep the identity of the side west (or north) of the partition.
      const probe: [number, number] = x1 === x2 ? [x1 - 600, (y1 + y2) / 2] : [(x1 + x2) / 2, y1 - 600], face = faceAt(probe[0], probe[1]);
      if (face) result = execute({ ...wall, roomChoices: [{ roomId: face.roomId, point: probe }] });
    }
    if (!result.ok) throw new Error(`Template ${options.template} partition ${x1},${y1}-${x2},${y2} failed: ${result.errors[0]?.message ?? 'rejected'}`);
  }
  const counts = new Map<RoomType, number>();
  for (const room of spec.rooms) {
    const [x, y] = room.at, face = faceAt(x, y);
    if (!face) throw new Error(`Template ${options.template} has no room at ${x},${y}.`);
    const n = (counts.get(room.type) ?? 0) + 1; counts.set(room.type, n);
    const label = options.roomName(room.type);
    run({ type: 'UpdateRoom', roomId: face.roomId, properties: { name: n === 1 ? label : `${label} ${n}`, type: room.type } });
  }
  for (const item of spec.openings) {
    const doc = store.getSnapshot().document, junction = new Map(doc.junctions.map(j => [j.id, j]));
    const hosts = doc.walls.flatMap(wall => {
      const a = junction.get(wall.a)!, b = junction.get(wall.b)!, [x, y] = item.at;
      const inside = a.y === b.y ? a.y === y && x > Math.min(a.x, b.x) && x < Math.max(a.x, b.x) : a.x === b.x && a.x === x && y > Math.min(a.y, b.y) && y < Math.max(a.y, b.y);
      return inside ? [{ wall, offset: Math.abs(x - a.x) + Math.abs(y - a.y) }] : [];
    });
    if (hosts.length !== 1) throw new Error(`Template ${options.template} opening at ${item.at.join(',')} has ${hosts.length} host walls.`);
    const { wall, offset } = hosts[0]!;
    run({ type: 'AddOpening', opening: { id: options.nextId(), wallId: wall.id, kind: item.kind, assetId: item.kind === 'window' ? 'window_asset' : 'door_asset', offset, width: item.width, height: item.height ?? 2100, sill: item.sill ?? 0, flipX: false, flipY: false } });
  }
  return JSON.parse(serializeProject(store.getSnapshot().document)) as ProjectDoc;
}

/** D73 AI-3: one room as an integer-mm centreline rectangle (top-left corner, size). */
export interface RoomRectSpec { x: number; y: number; width: number; depth: number; type: RoomType }
export interface RoomsProjectOptions extends Omit<TemplateOptions, 'template'> { rooms: readonly RoomRectSpec[]; thickness?: number }
export const SKETCH_WALL_THICKNESS = 200;
/**
 * D73 AI-3: builds a new project from room rectangles (for example read from a sketch) through the real AddRectangle
 * and UpdateRoom commands, so the result passes the same validation as a hand-drawn plan. Shared edges become one
 * wall. A room whose walls the L0 rules reject (for example a four-way crossing) is left out and its index reported;
 * a room already enclosed by its neighbours' walls is only named.
 */
export function createRoomsProject(options: RoomsProjectOptions): { document: ProjectDoc; skipped: number[] } {
  if (!Array.isArray(options.rooms) || options.rooms.length < 1 || options.rooms.length > 20) throw new Error('Choose 1 to 20 rooms.');
  const blank = createBlankProject({ name: options.name, units: options.units, now: options.now, nextId: options.nextId, ...(options.floorName ? { floorName: options.floorName } : {}), ...(options.materialName ? { materialName: options.materialName } : {}) });
  const store = new ProjectStore(blank, `rooms_${options.nextId()}`, { now: () => options.now });
  const height = blank.floors[0]!.defaultWallHeight, thickness = options.thickness ?? SKETCH_WALL_THICKNESS, skipped: number[] = [];
  let step = 0;
  const execute = (command: Record<string, unknown>) => store.execute({ id: `rooms_${step++}`, baseGeneration: store.getSnapshot().localGeneration, ...command } as Command);
  const centre = (r: RoomRectSpec): [number, number] => [r.x + r.width / 2, r.y + r.depth / 2];
  const faceAt = ([x, y]: [number, number]) => store.getSnapshot().derived.faces.find(f => f.clearRects.some(r => x > r[0] && x < r[2] && y > r[1] && y < r[3]));
  for (const [i, room] of options.rooms.entries()) {
    const face = faceAt(centre(room)), half = thickness / 2;
    // Already closed by neighbouring rooms: its clear rectangle is exactly this room's.
    if (face && face.clearRects.length === 1 && face.clearRects[0]!.every((v, k) => v === [room.x + half, room.y + half, room.x + room.width - half, room.y + room.depth - half][k])) continue;
    if (face || !execute({ type: 'AddRectangle', x: room.x, y: room.y, width: room.width, depth: room.depth, thickness, height }).ok) skipped.push(i);
  }
  const counts = new Map<RoomType, number>();
  for (const [i, room] of options.rooms.entries()) {
    if (skipped.includes(i)) continue;
    const face = faceAt(centre(room));
    if (!face) { skipped.push(i); continue; }
    const n = (counts.get(room.type) ?? 0) + 1; counts.set(room.type, n);
    const label = options.roomName(room.type);
    if (!execute({ type: 'UpdateRoom', roomId: face.roomId, properties: { name: n === 1 ? label : `${label} ${n}`, type: room.type } }).ok) skipped.push(i);
  }
  return { document: JSON.parse(serializeProject(store.getSnapshot().document)) as ProjectDoc, skipped: skipped.sort((a, b) => a - b) };
}
