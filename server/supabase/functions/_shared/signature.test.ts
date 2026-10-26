import { describe, expect, it, vi } from 'vitest';
import { bytesToHex } from './http.ts';
import { newJwksCache, verifyFalWebhook } from './signature.ts';

// D86 Claude-authored builder tests: a key pair generated here signs deliveries exactly as fal's docs describe
// (request_id \n user_id \n timestamp \n hex(sha256(body)), Ed25519, hex signature; JWKS `x` = base64url raw key).
const encoder = new TextEncoder();
async function keyPair() {
  const pair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const x = btoa(String.fromCharCode(...raw)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  return { pair, jwk: { kty: 'OKP', crv: 'Ed25519', x } };
}
async function signed(privateKey: CryptoKey, body: string, timestamp: number, requestId = 'req-1', userId = 'fal-user') {
  const digest = bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(body))));
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, privateKey, encoder.encode(`${requestId}\n${userId}\n${timestamp}\n${digest}`)));
  return new Headers({ 'X-Fal-Webhook-Request-Id': requestId, 'X-Fal-Webhook-User-Id': userId, 'X-Fal-Webhook-Timestamp': String(timestamp), 'X-Fal-Webhook-Signature': bytesToHex(signature) });
}
const NOW = 1_793_000_000_000, TS = NOW / 1000, BODY = '{"request_id":"req-1","status":"OK"}';

describe('fal webhook signature', () => {
  it('accepts a correctly signed delivery and caches the keys', async () => {
    const { pair, jwk } = await keyPair(), fetchJwks = vi.fn(async () => ({ keys: [jwk] })), cache = newJwksCache();
    const deps = { now: () => NOW, fetchJwks, cache };
    expect(await verifyFalWebhook(await signed(pair.privateKey, BODY, TS), encoder.encode(BODY), deps)).toEqual({ ok: true, requestId: 'req-1' });
    expect(await verifyFalWebhook(await signed(pair.privateKey, BODY, TS - 10), encoder.encode(BODY), deps)).toEqual({ ok: true, requestId: 'req-1' });
    expect(fetchJwks).toHaveBeenCalledTimes(1);
  });
  it('refuses a tampered body, a wrong key, and a changed request id', async () => {
    const { pair, jwk } = await keyPair(), other = await keyPair(), cache = newJwksCache();
    const deps = { now: () => NOW, fetchJwks: async () => ({ keys: [jwk] }), cache };
    const headers = await signed(pair.privateKey, BODY, TS);
    expect(await verifyFalWebhook(headers, encoder.encode(BODY.replace('OK', 'ERROR')), deps)).toEqual({ ok: false, reason: 'signature' });
    expect(await verifyFalWebhook(await signed(other.pair.privateKey, BODY, TS), encoder.encode(BODY), { ...deps, cache: newJwksCache() })).toEqual({ ok: false, reason: 'signature' });
    headers.set('X-Fal-Webhook-Request-Id', 'req-2');
    expect(await verifyFalWebhook(headers, encoder.encode(BODY), deps)).toEqual({ ok: false, reason: 'signature' });
  });
  it('refuses deliveries more than 5 minutes old or ahead, and missing or malformed headers', async () => {
    const { pair, jwk } = await keyPair(), deps = { now: () => NOW, fetchJwks: async () => ({ keys: [jwk] }), cache: newJwksCache() };
    expect(await verifyFalWebhook(await signed(pair.privateKey, BODY, TS - 301), encoder.encode(BODY), deps)).toEqual({ ok: false, reason: 'stale' });
    expect(await verifyFalWebhook(await signed(pair.privateKey, BODY, TS + 301), encoder.encode(BODY), deps)).toEqual({ ok: false, reason: 'stale' });
    expect(await verifyFalWebhook(await signed(pair.privateKey, BODY, TS - 300), encoder.encode(BODY), deps)).toEqual({ ok: true, requestId: 'req-1' });
    const headers = await signed(pair.privateKey, BODY, TS);
    headers.set('X-Fal-Webhook-Signature', 'zz');
    expect(await verifyFalWebhook(headers, encoder.encode(BODY), deps)).toEqual({ ok: false, reason: 'headers' });
    headers.delete('X-Fal-Webhook-Signature');
    expect(await verifyFalWebhook(headers, encoder.encode(BODY), deps)).toEqual({ ok: false, reason: 'headers' });
  });
  it('after a key rotation, a failed check refetches the keys once, but at most every 5 minutes', async () => {
    const old = await keyPair(), rotated = await keyPair(), cache = newJwksCache();
    let served = [old.jwk];
    const fetchJwks = vi.fn(async () => ({ keys: served })), at = { t: NOW };
    const deps = { now: () => at.t, fetchJwks, cache };
    expect((await verifyFalWebhook(await signed(old.pair.privateKey, BODY, at.t / 1000), encoder.encode(BODY), deps)).ok).toBe(true);
    served = [rotated.jwk];
    at.t += 60_000;
    expect((await verifyFalWebhook(await signed(rotated.pair.privateKey, BODY, at.t / 1000), encoder.encode(BODY), deps)).ok).toBe(true);
    expect(fetchJwks).toHaveBeenCalledTimes(2);
    // A burst of bad deliveries right after cannot force more fetches.
    at.t += 1000;
    const stranger = await keyPair();
    for (let i = 0; i < 3; i++) expect((await verifyFalWebhook(await signed(stranger.pair.privateKey, BODY, at.t / 1000), encoder.encode(BODY), deps)).ok).toBe(false);
    expect(fetchJwks).toHaveBeenCalledTimes(2);
  });
  it('keys expire after the cache time; a broken JWKS answer keeps the old keys', async () => {
    const { pair, jwk } = await keyPair(), cache = newJwksCache(), at = { t: NOW };
    let broken = false;
    const fetchJwks = vi.fn(async () => { if (broken) throw new Error('down'); return { keys: [{ kty: 'RSA', n: 'x' }, { kty: 'OKP', crv: 'Ed25519', x: 'short' }, jwk] }; });
    const deps = { now: () => at.t, fetchJwks, cache };
    expect((await verifyFalWebhook(await signed(pair.privateKey, BODY, at.t / 1000), encoder.encode(BODY), deps)).ok).toBe(true);
    expect(cache.keys).toHaveLength(1);
    at.t += 13 * 60 * 60 * 1000; broken = true;
    expect((await verifyFalWebhook(await signed(pair.privateKey, BODY, at.t / 1000), encoder.encode(BODY), deps)).ok).toBe(true);
    expect(fetchJwks).toHaveBeenCalledTimes(2);
  });
  it('with no keys at all every delivery is refused', async () => {
    const { pair } = await keyPair();
    expect(await verifyFalWebhook(await signed(pair.privateKey, BODY, TS), encoder.encode(BODY), { now: () => NOW, fetchJwks: async () => null, cache: newJwksCache() })).toEqual({ ok: false, reason: 'keys' });
  });
});
