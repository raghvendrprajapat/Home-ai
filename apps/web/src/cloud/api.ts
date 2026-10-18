import { Capacitor } from '@capacitor/core';
import type { ProjectDoc } from '@gharplan/core-model';
import type { CloudConfig } from './config';

/** Answers of the D65 database functions, plus NETWORK (no answer: retry the same request) and UNEXPECTED. */
export type CloudCode = 'NOT_SIGNED_IN' | 'INVALID_REQUEST' | 'INVALID_DOCUMENT' | 'TOO_LARGE' | 'NOT_FOUND' | 'PROJECT_ID_TAKEN' | 'PROJECT_LIMIT'
  | 'PROJECT_TRASHED' | 'REVISION_CONFLICT' | 'IDEMPOTENCY_MISMATCH' | 'VERSION_NOT_FOUND' | 'SHARE_LIMIT' | 'CONFIRMATION_REQUIRED' | 'NETWORK' | 'UNEXPECTED';
export interface CloudFailure { ok: false; code: CloudCode; details?: Record<string, unknown> }
export type SaveReply = { ok: true; serverRevision: number; sha256: string; savedAt: string; replayed?: boolean } | CloudFailure;
export type LoadReply = { ok: true; serverRevision: number; name: string; document: unknown } | CloudFailure;
export interface SaveRequest { readonly projectId: string; readonly expectedServerRevision: number; readonly commandId: string; readonly document: ProjectDoc }
export interface CloudUser { id: string; email: string | null; name: string | null; lastSignInAt: string | null }
export interface CloudProjectSummary { id: string; name: string; serverRevision: number; updatedAt: string }
export interface CloudVersion { revision: number; createdAt: string }
export interface CloudShare { id: string; createdAt: string }
export interface CloudApi {
  user(): CloudUser | null;
  onUser(listener: (user: CloudUser | null) => void): () => void;
  signInWithGoogle(returnTo: string): Promise<CloudFailure | null>;
  signOut(): Promise<void>;
  save(request: SaveRequest): Promise<SaveReply>;
  load(projectId: string): Promise<LoadReply>;
  listProjects(includeTrashed?: boolean): Promise<{ ok: true; projects: CloudProjectSummary[] } | CloudFailure>;
  /** FR-032: the kept versions (newest 20), newest first. */
  listVersions(projectId: string): Promise<{ ok: true; versions: CloudVersion[] } | CloudFailure>;
  loadVersion(projectId: string, revision: number): Promise<{ ok: true; document: unknown } | CloudFailure>;
  /** FR-032: an old version becomes the new head (expected head + 1); the head never moves backwards. */
  restore(projectId: string, fromRevision: number, expectedServerRevision: number, commandId: string): Promise<SaveReply>;
  /** FR-033: a new view-only link. The raw token is returned once and never stored by the server. */
  createShare(projectId: string): Promise<{ ok: true; shareId: string; token: string } | CloudFailure>;
  listShares(projectId: string): Promise<{ ok: true; shares: CloudShare[] } | CloudFailure>;
  revokeShare(shareId: string): Promise<{ ok: true } | CloudFailure>;
  /** FR-033: anyone holding a live link (signed in or not) reads the current cloud head. */
  getShared(token: string): Promise<LoadReply>;
  /** FR-043: deletes the account and every cloud drawing, version and link at once (D65). */
  deleteAccount(): Promise<{ ok: true } | CloudFailure>;
}
/**
 * FR-031 Android (D71): Google refuses sign-in inside an app's web view, so the Android app opens it in the system
 * browser and Google/Supabase send the person back through this deep link (declared in AndroidManifest.xml).
 */
export const NATIVE_AUTH_REDIRECT = 'com.gharplan.app://auth-callback';
/** The PKCE code from our own deep link only; anything else (other links, errors) gives null. */
export function nativeAuthCode(url: string): string | null {
  if (!url.startsWith(`${NATIVE_AUTH_REDIRECT}?`) && !url.startsWith(`${NATIVE_AUTH_REDIRECT}/?`)) return null;
  try { const code = new URL(url).searchParams.get('code'); return code && /^[A-Za-z0-9._~-]{6,512}$/.test(code) ? code : null; } catch { return null; }
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
const userOf = (user: { id: string; email?: string | undefined; last_sign_in_at?: string | undefined; user_metadata?: Record<string, unknown> } | null | undefined): CloudUser | null =>
  user ? { id: user.id, email: user.email ?? null, lastSignInAt: user.last_sign_in_at ?? null, name: typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : typeof user.user_metadata?.name === 'string' ? user.user_metadata.name : null } : null;

/** Supabase-backed API. The library is imported only here, lazily, so the offline editor never loads it. */
export async function createSupabaseApi(config: CloudConfig): Promise<CloudApi> {
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(config.url, config.anonKey, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  let current: CloudUser | null = userOf((await client.auth.getSession()).data.session?.user);
  const listeners = new Set<(user: CloudUser | null) => void>();
  client.auth.onAuthStateChange((_event, session) => { current = userOf(session?.user); for (const listener of [...listeners]) listener(current); });
  if (Capacitor.isNativePlatform()) {
    // The deep link can arrive while the app runs, or start it after Android closed it during sign-in.
    const { App } = await import('@capacitor/app'), finish = async (url: string | undefined) => {
      const code = url ? nativeAuthCode(url) : null;
      if (!code) return;
      await client.auth.exchangeCodeForSession(code);
      try { const { Browser } = await import('@capacitor/browser'); await Browser.close(); } catch { /* the tab may already be gone */ }
    };
    await App.addListener('appUrlOpen', event => { void finish(event.url); });
    try { await finish((await App.getLaunchUrl())?.url); } catch { /* no launch link */ }
  }
  const rpc = async (name: string, args: Record<string, unknown>) => {
    try { const { data, error, status } = await client.rpc(name, args); return rpcAnswer({ data, error, status }); }
    catch { return { ok: false, code: 'NETWORK' } as CloudFailure; }
  };
  return {
    user: () => current,
    onUser(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    async signInWithGoogle(returnTo) {
      if (Capacitor.isNativePlatform()) {
        const { data, error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: NATIVE_AUTH_REDIRECT, skipBrowserRedirect: true } });
        if (error || !data.url) return { ok: false, code: 'NETWORK' };
        const { Browser } = await import('@capacitor/browser'); await Browser.open({ url: data.url }); return null;
      }
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
    async listVersions(projectId) {
      try {
        const { data, error, status } = await client.from('project_versions').select('revision,created_at').eq('project_id', projectId).order('revision', { ascending: false }).limit(20);
        if (error || !Array.isArray(data)) return { ok: false, code: status === 0 || status >= 500 ? 'NETWORK' : 'UNEXPECTED' };
        return { ok: true, versions: (data as Record<string, unknown>[]).map(row => ({ revision: Number(row.revision), createdAt: String(row.created_at) })) };
      } catch { return { ok: false, code: 'NETWORK' }; }
    },
    async loadVersion(projectId, revision) {
      try {
        const { data, error, status } = await client.from('project_versions').select('snapshot').eq('project_id', projectId).eq('revision', revision).limit(1);
        if (error || !Array.isArray(data)) return { ok: false, code: status === 0 || status >= 500 ? 'NETWORK' : 'UNEXPECTED' };
        const row = data[0] as Record<string, unknown> | undefined;
        return row ? { ok: true, document: row.snapshot } : { ok: false, code: 'VERSION_NOT_FOUND' };
      } catch { return { ok: false, code: 'NETWORK' }; }
    },
    async restore(projectId, fromRevision, expectedServerRevision, commandId) {
      const answer = await rpc('restore_version', { p_project_id: projectId, p_from_revision: fromRevision, p_expected_revision: expectedServerRevision, p_command_id: commandId });
      return answer.ok ? { ok: true, serverRevision: Number(answer.serverRevision), sha256: String(answer.sha256), savedAt: String(answer.savedAt), ...answer.replayed === true ? { replayed: true } : {} } : answer;
    },
    async createShare(projectId) {
      const answer = await rpc('create_share', { p_project_id: projectId });
      return answer.ok && typeof answer.token === 'string' && /^[0-9a-f]{64}$/.test(answer.token) ? { ok: true, shareId: String(answer.shareId), token: answer.token } : answer.ok ? { ok: false, code: 'UNEXPECTED' } : answer;
    },
    async listShares(projectId) {
      try {
        const { data, error, status } = await client.from('project_shares').select('id,created_at').eq('project_id', projectId).is('revoked_at', null).order('created_at', { ascending: false }).limit(10);
        if (error || !Array.isArray(data)) return { ok: false, code: status === 0 || status >= 500 ? 'NETWORK' : 'UNEXPECTED' };
        return { ok: true, shares: (data as Record<string, unknown>[]).map(row => ({ id: String(row.id), createdAt: String(row.created_at) })) };
      } catch { return { ok: false, code: 'NETWORK' }; }
    },
    async revokeShare(shareId) { const answer = await rpc('revoke_share', { p_share_id: shareId }); return answer.ok ? { ok: true } : answer; },
    async getShared(token) {
      const answer = await rpc('get_shared_project', { p_token: token });
      return answer.ok ? { ok: true, serverRevision: Number(answer.serverRevision), name: String(answer.name), document: answer.document } : answer;
    },
    async deleteAccount() { const answer = await rpc('delete_account', { p_confirm: 'DELETE' }); return answer.ok ? { ok: true } : answer; },
    async listProjects(includeTrashed = false) {
      try {
        const query = client.from('projects').select('id,name,current_revision,updated_at'), { data, error, status } = await (includeTrashed ? query : query.is('trashed_at', null)).order('updated_at', { ascending: false }).limit(200);
        if (error || !Array.isArray(data)) return { ok: false, code: status === 0 || status >= 500 ? 'NETWORK' : 'UNEXPECTED' };
        return { ok: true, projects: (data as Record<string, unknown>[]).map(row => ({ id: String(row.id), name: String(row.name), serverRevision: Number(row.current_revision), updatedAt: String(row.updated_at) })) };
      } catch { return { ok: false, code: 'NETWORK' }; }
    },
  };
}
