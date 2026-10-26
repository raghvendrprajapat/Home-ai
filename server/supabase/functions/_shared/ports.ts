import type { StoredFile } from './validate.ts';

/**
 * D86 What the Edge Function handlers need from the outside world. live.ts fills it from Supabase and Deno; the
 * Vitest tests fill it with fakes. Handlers never read environment variables or keys themselves, and never log keys,
 * tokens, signed URLs or request bodies.
 */
export interface RpcResult { data: unknown; error: { message?: string } | null }
export type Rpc = (name: string, args: Record<string, unknown>) => Promise<RpcResult>;
export interface ServiceStorage {
  /** Files directly inside a folder of the private bucket, or null when listing failed. */
  list(folder: string): Promise<StoredFile[] | null>;
  signedUrl(path: string, seconds: number): Promise<string | null>;
  upload(path: string, bytes: Uint8Array, contentType: string): Promise<boolean>;
  remove(paths: string[]): Promise<boolean>;
}
export interface Ports {
  readonly falKey: string;
  readonly supabaseUrl: string;
  readonly serviceKey: string;
  readonly origins: readonly string[];
  readonly mediaHosts: readonly string[];
  /** The signed-in user behind an access token, checked by Supabase Auth; null when the token is not valid. */
  userId(jwt: string): Promise<string | null>;
  /** Database functions called as that user (auth.uid() is the user). */
  asUser(jwt: string): Rpc;
  /** Database functions called with the service role. */
  service: Rpc;
  storage: ServiceStorage;
  fetch: typeof fetch;
  now(): number;
  /** Keeps work running after the answer was sent (EdgeRuntime.waitUntil on Supabase). */
  defer(work: Promise<unknown>): void;
  log(event: string, fields?: Record<string, string | number | boolean | null>): void;
}
export type Answer = Record<string, unknown> & ({ ok: true } | { ok: false; code: string });
/** The JSON object a database function returned, or UNEXPECTED. */
export function answer(result: RpcResult): Answer {
  const data = result.data;
  if (result.error || !data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, code: 'UNEXPECTED' };
  const value = data as Record<string, unknown>;
  return value.ok === true ? value as Answer : { ...value, ok: false, code: typeof value.code === 'string' ? value.code : 'UNEXPECTED' };
}
