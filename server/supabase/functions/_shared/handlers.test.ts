import { describe, expect, it } from 'vitest';
import { cleanupHandler } from './cleanup.ts';
import { bytesToHex } from './http.ts';
import type { Ports, Rpc } from './ports.ts';
import { segmentHandler } from './segment.ts';
import { newJwksCache } from './signature.ts';
import { submitHandler } from './submit.ts';
import type { StoredFile } from './validate.ts';
import { webhookHandler } from './webhook.ts';

// D86 Claude-authored builder tests for the four Edge Functions with fake Supabase, storage and fal. No network.
// The fake database keeps only the rules the handlers rely on (idempotent reserve, claim once, settle once); the real
// SQL is tested on PostgreSQL in server/supabase/tests.
const USER = '0a1b2c3d-0000-4000-8000-000000000001', JWT = 'user.jwt.token-1234', SERVICE = 'service-key-secret-1234';
const JOB = 'job_abcdef12', FOLDER = `${USER}/${JOB}`;
type Job = { id: string; clientJobId: string; kind: string; status: string; folder: string; requestId: string | null; output: string | null; error: string | null; costIncurred?: boolean };

class FakeServer {
  jobs: Job[] = []; files = new Map<string, StoredFile & { bytes?: Uint8Array }>(); calls: { url: string; init: RequestInit }[] = []; logs: string[] = [];
  reserveAnswer: Record<string, unknown> | null = null; deferred: Promise<unknown>[] = [];
  fal: (url: string, init: RequestInit) => Promise<Response> = async () => new Response(JSON.stringify({ request_id: 'req-123', status: 'IN_QUEUE' }), { status: 200 });
  rpc(asUser: boolean): Rpc {
    return async (name, a) => {
      const job = this.jobs.find(j => j.id === a.p_job_id);
      const data = ((): unknown => {
        switch (name) {
          case 'reserve_ai_job': {
            if (!asUser) return { ok: false, code: 'NOT_SIGNED_IN' };
            if (this.reserveAnswer) return this.reserveAnswer;
            const found = this.jobs.find(j => j.clientJobId === a.p_client_job_id);
            if (found) return { ok: true, jobId: found.id, status: found.status, replayed: true };
            const created: Job = { id: `00000000-0000-4000-8000-00000000000${this.jobs.length + 1}`, clientJobId: String(a.p_client_job_id), kind: String(a.p_kind), status: 'reserved', folder: String(a.p_folder ?? `${USER}/${String(a.p_client_job_id)}`), requestId: null, output: null, error: null };
            this.jobs.push(created); return { ok: true, jobId: created.id, status: 'reserved' };
          }
          case 'claim_ai_job':
            if (!job) return { ok: false, code: 'NOT_FOUND' };
            if (job.status !== 'reserved') return { ok: false, code: 'NOT_CLAIMABLE', details: { status: job.status } };
            job.status = 'submitting'; return { ok: true, jobId: job.id, userId: USER, kind: job.kind, folder: job.folder };
          case 'start_ai_job':
            if (job?.status === 'submitting') { job.status = 'running'; job.requestId = String(a.p_request_id); return { ok: true }; }
            if (job && !job.requestId) job.requestId = String(a.p_request_id);
            return job ? { ok: true, replayed: true } : { ok: false, code: 'NOT_FOUND' };
          case 'finish_ai_job':
            if (!job) return { ok: false, code: 'NOT_FOUND' };
            if (['succeeded', 'refunded'].includes(job.status)) return { ok: true, status: job.status, replayed: true };
            job.status = a.p_ok ? 'succeeded' : a.p_cost_incurred ? 'failed' : 'refunded'; job.output = (a.p_output_path as string | null) ?? null; job.error = (a.p_error as string | null) ?? null; job.costIncurred = a.p_cost_incurred === true;
            return { ok: true, status: job.status };
          case 'ai_job_for_webhook':
            return job && (job.requestId === null || job.requestId === a.p_request_id) ? { ok: true, jobId: job.id, userId: USER, status: job.status, folder: job.folder } : { ok: false, code: 'NOT_FOUND' };
          case 'ai_expired_paths': return this.jobs.flatMap(j => [{ job_id: j.id, path: `${j.folder}/` }, ...j.output ? [{ job_id: j.id, path: j.output }] : []]);
          case 'mark_ai_purged': return (a.p_job_ids as string[]).length;
          default: return { ok: false, code: 'UNKNOWN_FUNCTION' };
        }
      })();
      return { data, error: null };
    };
  }
  put(path: string, mimetype: string, size = 1000) { this.files.set(path, { name: path.split('/').pop()!, size, mimetype }); }
  ports(overrides: Partial<Ports> = {}): Ports {
    return {
      falKey: 'fal-key-secret', supabaseUrl: 'https://abc.supabase.co', serviceKey: SERVICE, origins: ['https://localhost', 'https://app.example'], mediaHosts: ['fal.media'],
      userId: async jwt => jwt === JWT ? USER : null, asUser: () => this.rpc(true), service: this.rpc(false),
      storage: {
        list: async folder => [...this.files.entries()].filter(([path]) => path.startsWith(`${folder}/`) && !path.slice(folder.length + 1).includes('/')).map(([, file]) => ({ name: file.name, size: file.size, mimetype: file.mimetype })),
        signedUrl: async (path, seconds) => this.files.has(path) ? `https://abc.supabase.co/storage/v1/object/sign/room-photos/${path}?token=t&expires=${seconds}` : null,
        upload: async (path, bytes, contentType) => { this.files.set(path, { name: path.split('/').pop()!, size: bytes.length, mimetype: contentType, bytes }); return true; },
        remove: async paths => { for (const p of paths) this.files.delete(p); return true; },
      },
      fetch: (async (input: RequestInfo | URL, init?: RequestInit) => { const url = String(input); this.calls.push({ url, init: init ?? {} }); return this.fal(url, init ?? {}); }) as typeof fetch,
      now: () => 1_793_000_000_000, defer: work => { this.deferred.push(work); }, log: (event, fields) => { this.logs.push(`${event} ${JSON.stringify(fields ?? {})}`); },
      ...overrides,
    };
  }
}
const post = (url: string, body: unknown, headers: Record<string, string> = {}) => new Request(url, { method: 'POST', headers: { Authorization: `Bearer ${JWT}`, Origin: 'https://app.example', 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
const submitBody = (refs = 0) => ({ clientJobId: JOB, surface: 'floor', material: { kind: refs ? 'pattern' : 'paint', label: 'Sky blue', colour: refs ? null : '#bcd7ea' },
  files: { photo: `${FOLDER}/photo.jpg`, mask: `${FOLDER}/mask.png`, references: Array.from({ length: refs }, (_, i) => `${FOLDER}/ref-${i + 1}.jpg`) } });
function uploaded(server: FakeServer, refs = 0) { server.put(`${FOLDER}/photo.jpg`, 'image/jpeg'); server.put(`${FOLDER}/mask.png`, 'image/png'); for (let i = 1; i <= refs; i++) server.put(`${FOLDER}/ref-${i}.jpg`, 'image/jpeg'); }

describe('room-ai-submit', () => {
  it('reserves, checks uploads, claims, sends exactly one medium-quality request to the fal queue with our webhook, records the request id', async () => {
    const server = new FakeServer(); uploaded(server, 2);
    const response = await submitHandler(server.ports())(post('https://f/room-ai-submit', submitBody(2)));
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example');
    expect(await response.json()).toEqual({ ok: true, jobId: server.jobs[0]!.id, status: 'running' });
    expect(server.calls).toHaveLength(1);
    const call = server.calls[0]!, url = new URL(call.url), sent = JSON.parse(String(call.init.body)) as Record<string, unknown>;
    expect(`${url.origin}${url.pathname}`).toBe('https://queue.fal.run/openai/gpt-image-2.5/flare/edit');
    expect(url.searchParams.get('fal_webhook')).toBe(`https://abc.supabase.co/functions/v1/room-ai-webhook?job=${server.jobs[0]!.id}`);
    expect((call.init.headers as Record<string, string>).Authorization).toBe('Key fal-key-secret');
    expect((call.init.headers as Record<string, string>)['X-Fal-Store-IO']).toBe('0');
    expect(sent).toMatchObject({ quality: 'medium', num_images: 1, output_format: 'jpeg' });
    expect((sent.image_urls as string[]).map(u => new URL(u).pathname.split('/').pop())).toEqual(['photo.jpg', 'ref-1.jpg', 'ref-2.jpg']);
    expect(new URL(String(sent.mask_url)).pathname.endsWith('/mask.png')).toBe(true);
    expect(server.jobs[0]).toMatchObject({ status: 'running', requestId: 'req-123' });
    // Logs never contain the fal key, the user's token or signed URLs.
    expect(server.logs.join('\n')).not.toMatch(/fal-key-secret|user\.jwt|token=|sign\//);
  });
  it('a second tap with the same clientJobId never calls fal again', async () => {
    const server = new FakeServer(); uploaded(server);
    const handler = submitHandler(server.ports());
    await handler(post('https://f/room-ai-submit', submitBody()));
    const again = await handler(post('https://f/room-ai-submit', submitBody()));
    expect(await again.json()).toEqual({ ok: true, jobId: server.jobs[0]!.id, status: 'running' });
    expect(server.calls).toHaveLength(1);
    expect(server.jobs).toHaveLength(1);
  });
  it('not signed in → 401 and nothing reserved; quota answers are passed through', async () => {
    const server = new FakeServer(); uploaded(server);
    const handler = submitHandler(server.ports());
    expect((await handler(post('https://f/x', submitBody(), { Authorization: 'Bearer someone.else.token' }))).status).toBe(401);
    expect((await handler(new Request('https://f/x', { method: 'POST', body: '{}' }))).status).toBe(401);
    expect(server.jobs).toHaveLength(0);
    server.reserveAnswer = { ok: false, code: 'AI_PAUSED' };
    expect(await (await handler(post('https://f/x', submitBody()))).json()).toEqual({ ok: false, code: 'AI_PAUSED' });
    server.reserveAnswer = { ok: false, code: 'NO_PREVIEWS_LEFT', details: { limit: 3 } };
    expect(await (await handler(post('https://f/x', submitBody()))).json()).toEqual({ ok: false, code: 'NO_PREVIEWS_LEFT', details: { limit: 3 } });
    expect(server.calls).toHaveLength(0);
  });
  it('bad requests are refused before any reservation', async () => {
    const server = new FakeServer();
    const response = await submitHandler(server.ports())(post('https://f/x', { ...submitBody(), files: { photo: `${USER}/../photo.jpg`, mask: `${FOLDER}/mask.png` } }));
    expect(response.status).toBe(400);
    expect(server.jobs).toHaveLength(0);
  });
  it('missing uploads refund the reservation and call nobody', async () => {
    const server = new FakeServer(); server.put(`${FOLDER}/photo.jpg`, 'image/jpeg');
    expect(await (await submitHandler(server.ports())(post('https://f/x', submitBody()))).json()).toEqual({ ok: false, code: 'UPLOAD_MISSING' });
    expect(server.jobs[0]).toMatchObject({ status: 'refunded', error: 'missing mask.png' });
    expect(server.calls).toHaveLength(0);
  });
  it('fal refuses → refunded; fal unreachable → failed (preview back, money counted)', async () => {
    const refused = new FakeServer(); uploaded(refused); refused.fal = async () => new Response('no', { status: 422 });
    expect(await (await submitHandler(refused.ports())(post('https://f/x', submitBody()))).json()).toEqual({ ok: false, code: 'PROVIDER_FAILED' });
    expect(refused.jobs[0]).toMatchObject({ status: 'refunded', costIncurred: false });
    const down = new FakeServer(); uploaded(down); down.fal = async () => { throw new TypeError('network'); };
    expect(await (await submitHandler(down.ports())(post('https://f/x', submitBody()))).json()).toEqual({ ok: false, code: 'PROVIDER_FAILED' });
    expect(down.jobs[0]).toMatchObject({ status: 'failed', costIncurred: true });
  });
  it('without FAL_KEY the function says AI is unavailable; CORS preflight follows the allowlist', async () => {
    const server = new FakeServer();
    expect((await submitHandler(server.ports({ falKey: '' }))(post('https://f/x', submitBody()))).status).toBe(503);
    expect((await submitHandler(server.ports())(new Request('https://f/x', { method: 'OPTIONS', headers: { Origin: 'https://localhost' } }))).status).toBe(204);
    expect((await submitHandler(server.ports())(new Request('https://f/x', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } }))).status).toBe(403);
  });
});

// Webhook deliveries signed with a key pair made here, as fal's docs describe.
const encoder = new TextEncoder();
async function falKeys() {
  const pair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  return { pair, jwks: { keys: [{ kty: 'OKP', crv: 'Ed25519', x: btoa(String.fromCharCode(...raw)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '') }] } };
}
async function delivery(key: CryptoKey, jobId: string, body: unknown, requestId = 'req-123') {
  const text = JSON.stringify(body), ts = String(1_793_000_000), digest = bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text))));
  const signature = bytesToHex(new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, key, encoder.encode(`${requestId}\nfal-user\n${ts}\n${digest}`))));
  return new Request(`https://abc.supabase.co/functions/v1/room-ai-webhook?job=${jobId}`, { method: 'POST', body: text,
    headers: { 'X-Fal-Webhook-Request-Id': requestId, 'X-Fal-Webhook-User-Id': 'fal-user', 'X-Fal-Webhook-Timestamp': ts, 'X-Fal-Webhook-Signature': signature, 'Content-Type': 'application/json' } });
}
async function running(server: FakeServer) {
  uploaded(server, 1);
  await submitHandler(server.ports())(post('https://f/x', submitBody(1)));
  return server.jobs[0]!.id;
}
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

describe('room-ai-webhook', () => {
  it('a signed OK delivery stores the result privately, settles succeeded, deletes the photo and references but keeps the mask', async () => {
    const server = new FakeServer(), jobId = await running(server), { pair, jwks } = await falKeys();
    server.fal = async url => url.startsWith('https://v3.fal.media/') ? new Response(JPEG, { status: 200, headers: { 'Content-Type': 'image/jpeg' } }) : new Response('', { status: 404 });
    const handler = webhookHandler(server.ports(), { cache: newJwksCache(), fetchJwks: async () => jwks });
    const response = await handler(await delivery(pair.privateKey, jobId, { request_id: 'req-123', status: 'OK', payload: { images: [{ url: 'https://v3.fal.media/files/out.jpeg' }] } }));
    expect(response.status).toBe(200);
    await Promise.all(server.deferred);
    expect(server.jobs[0]).toMatchObject({ status: 'succeeded', output: `${USER}/results/${jobId}.jpg` });
    expect(server.files.get(`${USER}/results/${jobId}.jpg`)?.bytes).toEqual(JPEG);
    expect([...server.files.keys()].filter(p => p.startsWith(`${FOLDER}/`))).toEqual([`${FOLDER}/mask.png`]);
    // Delivered again (fal retries): nothing changes, still 200.
    const again = await handler(await delivery(pair.privateKey, jobId, { request_id: 'req-123', status: 'OK', payload: { images: [{ url: 'https://v3.fal.media/files/out.jpeg' }] } }));
    expect(again.status).toBe(200);
    expect(server.deferred).toHaveLength(1);
  });
  it('a bad signature is 401 and changes nothing', async () => {
    const server = new FakeServer(), jobId = await running(server), { jwks } = await falKeys(), stranger = await falKeys();
    const handler = webhookHandler(server.ports(), { cache: newJwksCache(), fetchJwks: async () => jwks });
    const response = await handler(await delivery(stranger.pair.privateKey, jobId, { request_id: 'req-123', status: 'ERROR' }));
    expect(response.status).toBe(401);
    expect(server.jobs[0]!.status).toBe('running');
    expect(server.deferred).toHaveLength(0);
  });
  it('ERROR refunds; a result from a host outside the allowlist is never downloaded', async () => {
    const server = new FakeServer(), jobId = await running(server), { pair, jwks } = await falKeys();
    const handler = webhookHandler(server.ports(), { cache: newJwksCache(), fetchJwks: async () => jwks });
    await handler(await delivery(pair.privateKey, jobId, { request_id: 'req-123', status: 'ERROR', error: 'content policy' }));
    await Promise.all(server.deferred);
    expect(server.jobs[0]).toMatchObject({ status: 'refunded', costIncurred: false });

    const other = new FakeServer(), otherJob = await running(other);
    const before = other.calls.length;
    await webhookHandler(other.ports(), { cache: newJwksCache(), fetchJwks: async () => jwks })(await delivery(pair.privateKey, otherJob, { request_id: 'req-123', status: 'OK', payload: { images: [{ url: 'https://169.254.169.254/latest/meta-data' }] } }));
    await Promise.all(other.deferred);
    expect(other.calls).toHaveLength(before);
    expect(other.jobs[0]).toMatchObject({ status: 'failed', costIncurred: true });
  });
  it('a signed delivery for an unknown job, or with a mismatched body, changes nothing', async () => {
    const server = new FakeServer(), jobId = await running(server), { pair, jwks } = await falKeys();
    const handler = webhookHandler(server.ports(), { cache: newJwksCache(), fetchJwks: async () => jwks });
    expect(await (await handler(await delivery(pair.privateKey, '00000000-0000-4000-8000-0000000000ff', { request_id: 'req-123', status: 'OK' }))).json()).toEqual({ ok: true, ignored: true });
    expect((await handler(await delivery(pair.privateKey, jobId, { request_id: 'req-other', status: 'OK' }))).status).toBe(400);
    expect(await (await handler(await delivery(pair.privateKey, jobId, { request_id: 'req-999', status: 'OK' }, 'req-999'))).json()).toEqual({ ok: true, ignored: true });
    expect(server.jobs[0]!.status).toBe('running');
  });
});

describe('room-ai-segment', () => {
  const tap = { clientJobId: 'tap_00000001', photo: `${USER}/session-0001/photo.jpg`, x: 120, y: 80 };
  it('one SAM-2 call with one positive point; the mask comes back as base64 PNG', async () => {
    const server = new FakeServer(); server.put(tap.photo, 'image/jpeg');
    const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    server.fal = async url => url === 'https://fal.run/fal-ai/sam2/image' ? new Response(JSON.stringify({ image: { url: 'https://v3.fal.media/m.png' } }), { status: 200 })
      : url === 'https://v3.fal.media/m.png' ? new Response(png, { headers: { 'Content-Type': 'image/png' } }) : new Response('', { status: 404 });
    const response = await segmentHandler(server.ports())(post('https://f/room-ai-segment', tap));
    expect(await response.json()).toEqual({ ok: true, mask: 'iVBORw0KGgo=', contentType: 'image/png' });
    expect(JSON.parse(String(server.calls[0]!.init.body))).toMatchObject({ prompts: [{ label: 1, x: 120, y: 80 }], apply_mask: false });
    expect(server.jobs[0]).toMatchObject({ kind: 'segment', status: 'succeeded', folder: `${USER}/session-0001` });
  });
  it('limit reached, provider failure and a repeated key', async () => {
    const server = new FakeServer(); server.put(tap.photo, 'image/jpeg');
    server.reserveAnswer = { ok: false, code: 'SEGMENT_LIMIT', details: { limit: 20 } };
    expect(await (await segmentHandler(server.ports())(post('https://f/x', tap))).json()).toEqual({ ok: false, code: 'SEGMENT_LIMIT', details: { limit: 20 } });
    server.reserveAnswer = null; server.fal = async () => new Response('busy', { status: 503 });
    expect(await (await segmentHandler(server.ports())(post('https://f/x', tap))).json()).toEqual({ ok: false, code: 'PROVIDER_FAILED' });
    expect(server.jobs[0]).toMatchObject({ status: 'refunded' });
    expect(await (await segmentHandler(server.ports())(post('https://f/x', tap))).json()).toEqual({ ok: false, code: 'ALREADY_DONE' });
  });
});

describe('room-ai-cleanup', () => {
  it('only the service key may run it; it empties expired folders and results and marks the jobs', async () => {
    const server = new FakeServer(), jobId = await running(server);
    server.put(`${USER}/results/${jobId}.jpg`, 'image/jpeg'); server.jobs[0]!.output = `${USER}/results/${jobId}.jpg`;
    const handler = cleanupHandler(server.ports());
    expect((await handler(new Request('https://f/x', { method: 'POST', headers: { Authorization: `Bearer ${JWT}` } }))).status).toBe(401);
    expect((await handler(new Request('https://f/x', { method: 'POST' }))).status).toBe(401);
    const response = await cleanupHandler(server.ports())(new Request('https://f/x', { method: 'POST', headers: { Authorization: `Bearer ${SERVICE}` } }));
    expect(await response.json()).toEqual({ ok: true, removed: 4, jobs: 1, failed: 0, marked: true });
    expect(server.files.size).toBe(0);
  });
});
