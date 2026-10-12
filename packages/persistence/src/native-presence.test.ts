import { expect, it } from 'vitest';
import { NativeMirror } from './native-mirror';
import type { MirrorIo } from './native-mirror';
it('empty/damaged native directories are collisions without reading or removing their originals', async () => {
  const io: MirrorIo = { list: async path => { expect(path).toBe('gharplan-mirrors'); return ['empty_project', 'damaged_project']; }, read: async () => { throw new Error('Must not read'); }, write: async () => { throw new Error('Must not write'); }, rename: async () => { throw new Error('Must not rename'); }, remove: async () => { throw new Error('Must not delete'); } };
  const mirror = new NativeMirror(io); expect(await mirror.hasProjectDirectory('empty_project')).toBe(true); expect(await mirror.hasProjectDirectory('damaged_project')).toBe(true); expect(await mirror.hasProjectDirectory('new_project')).toBe(false);
  await expect(mirror.hasProjectDirectory('../bad')).rejects.toThrow();
});
it('unknown or oversized native identity scans fail rather than admitting an existing identity', async () => {
  const base: MirrorIo = { list: async () => { throw new Error('I/O unavailable'); }, read: async () => '', write: async () => {}, rename: async () => {}, remove: async () => {} };
  await expect(new NativeMirror(base).hasProjectDirectory('new_project')).rejects.toThrow('I/O unavailable');
  await expect(new NativeMirror({ ...base, list: async () => Array.from({ length: 1001 }, (_, i) => `project_${i}`) }).hasProjectDirectory('new_project')).rejects.toMatchObject({ kind: 'size' });
});
