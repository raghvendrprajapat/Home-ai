import { freeze } from 'immer';
import { canonicalStringify, MAX_DOCUMENT_BYTES } from './serialization';
import type { ValidationIssue } from './types';

export const CURRENT_SCHEMA_VERSION = 1;
export interface MigrationStep {
  from: number; to: number;
  validateInput(value: unknown): readonly ValidationIssue[];
  transform(value: unknown): unknown;
  validateOutput(value: unknown): readonly ValidationIssue[];
}
export type MigrationResult = { ok: true; value: unknown; fromVersion: number; toVersion: number; applied: number[]; canonical: string } |
  { ok: false; errors: ValidationIssue[] };
const failure = (code: string, message: string): MigrationResult => ({ ok: false, errors: [{ code, message, entityIds: [] }] });
function version(value: unknown): number | null {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.hasOwn(value, 'schemaVersion')) return null;
  const n = (value as Record<string, unknown>).schemaVersion;
  return typeof n === 'number' && Number.isSafeInteger(n) && n >= 1 ? n : null;
}
function assertPlainJson(source: unknown): void {
  const seen = new Set<object>(); let nodes = 0;
  const visit = (value: unknown, depth: number): void => {
    if (++nodes > MAX_DOCUMENT_BYTES || depth > 64) throw new Error('JSON work/depth limit.');
    if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) return;
    if (typeof value !== 'object' || seen.has(value)) throw new Error('Only acyclic plain JSON values are admitted.');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) throw new Error('Non-JSON object prototype.');
    const keys = Reflect.ownKeys(value);
    if (array && keys.length !== value.length + 1) throw new Error('Sparse or decorated arrays are not plain JSON.');
    seen.add(value);
    for (const key of keys) {
      if (array && key === 'length') continue;
      if (typeof key !== 'string') throw new Error('Symbol keys are not JSON.');
      if (array && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length)) throw new Error('Invalid JSON array index.');
      const property = Object.getOwnPropertyDescriptor(value, key)!;
      if (!property.enumerable || !('value' in property)) throw new Error('Hidden/accessor properties are not plain JSON.');
      visit(property.value, depth + 1);
    }
    seen.delete(value);
  };
  visit(source, 0);
}
/** Only explicitly reviewed adjacent migrations are supported. No historical
 * product format is invented by this framework. Inputs are copied/frozen before
 * trusted callbacks; returned JSON/schema/versions validate at every step.
 */
export class MigrationRegistry {
  #steps: ReadonlyMap<number, Readonly<MigrationStep>>;
  constructor(readonly latest: number, readonly validateLatest: (value: unknown) => readonly ValidationIssue[], steps: readonly MigrationStep[]) {
    if (!Number.isSafeInteger(latest) || latest < 1 || typeof validateLatest !== 'function' || steps.length > 64) throw new Error('Invalid migration registry version, validator or size.');
    const map = new Map<number, Readonly<MigrationStep>>();
    for (const step of steps) {
      if (!Number.isSafeInteger(step.from) || step.from < 1 || step.to !== step.from + 1 || step.to > latest || map.has(step.from) ||
          typeof step.validateInput !== 'function' || typeof step.transform !== 'function' || typeof step.validateOutput !== 'function')
        throw new Error('Migrations must be unique adjacent validated steps within the supported version.');
      map.set(step.from, Object.freeze({ from: step.from, to: step.to, validateInput: step.validateInput,
        transform: step.transform, validateOutput: step.validateOutput }));
    }
    this.#steps = map;
    Object.freeze(this);
  }
  run(source: unknown): MigrationResult {
    try {
      // Strict admission rejects values the existing serializer could flatten
      // (Date, sparse arrays, hidden/accessor properties) before any data loss.
      // Serialization then bounds bytes. Copying avoids
      // freezing or mutating any caller-owned source object on success/failure.
      assertPlainJson(source);
      let value: unknown = JSON.parse(canonicalStringify(source));
      const fromVersion = version(value);
      if (fromVersion === null) return failure('schema-version', 'A supported positive integer schemaVersion is required. The original file is unchanged.');
      if (fromVersion > this.latest) return failure('future-version', 'Update the app to open this newer project. The original file is unchanged.');
      const applied: number[] = []; let current = fromVersion;
      while (current < this.latest) {
        if (applied.length >= 64) return failure('migration-limit', 'Migration chain exceeds its supported limit. The original file is unchanged.');
        const step = this.#steps.get(current);
        if (!step) return failure('unsupported-version', 'This older project version has no supported migration. The original file is unchanged.');
        const input = freeze(value, true), before = step.validateInput(input);
        if (before.length) return { ok: false, errors: [...before] };
        const transformed = step.transform(input); assertPlainJson(transformed);
        const next: unknown = JSON.parse(canonicalStringify(transformed));
        if (version(next) !== step.to) return failure('migration-version', 'Migration returned the wrong version. The original file is unchanged.');
        const after = step.validateOutput(freeze(next, true));
        if (after.length) return { ok: false, errors: [...after] };
        value = next; current = step.to; applied.push(current);
      }
      const errors = this.validateLatest(freeze(value, true));
      if (errors.length) return { ok: false, errors: [...errors] };
      const canonical = canonicalStringify(value);
      return { ok: true, value: JSON.parse(canonical), fromVersion, toVersion: current, applied, canonical };
    } catch { return failure('migration-failed', 'Project validation or migration failed. The original file is unchanged.'); }
  }
}
