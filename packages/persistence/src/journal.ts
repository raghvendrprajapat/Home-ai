import { MAX_DOCUMENT_BYTES, parseProject, proposeRoomRepair, serializeProject, validateProject } from '@gharplan/core-model';
import type { ModelChange } from '@gharplan/core-model';
import { applyPatches, enablePatches } from 'immer';
import type { Immutable, Patch } from 'immer';
import { pack, sha256, unpackText } from './codec';
import { assertHead, assertMeta, StorageError } from './types';
import type { Bundle, Checkpoint, Journal, Prepared, ProjectMeta, Recovered } from './types';

enablePatches();
export function checkedPatches(value: unknown): Patch[] {
  if (!Array.isArray(value) || value.length > 100000 || new TextEncoder().encode(JSON.stringify(value)).byteLength > MAX_DOCUMENT_BYTES)
    throw new StorageError('size', 'Journal patch count or bytes exceed the supported limit.');
  for (const p of value) {
    if (!p || !['add', 'replace', 'remove'].includes(p.op) || !Array.isArray(p.path) || p.path.length > 64 ||
      p.path.some((part: unknown) => typeof part === 'number' ? !Number.isSafeInteger(part) || part < 0 :
        typeof part !== 'string' || ['__proto__', 'prototype', 'constructor'].includes(part)))
      throw new StorageError('corrupt', 'Unsafe or unsupported journal patch.');
  }
  return value as Patch[];
}
export async function prepare(meta: ProjectMeta, changes: readonly Immutable<ModelChange>[], now = Date.now()): Promise<Prepared> {
  assertMeta(meta); if (!changes.length) throw new StorageError('io', 'A save needs at least one model change.');
  let hash = meta.hash, seq = meta.seq, checkpointSeq = meta.checkpointSeqs[0]!;
  const entries: Journal[] = [], checkpoints: Checkpoint[] = [];
  for (const change of changes) {
    if (change.document.id !== meta.projectId) throw new StorageError('conflict', 'The drawing changed while saving.');
    if (!Number.isSafeInteger(++seq)) throw new StorageError('size', 'Local sequence limit reached.');
    const next = await sha256(serializeProject(change.document));
    entries.push({ projectId: meta.projectId, epoch: meta.epoch, seq, hash: next, beforeHash: hash, patches: checkedPatches(change.patches) }); hash = next;
    if (seq - checkpointSeq >= 50) {
      checkpoints.push({ projectId: meta.projectId, epoch: meta.epoch, seq, hash, packed: await pack(change.document) }); checkpointSeq = seq;
    }
  }
  const document = changes.at(-1)!.document;
  if (!checkpoints.length && now - meta.checkpointAt >= 30000) checkpoints.push({ projectId: meta.projectId, epoch: meta.epoch, seq, hash, packed: await pack(document) });
  const checkpointSeqs = [...checkpoints.map(c => c.seq), ...meta.checkpointSeqs].sort((a, b) => b - a).slice(0, 2);
  return { expected: { projectId: meta.projectId, epoch: meta.epoch, seq: meta.seq, hash: meta.hash },
    meta: { ...meta, seq, hash, name: document.name, savedAt: new Date(now).toISOString(), checkpointSeqs, checkpointAt: checkpoints.length ? now : meta.checkpointAt },
    entries, checkpoints, document };
}
/** Validation occurs before any replacement of the live model or stored bytes. */
export async function recover(bundle: Bundle): Promise<Recovered> {
  assertMeta(bundle.meta);
  if (bundle.checkpoints.length > 2 || bundle.journal.length > 100) throw new StorageError('size', 'Local journal/checkpoint retention limit exceeded.');
  const { meta } = bundle;
  let best: Recovered | null = null, damagedCheckpoint = false;
  for (const number of meta.checkpointSeqs) {
    try {
      const checkpoint = bundle.checkpoints.find(c => c.seq === number);
      if (!checkpoint) throw new StorageError('corrupt', 'A checkpoint is missing.');
      assertHead(checkpoint);
      if (checkpoint.projectId !== meta.projectId || checkpoint.epoch !== meta.epoch || checkpoint.hash !== checkpoint.packed.hash) throw new StorageError('corrupt', 'Checkpoint identity mismatch.');
      const text = await unpackText(checkpoint.packed), parsed = parseProject(text);
      if (!parsed.ok) {
        damagedCheckpoint = true;
        const repaired = proposeRoomRepair(text);
        if (!repaired || repaired.id !== meta.projectId) throw new StorageError('corrupt', 'Checkpoint project validation or identity failed.');
        const proposal: Recovered = { document: repaired, head: { projectId: meta.projectId, epoch: meta.epoch, seq: checkpoint.seq, hash: await sha256(serializeProject(repaired)) },
          complete: false, journalNewer: false, roomRepair: true, warning: 'Room boundaries can be rebuilt from valid walls. Some room names/materials may reset; later journal entries are not applied. Accept only as a separate recovery copy.', bundle };
        if (!best || proposal.head.seq > best.head.seq) best = proposal;
        continue;
      }
      let document = parsed.document, hash = checkpoint.hash, seq = checkpoint.seq;
      if (document.id !== meta.projectId) throw new StorageError('corrupt', 'Checkpoint project ID mismatch.');
      let warning: string | null = null;
      while (seq < meta.seq) {
        try {
          const matches = bundle.journal.filter(e => e.seq === seq + 1);
          if (matches.length !== 1) throw new StorageError('corrupt', 'Journal is missing or duplicated.');
          const entry = matches[0]!; assertHead(entry);
          if (entry.projectId !== meta.projectId || entry.epoch !== meta.epoch || entry.beforeHash !== hash) throw new StorageError('corrupt', 'Journal sequence or checksum chain is broken.');
          const candidate = applyPatches(document, checkedPatches(entry.patches));
          const errors = validateProject(candidate);
          if (errors.length || candidate.id !== meta.projectId) throw new StorageError('corrupt', errors[0]?.message ?? 'Journal changes the project identity.');
          if (await sha256(serializeProject(candidate)) !== entry.hash) throw new StorageError('corrupt', 'Journal checksum mismatch.');
          document = candidate; hash = entry.hash; seq = entry.seq;
        } catch { warning = 'Some recent saved changes are damaged. Original bytes are retained; the last valid drawing can be recovered as a copy.'; break; }
      }
      const complete = seq === meta.seq && hash === meta.hash;
      const result: Recovered = { document, head: { projectId: meta.projectId, epoch: meta.epoch, seq, hash }, complete,
        journalNewer: seq > checkpoint.seq, warning: damagedCheckpoint ? 'A newer checkpoint is damaged. Recover the validated drawing as a copy; original data remains untouched.' : complete ? null : warning ?? 'Saved head checksum differs. Recover a copy without replacing the original.', bundle };
      if (!best || result.head.seq > best.head.seq || complete) best = result;
      if (complete) return result;
    } catch { damagedCheckpoint = true; /* Try the older retained checkpoint; never rewrite damaged bytes. */ }
  }
  if (!best) throw new StorageError('corrupt', 'No valid local checkpoint remains. Original data is retained; import a backup or use a separate sample.');
  return best;
}
