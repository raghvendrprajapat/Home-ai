import { describe, expect, it } from 'vitest';
import { rpcAnswer } from './api';
import { cloudConfig, E2E_CLOUD_URL, secretCloudKey } from './config';
import { CloudSession, cloudWasUsed } from './session';
import type { CloudApi } from './api';

// FR-031 (D67) cloud configuration, answer mapping and lazy connection. Claude-authored tests.
const jwt = (payload: object) => `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify(payload)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')}.signature`;
describe('FR-031 cloud configuration', () => {
  it('accepts only a supabase.co project URL (or the test stand-in) with a public key', () => {
    expect(cloudConfig({})).toBeNull();
    expect(cloudConfig({ VITE_SUPABASE_URL: 'https://abcdefghij.supabase.co', VITE_SUPABASE_ANON_KEY: 'sb_publishable_x' })).toEqual({ url: 'https://abcdefghij.supabase.co', anonKey: 'sb_publishable_x' });
    expect(cloudConfig({ VITE_SUPABASE_URL: E2E_CLOUD_URL, VITE_SUPABASE_ANON_KEY: 'k' })).not.toBeNull();
    for (const url of ['http://abcdefghij.supabase.co', 'https://evil.example.com', 'https://abc.supabase.co.evil.com', 'https://abcdefghij.supabase.co/'])
      expect(cloudConfig({ VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: 'k' }), url).toBeNull();
  });
  it('refuses secret and service-role keys so they can never ship in the app', () => {
    expect(secretCloudKey('sb_secret_abc')).toBe(true);
    expect(secretCloudKey(jwt({ role: 'service_role' }))).toBe(true);
    expect(secretCloudKey(jwt({ role: 'anon' }))).toBe(false);
    expect(secretCloudKey('sb_publishable_abc')).toBe(false);
    expect(cloudConfig({ VITE_SUPABASE_URL: 'https://abcdefghij.supabase.co', VITE_SUPABASE_ANON_KEY: jwt({ role: 'service_role' }) })).toBeNull();
  });
});

describe('FR-031 database answers', () => {
  it('passes the function JSON through and maps transport failures to NETWORK (retry) or UNEXPECTED', () => {
    expect(rpcAnswer({ data: { ok: true, serverRevision: 2 }, error: null, status: 200 })).toEqual({ ok: true, serverRevision: 2 });
    expect(rpcAnswer({ data: { ok: false, code: 'REVISION_CONFLICT', details: { currentServerRevision: 4 } }, error: null, status: 200 })).toEqual({ ok: false, code: 'REVISION_CONFLICT', details: { currentServerRevision: 4 } });
    expect(rpcAnswer({ data: { ok: false, code: 'SOMETHING_NEW' }, error: null, status: 200 })).toEqual({ ok: false, code: 'UNEXPECTED' });
    for (const status of [0, 408, 429, 500, 503]) expect(rpcAnswer({ data: null, error: { message: 'x' }, status }).code, String(status)).toBe('NETWORK');
    for (const status of [400, 401, 403, 404]) expect(rpcAnswer({ data: null, error: { message: 'x' }, status }).code, String(status)).toBe('UNEXPECTED');
  });
});

describe('FR-031 lazy cloud connection', () => {
  it('reconnects on its own only after an earlier sign-in or a return from Google', () => {
    const storage = (keys: string[]) => ({ length: keys.length, key: (i: number) => keys[i] ?? null });
    expect(cloudWasUsed(storage([]), '')).toBe(false);
    expect(cloudWasUsed(storage(['gharplan.ui', 'sb-abcdefghij-auth-token']), '')).toBe(true);
    expect(cloudWasUsed(storage([]), '?code=abc')).toBe(true);
    expect(cloudWasUsed(null, '?x=1')).toBe(false);
  });
  it('loads the library once, reports the signed-in person, and can retry after a failed load', async () => {
    let calls = 0, fail = true, notify: ((user: { id: string; email: null; name: string; lastSignInAt: null } | null) => void) | undefined;
    const api = { user: () => null, onUser: (listener: typeof notify) => { notify = listener; return () => undefined; }, onSignInFailed: () => () => undefined } as unknown as CloudApi;
    const session = new CloudSession({ url: E2E_CLOUD_URL, anonKey: 'k' }, () => { calls++; if (fail) return Promise.reject(new Error('offline')); return Promise.resolve(api); });
    expect(await session.ensure()).toBeNull(); expect(session.getSnapshot().status).toBe('failed');
    fail = false;
    expect(await session.ensure()).toBe(api); expect(await session.ensure()).toBe(api); expect(calls).toBe(2);
    expect(session.getSnapshot().status).toBe('signed-out');
    notify!({ id: 'u1', email: null, name: 'R', lastSignInAt: null });
    expect(session.getSnapshot()).toEqual({ status: 'signed-in', user: { id: 'u1', email: null, name: 'R', lastSignInAt: null } });
  });
});
