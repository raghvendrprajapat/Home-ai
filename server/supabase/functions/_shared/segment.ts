import { allowedMediaUrl, falHeaders, segmentRequestBody, SYNC_SEGMENT_URL } from './fal.ts';
import { bearer, bytesToBase64, corsHeaders, fetchWithTimeout, json, preflight, readJson, readLimited } from './http.ts';
import { answer } from './ports.ts';
import type { Ports } from './ports.ts';
import { checkSegment, checkUploads, SIGNED_URL_SECONDS } from './validate.ts';

/**
 * D86 room-ai-segment: "Tap to select (AI)". Signed-in callers only; at most segment_daily_limit taps a day, and the
 * taps do not use the 3 monthly previews. SAM-2 runs synchronously with one positive point; the mask image is fetched
 * only from fal's media hosts and returned to the app as base64 PNG. Nothing is stored for the result.
 */
export const MAX_MASK_BYTES = 4 * 1024 * 1024;
const MASK_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export function segmentHandler(ports: Ports) {
  return async (request: Request): Promise<Response> => {
    const early = preflight(request, ports.origins);
    if (early) return early;
    const cors = corsHeaders(request.headers.get('Origin'), ports.origins), reply = (body: unknown, status = 200) => json(body, status, cors);
    if (request.method !== 'POST') return reply({ ok: false, code: 'INVALID_REQUEST' }, 405);
    const jwt = bearer(request), userId = jwt ? await ports.userId(jwt) : null;
    if (!jwt || !userId) return reply({ ok: false, code: 'NOT_SIGNED_IN' }, 401);
    if (!ports.falKey) return reply({ ok: false, code: 'AI_UNAVAILABLE' }, 503);
    const checked = checkSegment(await readJson(request), userId);
    if (!checked.ok) return reply({ ok: false, code: 'INVALID_REQUEST', details: { reason: checked.reason } }, 400);
    const tap = checked.value;

    const reserved = answer(await ports.asUser(jwt)('reserve_ai_job', { p_client_job_id: tap.clientJobId, p_kind: 'segment', p_folder: tap.folder }));
    if (!reserved.ok) return reply(reserved.code === 'UNEXPECTED' ? { ok: false, code: 'UNEXPECTED' } : { ok: false, code: reserved.code, ...reserved.details ? { details: reserved.details } : {} });
    const jobId = String(reserved.jobId);
    // The answer of an earlier call with this key cannot be repeated (nothing is kept); the app makes a new tap.
    if (reserved.status !== 'reserved') return reply({ ok: false, code: 'ALREADY_DONE' });
    const finish = async (ok: boolean, error: string | null, costIncurred: boolean) => {
      await ports.service('finish_ai_job', { p_job_id: jobId, p_ok: ok, p_output_path: null, p_error: error, p_cost_incurred: costIncurred });
    };
    const listing = await ports.storage.list(tap.folder), uploads = listing ? checkUploads(listing, tap.folder, { photo: tap.photo }) : { ok: false as const, reason: 'listing failed' };
    if (!uploads.ok) { await finish(false, uploads.reason, false); return reply({ ok: false, code: 'UPLOAD_MISSING' }); }
    if (!answer(await ports.service('claim_ai_job', { p_job_id: jobId })).ok) return reply({ ok: false, code: 'ALREADY_DONE' });
    const photoUrl = await ports.storage.signedUrl(tap.photo, SIGNED_URL_SECONDS);
    if (!photoUrl) { await finish(false, 'signed url failed', false); return reply({ ok: false, code: 'UPLOAD_MISSING' }); }

    let response: Response;
    try { response = await fetchWithTimeout(ports.fetch, SYNC_SEGMENT_URL, { method: 'POST', headers: falHeaders(ports.falKey), body: JSON.stringify(segmentRequestBody(photoUrl, tap.x, tap.y)) }, 60_000); }
    catch { await finish(false, 'provider unreachable', true); return reply({ ok: false, code: 'PROVIDER_FAILED' }); }
    if (!response.ok) { await finish(false, `provider refused (${response.status})`, false); return reply({ ok: false, code: 'PROVIDER_FAILED' }); }
    let maskUrl: URL | null;
    try { maskUrl = allowedMediaUrl(((await response.json()) as { image?: { url?: unknown } }).image?.url, ports.mediaHosts); } catch { maskUrl = null; }
    if (!maskUrl) { await finish(false, 'mask missing or from an unexpected host', true); return reply({ ok: false, code: 'PROVIDER_FAILED' }); }
    let bytes: Uint8Array | null = null, type = '';
    try {
      const mask = await fetchWithTimeout(ports.fetch, maskUrl.href, { method: 'GET' }, 20_000);
      type = (mask.headers.get('Content-Type') ?? '').split(';')[0]!.trim().toLowerCase();
      if (mask.ok && MASK_TYPES.has(type)) bytes = await readLimited(mask, MAX_MASK_BYTES);
    } catch { bytes = null; }
    if (!bytes) { await finish(false, 'mask download failed', true); return reply({ ok: false, code: 'PROVIDER_FAILED' }); }
    await finish(true, null, true);
    return reply({ ok: true, mask: bytesToBase64(bytes), contentType: type });
  };
}
