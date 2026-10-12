import { expect, it, vi } from 'vitest';
import { readProjectUpload } from './read-file';
it('bounded reader rejects invalid size, actual size mismatch and worker startup failure', async () => {
  expect(await readProjectUpload({ size: 0, arrayBuffer: async () => new ArrayBuffer(0) })).toMatchObject({ ok: false, errors: [{ code: 'file-size' }] });
  expect(await readProjectUpload({ size: 2, arrayBuffer: async () => new ArrayBuffer(1) })).toMatchObject({ ok: false, errors: [{ code: 'file-read' }] });
  expect(await readProjectUpload({ size: 1, arrayBuffer: async () => new ArrayBuffer(1) }, { worker: () => { throw new Error('CSP/worker unavailable'); } })).toMatchObject({ ok: false, errors: [{ code: 'file-worker' }] });
});
it('stale worker tokens cannot finish admission; abort terminates worker without initializing data', async () => {
  const controller = new AbortController(); let stopped = false;
  const worker = { onmessage: null as Worker['onmessage'], onerror: null as Worker['onerror'], terminate: () => { stopped = true; }, postMessage: (message: { token: string }) => { worker.onmessage?.call(worker as unknown as Worker, new MessageEvent('message', { data: { token: message.token + '_stale', result: { ok: true } } })); controller.abort(); } };
  const result = await readProjectUpload({ size: 1, arrayBuffer: async () => new ArrayBuffer(1) }, { signal: controller.signal, worker: () => worker });
  expect(result).toMatchObject({ ok: false, errors: [{ code: 'file-cancelled' }] }); expect(stopped).toBe(true); expect(worker.onmessage).toBeNull();
});
it('unresponsive file read times out without continuing to a worker', async () => {
  vi.useFakeTimers();
  try { const factory = vi.fn(); const result = readProjectUpload({ size: 1, arrayBuffer: () => new Promise(() => {}) }, { timeoutMs: 10, worker: factory }); await vi.advanceTimersByTimeAsync(11); expect(await result).toMatchObject({ ok: false, errors: [{ code: 'file-read' }] }); expect(factory).not.toHaveBeenCalled(); }
  finally { vi.useRealTimers(); }
});
it('stalled worker terminates on its watchdog and late results cannot become admissions', async () => {
  vi.useFakeTimers();
  try {
    const probe: { token: string; delivery: Worker['onmessage'] } = { token: '', delivery: null };
    const worker = { onmessage: null as Worker['onmessage'], onerror: null as Worker['onerror'], terminate: vi.fn(), postMessage: (request: { token: string }) => { probe.token = request.token; probe.delivery = worker.onmessage; } };
    const result = readProjectUpload({ size: 1, arrayBuffer: async () => new ArrayBuffer(1) }, { timeoutMs: 10, worker: () => worker });
    await vi.advanceTimersByTimeAsync(11); expect(await result).toMatchObject({ ok: false, errors: [{ code: 'file-worker' }] }); expect(worker.terminate).toHaveBeenCalledOnce(); expect(worker.onmessage).toBeNull();
    probe.delivery?.call(worker as unknown as Worker, new MessageEvent('message', { data: { token: probe.token, result: { ok: true } } })); expect(await result).toMatchObject({ ok: false });
  } finally { vi.useRealTimers(); }
});
