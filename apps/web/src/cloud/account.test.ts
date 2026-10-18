import { describe, expect, it } from 'vitest';
import { exportCloudData, RECENT_SIGN_IN_MS, signedInRecently } from './AccountPanel';
import type { CloudApi } from './api';

// FR-043 (D70) account deletion guard and cloud export. Claude-authored tests.
describe('FR-043 recent sign-in before deletion', () => {
  const now = Date.parse('2026-10-18T12:00:00Z');
  it('allows deletion only within 10 minutes of signing in', () => {
    expect(RECENT_SIGN_IN_MS).toBe(600_000);
    expect(signedInRecently({ lastSignInAt: '2026-10-18T11:50:00Z' }, now)).toBe(true);
    expect(signedInRecently({ lastSignInAt: '2026-10-18T11:49:59Z' }, now)).toBe(false);
    expect(signedInRecently({ lastSignInAt: null }, now)).toBe(false);
    expect(signedInRecently({ lastSignInAt: 'not a date' }, now)).toBe(false);
    expect(signedInRecently({ lastSignInAt: '2026-10-18T13:00:00Z' }, now)).toBe(false); // far future clock: not trusted
  });
});

describe('FR-043 cloud export', () => {
  it('includes every listed drawing (trash too) and names the ones that could not be read', async () => {
    let askedTrash: boolean | undefined;
    const api = {
      listProjects: (includeTrashed?: boolean) => { askedTrash = includeTrashed; return Promise.resolve({ ok: true, projects: [{ id: 'a', name: 'A', serverRevision: 2, updatedAt: '' }, { id: 'b', name: 'B', serverRevision: 1, updatedAt: '' }] }); },
      load: (id: string) => Promise.resolve(id === 'a' ? { ok: true, serverRevision: 2, name: 'A', document: { id: 'a' } } : { ok: false, code: 'NETWORK' }),
    } as unknown as CloudApi;
    const result = await exportCloudData(api, { id: 'u', email: 'e@x', name: null, lastSignInAt: null }, () => 'T');
    expect(askedTrash).toBe(true);
    expect(result).toEqual({ format: 'gharplan-cloud-export', version: 1, exportedAt: 'T', account: { id: 'u', email: 'e@x' }, projects: [{ id: 'a', name: 'A', serverRevision: 2, document: { id: 'a' } }], missing: ['b'] });
  });
  it('gives nothing (and the panel says so) when the list itself cannot be read', async () => {
    const api = { listProjects: () => Promise.resolve({ ok: false, code: 'NETWORK' }) } as unknown as CloudApi;
    expect(await exportCloudData(api, { id: 'u', email: null, name: null, lastSignInAt: null })).toBeNull();
  });
});
