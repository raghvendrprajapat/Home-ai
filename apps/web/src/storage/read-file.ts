import { MAX_DOCUMENT_BYTES } from '@gharplan/core-model';
import type { ParseResult } from '@gharplan/core-model';
type ImportWorker = Pick<Worker, 'postMessage' | 'terminate' | 'onmessage' | 'onerror'>;
const failed = (code: string): ParseResult => ({ ok: false, errors: [{ code, message: 'Backup could not be admitted; existing data is unchanged.', entityIds: [] }] });
export async function readProjectUpload(file: Pick<File, 'size' | 'arrayBuffer'>, options: { signal?: AbortSignal; timeoutMs?: number; worker?: () => ImportWorker } = {}): Promise<ParseResult> {
  if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > MAX_DOCUMENT_BYTES) return failed('file-size');
  if (options.signal?.aborted) return failed('file-cancelled');
  let buffer: ArrayBuffer;
  try {
    buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const abort = () => done(new Error('Cancelled'));
      const timer = setTimeout(() => done(new Error('Read timeout')), options.timeoutMs ?? 10000);
      const done = (error: Error | null, value?: ArrayBuffer) => { clearTimeout(timer); options.signal?.removeEventListener('abort', abort); if (error) reject(error); else resolve(value!); };
      options.signal?.addEventListener('abort', abort, { once: true });
      try { file.arrayBuffer().then(value => done(null, value), () => done(new Error('Read failed'))); }
      catch { done(new Error('Read failed')); }
    });
  } catch { return failed(options.signal?.aborted ? 'file-cancelled' : 'file-read'); }
  if (options.signal?.aborted) return failed('file-cancelled');
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength !== file.size) return failed('file-read');
  return new Promise(resolve => {
    let worker: ImportWorker;
    try { worker = options.worker?.() ?? new Worker(new URL('./import.worker.ts', import.meta.url), { type: 'module' }); }
    catch { resolve(failed('file-worker')); return; }
    const token = crypto.randomUUID(); let finished = false;
    const finish = (result: ParseResult) => { if (finished) return; finished = true; clearTimeout(timer); options.signal?.removeEventListener('abort', abort); worker.onmessage = null; worker.onerror = null; worker.terminate(); resolve(result); };
    const abort = () => finish(failed('file-cancelled'));
    const timer = setTimeout(() => finish(failed('file-worker')), options.timeoutMs ?? 10000);
    options.signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = event => { if (event.data?.token === token && typeof event.data.result?.ok === 'boolean') finish(event.data.result); };
    worker.onerror = () => finish(failed('file-worker'));
    if (options.signal?.aborted) { abort(); return; }
    try { worker.postMessage({ token, buffer }, [buffer]); } catch { finish(failed('file-worker')); }
  });
}
