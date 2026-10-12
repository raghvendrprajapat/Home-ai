import { validateProject } from './validation';
import type { ProjectDoc } from './types';

/** Creation builds a new document; existing documents still change only through
 * ProjectStore commands. Clock/IDs/labels are supplied by the application. */
export function createBlankProject(options: { name: string; units: ProjectDoc['units']; now: string; nextId(): string; floorName?: string; materialName?: string }): ProjectDoc {
  const document: ProjectDoc = { schemaVersion: 1, id: options.nextId(), name: options.name.trim(), units: options.units,
    createdAt: options.now, updatedAt: options.now, revision: 0,
    floors: [{ id: options.nextId(), name: options.floorName ?? 'Ground floor', level: 0, elevation: 0, defaultWallHeight: 2700 }],
    materials: [{ id: options.nextId(), name: options.materialName ?? 'Base finish', baseColor: '#f3ede3', roughness: 0.8, metalness: 0 }],
    junctions: [], walls: [], rooms: [], openings: [], furniture: [], lights: [], cameras: [] };
  const errors = validateProject(document); if (errors.length) throw new Error(errors[0]!.message);
  return document;
}
