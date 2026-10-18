/**
 * FR-031 (D67) cloud configuration from build-time variables. Without both values the app stays fully local and
 * every cloud control explains that cloud saving is not set up. The anon/publishable key is public by design; a
 * secret or service-role key is refused here and at build time (vite.config.ts), so it can never ship in the app.
 */
export interface CloudConfig { url: string; anonKey: string }
/** The fake project the browser tests answer with Playwright routes; never reachable for real. */
export const E2E_CLOUD_URL = 'https://gharplan-e2e.supabase.co';
export function secretCloudKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true;
  const payload = key.split('.')[1];
  if (!payload) return false;
  try { return (JSON.parse(atob(payload.replaceAll('-', '+').replaceAll('_', '/'))) as { role?: unknown }).role === 'service_role'; } catch { return false; }
}
export function cloudConfig(env: Record<string, unknown> = import.meta.env): CloudConfig | null {
  const url = env.VITE_SUPABASE_URL, anonKey = env.VITE_SUPABASE_ANON_KEY;
  if (typeof url !== 'string' || typeof anonKey !== 'string' || !url || !anonKey || secretCloudKey(anonKey)) return null;
  return /^https:\/\/[a-z0-9]{3,40}\.supabase\.co$/.test(url) || url === E2E_CLOUD_URL ? { url, anonKey } : null;
}
