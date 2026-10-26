import { allowedOrigins, fetchWithTimeout } from './http.ts';
import { mediaHosts } from './fal.ts';
import type { Ports, Rpc } from './ports.ts';
import { JWKS_URL } from './signature.ts';
import { BUCKET } from './validate.ts';
import type { StoredFile } from './validate.ts';

/**
 * D86 The real Ports: Supabase (supabase-js, passed in by each function's index.ts) and environment variables set as
 * Supabase secrets. FAL_KEY and ALLOWED_ORIGINS are set by the owner; SUPABASE_URL, SUPABASE_ANON_KEY and
 * SUPABASE_SERVICE_ROLE_KEY are provided by Supabase itself. Nothing here is ever logged.
 */
interface Bucket {
  list(path: string, options?: { limit?: number }): Promise<{ data: { name: string; id: string | null; metadata: Record<string, unknown> | null }[] | null; error: unknown }>;
  createSignedUrl(path: string, expiresIn: number): Promise<{ data: { signedUrl: string } | null; error: unknown }>;
  upload(path: string, body: Uint8Array, options?: { contentType?: string; upsert?: boolean }): Promise<{ error: unknown }>;
  remove(paths: string[]): Promise<{ error: unknown }>;
}
export interface SupabaseLike {
  auth: { getUser(jwt: string): Promise<{ data: { user: { id: string } | null }; error: unknown }> };
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message?: string } | null }>;
  storage: { from(bucket: string): Bucket };
}
export type CreateClient = (url: string, key: string, options?: Record<string, unknown>) => SupabaseLike;
const serverOnly = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

export function livePorts(createClient: CreateClient, env: (name: string) => string | undefined): Ports {
  const supabaseUrl = env('SUPABASE_URL') ?? '', serviceKey = env('SUPABASE_SERVICE_ROLE_KEY') ?? '', anonKey = env('SUPABASE_ANON_KEY') ?? '';
  const admin = createClient(supabaseUrl, serviceKey, serverOnly), bucket = admin.storage.from(BUCKET);
  const call = (client: SupabaseLike): Rpc => async (name, args) => {
    try { const { data, error } = await client.rpc(name, args); return { data, error }; } catch { return { data: null, error: { message: 'network' } }; }
  };
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (work: Promise<unknown>) => void } }).EdgeRuntime;
  return {
    falKey: env('FAL_KEY') ?? '', supabaseUrl, serviceKey,
    origins: allowedOrigins(env('ALLOWED_ORIGINS')), mediaHosts: mediaHosts(env('FAL_MEDIA_HOSTS')),
    async userId(jwt) { try { const { data, error } = await admin.auth.getUser(jwt); return error ? null : data.user?.id ?? null; } catch { return null; } },
    asUser: jwt => call(createClient(supabaseUrl, anonKey, { ...serverOnly, global: { headers: { Authorization: `Bearer ${jwt}` } } })),
    service: call(admin),
    storage: {
      async list(folder) {
        try {
          const { data, error } = await bucket.list(folder, { limit: 100 });
          if (error || !data) return null;
          return data.filter(entry => entry.id !== null).map((entry): StoredFile => ({ name: entry.name, size: Number(entry.metadata?.size ?? 0), mimetype: String(entry.metadata?.mimetype ?? '') }));
        } catch { return null; }
      },
      async signedUrl(path, seconds) { try { const { data, error } = await bucket.createSignedUrl(path, seconds); return error ? null : data?.signedUrl ?? null; } catch { return null; } },
      async upload(path, bytes, contentType) { try { return !(await bucket.upload(path, bytes, { contentType, upsert: true })).error; } catch { return false; } },
      async remove(paths) { try { return !(await bucket.remove(paths)).error; } catch { return false; } },
    },
    fetch: (input, init) => fetch(input, init),
    now: () => Date.now(),
    defer: work => { if (runtime?.waitUntil) runtime.waitUntil(work); else void work; },
    log: (event, fields) => console.log(JSON.stringify({ event, ...fields })),
  };
}

/** fal's public webhook keys (no secret involved). */
export async function fetchFalJwks(): Promise<unknown> {
  const response = await fetchWithTimeout(fetch, JWKS_URL, { method: 'GET' }, 5000);
  return response.ok ? await response.json() : null;
}
