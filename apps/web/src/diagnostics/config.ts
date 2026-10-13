/** Standard hosted public DSNs only. Reject passwords, query data and arbitrary targets. */
export function publicDsn(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 256) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.password || url.port || url.search || url.hash || !/^[a-f0-9]{32}$/.test(url.username) || !/^o\d+\.ingest(?:\.(?:us|de))?\.sentry\.io$/.test(url.hostname) || !/^\/\d+$/.test(url.pathname)) return null;
    return url.href;
  } catch { return null; }
}
