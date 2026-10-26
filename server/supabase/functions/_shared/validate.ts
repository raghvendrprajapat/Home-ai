import { cleanLabel, MAX_REFERENCES } from './fal.ts';
import type { EditMaterial, SurfaceKind } from './fal.ts';

/**
 * D86 Room photo AI request checks. The app uploads with the person's own session into <user id>/<client job id>/
 * (storage policies refuse any other folder); these checks run again on the server before anything is paid for.
 */
export const BUCKET = 'room-photos';
export const SIGNED_URL_SECONDS = 600;
/** Upload limits; the bucket itself also refuses files above 5 MB and anything but JPEG/PNG. */
export const LIMITS = { photo: 5 * 1024 * 1024, mask: 2 * 1024 * 1024, reference: 2 * 1024 * 1024 } as const;
const CLIENT_JOB = /^[A-Za-z0-9_-]{8,64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);

export interface EditFiles { readonly photo: string; readonly mask: string; readonly references: readonly string[] }
export interface SubmitRequest { readonly clientJobId: string; readonly folder: string; readonly material: EditMaterial; readonly surface: SurfaceKind; readonly files: EditFiles }
export type Checked<T> = { ok: true; value: T } | { ok: false; reason: string };
const fail = (reason: string): { ok: false; reason: string } => ({ ok: false, reason });
const record = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

/** A path is accepted only directly inside the caller's job folder, with a plain lower-case file name. */
export function fileInFolder(path: unknown, folder: string, extension: 'jpg' | 'png'): path is string {
  if (typeof path !== 'string' || !path.startsWith(`${folder}/`)) return false;
  const name = path.slice(folder.length + 1);
  return new RegExp(`^[a-z0-9-]{1,32}\\.${extension}$`).test(name);
}

export function checkSubmit(body: unknown, userId: string): Checked<SubmitRequest> {
  const b = record(body);
  if (!b || !isUuid(userId)) return fail('body');
  if (typeof b.clientJobId !== 'string' || !CLIENT_JOB.test(b.clientJobId)) return fail('clientJobId');
  const folder = `${userId}/${b.clientJobId}`, m = record(b.material), f = record(b.files);
  if (!m || !['paint', 'pattern', 'picture'].includes(m.kind as string)) return fail('material');
  if (m.colour !== undefined && m.colour !== null && (typeof m.colour !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(m.colour))) return fail('colour');
  if (typeof m.label !== 'string' || m.label.length > 200) return fail('label');
  const surface = b.surface ?? 'other';
  if (!['wall', 'floor', 'other'].includes(surface as string)) return fail('surface');
  if (!f || !fileInFolder(f.photo, folder, 'jpg') || !fileInFolder(f.mask, folder, 'png')) return fail('files');
  const refs = f.references ?? [];
  if (!Array.isArray(refs) || refs.length > MAX_REFERENCES || !refs.every(r => fileInFolder(r, folder, 'jpg'))) return fail('references');
  const all = [f.photo, f.mask, ...refs];
  if (new Set(all).size !== all.length) return fail('files');
  if (m.kind === 'picture' && refs.length < 1) return fail('references');
  return { ok: true, value: { clientJobId: b.clientJobId, folder, surface: surface as SurfaceKind,
    material: { kind: m.kind as EditMaterial['kind'], label: cleanLabel(m.label), colour: typeof m.colour === 'string' ? m.colour.toLowerCase() : null },
    files: { photo: f.photo as string, mask: f.mask as string, references: refs as string[] } } };
}

export interface SegmentRequest { readonly clientJobId: string; readonly folder: string; readonly photo: string; readonly x: number; readonly y: number }
/** One tap: a photo the person uploaded into one of their own folders, and a point inside it (working pixels). */
export function checkSegment(body: unknown, userId: string): Checked<SegmentRequest> {
  const b = record(body);
  if (!b || !isUuid(userId)) return fail('body');
  if (typeof b.clientJobId !== 'string' || !CLIENT_JOB.test(b.clientJobId)) return fail('clientJobId');
  const match = typeof b.photo === 'string' ? /^([0-9a-f-]{36})\/([A-Za-z0-9_-]{8,64})\/photo\.jpg$/.exec(b.photo) : null;
  if (!match || match[1] !== userId || match[2] === 'results') return fail('photo');
  const x = b.x, y = b.y;
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > 4096 || y > 4096) return fail('point');
  return { ok: true, value: { clientJobId: b.clientJobId, folder: `${userId}/${match[2]}`, photo: b.photo as string, x: Math.round(x), y: Math.round(y) } };
}

/** One entry of a storage folder listing (supabase-js list()). */
export interface StoredFile { readonly name: string; readonly size: number; readonly mimetype: string }
/** Every named upload exists in the folder with the right type and size. */
export function checkUploads(listing: readonly StoredFile[], folder: string, files: EditFiles | { photo: string }): Checked<true> {
  const find = (path: string) => listing.find(file => `${folder}/${file.name}` === path);
  const wanted: [string, 'image/jpeg' | 'image/png', number][] = [[files.photo, 'image/jpeg', LIMITS.photo]];
  if ('mask' in files) wanted.push([files.mask, 'image/png', LIMITS.mask], ...files.references.map(r => [r, 'image/jpeg', LIMITS.reference] as [string, 'image/jpeg', number]));
  for (const [path, type, limit] of wanted) {
    const file = find(path);
    if (!file) return fail(`missing ${path.slice(folder.length + 1)}`);
    if (file.mimetype !== type || !(file.size > 0 && file.size <= limit)) return fail(`bad ${path.slice(folder.length + 1)}`);
  }
  return { ok: true, value: true };
}
