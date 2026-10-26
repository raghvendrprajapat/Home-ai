import { Capacitor } from '@capacitor/core';
import type { ProjectDoc } from '@gharplan/core-model';
import type { CloudConfig } from './config';

/** Answers of the D65 database functions, plus NETWORK (no answer: retry the same request) and UNEXPECTED. */
export type CloudCode = 'NOT_SIGNED_IN' | 'INVALID_REQUEST' | 'INVALID_DOCUMENT' | 'TOO_LARGE' | 'NOT_FOUND' | 'PROJECT_ID_TAKEN' | 'PROJECT_LIMIT'
  | 'PROJECT_TRASHED' | 'REVISION_CONFLICT' | 'IDEMPOTENCY_MISMATCH' | 'VERSION_NOT_FOUND' | 'SHARE_LIMIT' | 'CONFIRMATION_REQUIRED' | 'REAUTH_REQUIRED' | 'NETWORK' | 'UNEXPECTED'
  | RoomAiCode;
/** D86 Room photo AI answers (database functions and Edge Functions). */
export type RoomAiCode = 'AI_DISABLED' | 'AI_PAUSED' | 'NO_PREVIEWS_LEFT' | 'SEGMENT_LIMIT' | 'UPLOAD_MISSING' | 'PROVIDER_FAILED' | 'ALREADY_DONE' | 'AI_UNAVAILABLE';
export interface CloudFailure { ok: false; code: CloudCode; details?: Record<string, unknown> }
export type SaveReply = { ok: true; serverRevision: number; sha256: string; savedAt: string; replayed?: boolean } | CloudFailure;
export type LoadReply = { ok: true; serverRevision: number; name: string; document: unknown } | CloudFailure;
export interface SaveRequest { readonly projectId: string; readonly expectedServerRevision: number; readonly commandId: string; readonly document: ProjectDoc }
export interface CloudUser { id: string; email: string | null; name: string | null; lastSignInAt: string | null }
export interface CloudProjectSummary { id: string; name: string; serverRevision: number; updatedAt: string }
export interface CloudVersion { revision: number; createdAt: string }
export interface CloudShare { id: string; createdAt: string }
/** D86 Room photo AI: what the signed-in person may still do (never any money amounts). */
export interface AiQuota { enabled: boolean; paused: boolean; segmentPaused: boolean; previewsPerMonth: number; previewsLeft: number; segmentsLeft: number }
export type AiJobStatus = 'reserved' | 'submitting' | 'running' | 'succeeded' | 'failed' | 'refunded';
export interface AiSubmitBody { clientJobId: string; surface: 'wall' | 'floor' | 'other'; material: { kind: 'paint' | 'pattern' | 'picture'; label: string; colour: string | null }; files: { photo: string; mask: string; references: string[] } }
/**
 * D86 Room photo AI calls. Uploads go to the private bucket with the person's own session (storage policies allow only
 * their own folder); the AI provider is reached only through the app's Edge Functions, which hold the key.
 */
export interface RoomAiApi {
  quota(): Promise<({ ok: true } & AiQuota) | CloudFailure>;
  reserve(clientJobId: string, kind: 'edit' | 'segment', folder?: string): Promise<{ ok: true; jobId: string; status: AiJobStatus } | CloudFailure>;
  upload(path: string, file: Blob): Promise<{ ok: true } | CloudFailure>;
  submit(body: AiSubmitBody): Promise<{ ok: true; jobId: string; status: AiJobStatus } | CloudFailure>;
  segment(body: { clientJobId: string; photo: string; x: number; y: number }): Promise<{ ok: true; mask: Blob } | CloudFailure>;
  job(jobId: string): Promise<{ ok: true; status: AiJobStatus; outputPath: string | null } | CloudFailure>;
  /** A private file of the person's own, as a Blob (same-origin object data, so canvases are never tainted). */
  download(path: string): Promise<Blob | null>;
  remove(paths: string[]): Promise<void>;
}
export const ROOM_AI_BUCKET = 'room-photos';
const AI_STATUS = new Set<AiJobStatus>(['reserved', 'submitting', 'running', 'succeeded', 'failed', 'refunded']);
export const aiStatus = (value: unknown): AiJobStatus | null => typeof value === 'string' && AI_STATUS.has(value as AiJobStatus) ? value as AiJobStatus : null;
export interface CloudApi {
  user(): CloudUser | null;
  onUser(listener: (user: CloudUser | null) => void): () => void;
  /** Android: a sign-in that came back through the deep link but failed (refused, or the code was not accepted). */
  onSignInFailed(listener: () => void): () => void;
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
  /** D86 Room photo AI previews and tap-to-select. */
  readonly roomAi: RoomAiApi;
}
/**
 * FR-031 Android (D71): Google refuses sign-in inside an app's web view, so the Android app opens it in the system
 * browser and Google/Supabase send the person back through this deep link (declared in AndroidManifest.xml).
 */
export const NATIVE_AUTH_REDIRECT = 'com.gharplan.app://auth-callback';
/** Our own sign-in deep link (with a code or an error), as opposed to any other link that opens the app. */
export const isNativeAuthReturn = (url: string): boolean => url.startsWith(`${NATIVE_AUTH_REDIRECT}?`) || url.startsWith(`${NATIVE_AUTH_REDIRECT}/?`) || url.startsWith(`${NATIVE_AUTH_REDIRECT}#`);
/** The PKCE code from our own deep link only; anything else (other links, errors) gives null. */
export function nativeAuthCode(url: string): string | null {
  if (!isNativeAuthReturn(url) || url.startsWith(`${NATIVE_AUTH_REDIRECT}#`)) return null;
  try { const code = new URL(url).searchParams.get('code'); return code && /^[A-Za-z0-9._~-]{6,512}$/.test(code) ? code : null; } catch { return null; }
}
const KNOWN = new Set<CloudCode>(['NOT_SIGNED_IN', 'INVALID_REQUEST', 'INVALID_DOCUMENT', 'TOO_LARGE', 'NOT_FOUND', 'PROJECT_ID_TAKEN', 'PROJECT_LIMIT', 'PROJECT_TRASHED', 'REVISION_CONFLICT', 'IDEMPOTENCY_MISMATCH', 'VERSION_NOT_FOUND', 'SHARE_LIMIT', 'CONFIRMATION_REQUIRED', 'REAUTH_REQUIRED',
  'AI_DISABLED', 'AI_PAUSED', 'NO_PREVIEWS_LEFT', 'SEGMENT_LIMIT', 'UPLOAD_MISSING', 'PROVIDER_FAILED', 'ALREADY_DONE', 'AI_UNAVAILABLE']);
type FunctionResult = { data: unknown; error: { name?: string; context?: { status?: number } } | null };
/** Maps an Edge Function answer like rpcAnswer: no answer or a server error is NETWORK, 401 is NOT_SIGNED_IN. */
export function functionAnswer(result: FunctionResult): Record<string, unknown> & ({ ok: true } | CloudFailure) {
  if (result.error) {
    const status = result.error.context?.status ?? 0;
    return { ok: false, code: status === 401 ? 'NOT_SIGNED_IN' : status === 503 ? 'AI_UNAVAILABLE' : status === 0 || status >= 500 || status === 408 || status === 429 || result.error.name === 'FunctionsFetchError' || result.error.name === 'FunctionsRelayError' ? 'NETWORK' : 'UNEXPECTED' };
  }
  return rpcAnswer({ data: result.data, error: null, status: 200 });
}
type RpcResult = { data: unknown; error: { message?: string } | null; status: number };
/** Maps a PostgREST answer onto the function's own JSON; transport failures are NETWORK so the caller retries. */
export function rpcAnswer(result: RpcResult): Record<string, unknown> & ({ ok: true } | CloudFailure) {
  if (result.error || !result.data || typeof result.data !== 'object') return { ok: false, code: result.status === 0 || result.status >= 500 || result.status === 408 || result.status === 429 ? 'NETWORK' : 'UNEXPECTED' };
  const data = result.data as Record<string, unknown>;
  if (data.ok === true) return data as Record<string, unknown> & { ok: true };
  return { ok: false, code: KNOWN.has(data.code as CloudCode) ? data.code as CloudCode : 'UNEXPECTED', ...data.details && typeof data.details === 'object' ? { details: data.details as Record<string, unknown> } : {} };
}
/** D86 Room photo AI over the same Supabase client (the person's own session). */
type Answer = (Record<string, unknown> & { ok: true }) | CloudFailure;
function roomAiApi(client: import('@supabase/supabase-js').SupabaseClient, rpc: (name: string, args: Record<string, unknown>) => Promise<Answer>): RoomAiApi {
  const bucket = () => client.storage.from(ROOM_AI_BUCKET);
  const invoke = async (name: string, body: unknown) => {
    try { const { data, error } = await client.functions.invoke(name, { body }); return functionAnswer({ data, error }) as Answer; }
    catch { return { ok: false, code: 'NETWORK' } as CloudFailure; }
  };
  return {
    async quota() {
      const a = await rpc('ai_quota', {});
      return a.ok ? { ok: true, enabled: a.enabled === true, paused: a.paused === true, segmentPaused: a.segmentPaused === true, previewsPerMonth: Number(a.previewsPerMonth) || 0, previewsLeft: Number(a.previewsLeft) || 0, segmentsLeft: Number(a.segmentsLeft) || 0 } : a;
    },
    async reserve(clientJobId, kind, folder) {
      const a = await rpc('reserve_ai_job', { p_client_job_id: clientJobId, p_kind: kind, ...folder ? { p_folder: folder } : {} });
      if (!a.ok) return a;
      const status = aiStatus(a.status);
      return status && typeof a.jobId === 'string' ? { ok: true, jobId: a.jobId, status } : { ok: false, code: 'UNEXPECTED' };
    },
    async upload(path, file) {
      try { const { error } = await bucket().upload(path, file, { contentType: file.type, upsert: true }); return error ? { ok: false, code: 'NETWORK' } : { ok: true }; }
      catch { return { ok: false, code: 'NETWORK' }; }
    },
    async submit(body) {
      const a = await invoke('room-ai-submit', body);
      if (!a.ok) return a;
      const status = aiStatus(a.status);
      return status && typeof a.jobId === 'string' ? { ok: true, jobId: a.jobId, status } : { ok: false, code: 'UNEXPECTED' };
    },
    async segment(body) {
      const a = await invoke('room-ai-segment', body);
      if (!a.ok) return a;
      if (typeof a.mask !== 'string' || a.mask.length > 6_000_000) return { ok: false, code: 'UNEXPECTED' };
      try { return { ok: true, mask: new Blob([Uint8Array.from(atob(a.mask), c => c.charCodeAt(0))], { type: typeof a.contentType === 'string' ? a.contentType : 'image/png' }) }; }
      catch { return { ok: false, code: 'UNEXPECTED' }; }
    },
    async job(jobId) {
      const a = await rpc('get_ai_job', { p_job_id: jobId });
      if (!a.ok) return a;
      const status = aiStatus(a.status);
      return status ? { ok: true, status, outputPath: typeof a.outputPath === 'string' ? a.outputPath : null } : { ok: false, code: 'UNEXPECTED' };
    },
    async download(path) {
      try { const { data, error } = await bucket().download(path); return error || !data ? null : data; } catch { return null; }
    },
    async remove(paths) { try { await bucket().remove(paths); } catch { /* the daily cleanup removes it after 7 days */ } },
  };
}
const userOf = (user: { id: string; email?: string | undefined; last_sign_in_at?: string | undefined; user_metadata?: Record<string, unknown> } | null | undefined): CloudUser | null =>
  user ? { id: user.id, email: user.email ?? null, lastSignInAt: user.last_sign_in_at ?? null, name: typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : typeof user.user_metadata?.name === 'string' ? user.user_metadata.name : null } : null;

/** Supabase-backed API. The library is imported only here, lazily, so the offline editor never loads it. */
export async function createSupabaseApi(config: CloudConfig): Promise<CloudApi> {
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(config.url, config.anonKey, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  let current: CloudUser | null = userOf((await client.auth.getSession()).data.session?.user);
  const listeners = new Set<(user: CloudUser | null) => void>(), failures = new Set<() => void>();
  // A failure during start-up (cold-start deep link) is kept until the first listener asks.
  let failedEarly = false;
  const failed = () => { if (failures.size) for (const listener of [...failures]) listener(); else failedEarly = true; };
  client.auth.onAuthStateChange((_event, session) => { current = userOf(session?.user); for (const listener of [...listeners]) listener(current); });
  if (Capacitor.isNativePlatform()) {
    // The deep link can arrive while the app runs, or start it after Android closed it during sign-in.
    const { App } = await import('@capacitor/app'), finish = async (url: string | undefined) => {
      if (!url || !isNativeAuthReturn(url)) return;
      // A refused sign-in (?error=…) or a code the server does not accept is reported instead of failing silently.
      const code = nativeAuthCode(url);
      let ok = false;
      if (code) try { ok = !(await client.auth.exchangeCodeForSession(code)).error; } catch { ok = false; }
      try { const { Browser } = await import('@capacitor/browser'); await Browser.close(); } catch { /* the tab may already be gone */ }
      if (!ok) failed();
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
    onSignInFailed(listener) { failures.add(listener); if (failedEarly) { failedEarly = false; listener(); } return () => failures.delete(listener); },
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
    roomAi: roomAiApi(client, rpc),
    async listProjects(includeTrashed = false) {
      try {
        const query = client.from('projects').select('id,name,current_revision,updated_at'), { data, error, status } = await (includeTrashed ? query : query.is('trashed_at', null)).order('updated_at', { ascending: false }).limit(200);
        if (error || !Array.isArray(data)) return { ok: false, code: status === 0 || status >= 500 ? 'NETWORK' : 'UNEXPECTED' };
        return { ok: true, projects: (data as Record<string, unknown>[]).map(row => ({ id: String(row.id), name: String(row.name), serverRevision: Number(row.current_revision), updatedAt: String(row.updated_at) })) };
      } catch { return { ok: false, code: 'NETWORK' }; }
    },
  };
}
