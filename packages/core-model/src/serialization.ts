import type { ProjectDoc } from './types';
import type { Immutable } from 'immer';
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export function utf8Bytes(value: string): number {
  let bytes = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x80) bytes++; else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && value.charCodeAt(i + 1) >= 0xdc00 && value.charCodeAt(i + 1) <= 0xdfff) { bytes += 4; i++; }
    else bytes += 3;
  }
  return bytes;
}
export function canonicalStringify(value: unknown): string {
  const seen = new Set<object>();
  const visit = (input: unknown, depth: number): string => {
    if (depth > 64) throw new Error('Document nesting exceeds the supported depth.');
    if (input === null || typeof input === 'string' || typeof input === 'boolean') return JSON.stringify(input);
    if (typeof input === 'number') { if (!Number.isFinite(input)) throw new Error('Non-finite number.'); return JSON.stringify(input); }
    if (typeof input !== 'object') throw new Error('Only JSON values can be serialized.');
    if (seen.has(input)) throw new Error('Cyclic document.'); seen.add(input);
    let result: string;
    if (Array.isArray(input)) result = `[${input.map(v => visit(v, depth + 1)).join(',')}]`;
    else {
      const object = input as Record<string, unknown>;
      result = `{${Object.keys(object).sort().map(k => `${JSON.stringify(k)}:${visit(object[k], depth + 1)}`).join(',')}}`;
    }
    seen.delete(input); return result;
  };
  const result = visit(value, 0);
  if (utf8Bytes(result) > MAX_DOCUMENT_BYTES) throw new Error('Project exceeds the 10 MiB document limit.');
  return result;
}
export function serializeProject(document: Immutable<ProjectDoc>): string { return canonicalStringify(document); }
/** Cache tag only, never used for cryptographic security or authoritative server receipts. */
export function dependencyHash(value: unknown): string {
  const text = canonicalStringify(value); let a = 0x811c9dc5, b = 0x9e3779b9;
  for (let i = 0; i < text.length; i++) { a = Math.imul(a ^ text.charCodeAt(i), 0x01000193); b = Math.imul(b ^ text.charCodeAt(i), 0x85ebca6b); }
  return `${(a >>> 0).toString(16).padStart(8, '0')}${(b >>> 0).toString(16).padStart(8, '0')}`;
}
