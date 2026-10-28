/**
 * D92 AI test mode: image checks done on the server before anything is paid for. The type of every file is decided
 * by its first bytes (magic numbers), never by its name or the type the browser claimed; sizes are read from the PNG
 * IHDR chunk or the JPEG SOF marker.
 */
export type ImageKind = 'jpeg' | 'png';
export interface ImageInfo { readonly kind: ImageKind; readonly width: number; readonly height: number; readonly alpha: boolean }

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
export function sniff(bytes: Uint8Array): ImageKind | null {
  if (bytes.length >= 8 && PNG_SIGNATURE.every((b, i) => bytes[i] === b)) return 'png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  return null;
}

/** Width, height and colour type from the IHDR chunk, which must come first. Alpha = colour type 4 or 6. */
function pngInfo(bytes: Uint8Array): ImageInfo | null {
  if (bytes.length < 33) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(8) !== 13 || String.fromCharCode(bytes[12]!, bytes[13]!, bytes[14]!, bytes[15]!) !== 'IHDR') return null;
  const width = view.getUint32(16), height = view.getUint32(20), depth = bytes[24]!, colour = bytes[25]!;
  if (!width || !height || ![1, 2, 4, 8, 16].includes(depth) || ![0, 2, 3, 4, 6].includes(colour)) return null;
  return { kind: 'png', width, height, alpha: colour === 4 || colour === 6 };
}

/** Width and height from the first SOF marker (baseline, progressive and the other frame types). */
function jpegInfo(bytes: Uint8Array): ImageInfo | null {
  let at = 2;
  while (at + 4 <= bytes.length) {
    if (bytes[at] !== 0xff) return null;
    let marker = bytes[at + 1]!;
    while (marker === 0xff && at + 2 < bytes.length) { at++; marker = bytes[at + 1]!; }
    at += 2;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (marker === 0xd9 || marker === 0xda) return null;
    if (at + 2 > bytes.length) return null;
    const length = (bytes[at]! << 8) | bytes[at + 1]!;
    if (length < 2 || at + length > bytes.length) return null;
    const frame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (frame) {
      if (length < 7) return null;
      const height = (bytes[at + 3]! << 8) | bytes[at + 4]!, width = (bytes[at + 5]! << 8) | bytes[at + 6]!;
      return width && height ? { kind: 'jpeg', width, height, alpha: false } : null;
    }
    at += length;
  }
  return null;
}

/** The real type and size of an uploaded image, or null when it is neither a readable PNG nor a readable JPEG. */
export function imageInfo(bytes: Uint8Array): ImageInfo | null {
  const kind = sniff(bytes);
  return kind === 'png' ? pngInfo(bytes) : kind === 'jpeg' ? jpegInfo(bytes) : null;
}

/**
 * OpenAI custom sizes (image-generation guide and API reference, 2026-10-28): width and height multiples of 16,
 * aspect ratio between 1:3 and 3:1, total pixels 655 360 … 8 294 400. GharPlan additionally keeps the long side at
 * most 1536 px (the visualizer's working size), which keeps the upload and the answer under Vercel's 4.5 MB limit.
 */
export const AI_MAX_LONG = 1536, AI_MIN_PIXELS = 655_360, AI_MAX_PIXELS = 8_294_400, AI_MAX_RATIO = 3;
export function aiSizeOk(width: number, height: number): boolean {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 16 || height < 16) return false;
  if (width % 16 || height % 16 || Math.max(width, height) > AI_MAX_LONG) return false;
  const pixels = width * height;
  return pixels >= AI_MIN_PIXELS && pixels <= AI_MAX_PIXELS && Math.max(width, height) <= AI_MAX_RATIO * Math.min(width, height);
}
