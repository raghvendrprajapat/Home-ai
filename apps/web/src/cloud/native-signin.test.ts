import { beforeEach, describe, expect, it, vi } from 'vitest';

// FR-031 Android (D71) sign-in through the system browser and the app's deep link. Claude-authored tests with the
// Capacitor plugins and the Supabase client replaced by recorders; no phone or real Google sign-in is involved.
const calls: string[] = [];
let native = true, launchUrl: string | undefined, urlListener: ((event: { url: string }) => void) | undefined;
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native } }));
vi.mock('@capacitor/app', () => ({ App: {
  addListener: (name: string, listener: (event: { url: string }) => void) => { calls.push(`listen:${name}`); urlListener = listener; return Promise.resolve({ remove: () => Promise.resolve() }); },
  getLaunchUrl: () => Promise.resolve(launchUrl ? { url: launchUrl } : undefined),
} }));
vi.mock('@capacitor/browser', () => ({ Browser: {
  open: (options: { url: string }) => { calls.push(`open:${options.url}`); return Promise.resolve(); },
  close: () => { calls.push('close'); return Promise.resolve(); },
} }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: {
  getSession: () => Promise.resolve({ data: { session: null } }),
  onAuthStateChange: () => undefined,
  signInWithOAuth: (credentials: { options: { redirectTo: string; skipBrowserRedirect?: boolean } }) => { calls.push(`oauth:${credentials.options.redirectTo}:${credentials.options.skipBrowserRedirect === true}`); return Promise.resolve({ data: { url: 'https://abcdefghij.supabase.co/auth/v1/authorize?provider=google' }, error: null }); },
  exchangeCodeForSession: (code: string) => { calls.push(`exchange:${code}`); return Promise.resolve({ error: null }); },
  signOut: () => Promise.resolve({ error: null }),
} }) }));

const { createSupabaseApi, NATIVE_AUTH_REDIRECT, nativeAuthCode } = await import('./api');
const { cloudWasUsed } = await import('./session');
const config = { url: 'https://abcdefghij.supabase.co', anonKey: 'sb_publishable_x' };
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
beforeEach(() => { calls.length = 0; native = true; launchUrl = undefined; urlListener = undefined; });

describe('FR-031 Android sign-in', () => {
  it('reads the code only from our own deep link', () => {
    expect(NATIVE_AUTH_REDIRECT).toBe('com.gharplan.app://auth-callback');
    expect(nativeAuthCode('com.gharplan.app://auth-callback?code=abc123-XYZ')).toBe('abc123-XYZ');
    expect(nativeAuthCode('com.gharplan.app://auth-callback/?code=abc123')).toBe('abc123');
    for (const url of ['com.gharplan.app://auth-callback?error=access_denied', 'com.evil.app://auth-callback?code=abc123', 'https://example.com/?code=abc123', 'com.gharplan.app://auth-callbackx?code=abc123', 'com.gharplan.app://auth-callback?code=a b'])
      expect(nativeAuthCode(url), url).toBeNull();
  });

  it('opens Google in the system browser with the deep link as the return address', async () => {
    const api = await createSupabaseApi(config);
    expect(await api.signInWithGoogle('https://ignored.example/')).toBeNull();
    expect(calls).toEqual(['listen:appUrlOpen', 'oauth:com.gharplan.app://auth-callback:true', 'open:https://abcdefghij.supabase.co/auth/v1/authorize?provider=google']);
  });

  it('a returning deep link exchanges its code and closes the browser tab; other links are ignored', async () => {
    await createSupabaseApi(config);
    urlListener!({ url: 'https://example.com/?code=nope12' }); await settle();
    expect(calls).toEqual(['listen:appUrlOpen']);
    urlListener!({ url: 'com.gharplan.app://auth-callback?code=good-code-1' }); await settle(); await settle();
    expect(calls).toEqual(['listen:appUrlOpen', 'exchange:good-code-1', 'close']);
  });

  it('finishes a sign-in whose deep link started the app after Android closed it', async () => {
    launchUrl = 'com.gharplan.app://auth-callback?code=cold-start-9';
    await createSupabaseApi(config);
    expect(calls).toEqual(['listen:appUrlOpen', 'exchange:cold-start-9', 'close']);
    // A pending sign-in (stored PKCE verifier) is enough to reconnect at start-up.
    expect(cloudWasUsed({ length: 1, key: () => 'sb-abcdefghij-auth-token-code-verifier' }, '')).toBe(true);
  });

  it('the web app keeps the normal redirect and never touches the native plugins', async () => {
    native = false;
    const api = await createSupabaseApi(config);
    await api.signInWithGoogle('https://app.example.in/');
    expect(calls).toEqual(['oauth:https://app.example.in/:false']);
  });
});
