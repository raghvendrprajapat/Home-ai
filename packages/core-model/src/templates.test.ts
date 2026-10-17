import { describe, expect, it } from 'vitest';
import { createTemplateProject, parseProject, ProjectStore, serializeProject, TEMPLATE_IDS, TEMPLATES, validateProject } from './index';
import type { ProjectDoc, RoomType, TemplateId } from './index';

// FR-003 templates. Claude-authored analytic tests (not independent fixtures).
// Expected clear areas are hand-derived: outer walls 230 mm (half 115), inner walls 115 mm (half 57.5);
// a room's clear rectangle runs from each wall's inside face to the opposite inside face.
const NOW = '2026-10-17T00:00:00Z';
const labels: Record<RoomType, string> = { living: 'Living', bedroom: 'Bedroom', kitchen: 'Kitchen', bathroom: 'Bathroom', dining: 'Dining', pooja: 'Pooja', balcony: 'Balcony', utility: 'Utility', hall: 'Hall', study: 'Study', other: 'Other' };
function build(template: TemplateId, name = 'My home', roomName: (type: RoomType) => string = type => labels[type]): ProjectDoc {
  let n = 0;
  return createTemplateProject({ template, name, units: 'metric', now: NOW, nextId: () => `tpl_${n++}`, roomName });
}
const areas = (doc: ProjectDoc) => {
  const faces = new ProjectStore(doc, 'template_areas').getSnapshot().derived.faces;
  return Object.fromEntries(doc.rooms.map(room => [room.name, faces.find(f => f.roomId === room.id)!.clearAreaMm2]));
};
// width x depth of each clear rectangle, derived by hand:
//  1BHK Living  x 115..4142.5 (4027.5) by y 115..3542.5 (3427.5)         = 13,804,256.25 mm²
//  1BHK Kitchen x 115..4142.5 (4027.5) by y 3657.5..5885 (2227.5)        =  8,971,256.25
//  1BHK Bedroom x 4257.5..7085 (2827.5) by y 115..2942.5 (2827.5)        =  7,994,756.25
//  1BHK Utility x 4257.5..5642.5 (1385) by y 3057.5..5885 (2827.5)       =  3,916,087.5
//  1BHK Bathroom x 5757.5..7085 (1327.5) by y 3057.5..5885 (2827.5)      =  3,753,506.25
const EXPECTED: Record<TemplateId, Record<string, number>> = {
  '1bhk': { Living: 13804256.25, Kitchen: 8971256.25, Bedroom: 7994756.25, Utility: 3916087.5, Bathroom: 3753506.25 },
  //  2BHK Living x 115..4742.5 by y 115..3542.5 = 4627.5 x 3427.5 = 15,860,756.25; Kitchen 2227.5 x 2227.5 = 4,961,756.25
  //  Dining x 2457.5..4742.5 (2285) by y 3657.5..5885 (2227.5) = 5,089,837.5; Master x 4857.5..9485 (4627.5) by y 115..2942.5 (2827.5) = 13,084,256.25
  //  Bedroom 2 x 4857.5..7442.5 (2585) by y 3057.5..5885 (2827.5) = 7,309,087.5; Bathroom x 7557.5..9485 (1927.5) by 2827.5 = 5,450,006.25
  '2bhk': { Living: 15860756.25, Kitchen: 4961756.25, Dining: 5089837.5, Bedroom: 13084256.25, 'Bedroom 2': 7309087.5, Bathroom: 5450006.25 },
  // Presets: one 230 mm room, clear (w - 230) x (d - 230): 3370 x 3070, 4570 x 3370, 2770 x 2170, 1570 x 2170.
  bedroom: { Bedroom: 10345900 }, living: { Living: 15400900 }, kitchen: { Kitchen: 6010900 }, bathroom: { Bathroom: 3406900 },
};
const COUNTS: Record<TemplateId, { doors: number; windows: number; arches: number }> = {
  '1bhk': { doors: 5, windows: 7, arches: 0 }, '2bhk': { doors: 5, windows: 8, arches: 1 },
  bedroom: { doors: 1, windows: 1, arches: 0 }, living: { doors: 1, windows: 1, arches: 0 }, kitchen: { doors: 1, windows: 1, arches: 0 }, bathroom: { doors: 1, windows: 1, arches: 0 },
};

describe('FR-003 templates', () => {
  for (const id of TEMPLATE_IDS) {
    it(`${id}: valid project, exact analytic room areas, no small-room warning, named rooms`, () => {
      const doc = build(id);
      expect(validateProject(doc)).toEqual([]);
      expect(areas(doc)).toEqual(Object.fromEntries(Object.entries(EXPECTED[id]).map(([k, v]) => [k, expect.closeTo(v, 6)])));
      for (const value of Object.values(areas(doc))) expect(value).toBeGreaterThanOrEqual(250000);
      expect(doc.rooms.map(r => r.name)).toEqual(Object.keys(EXPECTED[id]).sort((a, b) => doc.rooms.findIndex(r => r.name === a) - doc.rooms.findIndex(r => r.name === b)));
      expect(doc.name).toBe('My home'); expect(doc.units).toBe('metric');
      expect(parseProject(serializeProject(doc))).toEqual({ ok: true, document: doc });
    });
    it(`${id}: openings sit exactly on their stated points with the right counts`, () => {
      const doc = build(id), spec = TEMPLATES[id], junction = new Map(doc.junctions.map(j => [j.id, j]));
      expect({ doors: doc.openings.filter(o => o.kind === 'door').length, windows: doc.openings.filter(o => o.kind === 'window').length, arches: doc.openings.filter(o => o.kind === 'opening').length }).toEqual(COUNTS[id]);
      const centres = doc.openings.map(o => {
        const wall = doc.walls.find(w => w.id === o.wallId)!, a = junction.get(wall.a)!, b = junction.get(wall.b)!;
        const length = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
        return [a.x + (b.x - a.x) / length * o.offset, a.y + (b.y - a.y) / length * o.offset].join(',');
      }).sort();
      expect(centres).toEqual(spec.openings.map(o => o.at.join(',')).sort());
      expect(doc.openings.every(o => o.sill + o.height <= 2700)).toBe(true);
    });
    it(`${id}: only L/T junctions (at most 3 walls), one floor, all integer mm, unique IDs`, () => {
      const doc = build(id), degree = new Map<string, number>();
      for (const wall of doc.walls) for (const j of [wall.a, wall.b]) degree.set(j, (degree.get(j) ?? 0) + 1);
      expect(Math.max(...degree.values())).toBeLessThanOrEqual(3);
      expect(doc.floors).toHaveLength(1);
      expect(doc.junctions.every(j => Number.isInteger(j.x) && Number.isInteger(j.y))).toBe(true);
      const ids = [doc.id, ...[doc.floors, doc.junctions, doc.walls, doc.openings, doc.rooms, doc.materials].flat().map(e => e.id)];
      expect(new Set(ids).size).toBe(ids.length);
    });
  }
  it('2BHK repeated room types are numbered; partitions are 115 mm and outer walls 230 mm', () => {
    const doc = build('2bhk');
    expect(doc.rooms.filter(r => r.type === 'bedroom').map(r => r.name)).toEqual(['Bedroom', 'Bedroom 2']);
    expect(new Set(doc.walls.map(w => w.thickness))).toEqual(new Set([230, 115]));
    expect(doc.walls.filter(w => w.thickness === 230).length).toBeGreaterThanOrEqual(4);
    expect(doc.walls.every(w => w.height === doc.floors[0]!.defaultWallHeight)).toBe(true);
  });
  it('localized room names come from the caller; builds are deterministic and independent of each other', () => {
    const hindi = build('1bhk', 'मेरा घर', type => ({ ...labels, living: 'बैठक', kitchen: 'रसोई' })[type]);
    expect(hindi.rooms.map(r => r.name)).toContain('बैठक'); expect(hindi.name).toBe('मेरा घर');
    expect(serializeProject(build('2bhk'))).toBe(serializeProject(build('2bhk')));
    expect(build('2bhk').id).toBe(build('2bhk').id); // same injected ID source; the app injects random IDs
  });
  it('the template document opens as an ordinary editable project: moving the whole V1 line keeps it valid and Undo restores it', () => {
    const doc = build('1bhk'), store = new ProjectStore(doc, 'template_edit'), before = serializeProject(store.getSnapshot().document);
    const column = store.getSnapshot().document.junctions.filter(j => j.x === 4200);
    expect(column.length).toBeGreaterThanOrEqual(4);
    const result = store.execute({ id: 'edit', baseGeneration: 0, type: 'MoveJunctions', moves: column.map(j => ({ junction: j.id, to: [4300, j.y] as const })) });
    expect(result.ok).toBe(true);
    expect(store.undo()).toBe(true); expect(serializeProject(store.getSnapshot().document)).toBe(before);
  });
  it('an unknown template or an invalid name fails without returning a document', () => {
    expect(() => createTemplateProject({ template: 'palace' as TemplateId, name: 'x', units: 'metric', now: NOW, nextId: () => 'x', roomName: t => t })).toThrow();
    expect(() => build('1bhk', '   ')).toThrow();
  });
});
