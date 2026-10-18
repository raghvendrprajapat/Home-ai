// Narrow types for the parts of @supabase/supabase-js 2.117.2 that cloud/api.ts uses. The package's own declarations
// do not compile under this project's `exactOptionalPropertyTypes` (auth-js WebAuthn types), so apps/web/tsconfig.json
// maps the import here for type checking only; Vite and Vitest still bundle and run the real package.
export interface SupabaseUser { id: string; email?: string; last_sign_in_at?: string; user_metadata?: Record<string, unknown> }
export interface SupabaseSession { user: SupabaseUser }
export interface PostgrestResult { data: unknown; error: { message?: string } | null; status: number }
export interface Query extends PromiseLike<PostgrestResult> {
  select(columns: string): Query; is(column: string, value: null): Query; eq(column: string, value: string | number): Query; order(column: string, options: { ascending: boolean }): Query; limit(count: number): Query;
}
export interface SupabaseClient {
  auth: {
    getSession(): Promise<{ data: { session: SupabaseSession | null } }>;
    onAuthStateChange(callback: (event: string, session: SupabaseSession | null) => void): unknown;
    signInWithOAuth(credentials: { provider: 'google'; options?: { redirectTo?: string; skipBrowserRedirect?: boolean } }): Promise<{ data: { url: string | null }; error: { message: string } | null }>;
    signOut(options?: { scope?: 'global' | 'local' | 'others' }): Promise<{ error: unknown }>;
    exchangeCodeForSession(authCode: string): Promise<{ error: { message: string } | null }>;
  };
  rpc(name: string, args: Record<string, unknown>): PromiseLike<PostgrestResult>;
  from(table: string): Query;
}
export function createClient(url: string, key: string, options?: { auth?: { flowType?: 'pkce' | 'implicit'; persistSession?: boolean; autoRefreshToken?: boolean; detectSessionInUrl?: boolean } }): SupabaseClient;
