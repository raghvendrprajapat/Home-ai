import { expect, it } from 'vitest';
import sample from '../../../../docs/examples/sample-project.json';
import { canonicalStringify, utf8Bytes } from '@gharplan/core-model';
import { sha256 } from '@gharplan/persistence';
import { exportNativeProject } from './native-export';
import type { NativeExportIo } from './native-export';
it('native export uses only private cache source and verifies exact destination receipt', async () => {
  const text = canonicalStringify(sample), files = new Map<string, string>(), calls: unknown[] = [];
  const io: NativeExportIo = { write: async (p, t) => { expect(p).toMatch(/^exports\/gharplan-[a-f0-9]{32}\.json$/); files.set(p, t); }, read: async p => files.get(p)!, remove: async p => { files.delete(p); }, save: async request => { calls.push(request); return { verified: true, bytes: utf8Bytes(text), sha256: await sha256(text) }; } };
  expect(await exportNativeProject(text, io)).toMatchObject({ verified: true, bytes: utf8Bytes(text) }); expect(calls).toHaveLength(1); expect(files.size).toBe(0);
  expect(JSON.stringify(calls)).not.toContain(sample.name); expect(text).toBe(canonicalStringify(sample));
});
it('cache corruption, provider cancellation and wrong receipts reject while originals stay untouched', async () => {
  const text = canonicalStringify(sample);
  for (const failure of ['cache', 'cancel', 'receipt'] as const) {
    let removed = 0, saves = 0;
    const io: NativeExportIo = { write: async () => {}, read: async () => failure === 'cache' ? 'broken' : text, remove: async () => { removed++; }, save: async () => { saves++; if (failure === 'cancel') throw Object.assign(new Error('Cancelled'), { code: 'EXPORT_CANCELLED' }); return { verified: true, bytes: utf8Bytes(text), sha256: '0'.repeat(64) }; } };
    await expect(exportNativeProject(text, io)).rejects.toThrow(); expect(removed).toBe(1); expect(saves).toBe(failure === 'cache' ? 0 : 1); expect(text).toBe(canonicalStringify(sample));
  }
});
it('cache write/read errors never invoke destination and cleanup failure cannot invalidate a verified file', async () => {
  const text = canonicalStringify(sample); let saves = 0;
  const base: NativeExportIo = { write: async () => {}, read: async () => text, remove: async () => {}, save: async () => { saves++; return { verified: true, bytes: utf8Bytes(text), sha256: await sha256(text) }; } };
  for (const action of ['write', 'read'] as const) await expect(exportNativeProject(text, { ...base, [action]: async () => { throw new Error('Injected cache I/O failure'); } })).rejects.toThrow('cache I/O');
  expect(saves).toBe(0); expect(await exportNativeProject(text, { ...base, remove: async () => { throw new Error('Cleanup unavailable'); } })).toMatchObject({ verified: true }); expect(saves).toBe(1);
});
it('a stalled transport cleanup cannot block destination acknowledgement', async () => {
  const text = canonicalStringify(sample), io: NativeExportIo = { write: async () => {}, read: async () => text, remove: () => new Promise(() => {}), save: async () => ({ verified: true, bytes: utf8Bytes(text), sha256: await sha256(text) }) };
  expect(await exportNativeProject(text, io)).toMatchObject({ verified: true });
});
