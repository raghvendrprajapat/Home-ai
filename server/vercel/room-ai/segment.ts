import { allowedUrl, FAL_MEDIA_HOSTS, falHeaders, pngDataUri, segmentRequestBody, SYNC_SEGMENT_URL, FAL_UPLOAD_INITIATE_URL, uploadInitiateBody, uploadUrl } from './fal.js';
import { consoleLog, fileBytes, gate, newLimits, processEnv, textField } from './guard.js';
import type { Deps } from './guard.js';
import { bytesToBase64, fetchWithTimeout, isTimeout, parseForm, readJson, readLimited } from './http.js';
import { imageInfo, sniff } from './images.js';

/**
 * D92 POST /api/room-ai/segment: "Tap to select (AI)" in test mode. Body: multipart form data with `room` (the
 * working photo, JPEG or PNG, ≤ 2.5 MB, ≤ 4096 px) and the tapped point `x`, `y` in its pixels. The photo goes to
 * fal's CDN (expires after 1 hour), SAM-2 answers a PNG mask; the answer is {ok: true, mask: base64 PNG}.
 */
export const SEGMENT_BODY_LIMIT = 3_000_000, SEGMENT_ROOM_LIMIT = 2_500_000, MASK_LIMIT = 3_000_000, MAX_EDGE = 4096;
export const SEGMENT_TIMEOUTS = { initiate: 15_000, put: 20_000, run: 60_000, download: 15_000 } as const;

export type SegmentChecked = { ok: true; room: Uint8Array; kind: 'jpeg' | 'png'; x: number; y: number } | { ok: false; reason: string };
export async function checkSegmentForm(form: FormData): Promise<SegmentChecked> {
  if ([...form.keys()].length > 5) return { ok: false, reason: 'fields' };
  const room = await fileBytes(form, 'room');
  if (!room || room.byteLength < 1 || room.byteLength > SEGMENT_ROOM_LIMIT) return { ok: false, reason: 'room' };
  const info = imageInfo(room);
  if (!info || info.width > MAX_EDGE || info.height > MAX_EDGE) return { ok: false, reason: 'room type' };
  const x = Number(textField(form, 'x', 12) ?? NaN), y = Number(textField(form, 'y', 12) ?? NaN);
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > info.width || y > info.height) return { ok: false, reason: 'point' };
  return { ok: true, room, kind: info.kind, x: Math.min(info.width - 1, Math.round(x)), y: Math.min(info.height - 1, Math.round(y)) };
}

type Failure = { code: string; status: number; step: string };
const providerFailure = (status: number, step: string): Failure => status === 401 || status === 403 ? { code: 'NOT_SET_UP', status: 503, step }
  : status === 429 ? { code: 'BUSY', status: 429, step } : { code: 'PROVIDER_FAILED', status: 502, step };

export function segmentHandler(deps: Deps) {
  return async (request: Request): Promise<Response> => {
    const started = deps.now(), passed = await gate(request, deps, 'fal', SEGMENT_BODY_LIMIT);
    if (passed instanceof Response) { if (request.method === 'POST') deps.log('room-ai-segment', { status: passed.status }); return passed; }
    const { bytes, reply, key } = passed;
    const fail = (f: Failure, extra: Record<string, string | number> = {}) => { deps.log('room-ai-segment', { status: f.status, code: f.code, step: f.step, ms: Math.round(deps.now() - started), ...extra }); return reply({ ok: false, code: f.code }, f.status); };
    const form = await parseForm(bytes, request.headers.get('Content-Type'));
    if (!form) return fail({ code: 'INVALID_REQUEST', status: 400, step: 'form' });
    const checked = await checkSegmentForm(form);
    if (!checked.ok) return fail({ code: 'INVALID_REQUEST', status: 400, step: checked.reason });
    const headers = falHeaders(key);
    const call = async (step: keyof typeof SEGMENT_TIMEOUTS, url: string, init: RequestInit): Promise<Response | Failure> => {
      try { return await fetchWithTimeout(deps.fetch, url, init, SEGMENT_TIMEOUTS[step]); }
      catch (error) { return isTimeout(error) ? { code: 'TIMEOUT', status: 504, step } : { code: 'PROVIDER_FAILED', status: 502, step }; }
    };
    // 1. Upload the photo to fal's CDN (two documented REST steps); the file expires after one hour.
    const initiated = await call('initiate', FAL_UPLOAD_INITIATE_URL, { method: 'POST', headers, body: JSON.stringify(uploadInitiateBody(checked.kind)) });
    if (!(initiated instanceof Response)) return fail(initiated);
    if (!initiated.ok) return fail(providerFailure(initiated.status, 'initiate'), { providerStatus: initiated.status });
    const target = await readJson(initiated, 64_000) as { upload_url?: unknown; file_url?: unknown } | null;
    const put = uploadUrl(target?.upload_url), file = allowedUrl(target?.file_url, FAL_MEDIA_HOSTS);
    if (!put || !file) return fail({ code: 'PROVIDER_FAILED', status: 502, step: 'upload address' });
    const sent = await call('put', put.href, { method: 'PUT', headers: { 'Content-Type': checked.kind === 'png' ? 'image/png' : 'image/jpeg' }, body: checked.room as Uint8Array<ArrayBuffer> });
    if (!(sent instanceof Response)) return fail(sent);
    if (!sent.ok) return fail(providerFailure(sent.status, 'put'), { providerStatus: sent.status, host: put.hostname });
    // 2. SAM-2 with one positive point; sync_mode asks for the mask inline (a data URI).
    const ran = await call('run', SYNC_SEGMENT_URL, { method: 'POST', headers, body: JSON.stringify(segmentRequestBody(file.href, checked.x, checked.y)) });
    if (!(ran instanceof Response)) return fail(ran);
    if (!ran.ok) return fail(providerFailure(ran.status, 'run'), { providerStatus: ran.status });
    const output = await readJson(ran, 6_000_000);
    const maskUrl = (output as { image?: { url?: unknown } } | null)?.image?.url;
    // 3. The mask: inline, or downloaded only from fal's media hosts over https.
    let mask = pngDataUri(maskUrl, MASK_LIMIT);
    if (!mask) {
      const remote = allowedUrl(maskUrl, FAL_MEDIA_HOSTS);
      if (!remote) return fail({ code: 'PROVIDER_FAILED', status: 502, step: 'mask address' });
      const got = await call('download', remote.href, { method: 'GET' });
      if (!(got instanceof Response)) return fail(got);
      if (!got.ok) return fail(providerFailure(got.status, 'download'), { providerStatus: got.status });
      mask = await readLimited(got, MASK_LIMIT);
    }
    if (!mask || sniff(mask) !== 'png') return fail({ code: 'PROVIDER_FAILED', status: 502, step: 'mask type' });
    deps.log('room-ai-segment', { status: 200, ms: Math.round(deps.now() - started) });
    return reply({ ok: true, mask: bytesToBase64(mask) }, 200);
  };
}
export const deployedSegment = (): ((request: Request) => Promise<Response>) => segmentHandler({ env: processEnv, fetch: (input, init) => fetch(input, init), now: () => Date.now(), log: consoleLog, limits: newLimits() });
