import { derivePlan, freshId } from '@gharplan/geometry';
import { parseProject, validateProject } from './validation';
import { serializeProject } from './serialization';
import type { ProjectDoc } from './types';

/** Explicit recovery proposal only. The original bytes are never modified.
 * Only semantic room-boundary failures qualify; invalid coordinates, schema,
 * openings, references and unsupported geometry are never silently repaired.
 */
export function proposeRoomRepair(text: string): ProjectDoc | null {
  const parsed = parseProject(text); if (parsed.ok || !parsed.errors.length || parsed.errors.some(e => e.code !== 'room-boundary')) return null;
  try {
    const document = JSON.parse(text) as ProjectDoc;
    const derived = derivePlan({ ...document, rooms: [] }), used = new Set([document.id, ...[document.floors, document.junctions, document.walls, document.openings, document.furniture, document.materials, document.lights, document.cameras, document.stairs ?? [], document.roofs ?? []].flat().map(e => e.id)]);
    const old = document.rooms;
    document.rooms = derived.faces.map((face, i) => {
      const matching = old.filter(r => r.boundary.length === face.boundary.length && r.boundary.some((_, start) => face.boundary.every((id, n) => id === r.boundary[(start + n) % r.boundary.length])));
      if (matching.length === 1 && !used.has(matching[0]!.id)) { used.add(matching[0]!.id); return { ...matching[0]!, boundary: [...face.boundary] }; }
      // FR-034: a recovered room belongs to the floor of its own corners.
      const floor = document.floors.find(f => f.id === document.junctions.find(j => j.id === face.boundary[0])?.floorId) ?? document.floors[0]!;
      return { id: freshId('room', used), floorId: floor.id, boundary: [...face.boundary], name: `Recovered room ${i + 1}`, type: 'other' as const,
        ceilingHeight: floor.defaultWallHeight, floorMaterial: document.materials[0]!.id, rev: 0 };
    });
    return validateProject(document).length ? null : document;
  } catch { return null; }
}
/** New IDs and zero server revision: recovery cannot impersonate a cloud head. */
export function recoveryCopy(document: ProjectDoc, now: string, nextId: () => string): ProjectDoc {
  const copy = JSON.parse(serializeProject(document)) as ProjectDoc;
  const groups = [copy.floors, copy.junctions, copy.walls, copy.openings, copy.rooms, copy.furniture, copy.materials, copy.lights, copy.cameras, copy.stairs ?? [], copy.roofs ?? []];
  const map = new Map([copy.id, ...groups.flat().map(e => e.id), ...copy.furniture.flatMap(e => e.groupId ? [e.groupId] : [])].map(id => [id, nextId()]));
  const id = (old: string): string => { const next = map.get(old); if (!next) throw new Error('Recovery reference does not resolve.'); return next; };
  copy.id = id(copy.id); copy.name = `Recovered ${copy.name}`.slice(0, 120); copy.revision = 0; copy.createdAt = now; copy.updatedAt = now;
  for (const group of groups) for (const e of group) { e.id = id(e.id); if ('floorId' in e) e.floorId = id(e.floorId); if ('rev' in e) e.rev = 0; }
  for (const wall of copy.walls) { wall.a = id(wall.a); wall.b = id(wall.b); wall.leftMaterial = id(wall.leftMaterial); wall.rightMaterial = id(wall.rightMaterial); }
  for (const opening of copy.openings) opening.wallId = id(opening.wallId);
  for (const e of [...copy.stairs ?? [], ...copy.roofs ?? []]) e.material = id(e.material);
  for (const room of copy.rooms) { room.boundary = room.boundary.map(id); room.floorMaterial = id(room.floorMaterial); }
  for (const item of copy.furniture) { if (item.groupId) item.groupId = id(item.groupId); item.materialOverrides = Object.fromEntries(Object.entries(item.materialOverrides).map(([key, value]) => [key, id(value)])); }
  const errors = validateProject(copy); if (errors.length) throw new Error(errors[0]?.message ?? 'Recovery copy failed validation.'); return copy;
}
