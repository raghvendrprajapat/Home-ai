import { allowedMediaUrl } from './fal.ts';
import { fetchWithTimeout, json, readLimited } from './http.ts';
import { answer } from './ports.ts';
import type { Ports } from './ports.ts';
import { verifyFalWebhook } from './signature.ts';
import type { JwksCache } from './signature.ts';
import { isUuid } from './validate.ts';

/**
 * D86 room-ai-webhook: fal calls this when an edit finishes. No Supabase sign-in (fal has none); instead every
 * delivery must carry a valid fal signature, or it gets 401 and changes nothing. A valid delivery is answered 200 at
 * once and the work continues in the background (fal waits at most 15 s). Idempotent: a job that is already settled
 * is left alone. On success the image is downloaded only from fal's media hosts and stored privately under
 * <owner>/results/<job id>.jpg; on failure the job is refunded. The room photo and reference images are deleted right
 * after; the mask stays so the app can finish the preview later (the daily cleanup removes everything after 7 days).
 */
export const MAX_DELIVERY_BYTES = 1024 * 1024;
export const MAX_RESULT_BYTES = 15 * 1024 * 1024;
const RESULT_TYPES = new Set(['image/jpeg', 'image/jpg']);

interface Delivery { request_id?: unknown; status?: unknown; payload?: { images?: { url?: unknown }[] } | null; error?: unknown }
export interface WebhookOptions { cache: JwksCache; fetchJwks: () => Promise<unknown> }

export function webhookHandler(ports: Ports, options: WebhookOptions) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return json({ ok: false }, 405);
    const raw = new Uint8Array(await request.arrayBuffer());
    if (raw.byteLength > MAX_DELIVERY_BYTES) return json({ ok: false }, 413);
    const verdict = await verifyFalWebhook(request.headers, raw, { now: ports.now, fetchJwks: options.fetchJwks, cache: options.cache });
    if (!verdict.ok) { ports.log('room-ai-webhook refused', { reason: verdict.reason }); return json({ ok: false }, 401); }
    let delivery: Delivery;
    try { delivery = JSON.parse(new TextDecoder().decode(raw)) as Delivery; } catch { return json({ ok: false }, 400); }
    if (delivery.request_id !== verdict.requestId) return json({ ok: false }, 400);
    const jobId = new URL(request.url).searchParams.get('job');
    // Signed by fal but not one of ours (or already forgotten): acknowledge so fal stops retrying.
    if (!isUuid(jobId)) return json({ ok: true, ignored: true });
    const found = answer(await ports.service('ai_job_for_webhook', { p_job_id: jobId, p_request_id: verdict.requestId }));
    if (!found.ok) return json({ ok: true, ignored: true });
    if (found.status === 'succeeded' || found.status === 'refunded') return json({ ok: true, settled: found.status });
    const work = settle(ports, jobId, verdict.requestId, typeof found.userId === 'string' ? found.userId : null, String(found.folder), delivery);
    ports.defer(work.catch(() => ports.log('room-ai-webhook background failure', { job: jobId })));
    return json({ ok: true });
  };
}

async function settle(ports: Ports, jobId: string, requestId: string, userId: string | null, folder: string, delivery: Delivery): Promise<void> {
  const finish = async (ok: boolean, outputPath: string | null, error: string | null, costIncurred: boolean) => {
    await ports.service('start_ai_job', { p_job_id: jobId, p_request_id: requestId }); // records the request id if the submit answer was lost
    const done = answer(await ports.service('finish_ai_job', { p_job_id: jobId, p_ok: ok, p_output_path: outputPath, p_error: error, p_cost_incurred: costIncurred }));
    ports.log('room-ai-webhook settled', { job: jobId, ok, status: typeof done.status === 'string' ? done.status : null });
  };
  try {
    if (!userId) { await finish(false, null, 'account deleted', true); return; }
    if (delivery.status !== 'OK') { await finish(false, null, 'provider error', false); return; }
    const url = allowedMediaUrl(delivery.payload?.images?.[0]?.url, ports.mediaHosts);
    if (!url) { await finish(false, null, 'result missing or from an unexpected host', true); return; }
    let bytes: Uint8Array | null = null;
    try {
      const response = await fetchWithTimeout(ports.fetch, url.href, { method: 'GET' }, 20_000);
      const type = (response.headers.get('Content-Type') ?? '').split(';')[0]!.trim().toLowerCase();
      if (response.ok && RESULT_TYPES.has(type)) bytes = await readLimited(response, MAX_RESULT_BYTES);
    } catch { bytes = null; }
    if (!bytes) { await finish(false, null, 'result download failed', true); return; }
    const path = `${userId}/results/${jobId}.jpg`;
    if (!await ports.storage.upload(path, bytes, 'image/jpeg')) { await finish(false, null, 'result upload failed', true); return; }
    await finish(true, path, null, true);
  } finally {
    // The room photo and the reference pictures are not needed any more; the mask is kept for the app (see above).
    const listing = await ports.storage.list(folder);
    const inputs = (listing ?? []).filter(file => file.name !== 'mask.png').map(file => `${folder}/${file.name}`);
    if (inputs.length) await ports.storage.remove(inputs);
  }
}
