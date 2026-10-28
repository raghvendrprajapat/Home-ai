/**
 * D92 AI test mode: tap-to-select with Meta SAM-2 hosted by fal.ai. Facts used (fal.ai/docs, fetched 2026-10-28):
 * - Inputs are URLs. fal says "some models" also accept data URIs; that is not stated for SAM-2, so the photo is first
 *   uploaded to fal's CDN with the documented two-step REST upload (initiate → PUT to the returned upload_url).
 * - CDN files are kept forever and are publicly readable unless X-Fal-Object-Lifecycle-Preference sets an expiry, so
 *   every upload and call asks for expiration_duration_seconds = 3600 (1 hour).
 * - X-Fal-Store-IO: 0 stops fal keeping the request/answer in its 90-day request history.
 * - SAM-2 input: image_url, prompts [{label: 1, x, y}], apply_mask, sync_mode, output_format; output: image.url. With
 *   sync_mode the mask comes back as a data URI (so nothing has to be downloaded).
 * - X-Fal-No-Retry: 1 turns off fal's own automatic retries (documented for queue requests; harmless here).
 */
export const FAL_UPLOAD_INITIATE_URL = 'https://rest.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3';
export const SEGMENT_MODEL = 'fal-ai/sam2/image';
export const SYNC_SEGMENT_URL = `https://fal.run/${SEGMENT_MODEL}`;
export const FAL_EXPIRY_SECONDS = 3600;
/** fal result and CDN hosts (https only; the host itself or any subdomain). */
export const FAL_MEDIA_HOSTS: readonly string[] = ['fal.media'];

export function falHeaders(falKey: string): Record<string, string> {
  return { Authorization: `Key ${falKey}`, 'Content-Type': 'application/json', 'X-Fal-Store-IO': '0', 'X-Fal-No-Retry': '1',
    'X-Fal-Object-Lifecycle-Preference': JSON.stringify({ expiration_duration_seconds: FAL_EXPIRY_SECONDS }) };
}
export function uploadInitiateBody(kind: 'jpeg' | 'png'): { file_name: string; content_type: string } {
  return kind === 'png' ? { file_name: 'room.png', content_type: 'image/png' } : { file_name: 'room.jpg', content_type: 'image/jpeg' };
}

/** SAM-2 with one positive point (x, y in the uploaded photo's pixels): the answer is a mask image (PNG data URI). */
export function segmentRequestBody(imageUrl: string, x: number, y: number) {
  return { image_url: imageUrl, prompts: [{ label: 1 as const, x: Math.round(x), y: Math.round(y) }], apply_mask: false as const,
    sync_mode: true as const, output_format: 'png' as const };
}

/** An https URL without credentials or port, on one of the hosts (or a subdomain of one). */
export function allowedUrl(value: unknown, hosts: readonly string[]): URL | null {
  if (typeof value !== 'string' || value.length > 4096) return null;
  try {
    const url = new URL(value), host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    return hosts.some(h => host === h || host.endsWith(`.${h}`)) ? url : null;
  } catch { return null; }
}
/** The presigned upload address returned by fal's authenticated REST call: https without credentials (any host). */
export function uploadUrl(value: unknown): URL | null {
  if (typeof value !== 'string' || value.length > 8192) return null;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url : null; } catch { return null; }
}

/** A `data:image/png;base64,…` answer as bytes, or null. */
export function pngDataUri(value: unknown, limit: number): Uint8Array | null {
  if (typeof value !== 'string') return null;
  const match = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[1]!.length > Math.ceil(limit / 3) * 4) return null;
  try { return Uint8Array.from(atob(match[1]!), c => c.charCodeAt(0)); } catch { return null; }
}
