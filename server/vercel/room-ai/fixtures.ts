import { deflateSync } from 'node:zlib';
import { newLimits } from './guard.js';
import type { Deps, RoomAiEnv } from './guard.js';

/** D92 test helpers (builder's own): real PNG/JPEG headers made in Node, fake deps, request builders. */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b: Uint8Array) => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 0xff]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length), view = new DataView(out.buffer);
  view.setUint32(0, data.length); for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i); out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
/** A valid PNG of the given size; colour type 6 (RGBA) by default, 2 = RGB, 0 = grey. All pixels zero. */
export function png(width: number, height: number, colourType: 0 | 2 | 6 = 6): Uint8Array {
  const channels = colourType === 6 ? 4 : colourType === 2 ? 3 : 1, raw = new Uint8Array((width * channels + 1) * height);
  const header = new Uint8Array(13), view = new DataView(header.buffer);
  view.setUint32(0, width); view.setUint32(4, height); header[8] = 8; header[9] = colourType;
  const parts = [Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let at = 0; for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}
/** JPEG markers only (SOI, APP0, SOF0 with the size, EOI): enough for type and size checks. */
export function jpeg(width: number, height: number, padding = 0): Uint8Array {
  const app0 = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00];
  const sof = [0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
  return Uint8Array.from([0xff, 0xd8, ...app0, ...sof, ...new Array<number>(padding).fill(0), 0xff, 0xd9]);
}
export const blob = (bytes: Uint8Array, type: string) => new Blob([bytes as Uint8Array<ArrayBuffer>], { type });

export const ORIGIN = 'https://gharplan.example.app';
export const CODE = 'tester-code-2026';
export const KEYS = { openai: 'test-openai-key-not-real', fal: 'test-fal-key-not-real' };
export const env = (over: Partial<RoomAiEnv> = {}): RoomAiEnv => ({ OPENAI_API_KEY: KEYS.openai, FAL_KEY: KEYS.fal, AI_ACCESS_CODE: CODE, ALLOWED_ORIGINS: ORIGIN, ...over });
export interface Logged { event: string; data: Readonly<Record<string, string | number | boolean>> }
export function deps(fetcher: typeof fetch, over: Partial<RoomAiEnv> = {}, at = { now: 1_000_000 }) {
  const logs: Logged[] = [];
  const d: Deps = { env: () => env(over), fetch: fetcher, now: () => at.now, log: (event, data) => { logs.push({ event, data }); }, limits: newLimits() };
  return { deps: d, logs, at };
}
export function post(path: string, form: FormData | null, headers: Record<string, string> = {}): Request {
  return new Request(`https://gharplan.example.app/api/room-ai/${path}`, { method: 'POST', body: form ?? null, headers: { Origin: ORIGIN, 'X-Room-AI-Code': CODE, ...headers } });
}
/** A valid edit form at 1024 × 640 (exactly OpenAI's minimum pixel count). */
export function editForm(over: { room?: Uint8Array; mask?: Uint8Array; references?: Uint8Array[]; kind?: string; surface?: string; label?: string; colour?: string } = {}): FormData {
  const form = new FormData();
  form.append('room', blob(over.room ?? png(1024, 640, 2), 'image/png'), 'room.png');
  form.append('mask', blob(over.mask ?? png(1024, 640, 6), 'image/png'), 'mask.png');
  for (const r of over.references ?? []) form.append('reference', blob(r, 'image/jpeg'), 'reference.jpg');
  form.append('kind', over.kind ?? 'paint'); form.append('surface', over.surface ?? 'wall'); form.append('label', over.label ?? 'Sky blue');
  if (over.colour !== '') form.append('colour', over.colour ?? '#BCD7EA');
  return form;
}
/** A fake fetch that records calls and answers from a queue of handlers. */
export function fakeFetch(...answers: ((url: string, init: RequestInit) => Response | Promise<Response>)[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetcher = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input); calls.push({ url, init });
    const answer = answers.shift(); if (!answer) throw new Error(`unexpected fetch ${url}`);
    return answer(url, init);
  }) as typeof fetch;
  return { fetcher, calls };
}
export const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
