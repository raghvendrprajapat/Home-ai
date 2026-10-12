import type { ProjectDoc } from '@gharplan/core-model';
import type { Immutable, Patch } from 'immer';

export class StorageError extends Error {
  constructor(readonly kind: 'unavailable' | 'conflict' | 'corrupt' | 'size' | 'io', message: string) { super(message); }
}
export interface Head { projectId: string; epoch: string; seq: number; hash: string }
export interface ProjectMeta extends Head {
  storageVersion: 1; name: string; savedAt: string; checkpointSeqs: number[]; checkpointAt: number;
  trashedAt?: string;
}
export interface Packed { codec: 'json' | 'gzip'; blob: Blob; hash: string; bytes: number }
export interface Checkpoint extends Head { packed: Packed }
export interface Journal extends Head { beforeHash: string; patches: readonly Patch[] }
export interface Bundle { meta: ProjectMeta; checkpoints: Checkpoint[]; journal: Journal[] }
export interface Recovered {
  document: ProjectDoc; head: Head; complete: boolean; journalNewer: boolean;
  warning: string | null; bundle: Bundle;
  roomRepair?: true;
}
export interface Prepared {
  expected: Head; meta: ProjectMeta; entries: Journal[]; checkpoints: Checkpoint[];
  document: Immutable<ProjectDoc>;
}
export const sameHead = (a: Head, b: Head): boolean => a.projectId === b.projectId && a.epoch === b.epoch && a.seq === b.seq && a.hash === b.hash;
export const validId = (s: unknown): s is string => typeof s === 'string' && /^[A-Za-z0-9_-]{2,40}$/.test(s);
export function assertHead(value: Head): void {
  if (!value || !validId(value.projectId) || typeof value.epoch !== 'string' || !/^[A-Za-z0-9_-]{2,80}$/.test(value.epoch) ||
      !Number.isSafeInteger(value.seq) || value.seq < 0 || typeof value.hash !== 'string' || !/^[a-f0-9]{64}$/.test(value.hash))
    throw new StorageError('corrupt', 'Invalid local save identity, sequence or checksum.');
}
export function assertMeta(meta: ProjectMeta): void {
  assertHead(meta);
  if (meta.storageVersion !== 1 || !Array.isArray(meta.checkpointSeqs) || meta.checkpointSeqs.length < 1 || meta.checkpointSeqs.length > 2 ||
      !meta.checkpointSeqs.every((n, i, all) => Number.isSafeInteger(n) && n >= 0 && n <= meta.seq && (i === 0 || n < all[i - 1]!)) ||
      !Number.isFinite(meta.checkpointAt) || typeof meta.savedAt !== 'string' || typeof meta.name !== 'string' ||
      meta.trashedAt !== undefined && (typeof meta.trashedAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(meta.trashedAt) || !Number.isFinite(Date.parse(meta.trashedAt))))
    throw new StorageError('corrupt', 'Unsupported or corrupt local save metadata. Original data is retained.');
}
