import { describe, expect, it } from 'vitest';
import { createRoomsProject, ProjectStore, validateProject } from './index';
import type { ProjectDoc, RoomRectSpec, RoomType } from './index';

// D73 AI-3 Claude-authored analytic tests. Walls are 200 mm (half 100); a clear rectangle runs from inside face to
// inside face, so a W x D centreline room alone is (W - 200) x (D - 200).
const labels: Partial<Record<RoomType, string>> = { living: 'Living', bedroom: 'Bedroom', kitchen: 'Kitchen', bathroom: 'Bathroom', other: 'Room' };
function build(rooms: RoomRectSpec[]) {
  let n = 0;
  return createRoomsProject({ rooms, name: 'Sketch', units: 'metric', now: '2026-10-18T00:00:00Z', nextId: () => `sk_${n++}`, roomName: type => labels[type] ?? type });
}
const areas = (doc: ProjectDoc) => {
  const faces = new ProjectStore(doc, 'rooms_areas').getSnapshot().derived.faces;
  return Object.fromEntries(doc.rooms.map(room => [room.name, faces.find(f => f.roomId === room.id)!.clearAreaMm2]));
};

describe('D73 createRoomsProject', () => {
  it('two rooms side by side share one wall: 6 junctions, 7 walls', () => {
    const { document, skipped } = build([{ x: 0, y: 0, width: 4000, depth: 3000, type: 'living' }, { x: 4000, y: 0, width: 3000, depth: 3000, type: 'bedroom' }]);
    expect(skipped).toEqual([]); expect(validateProject(document)).toEqual([]);
    expect(document.junctions).toHaveLength(6); expect(document.walls).toHaveLength(7);
    // Living x 100..3900 by y 100..2900 = 3800 x 2800; Bedroom x 4100..6900 by y 100..2900 = 2800 x 2800.
    expect(areas(document)).toEqual({ Living: 10640000, Bedroom: 7840000 });
    expect(document.rooms.map(r => r.type).sort()).toEqual(['bedroom', 'living']);
  });
  it('a room under two rooms meets their shared wall in a T: 8 junctions, 10 walls', () => {
    const { document, skipped } = build([{ x: 0, y: 0, width: 4000, depth: 3000, type: 'living' }, { x: 4000, y: 0, width: 3000, depth: 3000, type: 'bedroom' }, { x: 0, y: 3000, width: 7000, depth: 3000, type: 'kitchen' }]);
    expect(skipped).toEqual([]); expect(validateProject(document)).toEqual([]);
    expect(document.junctions).toHaveLength(8); expect(document.walls).toHaveLength(10);
    // Kitchen x 100..6900 by y 3100..5900 = 6800 x 2800.
    expect(areas(document)).toEqual({ Living: 10640000, Bedroom: 7840000, Kitchen: 19040000 });
  });
  it('a four-way crossing is not allowed in L0, so the two lower rooms of an exact 2 x 2 grid are reported', () => {
    const { document, skipped } = build([{ x: 0, y: 0, width: 3000, depth: 3000, type: 'living' }, { x: 3000, y: 0, width: 3000, depth: 3000, type: 'bedroom' }, { x: 0, y: 3000, width: 3000, depth: 3000, type: 'kitchen' }, { x: 3000, y: 3000, width: 3000, depth: 3000, type: 'bathroom' }]);
    expect(skipped).toEqual([2, 3]); expect(document.rooms).toHaveLength(2); expect(validateProject(document)).toEqual([]);
  });
  it('staggered by 150 mm the same grid builds all four rooms with T junctions only', () => {
    // East half of the middle line moved down to y 3150: TR 3000 x 3150, BR 3000 x 2850.
    const { document, skipped } = build([{ x: 0, y: 0, width: 3000, depth: 3000, type: 'living' }, { x: 3000, y: 0, width: 3000, depth: 3150, type: 'bedroom' }, { x: 0, y: 3000, width: 3000, depth: 3000, type: 'kitchen' }, { x: 3000, y: 3150, width: 3000, depth: 2850, type: 'bathroom' }]);
    expect(skipped).toEqual([]); expect(validateProject(document)).toEqual([]);
    // Living 2800 x 2800; Bedroom 2800 x (3050 - 100) = 2800 x 2950; Kitchen 2800 x 2800; Bathroom 2800 x (5900 - 3250) = 2800 x 2650.
    expect(areas(document)).toEqual({ Living: 7840000, Bedroom: 8260000, Kitchen: 7840000, Bathroom: 7420000 });
  });
  it('a room inside another is left out; repeated types are numbered', () => {
    const { document, skipped } = build([{ x: 0, y: 0, width: 4000, depth: 4000, type: 'bedroom' }, { x: 1000, y: 1000, width: 2000, depth: 2000, type: 'bathroom' }, { x: 4000, y: 0, width: 3000, depth: 4000, type: 'bedroom' }]);
    expect(skipped).toEqual([1]); expect(document.rooms.map(r => r.name).sort()).toEqual(['Bedroom', 'Bedroom 2']);
  });
  it('refuses an empty or oversized list', () => {
    expect(() => build([])).toThrow(); expect(() => build(Array.from({ length: 21 }, (_, i) => ({ x: i * 3000, y: 0, width: 3000, depth: 3000, type: 'other' as const })))).toThrow();
  });
});
