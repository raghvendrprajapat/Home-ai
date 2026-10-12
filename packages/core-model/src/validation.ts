import { applyGeometry, assertCoordinate, detectFaces, endpoints, GeometryError, wallLength } from '@gharplan/geometry';
import validateShape from './generated/project-validator.js';
import { canonicalStringify, MAX_DOCUMENT_BYTES, utf8Bytes } from './serialization';
import { CURRENT_SCHEMA_VERSION, MigrationRegistry } from './migrations';
import type { Opening, ProjectDoc, ValidationIssue, Wall } from './types';

function issue(code: string, message: string, entityIds: string[] = []): ValidationIssue { return { code, message, entityIds }; }
function cycleEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.some((_, start) => b.every((id, i) => id === a[(start + i) % a.length]));
}
export function openingEndGuard(document: ProjectDoc, wall: Wall, end: 'a' | 'b'): number {
  const [a, b] = endpoints(document, wall), horizontal = a.y === b.y;
  const neighbors = document.walls.filter(w => w.id !== wall.id && (w.a === wall[end] || w.b === wall[end]));
  const perpendicular = neighbors.filter(w => { const [c, d] = endpoints(document, w); return horizontal !== (c.y === d.y); });
  return 50 + (perpendicular.length ? Math.max(...perpendicular.map(w => w.thickness / 2)) : !neighbors.length ? wall.thickness / 2 : 0);
}
export function validateOpening(document: ProjectDoc, opening: Opening): ValidationIssue[] {
  const wall = document.walls.find(w => w.id === opening.wallId);
  if (!wall) return [issue('opening-host', 'Opening host wall does not exist.', [opening.id])];
  const length = wallLength(document, wall), start = opening.offset - opening.width / 2, end = opening.offset + opening.width / 2;
  const errors: ValidationIssue[] = [];
  if (start < openingEndGuard(document, wall, 'a') || end > length - openingEndGuard(document, wall, 'b'))
    errors.push(issue('opening-clearance', 'The opening does not fit with the wall end clearance.', [opening.id, wall.id]));
  if (opening.sill + opening.height > wall.height || opening.kind === 'door' && opening.sill !== 0)
    errors.push(issue('opening-height', 'Door/window height or sill is invalid for its wall.', [opening.id, wall.id]));
  return errors;
}
export function validateProject(value: unknown): ValidationIssue[] {
  if (!validateShape(value)) return (validateShape.errors ?? []).slice(0, 20).map(e => issue('schema', `${e.instancePath || '/'} ${e.message ?? e.keyword}`));
  const doc = value, errors: ValidationIssue[] = [];
  const groups = [doc.floors, doc.junctions, doc.walls, doc.openings, doc.rooms, doc.furniture, doc.materials, doc.lights, doc.cameras];
  if (!Number.isSafeInteger(doc.revision)) errors.push(issue('revision', 'Server revision must be a safe non-negative integer.'));
  const ids = new Set([doc.id]);
  for (const entities of groups) for (const entity of entities) {
    if (ids.has(entity.id)) errors.push(issue('duplicate-id', 'Every project entity must have a globally unique ID.', [entity.id])); ids.add(entity.id);
    if ('rev' in entity && !Number.isSafeInteger(entity.rev)) errors.push(issue('revision', 'Entity revision must be a safe integer.', [entity.id]));
  }
  if (doc.floors.length !== 1) errors.push(issue('floors', 'L0 supports exactly one floor.'));
  const floors = new Set(doc.floors.map(f => f.id)), materials = new Set(doc.materials.map(m => m.id));
  if (!materials.size) errors.push(issue('materials', 'A project needs at least one material.'));
  for (const e of [...doc.junctions, ...doc.walls, ...doc.rooms, ...doc.furniture, ...doc.lights])
    if (!floors.has(e.floorId)) errors.push(issue('floor-reference', 'Entity floor does not exist.', [e.id]));
  for (const wall of doc.walls) if (!materials.has(wall.leftMaterial) || !materials.has(wall.rightMaterial)) errors.push(issue('material-reference', 'Wall material does not exist.', [wall.id]));
  for (const room of doc.rooms) if (!materials.has(room.floorMaterial)) errors.push(issue('material-reference', 'Room floor material does not exist.', [room.id]));
  for (const f of doc.furniture) {
    try { assertCoordinate(f.position.x); assertCoordinate(f.position.y); } catch { errors.push(issue('coordinates', 'Furniture position must use integer mm within the L0 domain.', [f.id])); }
    for (const material of Object.values(f.materialOverrides)) if (!materials.has(material)) errors.push(issue('material-reference', 'Furniture override material does not exist.', [f.id]));
  }
  for (const light of doc.lights) {
    try { assertCoordinate(light.position.x); assertCoordinate(light.position.y); } catch { errors.push(issue('coordinates', 'Light position is outside the L0 domain.', [light.id])); }
  }
  try {
    canonicalStringify(doc);
    const geometry = applyGeometry(doc, { op: 'validate' });
    if (!geometry.accepted) errors.push(issue(geometry.error.code, geometry.error.message, geometry.error.entityIds));
    else {
      const faces = detectFaces(doc);
      if (faces.length !== doc.rooms.length || doc.rooms.some(room => !faces.some(face => cycleEqual(face.boundary, room.boundary))))
        errors.push(issue('room-boundary', 'Stored rooms must match all derived bounded faces in positive winding.'));
      for (const opening of doc.openings) errors.push(...validateOpening(doc, opening));
      const hosts = new Map<string, Opening[]>();
      for (const opening of doc.openings) hosts.set(opening.wallId, [...(hosts.get(opening.wallId) ?? []), opening]);
      for (const openings of hosts.values()) {
        openings.sort((a, b) => a.offset - a.width / 2 - (b.offset - b.width / 2));
        for (let i = 1; i < openings.length; i++) {
          const a = openings[i - 1]!, b = openings[i]!;
          if (a.offset + a.width / 2 > b.offset - b.width / 2) errors.push(issue('opening-overlap', 'Openings overlap along their host wall.', [a.id, b.id]));
        }
      }
    }
  } catch (error) {
    errors.push(issue(error instanceof GeometryError ? error.code : 'document', error instanceof Error ? error.message : 'Invalid project.'));
  }
  return errors;
}
export type ParseResult = { ok: true; document: ProjectDoc } | { ok: false; errors: ValidationIssue[] };
// Version 1 is the first documented product format. Older transforms may only
// be registered with their actual schema and immutable golden migration cases.
const projectMigrations = new MigrationRegistry(CURRENT_SCHEMA_VERSION, validateProject, []);
export function parseProject(serialized: string): ParseResult {
  if (serialized.length > MAX_DOCUMENT_BYTES || utf8Bytes(serialized) > MAX_DOCUMENT_BYTES)
    return { ok: false, errors: [issue('size', 'Project exceeds the 10 MiB document limit.')] };
  try {
    const value: unknown = JSON.parse(serialized);
    try {
      const migrated = projectMigrations.run(value);
      return migrated.ok ? { ok: true, document: migrated.value as ProjectDoc } : migrated;
    } catch (error) {
      return { ok: false, errors: [issue('validation', error instanceof Error ? error.message : 'Project validation failed.')] };
    }
  } catch { return { ok: false, errors: [issue('json', 'This file is not valid project JSON.')] }; }
}
