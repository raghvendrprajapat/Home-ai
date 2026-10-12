import { MAX_DOCUMENT_BYTES, parseProject, serializeProject, validateProject } from '@gharplan/core-model';
import type { ProjectDoc } from '@gharplan/core-model';
import type { Immutable } from 'immer';
import { StorageError } from './types';
import type { Packed } from './types';

export async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  if (bytes.byteLength > MAX_DOCUMENT_BYTES) throw new StorageError('size', 'Local drawing exceeds 10 MiB.');
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function pack(document: Immutable<ProjectDoc>): Promise<Packed> {
  const errors = validateProject(document);
  if (errors.length) throw new StorageError('corrupt', errors[0]?.message ?? 'Cannot save an invalid drawing.');
  const text = serializeProject(document), bytes = new TextEncoder().encode(text).byteLength, hash = await sha256(text);
  const source = new Blob([text], { type: 'application/json' });
  if (typeof CompressionStream === 'undefined') return { codec: 'json', blob: source, hash, bytes };
  const blob = await new Response(source.stream().pipeThrough(new CompressionStream('gzip'))).blob();
  return { codec: 'gzip', blob, hash, bytes };
}
export async function unpackText(packed: Packed): Promise<string> {
  if (!packed || !(packed.blob instanceof Blob) || packed.blob.size > MAX_DOCUMENT_BYTES + 65536 ||
      !Number.isSafeInteger(packed.bytes) || packed.bytes < 1 || packed.bytes > MAX_DOCUMENT_BYTES || !/^[a-f0-9]{64}$/.test(packed.hash))
    throw new StorageError('size', 'Invalid or oversized local checkpoint.');
  let stream = packed.blob.stream();
  if (packed.codec === 'gzip') {
    if (typeof DecompressionStream === 'undefined') throw new StorageError('unavailable', 'This browser cannot decompress the saved drawing.');
    stream = stream.pipeThrough(new DecompressionStream('gzip'));
  } else if (packed.codec !== 'json') throw new StorageError('corrupt', 'Unknown local checkpoint encoding.');
  const reader = stream.getReader(), decoder = new TextDecoder('utf-8', { fatal: true });
  let text = '', size = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_DOCUMENT_BYTES || size > packed.bytes) throw new StorageError('size', 'Decompressed drawing exceeds its size limit.');
      text += decoder.decode(part.value, { stream: true });
    }
    text += decoder.decode();
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  if (size !== packed.bytes || await sha256(text) !== packed.hash) throw new StorageError('corrupt', 'Checkpoint checksum or length mismatch.');
  return text;
}
export async function unpack(packed: Packed): Promise<ProjectDoc> {
  const result = parseProject(await unpackText(packed));
  if (!result.ok) throw new StorageError('corrupt', result.errors[0]?.message ?? 'Saved project is invalid.');
  return result.document;
}
