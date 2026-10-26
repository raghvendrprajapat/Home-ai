import { describe, expect, it } from 'vitest';
import { aiStatus, functionAnswer, rpcAnswer } from './api';
import { privacyAddress } from '../ui/PrivacyLink';

// D86 Claude-authored builder tests: how Edge Function and database answers become app codes, and where the
// privacy policy link points.
describe('Room photo AI answers', () => {
  it('Edge Function transport problems: 401 is signed out, 503 is unavailable, no answer or a server error is NETWORK', () => {
    expect(functionAnswer({ data: null, error: { name: 'FunctionsHttpError', context: { status: 401 } } })).toEqual({ ok: false, code: 'NOT_SIGNED_IN' });
    expect(functionAnswer({ data: null, error: { name: 'FunctionsHttpError', context: { status: 503 } } })).toEqual({ ok: false, code: 'AI_UNAVAILABLE' });
    expect(functionAnswer({ data: null, error: { name: 'FunctionsHttpError', context: { status: 502 } } })).toEqual({ ok: false, code: 'NETWORK' });
    expect(functionAnswer({ data: null, error: { name: 'FunctionsFetchError' } })).toEqual({ ok: false, code: 'NETWORK' });
    expect(functionAnswer({ data: null, error: { name: 'FunctionsHttpError', context: { status: 400 } } })).toEqual({ ok: false, code: 'UNEXPECTED' });
  });
  it('function and database answers keep the AI codes and their details; unknown codes become UNEXPECTED', () => {
    expect(functionAnswer({ data: { ok: true, jobId: 'j', status: 'running' }, error: null })).toEqual({ ok: true, jobId: 'j', status: 'running' });
    for (const code of ['AI_DISABLED', 'AI_PAUSED', 'NO_PREVIEWS_LEFT', 'SEGMENT_LIMIT', 'UPLOAD_MISSING', 'PROVIDER_FAILED', 'ALREADY_DONE', 'AI_UNAVAILABLE'])
      expect(functionAnswer({ data: { ok: false, code }, error: null })).toEqual({ ok: false, code });
    expect(rpcAnswer({ data: { ok: false, code: 'NO_PREVIEWS_LEFT', details: { limit: 3 } }, error: null, status: 200 })).toEqual({ ok: false, code: 'NO_PREVIEWS_LEFT', details: { limit: 3 } });
    expect(functionAnswer({ data: { ok: false, code: 'SOMETHING_NEW' }, error: null })).toEqual({ ok: false, code: 'UNEXPECTED' });
  });
  it('job states', () => {
    for (const s of ['reserved', 'submitting', 'running', 'succeeded', 'failed', 'refunded']) expect(aiStatus(s)).toBe(s);
    expect(aiStatus('done')).toBeNull(); expect(aiStatus(1)).toBeNull();
  });
});
describe('privacy policy address', () => {
  const here = { origin: 'https://gharplan.example.in', pathname: '/app/editor', baseUrl: '/' };
  it('the web app links its own copy next to the app', () => {
    expect(privacyAddress(false, {}, here)).toEqual({ href: 'https://gharplan.example.in/privacy.html', external: false });
    expect(privacyAddress(false, {}, { ...here, baseUrl: './' })).toEqual({ href: 'https://gharplan.example.in/app/privacy.html', external: false });
  });
  it('the Android app opens the hosted copy when VITE_PUBLIC_APP_URL is set, otherwise its bundled one', () => {
    const android = { origin: 'https://localhost', pathname: '/', baseUrl: '/' };
    expect(privacyAddress(true, { VITE_PUBLIC_APP_URL: 'https://gharplan.example.in/app' }, android)).toEqual({ href: 'https://gharplan.example.in/app/privacy.html', external: true });
    expect(privacyAddress(true, {}, android)).toEqual({ href: 'https://localhost/privacy.html', external: false });
  });
});
