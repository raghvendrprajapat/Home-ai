import { sameHead } from './types';
import type { Recovered } from './types';
import type { MirrorCandidate } from './native-mirror';

/** No timestamp-based choice between divergent epochs or equal-seq hashes. */
export function canOpenLocalAutomatically(local: Recovered | null, mirrors: readonly MirrorCandidate[]): boolean {
  if (!local || !local.complete || local.warning || local.journalNewer) return false;
  return mirrors.every(m => !m.warning && m.head.projectId === local.head.projectId && m.head.epoch === local.head.epoch &&
    (m.head.seq < local.head.seq || sameHead(m.head, local.head)));
}
