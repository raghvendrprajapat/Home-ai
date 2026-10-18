import { describe, expect, it } from 'vitest';
import { shareBase, sharedToken, shareLink } from './share-link';

// FR-033 (D69) link format. Claude-authored tests.
const token = 'ab'.repeat(32);
describe('FR-033 view-only link', () => {
  it('puts the token after # so servers and referrers never see it, and reads it back exactly', () => {
    const link = shareLink('https://app.example.in', '/', token);
    expect(link).toBe(`https://app.example.in/#/share/${token}`);
    expect(sharedToken(new URL(link).hash)).toBe(token);
  });
  it('ignores anything that is not exactly a 64-character lowercase hex token', () => {
    for (const hash of ['', '#', '#/share/', `#/share/${token}x`, `#/share/${token.toUpperCase()}`, `#/share/${token.slice(1)}`, `#/shares/${token}`, `#/share/${token}/edit`]) expect(sharedToken(hash), hash).toBeNull();
  });
});

describe('FR-033 link address on web and Android', () => {
  const web = { origin: 'https://app.example.in', pathname: '/plan/' }, android = { origin: 'https://localhost', pathname: '/' };
  it('the web app uses its own address unless a public address is set', () => {
    expect(shareBase(false, {}, web)).toEqual({ origin: 'https://app.example.in', pathname: '/plan/' });
    expect(shareBase(false, { VITE_PUBLIC_APP_URL: 'https://gharplan.example.in/app/' }, web)).toEqual({ origin: 'https://gharplan.example.in', pathname: '/app/' });
  });
  it('the Android app never links to its internal localhost address', () => {
    expect(shareBase(true, {}, android)).toBeNull();
    expect(shareBase(true, { VITE_PUBLIC_APP_URL: '' }, android)).toBeNull();
    const base = shareBase(true, { VITE_PUBLIC_APP_URL: 'https://gharplan.example.in' }, android);
    expect(base).toEqual({ origin: 'https://gharplan.example.in', pathname: '/' });
    expect(shareLink(base!.origin, base!.pathname, token)).toBe(`https://gharplan.example.in/#/share/${token}`);
  });
  it('an unsafe or malformed public address is ignored', () => {
    for (const bad of ['http://gharplan.example.in/', 'https://localhost/', 'https://gharplan.example.in/?x=1', 'https://gharplan.example.in/#/share', 'https://user:pw@gharplan.example.in/', 'gharplan.example.in', 'not a url']) {
      expect(shareBase(true, { VITE_PUBLIC_APP_URL: bad }, android), bad).toBeNull();
      expect(shareBase(false, { VITE_PUBLIC_APP_URL: bad }, web), bad).toEqual(web);
    }
  });
});
