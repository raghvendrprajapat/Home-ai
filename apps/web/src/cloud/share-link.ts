/**
 * FR-033 (D69) view-only link format. The token goes after `#`, so it is never sent to a web server or written to its
 * logs, and it is not passed on as a referrer. Tokens are 64 lowercase hex characters (D65).
 */
const PATTERN = /^#\/share\/([0-9a-f]{64})$/;
export const shareLink = (origin: string, pathname: string, token: string): string => `${origin}${pathname}#/share/${token}`;
export interface ShareBase { origin: string; pathname: string }
/**
 * Where view-only links point. `VITE_PUBLIC_APP_URL` (https only, no query, `#` or sign-in details) wins. Without
 * it the web app uses its own address, but the Android app has none: its pages come from an internal
 * `https://localhost`, which would be a dead link for everyone else, so it gets null and no link is made.
 */
export function shareBase(native: boolean, env: Record<string, unknown>, here: ShareBase): ShareBase | null {
  const raw = env.VITE_PUBLIC_APP_URL;
  if (typeof raw === 'string' && raw) {
    try {
      const url = new URL(raw);
      if (url.protocol === 'https:' && !url.search && !url.hash && !url.username && !url.password && url.hostname !== 'localhost') return { origin: url.origin, pathname: url.pathname };
    } catch { /* an invalid address is treated as missing */ }
  }
  return native ? null : { origin: here.origin, pathname: here.pathname };
}
export function sharedToken(hash: string): string | null { return PATTERN.exec(hash)?.[1] ?? null; }
