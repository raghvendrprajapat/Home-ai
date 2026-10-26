/**
 * D86 Room photo AI: small HTTP helpers shared by the Edge Functions. Plain TypeScript with web-standard APIs only
 * (Request, Response, Headers, fetch, AbortController), so Vitest runs the same code that Supabase runs on Deno.
 */

/** The Capacitor Android app always calls from this origin; it is allowed in addition to ALLOWED_ORIGINS. */
export const CAPACITOR_ORIGIN = 'https://localhost';

/** ALLOWED_ORIGINS: comma-separated https origins of the web app (for example the Vercel address). */
export function allowedOrigins(raw: string | undefined): string[] {
  const list = new Set<string>([CAPACITOR_ORIGIN]);
  for (const part of (raw ?? '').split(',')) {
    const value = part.trim();
    if (!value) continue;
    try {
      const url = new URL(value);
      // Only bare https origins (no path, query or user); "*" and http are ignored on purpose.
      if (url.protocol === 'https:' && url.origin === value.replace(/\/$/, '') && !url.username && !url.password) list.add(url.origin);
    } catch { /* not an origin */ }
  }
  return [...list];
}

/** CORS headers for an allowed origin; none at all for any other origin (the browser then blocks the answer). */
export function corsHeaders(origin: string | null, allowed: readonly string[]): Record<string, string> {
  const base: Record<string, string> = { Vary: 'Origin' };
  if (!origin || !allowed.includes(origin)) return base;
  return { ...base, 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Max-Age': '600' };
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

/** The answer to a browser preflight, or null when the request is not one. */
export function preflight(request: Request, allowed: readonly string[]): Response | null {
  if (request.method !== 'OPTIONS') return null;
  const origin = request.headers.get('Origin'), headers = corsHeaders(origin, allowed);
  return new Response(null, { status: origin && allowed.includes(origin) ? 204 : 403, headers });
}

/** The bearer token of a request, or null. */
export function bearer(request: Request): string | null {
  const value = request.headers.get('Authorization') ?? '';
  const match = /^Bearer ([A-Za-z0-9._~+/=-]{10,4096})$/.exec(value);
  return match ? match[1]! : null;
}

/** Reads a JSON body of at most `limit` bytes; null for anything else. */
export async function readJson(request: Request, limit = 16 * 1024): Promise<unknown> {
  const length = Number(request.headers.get('Content-Length') ?? '0');
  if (length > limit) return null;
  try {
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.byteLength > limit) return null;
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch { return null; }
}

/** fetch with a time limit. Throws on network failure or timeout (the caller decides what that means for money). */
export async function fetchWithTimeout(fetcher: typeof fetch, url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), ms);
  try { return await fetcher(url, { ...init, signal: controller.signal, redirect: 'error' }); } finally { clearTimeout(timer); }
}

/** Reads at most `limit` bytes of a response body; null when it is larger. */
export async function readLimited(response: Response, limit: number): Promise<Uint8Array | null> {
  const declared = Number(response.headers.get('Content-Length') ?? '0');
  if (declared > limit) return null;
  const bytes = new Uint8Array(await response.arrayBuffer());
  return bytes.byteLength > limit || bytes.byteLength === 0 ? null : bytes;
}

/** Constant-time comparison of two strings (for the service key of the cleanup call). */
export function sameSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0 && x.length > 0;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}

export function base64UrlToBytes(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) return null;
  try {
    const text = atob(value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4));
    return Uint8Array.from(text, c => c.charCodeAt(0));
  } catch { return null; }
}

export function hexToBytes(value: string): Uint8Array | null {
  if (!/^(?:[0-9a-fA-F]{2})+$/.test(value)) return null;
  const out = new Uint8Array(value.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(value.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export const bytesToHex = (bytes: Uint8Array): string => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
