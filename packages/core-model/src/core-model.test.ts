import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import sample from '../../../docs/examples/sample-project.json';
import gapFixtures from '../../../tests/fixtures/independent/geometry/closing-gap.json';
import limitFixtures from '../../../tests/fixtures/independent/geometry/segments-and-limits.json';
import { canonicalStringify, dependencyHash, MAX_DOCUMENT_BYTES, openingEndGuard, parseProject, ProjectStore, serializeProject, utf8Bytes, validateProject } from './index';
import type { Command, ProjectDoc } from './index';
function sampleDoc(): ProjectDoc {
  const parsed = parseProject(JSON.stringify(sample));
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors)); return parsed.document;
}
function blankDoc(): ProjectDoc {
  const doc = sampleDoc(); doc.id = 'blank_project'; doc.name = 'Blank'; doc.revision = 0;
  doc.junctions = []; doc.walls = []; doc.openings = []; doc.rooms = []; doc.furniture = []; doc.lights = []; doc.cameras = [];
  doc.materials = [{ id: 'm_default', name: 'Paint', baseColor: '#ece4d5', roughness: 0.8, metalness: 0 }]; return doc;
}
function command(store: ProjectStore, body: Omit<Command, 'id' | 'baseGeneration'>): Command {
  return { id: `command_${store.getSnapshot().localGeneration}`, baseGeneration: store.getSnapshot().localGeneration, ...body } as Command;
}
function move(store: ProjectStore, dx: number) {
  return store.execute(command(store, { type: 'MoveWall', wallId: 'w7', dx, dy: 0 } as Omit<Command, 'id' | 'baseGeneration'>));
}

describe('DM-001/002 canonical shape and semantic validation', () => {
  it('loads complete H.6 document, keeps pinned assets and exact serialization', () => {
    const doc = sampleDoc(); expect(validateProject(doc)).toEqual([]);
    expect(parseProject(serializeProject(doc))).toEqual({ ok: true, document: doc });
    expect(doc.furniture.map(f => f.assetVersion)).toEqual(sample.furniture.map(f => f.assetVersion));
    const store = new ProjectStore(doc, 'session_one'); expect(store.getSnapshot().derived.faces.map(f => f.roomId).sort()).toEqual(['r_bed', 'r_living']);
    expect(() => { (store.getSnapshot().document.name as unknown as { value: string }).value = 'mutation'; }).toThrow();
    expect(() => { Object.assign(store.getSnapshot().document, { name: 'mutated' }); }).toThrow(); expect(doc.name).toBe(sample.name);
  });
  it('rejects unsupported version, missing references, bad room boundaries, duplicate IDs and fractional geometry', () => {
    const cases: [string, (d: ProjectDoc) => void][] = [
      ['schema', d => { d.schemaVersion = 2 as 1; }], ['floor-reference', d => { d.furniture[0]!.floorId = 'missing'; }],
      ['material-reference', d => { d.walls[0]!.leftMaterial = 'missing'; }], ['duplicate-id', d => { d.furniture[0]!.id = d.walls[0]!.id; }],
      ['schema', d => { d.junctions[0]!.x = 0.4; }], ['room-boundary', d => { d.rooms[0]!.boundary.reverse(); }],
      ['floors', d => { d.floors.push({ ...d.floors[0]!, id: 'f1' }); }],
      ['schema', d => { d.walls[0]!.thickness = 1001; }], ['schema', d => { d.createdAt = 'not-a-date'; }],
    ];
    for (const [code, corrupt] of cases) { const doc = sampleDoc(); corrupt(doc); expect(validateProject(doc).some(e => e.code === code), code).toBe(true); }
    expect(parseProject('{broken').ok).toBe(false); expect(parseProject(' '.repeat(MAX_DOCUMENT_BYTES + 1)).ok).toBe(false);
  });
  it('UTF8 counting matches real encoder; canonical ordering/roundtrip/hash independent of object insertion order', () => {
    fc.assert(fc.property(fc.string(), text => {
      expect(utf8Bytes(text)).toBe(new TextEncoder().encode(text).byteLength);
      const a = { z: text, a: 12 }, b = { a: 12, z: text };
      expect(canonicalStringify(a)).toBe(canonicalStringify(b)); expect(dependencyHash(a)).toBe(dependencyHash(b));
    }), { seed: 20261011, numRuns: 500 });
    expect(() => canonicalStringify({ value: Number.NaN })).toThrow();
    const cycle: { self?: unknown } = {}; cycle.self = cycle; expect(() => canonicalStringify(cycle)).toThrow();
  });
  it('accepted independent LIM-04/LIM-05 reject in the full core document boundary', () => {
    for (const id of ['LIM-04', 'LIM-05']) {
      const fixture = limitFixtures.cases.find(c => c.id === id)!;
      if (typeof fixture.plan !== 'object') throw new Error('Fixture reference unexpectedly changed.');
      const doc = blankDoc(); doc.junctions = fixture.plan.junctions.map(j => ({ ...j, floorId: 'f0', x: Number(j.x), y: Number(j.y) }));
      doc.walls = fixture.plan.walls.map(w => ({ ...w, floorId: 'f0', leftMaterial: 'm_default', rightMaterial: 'm_default', rev: 0 }));
      expect(validateProject(doc).length).toBeGreaterThan(0); expect(parseProject(JSON.stringify(doc)).ok).toBe(false);
    }
  });
});

describe('Codex-authored opening and history properties; independent Claude review deferred by D17', () => {
  it('free-wall end guards and reversal preserve analytic world centres and exact undo', () => {
    fc.assert(fc.property(fc.integer({ min: 50, max: 1000 }), fc.integer({ min: 5000, max: 10000 }), fc.integer({ min: 100, max: 1000 }), (thickness, length, halfWidth) => {
      const doc = blankDoc(); doc.junctions = [{ id: 'ja', floorId: 'f0', x: 0, y: 0 }, { id: 'jb', floorId: 'f0', x: length, y: 0 }];
      doc.walls = [{ id: 'wa', floorId: 'f0', a: 'ja', b: 'jb', thickness, height: 3000, leftMaterial: 'm_default', rightMaterial: 'm_default', rev: 0 }];
      const offset = Math.ceil(50 + thickness / 2 + halfWidth);
      doc.openings = [{ id: 'oa', wallId: 'wa', kind: 'door', assetId: 'door_asset', offset, width: halfWidth * 2, height: 2100, sill: 0, flipX: false, flipY: false, rev: 0 }];
      expect(openingEndGuard(doc, doc.walls[0]!, 'a')).toBe(50 + thickness / 2);
      const store = new ProjectStore(doc, 'property_session');
      expect(store.execute({ id: 'reverse_wall', baseGeneration: 0, type: 'ReverseWall', wallId: 'wa' }).ok).toBe(true);
      const opening = store.getSnapshot().document.openings[0]!;
      expect(length - opening.offset).toBe(offset); expect(opening.flipX).toBe(true);
      expect(store.undo()).toBe(true); expect(serializeProject(store.getSnapshot().document)).toBe(serializeProject(doc));
      const invalid = { ...doc.openings[0]!, offset: offset - 1 };
      if (invalid.offset - halfWidth < 50 + thickness / 2) {
        const before = store.getSnapshot();
        expect(store.execute({ id: 'bad_clearance', baseGeneration: 2, type: 'UpdateOpening', openingId: 'oa', properties: { offset: invalid.offset } }).ok).toBe(false);
        expect(store.getSnapshot()).toBe(before);
      }
    }), { seed: 20261011, numRuns: 1000 });
  });
  it('mixed edit/undo/redo sequences match a separate immutable snapshot history oracle', () => {
    fc.assert(fc.property(fc.array(fc.integer({ min: -2, max: 2 }), { minLength: 1, maxLength: 20 }), actions => {
      const store = new ProjectStore(sampleDoc(), 'history_property', { now: () => '2026-10-11T15:00:00Z' });
      const undo: string[] = [], redo: string[] = []; let expected = serializeProject(sampleDoc()), generation = 0;
      for (const action of actions) {
        if (action === -2 || action === 2) {
          const source = action === -2 ? undo : redo, target = action === -2 ? redo : undo;
          const next = source.pop(), changed = action === -2 ? store.undo() : store.redo();
          expect(changed).toBe(next !== undefined);
          if (next !== undefined) { target.push(expected); expected = next; generation++; }
        } else {
          const result = move(store, action === 0 ? 1 : action);
          expect(result.ok).toBe(true); if (!result.ok) throw new Error('Analytically valid bounded partition edit failed.');
          if (result.changed) { undo.push(expected); redo.length = 0; generation++; expected = serializeProject(store.getSnapshot().document); }
        }
        expect(serializeProject(store.getSnapshot().document)).toBe(expected);
        expect(store.getSnapshot().localGeneration).toBe(generation); expect(store.getSnapshot().canUndo).toBe(undo.length > 0); expect(store.getSnapshot().canRedo).toBe(redo.length > 0);
      }
      expect(parseProject(expected).ok).toBe(true);
    }), { seed: 20261011, numRuns: 1000 });
  }, 30000);
});

describe('DM-003/004 and SYNC-007 atomic commands, exact history and server revision', () => {
  it('MoveWall w7 +100 gives exact approved areas; undo/redo restores exact content in new generations', () => {
    const original = sampleDoc(), store = new ProjectStore(original, 'session_one'), before = serializeProject(original);
    expect(move(store, 100).ok).toBe(true); const current = store.getSnapshot();
    expect(current.document.revision).toBe(1); expect(current.localGeneration).toBe(1);
    expect(current.derived.faces.map(f => f.clearAreaMm2).sort((a, b) => b - a)).toEqual([21119175, 15395175]);
    expect(current.document.rooms.map(r => r.id)).toEqual(original.rooms.map(r => r.id));
    expect(current.document.furniture).toEqual(original.furniture);
    const after = canonicalStringify(current.document), staleTag = store.asyncTag();
    expect(store.undo()).toBe(true); expect(canonicalStringify(store.getSnapshot().document)).toBe(before); expect(store.getSnapshot().localGeneration).toBe(2);
    expect(store.acceptsAsync(staleTag)).toBe(false);
    expect(store.redo()).toBe(true); expect(canonicalStringify(store.getSnapshot().document)).toBe(after); expect(store.getSnapshot().localGeneration).toBe(3);
    expect(store.acceptsAsync(staleTag)).toBe(false); expect(store.acceptsAsync(store.asyncTag())).toBe(true);
    const reopened = new ProjectStore(original, 'session_two'); expect(reopened.acceptsAsync(store.asyncTag())).toBe(false);
  });
  it('invalid geometry and stale edit leave snapshot, history, listeners and generation unchanged', () => {
    const store = new ProjectStore(sampleDoc(), 'session_one'); let calls = 0; store.subscribe(() => { calls++; });
    const snapshot = store.getSnapshot(); const invalid = store.execute({ id: 'bad_edit', baseGeneration: 0, type: 'MoveJunctions', moves: [{ junction: 'j2', to: [4500, 0.4] }] });
    expect(invalid.ok).toBe(false); expect(store.getSnapshot()).toBe(snapshot); expect(calls).toBe(0); expect(store.undo()).toBe(false);
    expect(store.execute({ id: 'stale_edit', baseGeneration: 9, type: 'RenameProject', name: 'Wrong' }).ok).toBe(false); expect(store.getSnapshot()).toBe(snapshot);
  });
  it('duplicate no-op preserves unused junctions, timestamp and empty history; real edit updates timestamp', () => {
    const doc = blankDoc(); doc.junctions.push({ id: 'unused_junction', floorId: 'f0', x: 9000, y: 9000 });
    const store = new ProjectStore(doc, 'noop_session', { now: () => '2026-10-11T15:00:00Z' });
    const add: Command = { id: 'wall_add', baseGeneration: 0, type: 'AddWall', from: [0, 0], to: [4000, 0], thickness: 200, height: 3000 };
    expect(store.execute(add).ok).toBe(true); expect(store.getSnapshot().document.updatedAt).toBe('2026-10-11T15:00:00Z');
    const before = store.getSnapshot(); expect(store.execute({ ...add, id: 'wall_duplicate', baseGeneration: 1 })).toMatchObject({ ok: true, changed: false });
    expect(store.getSnapshot()).toBe(before); expect(store.undo()).toBe(true); expect(store.getSnapshot().document.updatedAt).toBe(doc.updatedAt);
  });
  it('thickness changes invalidate adjacent room revs; furniture command preserves wall identity; unknown property rejects', () => {
    const store = new ProjectStore(sampleDoc(), 'dependency_session'), original = store.getSnapshot();
    expect(store.execute({ id: 'wall_thickness', baseGeneration: 0, type: 'UpdateWall', wallId: 'w7', properties: { thickness: 230 } }).ok).toBe(true);
    expect(store.getSnapshot().document.rooms.every(r => r.rev === 1)).toBe(true);
    expect(store.getSnapshot().derived.faces.map(f => f.clearAreaMm2).sort((a, b) => b - a)).toEqual([20367900, 15597900]);
    expect(store.undo()).toBe(true);
    const before = store.getSnapshot();
    expect(store.execute({ id: 'furniture_move', baseGeneration: 2, type: 'UpdateFurniture', furnitureId: before.document.furniture[0]!.id, properties: { position: { x: 1000, y: 1000 } } }).ok).toBe(true);
    expect(store.getSnapshot().document.walls).toBe(before.document.walls); expect(store.getSnapshot().document.furniture[0]!.rev).toBe(original.document.furniture[0]!.rev + 1);
    const current = store.getSnapshot();
    const malicious = { id: 'protected_id', baseGeneration: 3, type: 'UpdateWall', wallId: 'w7', properties: { id: 'renamed_wall' } } as unknown as Command;
    expect(store.execute(malicious).ok).toBe(false); expect(store.getSnapshot()).toBe(current);
  });
  it('100 history steps, redo cleared on branch, listener errors do not turn a committed edit into rejection', () => {
    const store = new ProjectStore(sampleDoc(), 'session_one');
    for (let i = 0; i < 100; i++) expect(move(store, i % 2 === 0 ? 1 : -1).ok).toBe(true);
    for (let i = 0; i < 100; i++) expect(store.undo()).toBe(true);
    expect(store.undo()).toBe(false); expect(store.getSnapshot().localGeneration).toBe(200);
    expect(canonicalStringify(store.getSnapshot().document)).toBe(serializeProject(sampleDoc()));
    store.subscribe(() => { throw new Error('Adapter crash'); });
    expect(store.execute({ id: 'rename_project', baseGeneration: 200, type: 'RenameProject', name: 'New name' }).ok).toBe(true);
    expect(store.redo()).toBe(false); expect(store.getListenerErrors()).toEqual(['Adapter crash']); expect(store.getSnapshot().document.name).toBe('New name');
  });
  it('cloud acknowledgement updates only server revision, survives undo and rejects wrong/out-of-order revision', () => {
    const store = new ProjectStore(sampleDoc(), 'session_one'); move(store, 100);
    expect(store.confirmServerRevision(1, 2)).toBe(true); expect(store.getSnapshot().localGeneration).toBe(1);
    expect(store.undo()).toBe(true); expect(store.getSnapshot().document.revision).toBe(2);
    expect(store.confirmServerRevision(1, 3)).toBe(false); expect(store.confirmServerRevision(2, 2.5)).toBe(false);
    expect(store.redo()).toBe(true); expect(store.getSnapshot().document.revision).toBe(2);
  });
  it('runtime malformed commands and unsafe revisions reject without state changes', () => {
    const store = new ProjectStore(sampleDoc(), 'runtime_session'), before = store.getSnapshot();
    for (const malformed of [null, undefined, [], {}, { id: 123, type: 'RenameProject', baseGeneration: 0 }, { id: 'bad_command', type: 'MoveWall', baseGeneration: 0 }]) {
      expect(store.execute(malformed as unknown as Command).ok).toBe(false); expect(store.getSnapshot()).toBe(before);
    }
    for (const value of [Number.MAX_SAFE_INTEGER + 1, Infinity, NaN, -1, 1.2]) expect(store.confirmServerRevision(1, value)).toBe(false);
    const doc = sampleDoc(); doc.revision = Number.MAX_SAFE_INTEGER + 1;
    expect(validateProject(doc).some(e => e.code === 'revision')).toBe(true);
    doc.revision = 1; doc.walls[0]!.rev = Number.MAX_SAFE_INTEGER + 1;
    expect(validateProject(doc).some(e => e.code === 'revision')).toBe(true);
  });
  it('coercible command values cannot move walls or delete dependent openings', () => {
    const store = new ProjectStore(sampleDoc(), 'coercion_session'), before = store.getSnapshot();
    for (const body of [
      { type: 'MoveWall', wallId: 'w7', dx: true, dy: false },
      { type: 'MoveWall', wallId: 'w7', dx: '100', dy: 0 },
      { type: 'DeleteWall', wallId: sample.openings[0]!.wallId, deleteDependents: 'false' },
    ]) {
      expect(store.execute({ id: 'coercible_command', baseGeneration: 0, ...body } as unknown as Command).ok).toBe(false);
      expect(store.getSnapshot()).toBe(before);
    }
  });
  it('opening edits and neighbour footprint changes invalidate every affected wall cache', () => {
    const store = new ProjectStore(sampleDoc(), 'mesh_dependency_session');
    const opening = store.getSnapshot().document.openings[0]!, host = store.getSnapshot().document.walls.find(w => w.id === opening.wallId)!;
    const edited = store.execute({ id: 'opening_width', baseGeneration: 0, type: 'UpdateOpening', openingId: opening.id, properties: { width: opening.width - 100 } });
    expect(edited.ok).toBe(true); if (!edited.ok) throw new Error('Expected valid edit.');
    expect(edited.changedIds).toContain(host.id); expect(store.getSnapshot().document.walls.find(w => w.id === host.id)!.rev).toBe(host.rev + 1);
    expect(store.undo()).toBe(true); const before = store.getSnapshot();
    const resized = store.execute({ id: 'neighbour_thickness', baseGeneration: 2, type: 'UpdateWall', wallId: 'w1', properties: { thickness: 300 } });
    expect(resized.ok).toBe(true); if (!resized.ok) throw new Error('Expected valid edit.');
    const after = store.getSnapshot();
    for (const w of after.document.walls) {
      const oldFootprint = before.derived.footprints.filter(p => p.ownerId === w.id), footprint = after.derived.footprints.filter(p => p.ownerId === w.id);
      if (JSON.stringify(oldFootprint) !== JSON.stringify(footprint)) {
        expect(resized.changedIds, w.id).toContain(w.id); expect(w.rev, w.id).toBeGreaterThan(before.document.walls.find(p => p.id === w.id)!.rev);
      }
    }
  });
  it('normalization split IDs reserve furniture and other project IDs', () => {
    const doc = blankDoc(); doc.furniture.push({ ...sampleDoc().furniture[0]!, id: 'wall_1_1' });
    const store = new ProjectStore(doc, 'split_id_session');
    expect(store.execute({ id: 'wall_add', baseGeneration: 0, type: 'AddWall', from: [0, 0], to: [6000, 0], thickness: 200, height: 3000 }).ok).toBe(true);
    expect(store.execute({ id: 'wall_tee', baseGeneration: 1, type: 'AddWall', from: [2000, 0], to: [2000, 2000], thickness: 200, height: 3000 }).ok).toBe(true);
    expect(store.getSnapshot().document.walls).toHaveLength(3); expect(validateProject(store.getSnapshot().document)).toEqual([]);
    expect(store.getSnapshot().document.furniture[0]!.id).toBe('wall_1_1');
  });
  it('public command patches cannot be changed to corrupt private history', () => {
    const store = new ProjectStore(sampleDoc(), 'patch_session'), result = move(store, 100);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected valid edit.');
    expect(() => { result.inverse.splice(0); }).toThrow();
    expect(() => { result.patches[0]!.path.splice(0); }).toThrow();
    expect(store.undo()).toBe(true); expect(canonicalStringify(store.getSnapshot().document)).toBe(serializeProject(sampleDoc()));
    expect(store.redo()).toBe(true); expect(store.getSnapshot().derived.faces[0]!.clearAreaMm2).toBe(21119175);
  });
  it('commit listeners cannot reenter history/commands or endlessly extend the notification batch', () => {
    const store = new ProjectStore(sampleDoc(), 'notification_session'); let calls = 0;
    store.subscribe(() => {
      calls++; store.subscribe(() => { calls++; });
      expect(store.undo()).toBe(false); expect(store.confirmServerRevision(1, 2)).toBe(false);
      expect(store.execute({ id: 'nested_edit', baseGeneration: 1, type: 'RenameProject', name: 'Nested' }).ok).toBe(false);
    });
    expect(move(store, 100).ok).toBe(true); expect(calls).toBe(1); expect(store.getSnapshot().localGeneration).toBe(1);
    expect(store.getSnapshot().document.name).toBe(sample.name);
  });
  it('throwing diagnostic accessors cannot report an already committed command as rejected', () => {
    const store = new ProjectStore(sampleDoc(), 'diagnostic_session'), error = new Error('original');
    Object.defineProperty(error, 'message', { get() { throw new Error('Broken diagnostic'); } });
    store.subscribe(() => { throw error; });
    expect(move(store, 100)).toMatchObject({ ok: true, changed: true });
    expect(store.getSnapshot().localGeneration).toBe(1); expect(store.getListenerErrors()).toEqual(['Adapter listener failed.']);
    expect(store.undo()).toBe(true); expect(store.getSnapshot().localGeneration).toBe(2);
  });
  it('height edits invalidate neighbour caps in upper height bands', () => {
    const doc = sampleDoc(); doc.walls.find(w => w.id === 'w1')!.thickness = 300;
    const store = new ProjectStore(doc, 'height_session'), result = store.execute({ id: 'shorten_wall', baseGeneration: 0, type: 'UpdateWall', wallId: 'w1', properties: { height: 2500 } });
    expect(result.ok).toBe(true); if (!result.ok) throw new Error('Expected valid edit.');
    expect(result.changedIds).toContain('w6'); expect(store.getSnapshot().document.walls.find(w => w.id === 'w6')!.rev).toBe(1);
    expect(store.undo()).toBe(true); expect(store.getSnapshot().document.walls.find(w => w.id === 'w6')!.rev).toBe(0);
  });
  it('a short wide wall cannot mask an upper-band thickness dependency', () => {
    const doc = blankDoc();
    doc.junctions = [{ id: 'jl', floorId: 'f0', x: -4000, y: 0 }, { id: 'jm', floorId: 'f0', x: 0, y: 0 }, { id: 'jr', floorId: 'f0', x: 4000, y: 0 }, { id: 'jb', floorId: 'f0', x: 0, y: 4000 }];
    const make = (id: string, a: string, b: string, thickness: number, height: number) => ({ id, floorId: 'f0', a, b, thickness, height, leftMaterial: 'm_default', rightMaterial: 'm_default', rev: 0 });
    doc.walls = [make('aa_low', 'jl', 'jm', 1000, 1000), make('bb_high', 'jm', 'jr', 200, 3000), make('cc_vertical', 'jm', 'jb', 200, 3000)];
    const store = new ProjectStore(doc, 'masked_session'), before = store.getSnapshot();
    const result = store.execute({ id: 'masked_thickness', baseGeneration: 0, type: 'UpdateWall', wallId: 'bb_high', properties: { thickness: 300 } });
    expect(result.ok).toBe(true); if (!result.ok) throw new Error('Expected valid edit.');
    expect(store.getSnapshot().derived.footprints.filter(p => p.ownerId === 'cc_vertical')).toEqual(before.derived.footprints.filter(p => p.ownerId === 'cc_vertical'));
    expect(result.changedIds).toContain('cc_vertical'); expect(store.getSnapshot().document.walls.find(w => w.id === 'cc_vertical')!.rev).toBe(1);
  });
  it('20 MiB history eviction is disclosed and retained undos remain valid', () => {
    const doc = sampleDoc(), store = new ProjectStore(doc, 'bounded_history'), furnitureId = doc.furniture[0]!.id;
    const variants: Record<string, string>[] = [{}, {}];
    for (let i = 0; i < 42000; i++) { variants[0]![`A_slot_${i}`] = doc.materials[0]!.id; variants[1]![`B_slot_${i}`] = doc.materials[0]!.id; }
    for (let i = 0; i < 15; i++) expect(store.execute({ id: `large_edit_${i}`, baseGeneration: i, type: 'UpdateFurniture', furnitureId, properties: { materialOverrides: variants[i % 2]! } }).ok).toBe(true);
    expect(store.getSnapshot().historyTruncated).toBe(true); let steps = 0;
    while (store.undo()) steps++;
    expect(steps).toBeGreaterThan(0); expect(steps).toBeLessThan(15); expect(validateProject(store.getSnapshot().document)).toEqual([]);
  }, 15000);
  it('new room IDs avoid collisions with non-geometry project entities', () => {
    const doc = blankDoc(); doc.materials[0]!.id = 'room_1';
    const store = new ProjectStore(doc, 'id_session');
    expect(store.execute({ id: 'rectangle_with_reserved_id', baseGeneration: 0, type: 'AddRectangle', x: 0, y: 0, width: 4000, depth: 3000, thickness: 200, height: 3000 }).ok).toBe(true);
    expect(store.getSnapshot().document.rooms[0]!.id).toBe('room_2');
  });
  it('GAP-03 fractional canonical command is rejected exactly as accepted independent fixture requires', () => {
    const c = gapFixtures.cases.find(c => c.id === 'GAP-03')!;
    const store = new ProjectStore(blankDoc(), 'gap_session'), snapshot = store.getSnapshot();
    if (!('from' in c.operation) || !('to' in c.operation)) throw new Error('Fixture operation changed.');
    const r = store.execute({ id: 'gap_command', baseGeneration: 0, type: 'AddWall', from: c.operation.from as [number, number], to: c.operation.to as [number, number], thickness: 200, height: 3000 });
    expect(r.ok).toBe(c.expect.accepted); expect(store.getSnapshot()).toBe(snapshot); expect(store.undo()).toBe(false);
  });
  it('D12 small positive rooms kept, warning updates, nonpositive close command leaves no undo entry', () => {
    const store = new ProjectStore(blankDoc(), 'small_session');
    expect(store.execute({ id: 'small_rectangle', baseGeneration: 0, type: 'AddRectangle', x: 0, y: 0, width: 699, depth: 699, thickness: 200, height: 3000 }).ok).toBe(true);
    expect(store.getSnapshot().derived.faces[0]!.clearAreaMm2).toBe(249001); expect(store.getSnapshot().derived.faces[0]!.smallSpaceWarning).toBe(true);
    const before = store.getSnapshot();
    const shrink = store.execute({ id: 'bad_shrink', baseGeneration: 1, type: 'MoveJunctions', moves: before.document.junctions.filter(j => j.x === 699).map(j => ({ junction: j.id, to: [200, j.y] })) });
    expect(shrink.ok).toBe(false); expect(store.getSnapshot()).toBe(before);
    expect(store.undo()).toBe(true); expect(store.getSnapshot().document.walls).toHaveLength(0); expect(store.redo()).toBe(true);
    expect(store.getSnapshot().derived.faces[0]!.clearAreaMm2).toBe(249001);
  });
  it('analytic random moves preserve total area; undo/redo exact with monotonically increasing generations', () => {
    fc.assert(fc.property(fc.integer({ min: -1000, max: 1000 }), delta => {
      const store = new ProjectStore(sampleDoc(), 'random_session'); expect(move(store, delta).ok).toBe(true);
      expect(store.getSnapshot().derived.faces.map(f => f.clearAreaMm2).sort((a, b) => b - a)).toEqual([20642175 + delta * 4770, 15872175 - delta * 4770].sort((a, b) => b - a));
      expect(store.getSnapshot().document.revision).toBe(1);
      if (delta !== 0) { const after = canonicalStringify(store.getSnapshot().document); expect(store.undo()).toBe(true); expect(store.redo()).toBe(true); expect(canonicalStringify(store.getSnapshot().document)).toBe(after); }
    }), { seed: 20261011, numRuns: 200 });
  });
});

describe('GEO-013/014/015 foundational opening integrity (Codex analytic tests; final Claude fixtures deferred)', () => {
  it('reverse host preserves exact world opening centre and undo restores all IDs/properties', () => {
    const doc = sampleDoc(), store = new ProjectStore(doc, 'opening_session'); const original = doc.openings.filter(o => o.wallId === 'w7');
    expect(store.execute({ id: 'reverse_wall', baseGeneration: 0, type: 'ReverseWall', wallId: 'w7' }).ok).toBe(true);
    for (const old of original) {
      const now = store.getSnapshot().document.openings.find(o => o.id === old.id)!; expect(now.offset).toBe(5000 - old.offset); expect(now.flipX).toBe(!old.flipX);
      // Original partition goes south from (4500,0); reversed goes north from (4500,5000).
      expect(5000 - now.offset).toBe(old.offset);
    }
    expect(store.undo()).toBe(true); expect(canonicalStringify(store.getSnapshot().document)).toBe(serializeProject(doc));
  });
  it('opening endpoint/overlap/height errors and implicit dependent deletion reject unchanged', () => {
    const store = new ProjectStore(sampleDoc(), 'opening_session'), original = store.getSnapshot(), opening = original.document.openings[0]!;
    const edit = (properties: object) => store.execute({ id: 'opening_edit', baseGeneration: 0, type: 'UpdateOpening', openingId: opening.id, properties } as Command);
    for (const properties of [{ offset: 1 }, { height: 6000 }, { offset: 0.4 }, { wallId: 'other' }]) { expect(edit(properties).ok).toBe(false); expect(store.getSnapshot()).toBe(original); }
    const overlapping = { ...opening, id: 'duplicate_opening' }; const { rev: _rev, ...input } = overlapping; void _rev;
    expect(store.execute({ id: 'duplicate_opening_command', baseGeneration: 0, type: 'AddOpening', opening: input }).ok).toBe(false);
    expect(store.execute({ id: 'delete_host', baseGeneration: 0, type: 'DeleteWall', wallId: opening.wallId, deleteDependents: false }).ok).toBe(false); expect(store.getSnapshot()).toBe(original);
  });
  it('split beside opening rehosts it; split through it rejects without losing data', () => {
    const base = blankDoc();
    const build = (offset: number) => {
      const store = new ProjectStore(base, 'split_session');
      expect(store.execute({ id: 'wall_command', baseGeneration: 0, type: 'AddWall', from: [0, 0], to: [6000, 0], thickness: 200, height: 3000 }).ok).toBe(true);
      const wallId = store.getSnapshot().document.walls[0]!.id;
      expect(store.execute({ id: 'door_command', baseGeneration: 1, type: 'AddOpening', opening: { id: 'door_one', wallId, kind: 'door', assetId: 'door_asset', offset, width: 900, height: 2100, sill: 0, flipX: false, flipY: false } }).ok).toBe(true); return store;
    };
    const good = build(1000); expect(good.execute({ id: 'split_beside', baseGeneration: 2, type: 'AddWall', from: [2000, 0], to: [2000, 3000], thickness: 200, height: 3000 }).ok).toBe(true);
    const host = good.getSnapshot().document.walls.find(w => w.id === good.getSnapshot().document.openings[0]!.wallId)!;
    expect(host.id).not.toBe('wall_1'); expect(good.getSnapshot().document.openings[0]!.offset).toBe(1000); expect(good.undo()).toBe(true);
    const bad = build(2000), snapshot = bad.getSnapshot(); expect(bad.execute({ id: 'split_through', baseGeneration: 2, type: 'AddWall', from: [2000, 0], to: [2000, 3000], thickness: 200, height: 3000 }).ok).toBe(false); expect(bad.getSnapshot()).toBe(snapshot);
  });
});
