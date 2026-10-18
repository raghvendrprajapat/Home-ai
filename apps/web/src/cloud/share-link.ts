/**
 * FR-033 (D69) view-only link format. The token goes after `#`, so it is never sent to a web server or written to its
 * logs, and it is not passed on as a referrer. Tokens are 64 lowercase hex characters (D65).
 */
const PATTERN = /^#\/share\/([0-9a-f]{64})$/;
export const shareLink = (origin: string, pathname: string, token: string): string => `${origin}${pathname}#/share/${token}`;
export function sharedToken(hash: string): string | null { return PATTERN.exec(hash)?.[1] ?? null; }
