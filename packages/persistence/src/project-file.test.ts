import { expect, it } from 'vitest';
import fc from 'fast-check';
import sample from '../../../docs/examples/sample-project.json';
import { canonicalStringify, MAX_DOCUMENT_BYTES, serializeProject } from '@gharplan/core-model';
import { parseProjectFile } from './index';
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
it('project backup roundtrip preserves exact canonical content and all IDs', () => {
  const input = JSON.stringify(sample), parsed = parseProjectFile(new TextEncoder().encode(input));
  expect(parsed.ok).toBe(true); if (!parsed.ok) throw new Error('Expected valid project.');
  expect(serializeProject(parsed.document)).toBe(canonicalStringify(sample));
  const output = parseProjectFile(new TextEncoder().encode(serializeProject(parsed.document))); expect(output).toEqual(parsed);
});
it('rejects empty/oversized/nonUTF8/invalid/newer/fractional files without altering bytes', () => {
  const cases = [new Uint8Array(), new Uint8Array(MAX_DOCUMENT_BYTES + 1), new Uint8Array([0xff]), encode({ ...sample, schemaVersion: 2 }), encode({ ...sample, junctions: sample.junctions.map((j, i) => i ? j : { ...j, x: 0.4 }) }), new TextEncoder().encode('not JSON')];
  for (const bytes of cases) { const before = bytes.slice(); expect(parseProjectFile(bytes).ok).toBe(false); expect(bytes.byteLength).toBe(before.byteLength); expect(bytes.every((value, index) => value === before[index])).toBe(true); }
  expect(parseProjectFile(encode({ ...sample, schemaVersion: 2 }))).toMatchObject({ ok: false, errors: [{ code: 'future-version' }] });
});
it('handles UTF8/BOM and seeded legal names without changing geometry', () => {
  fc.assert(fc.property(fc.string({ minLength: 1, maxLength: 40 }), name => {
    const input = { ...sample, name }, bytes = encode(input), parsed = parseProjectFile(bytes);
    expect(parsed.ok).toBe(true); if (parsed.ok) expect(serializeProject(parsed.document)).toBe(canonicalStringify(input));
  }), { seed: 41004, numRuns: 100 });
  const bytes = encode({ ...sample, name: 'मेरा घर' }), bom = new Uint8Array(bytes.length + 3); bom.set([0xef, 0xbb, 0xbf]); bom.set(bytes, 3);
  expect(parseProjectFile(bom)).toMatchObject({ ok: true, document: { name: 'मेरा घर' } });
});
it('accepts a valid file at exactly 10 MiB while preserving canonical content', () => {
  const content = JSON.stringify(sample), text = content + ' '.repeat(MAX_DOCUMENT_BYTES - new TextEncoder().encode(content).byteLength), bytes = new TextEncoder().encode(text);
  expect(bytes.byteLength).toBe(MAX_DOCUMENT_BYTES); const parsed = parseProjectFile(bytes); expect(parsed.ok).toBe(true);
  if (parsed.ok) expect(serializeProject(parsed.document)).toBe(canonicalStringify(sample));
});
