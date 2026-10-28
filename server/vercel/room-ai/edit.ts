import { consoleLog, fileBytes, gate, newLimits, processEnv, textField } from './guard.js';
import type { Deps } from './guard.js';
import { fetchWithTimeout, isTimeout, parseForm, readJson } from './http.js';
import { aiSizeOk, imageInfo } from './images.js';
import { buildPrompt, cleanLabel, MAX_REFERENCES, mapOpenAiError, OPENAI_EDIT_URL, openAiEditForm } from './openai.js';
import type { EditMaterial, MaterialKind, SurfaceKind } from './openai.js';

/**
 * D92 POST /api/room-ai/edit: one AI preview in test mode. Body: multipart form data with
 *   room      PNG, the working photo resized to the AI size (multiples of 16, long side ≤ 1536, ≥ 655 360 pixels);
 *   mask      PNG with alpha, exactly the room's size (transparent = edit);
 *   reference 0–3 JPEG/PNG pictures (tile, pattern or artwork), each ≤ 2048 px;
 *   kind, surface, label, colour  short fields; the prompt itself is fixed on the server.
 * The room photo is a PNG (not a JPEG) because OpenAI's guide says the edited image and its mask must have the same
 * format; a JPEG room with a PNG mask is not documented as accepted.
 * Answer: {ok: true, image: base64 JPEG, width, height}. Nothing is stored; nothing is retried.
 */
export const EDIT_BODY_LIMIT = 4_200_000;
export const EDIT_LIMITS = { room: 3_400_000, mask: 600_000, reference: 800_000, referenceEdge: 2048 } as const;
/** The answer must stay under Vercel's 4.5 MB response limit after base64 (4/3) and the JSON around it. */
export const RESULT_LIMIT = 3_200_000;
export const EDIT_TIMEOUT_MS = 280_000;
const KINDS: readonly MaterialKind[] = ['paint', 'pattern', 'picture'], SURFACES: readonly SurfaceKind[] = ['wall', 'floor', 'other'];

export type EditChecked = { ok: true; material: EditMaterial; surface: SurfaceKind; width: number; height: number;
  room: Uint8Array; mask: Uint8Array; references: { bytes: Uint8Array; kind: 'jpeg' | 'png' }[] } | { ok: false; reason: string };

/** Every check on the uploaded files and fields. Pure: runs before any provider call. */
export async function checkEditForm(form: FormData): Promise<EditChecked> {
  const fail = (reason: string): EditChecked => ({ ok: false, reason });
  if ([...form.keys()].length > 12) return fail('fields');
  const kind = textField(form, 'kind', 10), surface = textField(form, 'surface', 10) ?? 'other', label = textField(form, 'label', 200) ?? '', colour = textField(form, 'colour', 10);
  if (!kind || !KINDS.includes(kind as MaterialKind)) return fail('kind');
  if (!SURFACES.includes(surface as SurfaceKind)) return fail('surface');
  if (colour !== null && colour !== '' && !/^#[0-9a-fA-F]{6}$/.test(colour)) return fail('colour');
  const room = await fileBytes(form, 'room'), mask = await fileBytes(form, 'mask');
  if (!room || room.byteLength < 1 || room.byteLength > EDIT_LIMITS.room) return fail('room');
  if (!mask || mask.byteLength < 1 || mask.byteLength > EDIT_LIMITS.mask) return fail('mask');
  const roomInfo = imageInfo(room), maskInfo = imageInfo(mask);
  if (!roomInfo || roomInfo.kind !== 'png') return fail('room type');
  if (!maskInfo || maskInfo.kind !== 'png' || !maskInfo.alpha) return fail('mask type');
  if (maskInfo.width !== roomInfo.width || maskInfo.height !== roomInfo.height) return fail('mask size');
  if (!aiSizeOk(roomInfo.width, roomInfo.height)) return fail('room size');
  const entries = form.getAll('reference');
  if (entries.length > MAX_REFERENCES) return fail('references');
  const references: { bytes: Uint8Array; kind: 'jpeg' | 'png' }[] = [];
  for (const entry of entries) {
    if (!(entry instanceof Blob)) return fail('reference');
    const bytes = new Uint8Array(await entry.arrayBuffer()), info = imageInfo(bytes);
    if (bytes.byteLength < 1 || bytes.byteLength > EDIT_LIMITS.reference || !info || Math.max(info.width, info.height) > EDIT_LIMITS.referenceEdge) return fail('reference');
    references.push({ bytes, kind: info.kind });
  }
  if (kind === 'picture' && references.length < 1) return fail('references');
  return { ok: true, material: { kind: kind as MaterialKind, label: cleanLabel(label), colour: colour ? colour.toLowerCase() : null }, surface: surface as SurfaceKind,
    width: roomInfo.width, height: roomInfo.height, room, mask, references };
}

export function editHandler(deps: Deps) {
  return async (request: Request): Promise<Response> => {
    const started = deps.now(), passed = await gate(request, deps, 'openai', EDIT_BODY_LIMIT);
    if (passed instanceof Response) { if (request.method === 'POST') deps.log('room-ai-edit', { status: passed.status }); return passed; }
    const { bytes, reply, key } = passed, done = (body: { readonly ok: false; readonly code: string; readonly reason?: string }, status: number, extra: Record<string, string | number> = {}) => {
      deps.log('room-ai-edit', { status, code: body.code, ms: Math.round(deps.now() - started), ...extra });
      return reply(body, status);
    };
    const form = await parseForm(bytes, request.headers.get('Content-Type'));
    if (!form) return done({ ok: false, code: 'INVALID_REQUEST' }, 400);
    const checked = await checkEditForm(form);
    if (!checked.ok) return done({ ok: false, code: 'INVALID_REQUEST', reason: checked.reason }, 400, { reason: checked.reason });
    const prompt = buildPrompt(checked.material, checked.surface, checked.references.length);
    const body = openAiEditForm({ room: checked.room, mask: checked.mask, references: checked.references, width: checked.width, height: checked.height }, prompt);
    let response: Response;
    try { response = await fetchWithTimeout(deps.fetch, OPENAI_EDIT_URL, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body }, EDIT_TIMEOUT_MS); }
    catch (error) { return isTimeout(error) ? done({ ok: false, code: 'TIMEOUT' }, 504) : done({ ok: false, code: 'PROVIDER_FAILED' }, 502, { provider: 'unreachable' }); }
    const answer = await readJson(response, 8_000_000);
    if (!response.ok) { const mapped = mapOpenAiError(response.status, answer); return done({ ok: false, code: mapped.code }, mapped.status, { provider: mapped.providerCode, providerStatus: response.status }); }
    const b64 = (answer as { data?: { b64_json?: unknown }[] } | null)?.data?.[0]?.b64_json;
    if (typeof b64 !== 'string' || b64.length > Math.ceil(RESULT_LIMIT / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return done({ ok: false, code: 'PROVIDER_FAILED' }, 502, { provider: 'no image' });
    let head: Uint8Array;
    try { head = Uint8Array.from(atob(b64.slice(0, 64)), c => c.charCodeAt(0)); } catch { return done({ ok: false, code: 'PROVIDER_FAILED' }, 502, { provider: 'bad image' }); }
    if (head[0] !== 0xff || head[1] !== 0xd8 || head[2] !== 0xff) return done({ ok: false, code: 'PROVIDER_FAILED' }, 502, { provider: 'not jpeg' });
    deps.log('room-ai-edit', { status: 200, ms: Math.round(deps.now() - started), references: checked.references.length, width: checked.width, height: checked.height });
    return reply({ ok: true, image: b64, width: checked.width, height: checked.height }, 200);
  };
}
/** The handler as deployed: real environment, global fetch, per-instance limits. */
export const deployedEdit = (): ((request: Request) => Promise<Response>) => editHandler({ env: processEnv, fetch: (input, init) => fetch(input, init), now: () => Date.now(), log: consoleLog, limits: newLimits() });
