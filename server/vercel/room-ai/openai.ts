/**
 * D92 AI test mode: everything sent to OpenAI's image edit API is built here from a fixed allowlist. The app can
 * choose only the material kind, a short label, a colour and the surface; model, quality, image count, size, output
 * format and the prompt wording are fixed on the server, so no caller can ask for a more expensive call.
 * Facts used (developers.openai.com, fetched 2026-10-28): POST /v1/images/edits takes multipart form data with
 * image[] (the FIRST image is the one edited; the mask applies to it), mask (PNG with an alpha channel, transparent =
 * edit, same size as the first image), prompt, model, quality (default "auto", so "medium" is always sent), n,
 * size "WIDTHxHEIGHT", output_format and output_compression; the answer is data[0].b64_json.
 */
export const OPENAI_EDIT_URL = 'https://api.openai.com/v1/images/edits';
export const EDIT_MODEL = 'gpt-image-2.5-flare';
export const EDIT_QUALITY = 'medium';
export const OUTPUT_COMPRESSION = 85;
export const MAX_REFERENCES = 3, MAX_LABEL = 40, MAX_PROMPT = 1000;
export type MaterialKind = 'paint' | 'pattern' | 'picture';
export type SurfaceKind = 'wall' | 'floor' | 'other';
export interface EditMaterial { readonly kind: MaterialKind; readonly label: string; readonly colour: string | null }

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
  const ref = references > 0 ? 'the material shown in the second image' : 'a new material';
  const change = material.kind === 'paint' ? `Repaint it with a matt paint colour${named}${colour}.`
    : material.kind === 'pattern' ? `Cover it with ${ref}${named}, laid flat on the surface at a realistic size and following its perspective.`
      : `Place the artwork shown in the second image${named} on it as a picture that fills the area and follows its perspective.`;
  const prompt = `Edit the first image, a photo of a real room. The transparent area of the mask is ${TARGET[surface]}. ${change} `
    + 'Keep the light, shadows and reflections of the room natural. Change nothing outside the masked area. '
    + 'Do not add or remove furniture, people, text, logos or watermarks. Photorealistic.';
  return prompt.slice(0, MAX_PROMPT);
}

export interface EditFiles {
  readonly room: Uint8Array;
  readonly mask: Uint8Array;
  readonly references: readonly { readonly bytes: Uint8Array; readonly kind: 'jpeg' | 'png' }[];
  readonly width: number;
  readonly height: number;
}
const blob = (bytes: Uint8Array, type: string) => new Blob([bytes as Uint8Array<ArrayBuffer>], { type });
/** The exact multipart body: the room photo first, then at most 3 references, the mask, medium quality, one JPEG. */
export function openAiEditForm(files: EditFiles, prompt: string): FormData {
  if (files.references.length > MAX_REFERENCES) throw new Error('too many references');
  const form = new FormData();
  form.append('model', EDIT_MODEL);
  form.append('image[]', blob(files.room, 'image/png'), 'room.png');
  files.references.forEach((r, i) => form.append('image[]', blob(r.bytes, r.kind === 'png' ? 'image/png' : 'image/jpeg'), `reference-${i + 1}.${r.kind === 'png' ? 'png' : 'jpg'}`));
  form.append('mask', blob(files.mask, 'image/png'), 'mask.png');
  form.append('prompt', prompt.slice(0, MAX_PROMPT));
  form.append('quality', EDIT_QUALITY);
  form.append('n', '1');
  form.append('size', `${files.width}x${files.height}`);
  form.append('output_format', 'jpeg');
  form.append('output_compression', String(OUTPUT_COMPRESSION));
  return form;
}

/** What the app is told when OpenAI refuses or fails. None of these is retried automatically. */
export type EditProblem = 'BLOCKED' | 'BUSY' | 'BUDGET' | 'NOT_SET_UP' | 'PROVIDER_FAILED';
export function mapOpenAiError(status: number, body: unknown): { code: EditProblem; status: number; providerCode: string } {
  const error = body && typeof body === 'object' ? (body as { error?: unknown }).error : null;
  const raw = error && typeof error === 'object' ? (error as { code?: unknown; type?: unknown }) : {};
  const providerCode = String(typeof raw.code === 'string' ? raw.code : typeof raw.type === 'string' ? raw.type : 'unknown').replace(/[^a-z0-9_]/gi, '').slice(0, 60) || 'unknown';
  if (providerCode === 'moderation_blocked' || providerCode === 'image_generation_user_error' || providerCode === 'content_policy_violation') return { code: 'BLOCKED', status: 422, providerCode };
  if (providerCode === 'insufficient_quota' || providerCode === 'billing_hard_limit_reached') return { code: 'BUDGET', status: 402, providerCode };
  if (status === 429) return { code: 'BUSY', status: 429, providerCode };
  if (status === 401 || status === 403) return { code: 'NOT_SET_UP', status: 503, providerCode };
  return { code: 'PROVIDER_FAILED', status: 502, providerCode };
}
