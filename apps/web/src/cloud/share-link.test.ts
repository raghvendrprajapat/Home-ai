import { describe, expect, it } from 'vitest';
import { sharedToken, shareLink } from './share-link';

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
