import { MAX_DOCUMENT_BYTES, parseProject } from '@gharplan/core-model';
import type { ParseResult } from '@gharplan/core-model';

/** Plain UTF-8 versioned JSON only; gzip/ZIP are not project-file formats. */
export function parseProjectFile(bytes: Uint8Array): ParseResult {
  if (!bytes.byteLength || bytes.byteLength > MAX_DOCUMENT_BYTES) return { ok: false, errors: [{ code: 'file-size', message: 'Choose a nonempty JSON file no larger than 10 MiB.', entityIds: [] }] };
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { return { ok: false, errors: [{ code: 'file-encoding', message: 'The backup must contain valid UTF-8 JSON.', entityIds: [] }] }; }
  return parseProject(text);
}
