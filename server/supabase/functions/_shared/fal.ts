/**
 * D86 Room photo AI: everything the server sends to fal.ai is built here, from a fixed allowlist. The app can choose
 * only the material kind, a short label, a colour and the surface; model, quality, image count, output format and the
 * prompt wording are fixed on the server, so no client can ask for a more expensive call.
 * Facts used (fal docs, fetched 2026-10-26): the edit model's quality defaults to "high", so "medium" is always sent;
 * the first entry of image_urls is the image being edited; mask: white = change, black = keep.
 */
export const EDIT_MODEL = 'openai/gpt-image-2.5/flare/edit';
export const SEGMENT_MODEL = 'fal-ai/sam2/image';
export const QUEUE_EDIT_URL = `https://queue.fal.run/${EDIT_MODEL}`;
export const SYNC_SEGMENT_URL = `https://fal.run/${SEGMENT_MODEL}`;
export const MAX_REFERENCES = 3;
export const MAX_LABEL = 40;
export const MAX_PROMPT = 1000;
export type MaterialKind = 'paint' | 'pattern' | 'picture';
export type SurfaceKind = 'wall' | 'floor' | 'other';
export interface EditMaterial { readonly kind: MaterialKind; readonly label: string; readonly colour: string | null }

/** Headers for every fal call: the key, no payload kept in fal's request history, and outputs that expire in an hour. */
export function falHeaders(falKey: string): Record<string, string> {
  return { Authorization: `Key ${falKey}`, 'Content-Type': 'application/json', 'X-Fal-Store-IO': '0',
    'X-Fal-Object-Lifecycle-Preference': JSON.stringify({ expiration_duration_seconds: 3600 }) };
}

/** A label safe to place inside the fixed prompt: letters, digits, spaces and a few marks; at most 40 characters. */
export function cleanLabel(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.normalize('NFC').replace(/[^\p{L}\p{M}\p{N} #,.()'-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL).trim();
}

const TARGET: Record<SurfaceKind, string> = { wall: 'a wall', floor: 'the floor', other: 'a surface' };
/** The fixed prompt template. Only the cleaned label, a #rrggbb colour and fixed words are ever inserted. */
export function buildPrompt(material: EditMaterial, surface: SurfaceKind, references: number): string {
  const label = cleanLabel(material.label), named = label ? ` "${label}"` : '';
  const colour = material.colour && /^#[0-9a-f]{6}$/i.test(material.colour) ? ` (${material.colour.toLowerCase()})` : '';
  const ref = references > 0 ? 'the material shown in image 2' : 'a new material';
  const change = material.kind === 'paint' ? `Repaint it with a matt paint colour${named}${colour}.`
    : material.kind === 'pattern' ? `Cover it with ${ref}${named}, laid flat on the surface at a realistic size and following its perspective.`
      : `Place the artwork shown in image 2${named} on it as a picture that fills the area and follows its perspective.`;
  const prompt = `Edit image 1, a photo of a real room. The white part of the mask is ${TARGET[surface]}. ${change} `
    + 'Keep the light, shadows and reflections of the room natural. Change nothing outside the masked area. '
    + 'Do not add or remove furniture, people, text, logos or watermarks. Photorealistic.';
  return prompt.slice(0, MAX_PROMPT);
}

/** The exact edit request body: medium quality, one JPEG image, the room photo first, then at most 3 references. */
export function editRequestBody(input: { prompt: string; photoUrl: string; maskUrl: string; referenceUrls: readonly string[] }) {
  if (input.referenceUrls.length > MAX_REFERENCES) throw new Error('too many references');
  return { prompt: input.prompt.slice(0, MAX_PROMPT), image_urls: [input.photoUrl, ...input.referenceUrls], mask_url: input.maskUrl,
    quality: 'medium' as const, num_images: 1 as const, output_format: 'jpeg' as const, image_size: 'auto' as const, enable_safety_checker: true as const };
}

/** SAM-2 with one positive point (x, y in the uploaded photo's pixels): the answer is a mask image. */
export function segmentRequestBody(photoUrl: string, x: number, y: number) {
  return { image_url: photoUrl, prompts: [{ label: 1 as const, x: Math.round(x), y: Math.round(y) }], apply_mask: false as const, output_format: 'png' as const };
}

/** The queue URL with our webhook. The job id in the callback address is checked against the signed request id. */
export function queueUrl(supabaseUrl: string, jobId: string): string {
  const hook = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/room-ai-webhook?job=${encodeURIComponent(jobId)}`;
  return `${QUEUE_EDIT_URL}?fal_webhook=${encodeURIComponent(hook)}`;
}

/** Result files are downloaded only from fal's media hosts over https (default fal.media and its subdomains). */
export function mediaHosts(raw: string | undefined): string[] {
  const list = (raw ?? '').split(',').map(h => h.trim().toLowerCase()).filter(h => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(h));
  return list.length ? list : ['fal.media'];
}
export function allowedMediaUrl(value: unknown, hosts: readonly string[]): URL | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value), host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    return hosts.some(h => host === h || host.endsWith(`.${h}`)) ? url : null;
  } catch { return null; }
}

/** fal request ids are UUID-like; anything else is not stored. */
export const validRequestId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
