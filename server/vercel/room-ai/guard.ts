import { CODE_HEADER, allowedOrigins, corsHeaders, json, originAllowed, readBody, sameCode } from './http.js';

/**
 * D92 AI test mode: the checks every /api/room-ai call passes before any money can be spent, in this order:
 * CORS preflight → POST only → allowed origin (403) → server configured (503) → too many wrong codes on this
 * instance (429) → access code (401) → per-instance rate limit (429) → body size (413).
 * The secrets come only from Vercel Environment Variables (process.env on the server); they are never logged.
 */
export interface RoomAiEnv {
  readonly OPENAI_API_KEY?: string | undefined;
  readonly FAL_KEY?: string | undefined;
  readonly AI_ACCESS_CODE?: string | undefined;
  readonly ALLOWED_ORIGINS?: string | undefined;
}
/** Only codes, statuses and timings are ever logged: never images, keys, prompts or the access code. */
export type Log = (event: string, data: Readonly<Record<string, string | number | boolean>>) => void;
export interface Deps {
  readonly env: () => RoomAiEnv;
  readonly fetch: typeof fetch;
  readonly now: () => number;
  readonly log: Log;
  readonly limits: Limits;
}
/** An access code shorter than this counts as "not set up", so a typo like "1" never opens paid AI. */
export const MIN_CODE_LENGTH = 8;

/** A sliding window counter. */
export class Window {
  readonly limit: number;
  readonly ms: number;
  #hits: number[] = [];
  constructor(limit: number, ms: number) { this.limit = limit; this.ms = ms; }
  /** Whether one more event fits; when it does, it is counted. */
  take(now: number): boolean {
    this.#hits = this.#hits.filter(t => now - t < this.ms);
    if (this.#hits.length >= this.limit) return false;
    this.#hits.push(now);
    return true;
  }
  full(now: number): boolean { this.#hits = this.#hits.filter(t => now - t < this.ms); return this.#hits.length >= this.limit; }
}
/**
 * Per-instance, in-memory limits. NOT reliable: Vercel may run many instances and restarts them at any time, so
 * these only slow down a burst from one tester or a code-guessing loop. The real spend control in test mode is the
 * secret access code plus the budget limits the owner sets in the OpenAI and fal dashboards (where available).
 */
export interface Limits { readonly edit: Window; readonly segment: Window; readonly wrongCode: Window }
export const newLimits = (): Limits => ({ edit: new Window(6, 60_000), segment: new Window(30, 60_000), wrongCode: new Window(10, 10 * 60_000) });

export type Need = 'openai' | 'fal';
export interface Passed { readonly bytes: Uint8Array; readonly reply: (body: unknown, status?: number) => Response; readonly key: string }

export async function gate(request: Request, deps: Deps, need: Need, bodyLimit: number): Promise<Passed | Response> {
  const env = deps.env(), origin = request.headers.get('Origin'), ok = originAllowed(origin, allowedOrigins(env.ALLOWED_ORIGINS), request.url);
  const cors = corsHeaders(origin, ok), reply = (body: unknown, status = 200) => json(body, status, cors);
  if (request.method === 'OPTIONS') return new Response(null, { status: ok ? 204 : 403, headers: cors });
  if (request.method !== 'POST') return reply({ ok: false, code: 'INVALID_REQUEST' }, 405);
  if (!ok) return reply({ ok: false, code: 'ORIGIN' }, 403);
  const key = (need === 'openai' ? env.OPENAI_API_KEY : env.FAL_KEY)?.trim() ?? '', code = env.AI_ACCESS_CODE?.trim() ?? '';
  if (!key || code.length < MIN_CODE_LENGTH) return reply({ ok: false, code: 'NOT_SET_UP' }, 503);
  const now = deps.now();
  if (deps.limits.wrongCode.full(now)) return reply({ ok: false, code: 'BUSY' }, 429);
  const given = request.headers.get(CODE_HEADER) ?? '';
  if (given.length > 200 || !(await sameCode(given, code))) { deps.limits.wrongCode.take(now); return reply({ ok: false, code: 'WRONG_CODE' }, 401); }
  if (!(need === 'openai' ? deps.limits.edit : deps.limits.segment).take(now)) return reply({ ok: false, code: 'BUSY' }, 429);
  const bytes = await readBody(request, bodyLimit);
  if (!bytes) return reply({ ok: false, code: 'TOO_BIG' }, 413);
  return { bytes, reply, key };
}

/** A File entry of a form, or null. */
export async function fileBytes(form: FormData, name: string): Promise<Uint8Array | null> {
  const value = form.get(name);
  return value instanceof Blob ? new Uint8Array(await value.arrayBuffer()) : null;
}
/** A short text field, or null. */
export function textField(form: FormData, name: string, max = 200): string | null {
  const value = form.get(name);
  return typeof value === 'string' && value.length <= max ? value : null;
}
/** Process environment of the deployed function (Vercel applies changed variables only after a redeploy). */
export function processEnv(): RoomAiEnv {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
  return { OPENAI_API_KEY: env.OPENAI_API_KEY, FAL_KEY: env.FAL_KEY, AI_ACCESS_CODE: env.AI_ACCESS_CODE, ALLOWED_ORIGINS: env.ALLOWED_ORIGINS };
}
export const consoleLog: Log = (event, data) => { console.log(JSON.stringify({ event, ...data })); };
