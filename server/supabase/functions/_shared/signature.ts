import { base64UrlToBytes, bytesToHex, hexToBytes } from './http.ts';

/**
 * D86 fal webhook signature check (fal docs, fetched 2026-10-26). Every delivery carries X-Fal-Webhook-Request-Id,
 * -User-Id, -Timestamp (unix seconds) and -Signature (hex Ed25519). The signed message is
 * request_id + "\n" + user_id + "\n" + timestamp + "\n" + hex(sha256(raw body)), UTF-8. Public keys come from fal's
 * JWKS (each key's `x` is the base64url raw Ed25519 key). Deliveries older or newer than 5 minutes are refused.
 */
export const JWKS_URL = 'https://rest.fal.ai/.well-known/jwks.json';
export const MAX_SKEW_SECONDS = 300;
/** Keys are cached for at most 24 h (12 h here); a failed check may refetch them at most once every 5 minutes. */
export const JWKS_TTL_MS = 12 * 60 * 60 * 1000;
export const REFETCH_GAP_MS = 5 * 60 * 1000;

export interface JwksCache { keys: CryptoKey[] | null; fetchedAt: number; forcedAt: number }
export const newJwksCache = (): JwksCache => ({ keys: null, fetchedAt: 0, forcedAt: -Infinity });
export type Verdict = { ok: true; requestId: string } | { ok: false; reason: 'headers' | 'stale' | 'signature' | 'keys' };

/** Public keys from a JWKS document; entries that are not Ed25519 raw keys are skipped. */
export async function importJwks(document: unknown): Promise<CryptoKey[]> {
  const keys = document && typeof document === 'object' && Array.isArray((document as { keys?: unknown }).keys) ? (document as { keys: unknown[] }).keys : [];
  const out: CryptoKey[] = [];
  for (const key of keys) {
    const k = key as { kty?: unknown; crv?: unknown; x?: unknown };
    if (!k || typeof k.x !== 'string' || (k.kty !== undefined && k.kty !== 'OKP') || (k.crv !== undefined && k.crv !== 'Ed25519')) continue;
    const raw = base64UrlToBytes(k.x);
    if (!raw || raw.length !== 32) continue;
    try { out.push(await crypto.subtle.importKey('raw', raw as Uint8Array<ArrayBuffer>, { name: 'Ed25519' }, false, ['verify'])); } catch { /* not a usable key */ }
  }
  return out;
}

async function keysFor(cache: JwksCache, fetchJwks: () => Promise<unknown>, now: number, force: boolean): Promise<CryptoKey[]> {
  if (!force && cache.keys && now - cache.fetchedAt < JWKS_TTL_MS) return cache.keys;
  if (force) cache.forcedAt = now;
  try {
    const keys = await importJwks(await fetchJwks());
    if (keys.length) { cache.keys = keys; cache.fetchedAt = now; }
  } catch { /* keep any keys we had */ }
  return cache.keys ?? [];
}

export async function verifyFalWebhook(headers: Headers, body: Uint8Array, deps: { now: () => number; fetchJwks: () => Promise<unknown>; cache: JwksCache }): Promise<Verdict> {
  const requestId = headers.get('X-Fal-Webhook-Request-Id'), userId = headers.get('X-Fal-Webhook-User-Id');
  const timestamp = headers.get('X-Fal-Webhook-Timestamp'), signatureHex = headers.get('X-Fal-Webhook-Signature');
  if (!requestId || !userId || !timestamp || !signatureHex || !/^\d{1,12}$/.test(timestamp)) return { ok: false, reason: 'headers' };
  const signature = hexToBytes(signatureHex);
  if (!signature || signature.length !== 64) return { ok: false, reason: 'headers' };
  const now = deps.now();
  if (Math.abs(Math.floor(now / 1000) - Number(timestamp)) > MAX_SKEW_SECONDS) return { ok: false, reason: 'stale' };
  const digest = bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', body as Uint8Array<ArrayBuffer>)));
  const message = new TextEncoder().encode(`${requestId}\n${userId}\n${timestamp}\n${digest}`);
  const check = async (keys: CryptoKey[]) => {
    for (const key of keys) if (await crypto.subtle.verify({ name: 'Ed25519' }, key, signature as Uint8Array<ArrayBuffer>, message)) return true;
    return false;
  };
  let keys = await keysFor(deps.cache, deps.fetchJwks, now, false);
  if (await check(keys)) return { ok: true, requestId };
  // fal may have rotated its keys: refetch once, but never more often than every 5 minutes (bad requests cannot
  // make this function hammer fal's key endpoint).
  if (now - deps.cache.forcedAt >= REFETCH_GAP_MS) {
    keys = await keysFor(deps.cache, deps.fetchJwks, now, true);
    if (await check(keys)) return { ok: true, requestId };
  }
  return { ok: false, reason: keys.length ? 'signature' : 'keys' };
}
