/**
 * D92 AI test mode: HTTP helpers for the Vercel Functions in /api/room-ai. Web-standard APIs only (Request, Response,
 * fetch, FormData, Web Crypto), no dependencies, and only erasable TypeScript, so the same code runs in Vitest, in the
 * local Node harness and on Vercel's Node.js runtime.
 */

/** The Capacitor Android app always calls from this origin; it is allowed in addition to ALLOWED_ORIGINS. */
export const CAPACITOR_ORIGIN = 'https://localhost';
/** Header that carries the tester's access code. Never logged, never echoed. */
export const CODE_HEADER = 'X-Room-AI-Code';

/** ALLOWED_ORIGINS: comma-separated bare https origins of the web app (for example https://gharplan.vercel.app). */
export function allowedOrigins(raw: string | undefined): string[] {
  const list = new Set<string>([CAPACITOR_ORIGIN]);
  for (const part of (raw ?? '').split(',')) {
    const value = part.trim().replace(/\/$/, '');
    if (!value) continue;
    try {
      const url = new URL(value);
      // Only bare https origins (no path, query or user); "*" and http are ignored on purpose.
      if (url.protocol === 'https:' && url.origin === value && !url.username && !url.password) list.add(url.origin);
    } catch { /* not an origin */ }
  }
  return [...list];
}

/**
 * Whether a browser origin may call. Besides the list, the deployment's own address is accepted (a same-origin call
 * from the web app, including Vercel preview addresses) — but only an https origin whose host is the host this
 * request was sent to (the request URL's host or the Host header; a browser cannot set either for another site).
 */
export function originAllowed(origin: string | null, allowed: readonly string[], requestUrl: string, hostHeader: string | null = null): boolean {
  if (!origin) return false;
  if (allowed.includes(origin)) return true;
  try {
    const from = new URL(origin);
    if (from.protocol !== 'https:' || from.origin !== origin) return false;
    const hosts = [new URL(requestUrl).host, hostHeader?.trim().toLowerCase() ?? ''].filter(Boolean);
    return hosts.includes(from.host);
  } catch { return false; }
}

/** CORS headers for an allowed origin; none at all for any other origin (the browser then blocks the answer). */
export function corsHeaders(origin: string | null, ok: boolean): Record<string, string> {
  const base: Record<string, string> = { Vary: 'Origin' };
  if (!origin || !ok) return base;
  return { ...base, 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': `content-type, ${CODE_HEADER.toLowerCase()}`, 'Access-Control-Max-Age': '600' };
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

/**
 * Timing-safe comparison of the given access code with the configured one: both are hashed with SHA-256 first, so
 * the comparison always runs over 32 bytes whatever their lengths, and every byte is compared (no early exit).
 */
export async function sameCode(given: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([crypto.subtle.digest('SHA-256', encoder.encode(given)), crypto.subtle.digest('SHA-256', encoder.encode(expected))]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < 32; i++) diff |= x[i]! ^ y[i]!;
  return diff === 0 && given.length > 0 && expected.length > 0;
}

/** Reads a request body of at most `limit` bytes; null when it is larger (checked while reading, not just by header). */
export async function readBody(request: Request, limit: number): Promise<Uint8Array | null> {
  const declared = Number(request.headers.get('Content-Length') ?? '0');
  if (Number.isFinite(declared) && declared > limit) return null;
  if (!request.body) return new Uint8Array(0);
  const reader = request.body.getReader(), parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    // Stop reading at once; the rest is never buffered. (Not cancel(): undici's FormData bodies then throw unhandled.)
    if (size > limit) { reader.releaseLock(); return null; }
    parts.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const part of parts) { out.set(part, at); at += part.byteLength; }
  return out;
}

/** A multipart body (already read and size-checked) as FormData; null when it is not valid multipart. */
export async function parseForm(bytes: Uint8Array, contentType: string | null): Promise<FormData | null> {
  if (!contentType || !/^multipart\/form-data;\s*boundary=/i.test(contentType)) return null;
  try { return await new Response(bytes as Uint8Array<ArrayBuffer>, { headers: { 'Content-Type': contentType } }).formData(); } catch { return null; }
}

/** fetch with a time limit; never follows redirects. Throws on network failure, timeout or a caller abort. */
export async function fetchWithTimeout(fetcher: typeof fetch, url: string, init: RequestInit, ms: number, outer?: AbortSignal): Promise<Response> {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(new DOMException('timeout', 'TimeoutError')), ms);
  const stop = () => controller.abort(outer?.reason);
  if (outer) { if (outer.aborted) stop(); else outer.addEventListener('abort', stop, { once: true }); }
  try { return await fetcher(url, { ...init, signal: controller.signal, redirect: 'error' }); }
  finally { clearTimeout(timer); outer?.removeEventListener('abort', stop); }
}
/** True when an error came from fetchWithTimeout's own time limit. */
export const isTimeout = (error: unknown): boolean => error instanceof DOMException && error.name === 'TimeoutError'
  || error instanceof Error && error.name === 'TimeoutError'
  || !!(error && typeof error === 'object' && 'cause' in error && (error as { cause?: unknown }).cause instanceof DOMException && ((error as { cause: DOMException }).cause.name === 'TimeoutError'));

/** Reads at most `limit` bytes of a response body; null when it is larger or empty. */
export async function readLimited(response: Response, limit: number): Promise<Uint8Array | null> {
  const declared = Number(response.headers.get('Content-Length') ?? '0');
  if (declared > limit) return null;
  const bytes = new Uint8Array(await response.arrayBuffer());
  return bytes.byteLength > limit || bytes.byteLength === 0 ? null : bytes;
}

/** A JSON response body of at most `limit` bytes; null when larger, empty or not JSON. */
export async function readJson(response: Response, limit: number): Promise<unknown> {
  try { const raw = await readLimited(response, limit); return raw ? JSON.parse(new TextDecoder().decode(raw)) as unknown : null; } catch { return null; }
}

export function bytesToBase64(bytes: Uint8Array): string {
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}
export function base64ToBytes(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 !== 0) return null;
  try { return Uint8Array.from(atob(value), c => c.charCodeAt(0)); } catch { return null; }
}
