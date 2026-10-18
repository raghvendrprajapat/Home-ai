import type { ProjectDoc } from '@gharplan/core-model';
import type { CloudConfig } from './config';

/** Answers of the D65 database functions, plus NETWORK (no answer: retry the same request) and UNEXPECTED. */
export type CloudCode = 'NOT_SIGNED_IN' | 'INVALID_REQUEST' | 'INVALID_DOCUMENT' | 'TOO_LARGE' | 'NOT_FOUND' | 'PROJECT_ID_TAKEN' | 'PROJECT_LIMIT'
  | 'PROJECT_TRASHED' | 'REVISION_CONFLICT' | 'IDEMPOTENCY_MISMATCH' | 'VERSION_NOT_FOUND' | 'SHARE_LIMIT' | 'CONFIRMATION_REQUIRED' | 'NETWORK' | 'UNEXPECTED';
export interface CloudFailure { ok: false; code: CloudCode; details?: Record<string, unknown> }
export type SaveReply = { ok: true; serverRevision: number; sha256: string; savedAt: string; replayed?: boolean } | CloudFailure;
export type LoadReply = { ok: true; serverRevision: number; name: string; document: unknown } | CloudFailure;
export interface SaveRequest { readonly projectId: string; readonly expectedServerRevision: number; readonly commandId: string; readonly document: ProjectDoc }
export interface CloudUser { id: string; email: string | null; name: string | null }
export interface CloudProjectSummary { id: string; name: string; serverRevision: number; updatedAt: string }
export interface CloudApi {
  user(): CloudUser | null;
  onUser(listener: (user: CloudUser | null) => void): () => void;
  signInWithGoogle(returnTo: string): Promise<CloudFailure | null>;
  signOut(): Promise<void>;
  save(request: SaveRequest): Promise<SaveReply>;
  load(projectId: string): Promise<LoadReply>;
  listProjects(): Promise<{ ok: true; projects: CloudProjectSummary[] } | CloudFailure>;
}
const KNOWN = new Set<CloudCode>(['NOT_SIGNED_IN', 'INVALID_REQUEST', 'INVALID_DOCUMENT', 'TOO_LARGE', 'NOT_FOUND', 'PROJECT_ID_TAKEN', 'PROJECT_LIMIT', 'PROJECT_TRASHED', 'REVISION_CONFLICT', 'IDEMPOTENCY_MISMATCH', 'VERSION_NOT_FOUND', 'SHARE_LIMIT', 'CONFIRMATION_REQUIRED']);
type RpcResult = { data: unknown; error: { message?: string } | null; status: number };
/** Maps a PostgREST answer onto the function's own JSON; transport failures are NETWORK so the caller retries. */
export function rpcAnswer(result: RpcResult): Record<string, unknown> & ({ ok: true } | CloudFailure) {
  if (result.error || !result.data || typeof result.data !== 'object') return { ok: false, code: result.status === 0 || result.status >= 500 || result.status === 408 || result.status === 429 ? 'NETWORK' : 'UNEXPECTED' };
  const data = result.data as Record<string, unknown>;
  if (data.ok === true) return data as Record<string, unknown> & { ok: true };
  return { ok: false, code: KNOWN.has(data.code as CloudCode) ? data.code as CloudCode : 'UNEXPECTED', ...data.details && typeof data.details === 'object' ? { details: data.details as Record<string, unknown> } : {} };
}
const userOf = (user: { id: string; email?: string | undefined; user_metadata?: Record<string, unknown> } | null | undefined): CloudUser | null =>
  user ? { id: user.id, email: user.email ?? null, name: typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : typeof user.user_metadata?.name === 'string' ? user.user_metadata.name : null } : null;

/** Supabase-backed API. The library is imported only here, lazily, so the offline editor never loads it. */
export async function createSupabaseApi(config: CloudConfig): Promise<CloudApi> {
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(config.url, config.anonKey, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  let current: CloudUser | null = userOf((await client.auth.getSession()).data.session?.user);
  const listeners = new Set<(user: CloudUser | null) => void>();
  client.auth.onAuthStateChange((_event, session) => { current = userOf(session?.user); for (const listener of [...listeners]) listener(current); });
  const rpc = async (name: string, args: Record<string, unknown>) => {
    try { const { data, error, status } = await client.rpc(name, args); return rpcAnswer({ data, error, status }); }
    catch { return { ok: false, code: 'NETWORK' } as CloudFailure; }
  };
  return {
    user: () => current,
    onUser(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    async signInWithGoogle(returnTo) {
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: returnTo } });
      return error ? { ok: false, code: 'NETWORK' } : null;
    },
    async signOut() { await client.auth.signOut({ scope: 'local' }); },
    async save(request) {
      const answer = await rpc('save_snapshot', { p_project_id: request.projectId, p_expected_revision: request.expectedServerRevision, p_command_id: request.commandId, p_document: request.document });
      return answer.ok ? { ok: true, serverRevision: Number(answer.serverRevision), sha256: String(answer.sha256), savedAt: String(answer.savedAt), ...answer.replayed === true ? { replayed: true } : {} } : answer;
    },
    async load(projectId) {
      const answer = await rpc('load_project', { p_project_id: projectId });
      return answer.ok ? { ok: true, serverRevision: Number(answer.serverRevision), name: String(answer.name), document: answer.document } : answer;
    },
    async listProjects() {
      try {
        const { data, error, status } = await client.from('projects').select('id,name,current_revision,updated_at').is('trashed_at', null).order('updated_at', { ascending: false }).limit(100);
        if (error || !Array.isArray(data)) return { ok: false, code: status === 0 || status >= 500 ? 'NETWORK' : 'UNEXPECTED' };
        return { ok: true, projects: (data as Record<string, unknown>[]).map(row => ({ id: String(row.id), name: String(row.name), serverRevision: Number(row.current_revision), updatedAt: String(row.updated_at) })) };
      } catch { return { ok: false, code: 'NETWORK' }; }
    },
  };
}
