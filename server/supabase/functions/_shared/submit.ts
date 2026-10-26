import { buildPrompt, editRequestBody, falHeaders, queueUrl, validRequestId } from './fal.ts';
import { bearer, corsHeaders, fetchWithTimeout, json, preflight, readJson } from './http.ts';
import { answer } from './ports.ts';
import type { Ports } from './ports.ts';
import { checkSubmit, checkUploads, SIGNED_URL_SECONDS } from './validate.ts';

/**
 * D86 room-ai-submit: one AI preview. Signed-in callers only. Order: check the request → reserve (idempotent; the
 * same clientJobId never pays twice) → check the uploads → claim the job (only one caller can) → short-lived signed
 * URLs → fal queue with our webhook → record the request id. A failure after the reservation settles the job:
 * 'refunded' when fal certainly did not take it, 'failed' (preview given back, money still counted) when unclear.
 */
export function submitHandler(ports: Ports) {
  return async (request: Request): Promise<Response> => {
    const early = preflight(request, ports.origins);
    if (early) return early;
    const cors = corsHeaders(request.headers.get('Origin'), ports.origins), reply = (body: unknown, status = 200) => json(body, status, cors);
    if (request.method !== 'POST') return reply({ ok: false, code: 'INVALID_REQUEST' }, 405);
    const jwt = bearer(request), userId = jwt ? await ports.userId(jwt) : null;
    if (!jwt || !userId) return reply({ ok: false, code: 'NOT_SIGNED_IN' }, 401);
    if (!ports.falKey) return reply({ ok: false, code: 'AI_UNAVAILABLE' }, 503);
    const checked = checkSubmit(await readJson(request), userId);
    if (!checked.ok) return reply({ ok: false, code: 'INVALID_REQUEST', details: { reason: checked.reason } }, 400);
    const job = checked.value;

    const reserved = answer(await ports.asUser(jwt)('reserve_ai_job', { p_client_job_id: job.clientJobId, p_kind: 'edit' }));
    if (!reserved.ok) return reply(reserved.code === 'UNEXPECTED' ? { ok: false, code: 'UNEXPECTED' } : { ok: false, code: reserved.code, ...reserved.details ? { details: reserved.details } : {} });
    const jobId = String(reserved.jobId);
    // Already sent (a retry of the same tap): never call fal again, just let the app follow the job.
    if (reserved.status !== 'reserved') return reply({ ok: true, jobId, status: reserved.status });
    const settle = async (error: string, costIncurred: boolean) => {
      await ports.service('finish_ai_job', { p_job_id: jobId, p_ok: false, p_output_path: null, p_error: error, p_cost_incurred: costIncurred });
      ports.log('room-ai-submit settled', { job: jobId, error, costIncurred });
    };

    const listing = await ports.storage.list(job.folder), uploads = listing ? checkUploads(listing, job.folder, job.files) : { ok: false as const, reason: 'listing failed' };
    if (!uploads.ok) { await settle(uploads.reason, false); return reply({ ok: false, code: 'UPLOAD_MISSING' }); }
    const claimed = answer(await ports.service('claim_ai_job', { p_job_id: jobId }));
    if (!claimed.ok) {
      // Another call won the claim: it pays and records the request; this one only reports the job.
      const status = (claimed.details as { status?: unknown } | undefined)?.status;
      return claimed.code === 'NOT_CLAIMABLE' ? reply({ ok: true, jobId, status: typeof status === 'string' ? status : 'submitting' }) : reply({ ok: false, code: 'UNEXPECTED' });
    }
    const urls = await Promise.all([job.files.photo, job.files.mask, ...job.files.references].map(path => ports.storage.signedUrl(path, SIGNED_URL_SECONDS)));
    if (urls.some(url => !url)) { await settle('signed url failed', false); return reply({ ok: false, code: 'UPLOAD_MISSING' }); }
    const [photoUrl, maskUrl, ...referenceUrls] = urls as string[];
    const body = editRequestBody({ prompt: buildPrompt(job.material, job.surface, referenceUrls.length), photoUrl: photoUrl!, maskUrl: maskUrl!, referenceUrls });

    let response: Response;
    try { response = await fetchWithTimeout(ports.fetch, queueUrl(ports.supabaseUrl, jobId), { method: 'POST', headers: falHeaders(ports.falKey), body: JSON.stringify(body) }, 30_000); }
    catch { await settle('provider unreachable', true); return reply({ ok: false, code: 'PROVIDER_FAILED' }); }
    if (!response.ok) { await settle(`provider refused (${response.status})`, false); return reply({ ok: false, code: 'PROVIDER_FAILED' }); }
    let requestId: unknown;
    try { requestId = ((await response.json()) as { request_id?: unknown }).request_id; } catch { requestId = null; }
    if (!validRequestId(requestId)) { await settle('provider answer without request id', true); return reply({ ok: false, code: 'PROVIDER_FAILED' }); }
    const started = answer(await ports.service('start_ai_job', { p_job_id: jobId, p_request_id: requestId }));
    if (!started.ok) ports.log('room-ai-submit start not recorded', { job: jobId });
    ports.log('room-ai-submit queued', { job: jobId, references: referenceUrls.length });
    return reply({ ok: true, jobId, status: 'running' });
  };
}
