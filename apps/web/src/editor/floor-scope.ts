import type { Command, PreviewResult, ProjectStore } from '@gharplan/core-model';
import type { PlanDocument } from './view2d';

/**
 * FR-034 (D63): the 2D editor works on one floor at a time. A floor view keeps only that floor's
 * junctions, walls, their openings, rooms, furniture and lights, and lists the active floor first so
 * floor-relative helpers (for example furniture placement) use it. A one-floor project is returned
 * unchanged, so single-floor behaviour cannot drift. The canonical project is never replaced by a view.
 */
type Snapshot = ReturnType<ProjectStore['getSnapshot']>;
type Derived = Snapshot['derived'];
const views = new WeakMap<object, Map<string, PlanDocument>>();
export function floorView(document: PlanDocument, floorId: string | undefined): PlanDocument {
  if (!floorId || document.floors.length < 2 || !document.floors.some(f => f.id === floorId)) return document;
  let cache = views.get(document); if (!cache) { cache = new Map(); views.set(document, cache); }
  const hit = cache.get(floorId); if (hit) return hit;
  const walls = document.walls.filter(w => w.floorId === floorId), wallIds = new Set(walls.map(w => w.id));
  const view = {
    ...document,
    floors: [...document.floors.filter(f => f.id === floorId), ...document.floors.filter(f => f.id !== floorId)],
    junctions: document.junctions.filter(j => j.floorId === floorId), walls,
    openings: document.openings.filter(o => wallIds.has(o.wallId)),
    rooms: document.rooms.filter(r => r.floorId === floorId),
    furniture: document.furniture.filter(f => f.floorId === floorId),
    lights: document.lights.filter(l => l.floorId === floorId),
  } as PlanDocument;
  cache.set(floorId, view); return view;
}
const deriveds = new WeakMap<object, Map<string, Derived>>();
export function floorDerived(derived: Derived, document: PlanDocument, floorId: string | undefined): Derived {
  if (!floorId || document.floors.length < 2) return derived;
  let cache = deriveds.get(derived); if (!cache) { cache = new Map(); deriveds.set(derived, cache); }
  const hit = cache.get(floorId); if (hit) return hit;
  const junctions = new Set(document.junctions.filter(j => j.floorId === floorId).map(j => j.id)), walls = new Set(document.walls.filter(w => w.floorId === floorId).map(w => w.id));
  const view = { ...derived, faces: derived.faces.filter(f => junctions.has(f.boundary[0]!)), footprints: derived.footprints.filter(p => walls.has(p.ownerId)) } as Derived;
  cache.set(floorId, view); return view;
}
const snapshots = new WeakMap<object, Map<string, Snapshot>>();
export function floorSnapshot(snapshot: Snapshot, floorId: string | undefined): Snapshot {
  if (!floorId || snapshot.document.floors.length < 2) return snapshot;
  let cache = snapshots.get(snapshot); if (!cache) { cache = new Map(); snapshots.set(snapshot, cache); }
  const hit = cache.get(floorId); if (hit) return hit;
  const view = { ...snapshot, document: floorView(snapshot.document, floorId), derived: floorDerived(snapshot.derived, snapshot.document, floorId) } as Snapshot;
  cache.set(floorId, view); return view;
}
/** Wall tools draw on the active floor unless a command names its floor itself. */
export function onFloor(command: Command, floorId: string | undefined): Command {
  return floorId && (command.type === 'AddWall' || command.type === 'AddRectangle') && command.floorId === undefined ? { ...command, floorId } : command;
}
export interface FloorScope { readonly store: ProjectStore; readonly floorId: () => string | undefined; setFloor(floorId: string | undefined): void }
/**
 * A store with the same identity for its whole life whose snapshots and previews are floor views.
 * Commands still run on the one canonical store; switching floors notifies subscribers.
 */
export function createFloorScope(base: ProjectStore): FloorScope {
  let floor: string | undefined;
  const listeners = new Set<() => void>();
  const scoped: Partial<ProjectStore> = {
    getSnapshot: () => floorSnapshot(base.getSnapshot(), floor),
    subscribe: (listener: () => void) => { listeners.add(listener); const off = base.subscribe(listener); return () => { listeners.delete(listener); off(); }; },
    preview: (command: Command): PreviewResult => {
      const result = base.preview(onFloor(command, floor));
      return result.ok && floor && result.document.floors.length > 1 ? { ...result, document: floorView(result.document as PlanDocument, floor), derived: floorDerived(result.derived as Derived, result.document as PlanDocument, floor) } as PreviewResult : result;
    },
    execute: (command: Command) => base.execute(onFloor(command, floor)),
  };
  const store = new Proxy(base, {
    get(target, key) {
      if (key in scoped) return (scoped as Record<PropertyKey, unknown>)[key];
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value;
    },
  }) as ProjectStore;
  return { store, floorId: () => floor, setFloor(next) { if (next === floor) return; floor = next; for (const listener of [...listeners]) listener(); } };
}
