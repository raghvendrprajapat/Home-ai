import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import sample from '../../../docs/examples/sample-project.json';
import schema from '../../../docs/examples/project.schema.json';
import { canonicalStringify, CURRENT_SCHEMA_VERSION, MAX_DOCUMENT_BYTES, MigrationRegistry, parseProject, ProjectStore, serializeProject } from './index';
import type { MigrationStep, ProjectDoc, ValidationIssue } from './index';

// Synthetic framework-only schemas. These are not historical GharPlan formats
// and are never registered in parseProject or saved as production documents.
interface Synthetic { schemaVersion: number; name: string; count?: number; title?: string }
const error = (message: string): ValidationIssue[] => [{ code: 'synthetic-shape', message, entityIds: [] }];
const validate = (n: number) => (value: unknown): ValidationIssue[] => {
  const v = value as Synthetic;
  if (!v || v.schemaVersion !== n || typeof v.name !== 'string' || Object.keys(v).some(k => !['schemaVersion', 'name', ...(n >= 2 ? ['count'] : []), ...(n >= 3 ? ['title'] : [])].includes(k)) ||
      n >= 2 && v.count !== 7 || n >= 3 && v.title !== v.name) return error('Synthetic version shape mismatch.');
  return [];
};
const steps = (): MigrationStep[] => [
  { from: 1, to: 2, validateInput: validate(1), transform: v => ({ ...(v as Synthetic), schemaVersion: 2, count: 7 }), validateOutput: validate(2) },
  { from: 2, to: 3, validateInput: validate(2), transform: v => ({ ...(v as Synthetic), schemaVersion: 3, title: (v as Synthetic).name }), validateOutput: validate(3) },
];
describe('REL-001/REL-005 production version admission', () => {
  it('supported version equals the source schema and current canonical roundtrip preserves exact areas and IDs', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(schema.properties.schemaVersion.const);
    const text = canonicalStringify(sample), parsed = parseProject(text); expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error('Current sample must load.');
    expect(serializeProject(parsed.document)).toBe(text);
    const store = new ProjectStore(parsed.document, 'migrated_current');
    expect(store.getSnapshot().derived.faces.map(f => f.clearAreaMm2)).toEqual([20642175, 15872175]);
    const changed = store.execute({ id: 'moved_current', baseGeneration: 0, type: 'MoveWall', wallId: 'w7', dx: 100, dy: 0 });
    expect(changed.ok).toBe(true); expect(store.getSnapshot().derived.faces.map(f => f.clearAreaMm2)).toEqual([21119175, 15395175]);
    expect(store.undo()).toBe(true); expect(serializeProject(store.getSnapshot().document)).toBe(text);
  });
  it('future/missing/fractional/zero versions reject with actionable errors and preserve source/live drawing', () => {
    const original = canonicalStringify(sample), store = new ProjectStore(structuredClone(sample) as ProjectDoc, 'untouched_current');
    for (const n of [2, Number.MAX_SAFE_INTEGER, 0, -1, 1.2, '1', null, undefined]) {
      const value = { ...sample, schemaVersion: n }, text = JSON.stringify(value), result = parseProject(text);
      expect(result.ok).toBe(false); if (!result.ok && typeof n === 'number' && n > 1 && Number.isSafeInteger(n)) {
        expect(result.errors[0]!.code).toBe('future-version'); expect(result.errors[0]!.message).toContain('Update the app');
      }
      expect(JSON.stringify(value)).toBe(text); expect(serializeProject(store.getSnapshot().document)).toBe(original);
    }
  });
  it('unknown properties and fractional geometry are never silently dropped or rounded', () => {
    const unknown = JSON.stringify({ ...sample, futureField: true }); expect(parseProject(unknown).ok).toBe(false);
    const fraction = structuredClone(sample); fraction.junctions[0]!.x = 0.4;
    expect(parseProject(JSON.stringify(fraction)).ok).toBe(false);
    expect(parseProject('{broken').ok).toBe(false); expect(parseProject(' '.repeat(MAX_DOCUMENT_BYTES + 1)).ok).toBe(false);
  });
});
describe('REL-005 synthetic migration framework, not a historical compatibility claim', () => {
  it('accepted prototype-method descriptors retain all callbacks', () => {
    class Step implements MigrationStep {
      from = 1; to = 2;
      validateInput = validate(1);
      transform(value: unknown): unknown { return { ...(value as Synthetic), schemaVersion: 2, count: 7 }; }
      validateOutput(value: unknown): ValidationIssue[] { return validate(2)(value); }
    }
    const descriptor = new Step(), registry = new MigrationRegistry(2, validate(2), [descriptor]);
    expect(registry.run({ schemaVersion: 1, name: 'prototype' })).toMatchObject({ ok: true, value: { schemaVersion: 2, name: 'prototype', count: 7 }, applied: [2] });
  });
  it('adjacent chain validates every boundary, deterministic output and owned-copy identity', () => {
    const source = { schemaVersion: 1, name: 'घर' }, before = JSON.stringify(source), registry = new MigrationRegistry(3, validate(3), steps());
    const result = registry.run(source); expect(result).toEqual({ ok: true, value: { schemaVersion: 3, name: 'घर', count: 7, title: 'घर' }, fromVersion: 1, toVersion: 3, applied: [2, 3], canonical: '{"count":7,"name":"घर","schemaVersion":3,"title":"घर"}' });
    expect(registry.run(source)).toEqual(result); expect(JSON.stringify(source)).toBe(before); expect(Object.isFrozen(source)).toBe(false);
    expect(registry.run({ schemaVersion: 2, name: 'घर', count: 7 })).toMatchObject({ ok: true, applied: [3] });
  });
  it('seeded names keep exact analytic expected fields through every valid chain', () => {
    const registry = new MigrationRegistry(3, validate(3), steps());
    fc.assert(fc.property(fc.string({ maxLength: 60 }), name => {
      const source = { schemaVersion: 1, name }, result = registry.run(source);
      expect(result.ok).toBe(true); if (result.ok) expect(result.value).toEqual({ schemaVersion: 3, name, count: 7, title: name });
      expect(source).toEqual({ schemaVersion: 1, name });
    }), { seed: 20261012, numRuns: 100 });
  });
  it('rejects registry gaps, duplicates, skipped/backward/fractional versions and out-of-range targets', () => {
    const [first] = steps(); expect(() => new MigrationRegistry(3, validate(3), [first!, first!])).toThrow();
    for (const override of [{ from: 0 }, { from: 1.2 }, { to: 1 }, { to: 3 }, { to: 4 }]) expect(() => new MigrationRegistry(3, validate(3), [{ ...first!, ...override }])).toThrow();
    expect(new MigrationRegistry(3, validate(3), [first!]).run({ schemaVersion: 1, name: 'kept' })).toMatchObject({ ok: false, errors: [{ code: 'unsupported-version' }] });
    expect(() => new MigrationRegistry(0, validate(3), [])).toThrow(); expect(() => new MigrationRegistry(3, validate(3), Array.from({ length: 65 }, () => first!))).toThrow();
    expect(() => new MigrationRegistry(1, null as unknown as ReturnType<typeof validate>, [])).toThrow();
  });
  it('failed validators, throwing/mutating transforms and wrong/non-JSON outputs preserve original', () => {
    const source = { schemaVersion: 1, name: 'kept' }, before = canonicalStringify(source), first = steps()[0]!;
    const faulty: MigrationStep[] = [
      { ...first, validateInput: () => error('Input rejected.') }, { ...first, validateOutput: () => error('Output rejected.') },
      { ...first, transform: () => { throw new Error('Injected transform failure.'); } },
      { ...first, transform: v => { (v as Synthetic).name = 'mutated'; return { ...(v as Synthetic), schemaVersion: 2, count: 7 }; } },
      { ...first, transform: v => ({ ...(v as Synthetic), schemaVersion: 3, count: 7 }) },
      { ...first, transform: v => ({ ...(v as Synthetic), schemaVersion: 2, count: NaN }) },
      { ...first, transform: () => undefined },
    ];
    for (const step of faulty) { expect(new MigrationRegistry(2, validate(2), [step]).run(source).ok).toBe(false); expect(canonicalStringify(source)).toBe(before); expect(Object.isFrozen(source)).toBe(false); }
  });
  it('bounds oversized/deep/cyclic values, rejecting without partial success', () => {
    const registry = new MigrationRegistry(3, validate(3), steps());
    expect(registry.run({ schemaVersion: 1, name: 'x'.repeat(MAX_DOCUMENT_BYTES) }).ok).toBe(false);
    let deep: unknown = 0; for (let i = 0; i < 66; i++) deep = { child: deep };
    expect(registry.run({ schemaVersion: 1, name: 'kept', deep }).ok).toBe(false);
    const cycle: Record<string, unknown> = { schemaVersion: 1, name: 'kept' }; cycle.self = cycle; expect(registry.run(cycle).ok).toBe(false); expect(cycle.self).toBe(cycle);
  });
  it('rejects lossy non-JSON transforms even when schema callbacks are permissive', () => {
    const first = steps()[0]!, source = { schemaVersion: 1, name: 'kept' }, before = canonicalStringify(source);
    const hidden = Object.defineProperty({}, 'hidden', { value: 7, enumerable: false });
    let accessorReads = 0;
    const accessor = Object.defineProperty({}, 'accessor', { get: () => { accessorReads++; return 7; }, enumerable: true });
    const symbol = { [Symbol('not-json')]: 7 };
    const decorated: number[] & { extra?: number } = [1]; decorated.extra = 7;
    class ArraySubclass extends Array<number> {}
    for (const payload of [new Date(0), new Array(1), new ArraySubclass(1, 2), new Map(), new Uint8Array([1]), hidden, accessor, symbol, decorated, 7n]) {
      const registry = new MigrationRegistry(2, () => [], [{ ...first, transform: v => ({ ...(v as Synthetic), schemaVersion: 2, payload }), validateOutput: () => [] }]);
      expect(registry.run(source).ok).toBe(false); expect(canonicalStringify(source)).toBe(before);
    }
    expect(accessorReads).toBe(0);
  });
});
