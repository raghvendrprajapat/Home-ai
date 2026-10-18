import { describe, expect, it } from 'vitest';
import sample from '../../../docs/examples/sample-project.json';
import { MAX_FLOORS, ProjectStore, serializeProject, validateProject } from './index';
import type { Command, ProjectDoc } from './index';
import { derivePlan } from '@gharplan/geometry';

// FR-034 multiple floors (D63). Claude-authored analytic tests, not independent fixtures.
// H.6 sample: outer 230 mm walls w1..w6 around 8000 x 5000 (centreline), 115 mm partition w7 at x=4500; floor f0 elevation 0, walls 3000.
const setup = () => new ProjectStore(structuredClone(sample) as ProjectDoc, 'floors_session');
let serial = 0;
const run = (store: ProjectStore, command: Record<string, unknown>) =>
  store.execute({ id: `floor_${++serial}`, baseGeneration: store.getSnapshot().localGeneration, ...command } as Command);
const doc = (store: ProjectStore) => store.getSnapshot().document;
const plan = (d: ReturnType<typeof doc>) => structuredClone(d) as unknown as Parameters<typeof derivePlan>[0];
const derivedRooms = (store: ProjectStore, floorId: string) => { const d = doc(store); return derivePlan(plan(d)).faces.filter(face => d.junctions.find(j => j.id === face.boundary[0])!.floorId === floorId); };

describe('FR-034 floors', () => {
  it('adds a floor on top at the lower floor wall height, without touching the ground floor', () => {
    const store = setup(), before = structuredClone(doc(store));
    expect(run(store, { type: 'AddFloor', name: '  First floor ' }).ok).toBe(true);
    const floors = doc(store).floors;
    expect(floors).toHaveLength(2);
    expect(floors[1]).toMatchObject({ name: 'First floor', level: 1, elevation: 3000, defaultWallHeight: 3000 });
    expect(doc(store).walls).toEqual(before.walls); expect(doc(store).rooms).toEqual(before.rooms);
  });

  it('copying the outline brings only the outer walls up: one room of (8000-230) x (5000-230) mm', () => {
    const store = setup();
    expect(run(store, { type: 'AddFloor', name: 'First floor', copyOutlineFrom: 'f0' }).ok).toBe(true);
    const d = doc(store), upper = d.floors[1]!.id;
    const walls = d.walls.filter(w => w.floorId === upper);
    expect(walls.length).toBeGreaterThanOrEqual(4); // collinear outer pieces may stay split or merge; the partition never comes up
    expect(walls.every(w => w.thickness === 230 && w.height === 3000)).toBe(true);
    expect(d.junctions.filter(j => j.floorId === upper).every(j => !d.junctions.some(o => o.id === j.id && o.floorId !== upper))).toBe(true);
    const rooms = derivedRooms(store, upper);
    expect(rooms).toHaveLength(1);
    expect(rooms[0]!.clearAreaMm2).toBe(7770 * 4770); // 37 062 900 mm2, the spec's outer clear rectangle
    expect(d.rooms.filter(r => r.floorId === upper)).toHaveLength(1);
    // Ground floor keeps its two rooms with their exact areas (20 642 175 and 15 872 175 mm2).
    expect(derivedRooms(store, 'f0').map(f => f.clearAreaMm2).sort((a, b) => a - b)).toEqual([15872175, 20642175]);
  });

  it('identical stacked floors are independent: no shared footprints, no false nested-room error', () => {
    const store = setup();
    expect(run(store, { type: 'AddFloor', name: 'First floor', copyOutlineFrom: 'f0' }).ok).toBe(true);
    const upper = doc(store).floors[1]!.id;
    // Draw the same partition upstairs at exactly the ground floor position, but thinner: no shared-wall conflict across floors.
    expect(run(store, { type: 'AddWall', from: [4500, 0], to: [4500, 5000], thickness: 100, height: 3000, floorId: upper }).ok).toBe(true);
    expect(derivedRooms(store, upper).map(f => f.clearAreaMm2).sort((a, b) => a - b)).toEqual([(7885 - 4550) * 4770, (4450 - 115) * 4770]);
    expect(derivedRooms(store, 'f0').map(f => f.clearAreaMm2).sort((a, b) => a - b)).toEqual([15872175, 20642175]);
    const footprints = derivePlan(plan(doc(store))).footprints, owner = new Map(doc(store).walls.map(w => [w.id, w.floorId]));
    expect(footprints.filter(p => owner.get(p.ownerId) === upper).length).toBeGreaterThan(0);
  });

  it('a rectangle drawn on an upper floor uses that floor and does not adjoin ground walls of other thickness', () => {
    const store = setup();
    run(store, { type: 'AddFloor', name: 'First floor' });
    const upper = doc(store).floors[1]!.id;
    // Same line as ground wall w1 (y=0), 150 mm thick: on the ground floor this would need matching thickness.
    expect(run(store, { type: 'AddRectangle', x: 0, y: 0, width: 3000, depth: 3000, thickness: 150, height: 3000, floorId: upper }).ok).toBe(true);
    const d = doc(store);
    expect(d.walls.filter(w => w.floorId === upper)).toHaveLength(4);
    expect(d.rooms.filter(r => r.floorId === upper)).toHaveLength(1);
    expect(derivedRooms(store, upper)[0]!.clearAreaMm2).toBe(2850 * 2850);
    expect(run(store, { type: 'AddRectangle', x: 0, y: 0, width: 3000, depth: 3000, thickness: 150, height: 3000, floorId: 'missing' }).ok).toBe(false);
  });

  it('deleting a floor removes everything on it in one step; Undo restores the exact document; the last floor stays', () => {
    const store = setup(), original = serializeProject(doc(store));
    run(store, { type: 'AddFloor', name: 'First floor', copyOutlineFrom: 'f0' });
    const withFloor = serializeProject(doc(store)), upper = doc(store).floors[1]!.id;
    expect(run(store, { type: 'DeleteFloor', floorId: upper }).ok).toBe(true);
    const d = doc(store);
    expect(d.floors.map(f => f.id)).toEqual(['f0']);
    expect([...d.junctions, ...d.walls, ...d.rooms, ...d.furniture, ...d.lights].every(e => e.floorId === 'f0')).toBe(true);
    expect(store.undo()).toBe(true); expect(serializeProject(doc(store))).toBe(withFloor);
    expect(store.undo()).toBe(true); expect(serializeProject(doc(store))).toBe(original);
    const before = store.getSnapshot();
    expect(run(store, { type: 'DeleteFloor', floorId: 'f0' }).ok).toBe(false); expect(store.getSnapshot()).toBe(before);
  });

  it('deleting the ground floor takes its doors, windows and furniture too', () => {
    const store = setup();
    run(store, { type: 'AddFloor', name: 'First floor' });
    expect(run(store, { type: 'DeleteFloor', floorId: 'f0' }).ok).toBe(true);
    const d = doc(store);
    expect(d.walls).toEqual([]); expect(d.openings).toEqual([]); expect(d.furniture).toEqual([]); expect(d.rooms).toEqual([]);
    expect(d.floors).toHaveLength(1); expect(validateProject(d)).toEqual([]);
  });

  it('floors stay ordered: renaming works, a floor cannot start at or below the one beneath it, and at most MAX_FLOORS exist', () => {
    const store = setup();
    run(store, { type: 'AddFloor', name: 'First floor' });
    const upper = doc(store).floors[1]!.id, before = store.getSnapshot();
    expect(run(store, { type: 'UpdateFloor', floorId: upper, properties: { elevation: 0 } }).ok).toBe(false); expect(store.getSnapshot()).toBe(before);
    expect(run(store, { type: 'UpdateFloor', floorId: upper, properties: { elevation: 3200, name: 'Pehli manzil' } }).ok).toBe(true);
    expect(doc(store).floors[1]).toMatchObject({ elevation: 3200, name: 'Pehli manzil' });
    for (let i = 2; i < MAX_FLOORS; i++) expect(run(store, { type: 'AddFloor', name: `Floor ${i}` }).ok).toBe(true);
    expect(doc(store).floors).toHaveLength(MAX_FLOORS);
    expect(doc(store).floors.map(f => f.elevation)).toEqual([0, 3200, 6200, 9200, 12200, 15200]);
    const full = store.getSnapshot();
    expect(run(store, { type: 'AddFloor', name: 'Too many' }).ok).toBe(false); expect(store.getSnapshot()).toBe(full);
    for (const name of ['', '   ', 'x'.repeat(61)]) expect(run(store, { type: 'AddFloor', name }).ok).toBe(false);
    expect(run(store, { type: 'AddFloor', name: 'Copy', copyOutlineFrom: 'missing' }).ok).toBe(false);
  });

  it('validation accepts several ordered floors and rejects duplicate levels or non-increasing elevations', () => {
    const d = structuredClone(sample) as ProjectDoc;
    d.floors.push({ id: 'f1', name: 'First', level: 1, elevation: 3000, defaultWallHeight: 3000 });
    expect(validateProject(d)).toEqual([]);
    expect(validateProject({ ...d, floors: [d.floors[0]!, { ...d.floors[1]!, level: 0 }] }).map(e => e.code)).toContain('floors');
    expect(validateProject({ ...d, floors: [d.floors[0]!, { ...d.floors[1]!, elevation: 0 }] }).map(e => e.code)).toContain('floors');
  });
});
