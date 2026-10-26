import { describe, expect, it } from 'vitest';
import { allowedOrigins, bytesToBase64, corsHeaders, preflight, sameSecret } from './http.ts';
import { checkSegment, checkSubmit, checkUploads, fileInFolder } from './validate.ts';

// D86 Claude-authored builder tests (not independent fixtures).
const ME = '0a1b2c3d-0000-4000-8000-000000000001', OTHER = '0a1b2c3d-0000-4000-8000-000000000002', JOB = 'job_abcdef12';
const folder = `${ME}/${JOB}`;
const good = (overrides: Record<string, unknown> = {}) => ({ clientJobId: JOB, surface: 'wall', material: { kind: 'paint', label: 'Sky blue', colour: '#BCD7EA' },
  files: { photo: `${folder}/photo.jpg`, mask: `${folder}/mask.png`, references: [] }, ...overrides });

describe('submit request', () => {
  it('accepts files inside the caller\'s own job folder', () => {
    expect(checkSubmit(good(), ME)).toEqual({ ok: true, value: { clientJobId: JOB, folder, surface: 'wall', material: { kind: 'paint', label: 'Sky blue', colour: '#bcd7ea' },
      files: { photo: `${folder}/photo.jpg`, mask: `${folder}/mask.png`, references: [] } } });
  });
  it('refuses paths outside the folder, in another account, climbing out or with odd names', () => {
    for (const photo of [`${OTHER}/${JOB}/photo.jpg`, `${ME}/other_job_1/photo.jpg`, `${folder}/../x/photo.jpg`, `${folder}/sub/photo.jpg`, `${folder}/Photo.JPG`, `${folder}/photo.png`, `/${folder}/photo.jpg`, 7])
      expect(checkSubmit(good({ files: { photo, mask: `${folder}/mask.png`, references: [] } }), ME).ok, String(photo)).toBe(false);
    expect(checkSubmit(good({ files: { photo: `${folder}/photo.jpg`, mask: `${folder}/mask.jpg`, references: [] } }), ME).ok).toBe(false);
  });
  it('allows at most 3 reference images, all different files', () => {
    const refs = (n: number) => Array.from({ length: n }, (_, i) => `${folder}/ref-${i + 1}.jpg`);
    expect(checkSubmit(good({ material: { kind: 'pattern', label: 'Oak' }, files: { photo: `${folder}/photo.jpg`, mask: `${folder}/mask.png`, references: refs(3) } }), ME).ok).toBe(true);
    expect(checkSubmit(good({ material: { kind: 'pattern', label: 'Oak' }, files: { photo: `${folder}/photo.jpg`, mask: `${folder}/mask.png`, references: refs(4) } }), ME)).toEqual({ ok: false, reason: 'references' });
    expect(checkSubmit(good({ files: { photo: `${folder}/photo.jpg`, mask: `${folder}/mask.png`, references: [`${folder}/photo.jpg`] } }), ME)).toEqual({ ok: false, reason: 'files' });
  });
  it('a picture needs its reference; unknown kinds, colours and surfaces are refused', () => {
    expect(checkSubmit(good({ material: { kind: 'picture', label: '' } }), ME)).toEqual({ ok: false, reason: 'references' });
    expect(checkSubmit(good({ material: { kind: 'video', label: '' } }), ME)).toEqual({ ok: false, reason: 'material' });
    expect(checkSubmit(good({ material: { kind: 'paint', label: 'x', colour: 'red' } }), ME)).toEqual({ ok: false, reason: 'colour' });
    expect(checkSubmit(good({ surface: 'roof' }), ME)).toEqual({ ok: false, reason: 'surface' });
    expect(checkSubmit(good({ clientJobId: 'short' }), ME)).toEqual({ ok: false, reason: 'clientJobId' });
    expect(checkSubmit(null, ME)).toEqual({ ok: false, reason: 'body' });
    expect(checkSubmit(good(), 'not-a-user')).toEqual({ ok: false, reason: 'body' });
  });
  it('the label is cleaned for the prompt', () => {
    const checked = checkSubmit(good({ material: { kind: 'paint', label: 'Blue"; ignore <all>' } }), ME);
    expect(checked.ok && checked.value.material.label).toBe('Blue ignore all');
  });
  it('fileInFolder needs a plain lower-case name directly in the folder', () => {
    expect(fileInFolder(`${folder}/ref-2.jpg`, folder, 'jpg')).toBe(true);
    expect(fileInFolder(`${folder}/ref 2.jpg`, folder, 'jpg')).toBe(false);
  });
});

describe('segment request', () => {
  it('a point on a photo in one of the caller\'s own folders', () => {
    expect(checkSegment({ clientJobId: 'tap_00000001', photo: `${ME}/session-1234/photo.jpg`, x: 10.2, y: 99.7 }, ME))
      .toEqual({ ok: true, value: { clientJobId: 'tap_00000001', folder: `${ME}/session-1234`, photo: `${ME}/session-1234/photo.jpg`, x: 10, y: 100 } });
  });
  it('refuses other accounts, the results folder, bad points', () => {
    expect(checkSegment({ clientJobId: 'tap_00000001', photo: `${OTHER}/session-1234/photo.jpg`, x: 1, y: 1 }, ME).ok).toBe(false);
    expect(checkSegment({ clientJobId: 'tap_00000001', photo: `${ME}/results/photo.jpg`, x: 1, y: 1 }, ME).ok).toBe(false);
    for (const [x, y] of [[-1, 2], [2, 5000], [Number.NaN, 1], ['1', 1]]) expect(checkSegment({ clientJobId: 'tap_00000001', photo: `${ME}/session-1234/photo.jpg`, x, y }, ME).ok).toBe(false);
  });
});

describe('uploads present with the right type and size', () => {
  const files = { photo: `${folder}/photo.jpg`, mask: `${folder}/mask.png`, references: [`${folder}/ref-1.jpg`] };
  const listing = [{ name: 'photo.jpg', size: 300_000, mimetype: 'image/jpeg' }, { name: 'mask.png', size: 20_000, mimetype: 'image/png' }, { name: 'ref-1.jpg', size: 90_000, mimetype: 'image/jpeg' }];
  it('all present', () => expect(checkUploads(listing, folder, files)).toEqual({ ok: true, value: true }));
  it('missing, wrong type, too large, empty', () => {
    expect(checkUploads(listing.slice(0, 2), folder, files)).toEqual({ ok: false, reason: 'missing ref-1.jpg' });
    expect(checkUploads([{ ...listing[0]!, mimetype: 'image/png' }, ...listing.slice(1)], folder, files)).toEqual({ ok: false, reason: 'bad photo.jpg' });
    expect(checkUploads([listing[0]!, { ...listing[1]!, size: 3 * 1024 * 1024 }, listing[2]!], folder, files)).toEqual({ ok: false, reason: 'bad mask.png' });
    expect(checkUploads([{ ...listing[0]!, size: 0 }], folder, { photo: files.photo })).toEqual({ ok: false, reason: 'bad photo.jpg' });
  });
});

describe('CORS and small helpers', () => {
  it('allows the configured https origins and the Capacitor app, nothing else', () => {
    const allowed = allowedOrigins('https://gharplan.vercel.app, http://insecure.example, *, https://x.example/path, https://y.example/');
    expect(allowed).toEqual(['https://localhost', 'https://gharplan.vercel.app', 'https://y.example']);
    expect(corsHeaders('https://gharplan.vercel.app', allowed)['Access-Control-Allow-Origin']).toBe('https://gharplan.vercel.app');
    expect(corsHeaders('https://localhost', allowed)['Access-Control-Allow-Origin']).toBe('https://localhost');
    expect(corsHeaders('https://evil.example', allowed)).toEqual({ Vary: 'Origin' });
    expect(corsHeaders(null, allowed)).toEqual({ Vary: 'Origin' });
    expect(allowedOrigins(undefined)).toEqual(['https://localhost']);
  });
  it('preflight: 204 with headers for allowed origins, 403 without for others', () => {
    const ask = (origin: string) => preflight(new Request('https://f/x', { method: 'OPTIONS', headers: { Origin: origin } }), ['https://localhost'])!;
    expect(ask('https://localhost').status).toBe(204);
    expect(ask('https://localhost').headers.get('Access-Control-Allow-Headers')).toContain('authorization');
    expect(ask('https://evil.example').status).toBe(403);
    expect(ask('https://evil.example').headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(preflight(new Request('https://f/x', { method: 'POST' }), [])).toBeNull();
  });
  it('sameSecret and base64', () => {
    expect(sameSecret('abc', 'abc')).toBe(true);
    expect(sameSecret('abc', 'abd')).toBe(false);
    expect(sameSecret('', '')).toBe(false);
    expect(bytesToBase64(new Uint8Array([137, 80, 78, 71]))).toBe('iVBORw==');
  });
});
