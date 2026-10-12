import { MAX_DOCUMENT_BYTES, parseProject, serializeProject } from '@gharplan/core-model';
import type { ProjectDoc } from '@gharplan/core-model';
import type { Immutable } from 'immer';
import { sha256 } from './codec';
import { assertHead, sameHead, StorageError, validId } from './types';
import type { Head } from './types';

export interface MirrorIo {
  list(path: string): Promise<string[]>; read(path: string, maximumBytes: number): Promise<string>;
  write(path: string, value: string): Promise<void>; rename(from: string, to: string): Promise<void>; remove(path: string): Promise<void>;
}
export interface MirrorCandidate { head: Head; document: ProjectDoc; warning: boolean }
interface Marker extends Head { storageVersion: 1; documentFile: string }
const root = 'gharplan-mirrors';
const fileName = (s: string): boolean => /^[A-Za-z0-9_.-]{2,200}$/.test(s) && !s.includes('..');
function eligibleMarker(marker: Marker, name: string, id: string): boolean {
  assertHead(marker);
  return marker.storageVersion === 1 && marker.projectId === id && fileName(marker.documentFile) &&
    marker.documentFile === name.replace(/\.ready\.json$/, '.json') && name.startsWith(`${marker.epoch}_${marker.seq}_`);
}
/** Immutable documents/ready markers survive a partial copy/delete rename.
 * A ready marker alone is insufficient: its complete document must validate.
 * No claim is made about OS power-loss/fsync durability.
 */
export class NativeMirror {
  #tail: Promise<void> = Promise.resolve();
  #warnings: string[] = [];
  constructor(readonly io: MirrorIo) {}
  getWarnings(): readonly string[] { return [...this.#warnings]; }
  async read(projectId?: string): Promise<MirrorCandidate[]> {
    this.#warnings = [];
    const directories = projectId ? [projectId] : await this.io.list(root);
    if (directories.length > 1000) throw new StorageError('size', 'Too many native recovery directories; original files are retained.');
    const candidates: MirrorCandidate[] = [];
    for (const id of directories.filter(validId)) {
      let names: string[];
      try {
        names = await this.io.list(`${root}/${id}`);
        if (names.length > 600) throw new StorageError('size', 'Native recovery directory exceeds its scan limit.');
      } catch { this.#warnings.push('A phone backup directory is unreadable or exceeds its scan limit. Its files are retained; other validated backups remain available.'); continue; }
      const valid: MirrorCandidate[] = []; let damaged = false;
      for (const name of names.filter(n => n.endsWith('.ready.json'))) {
        if (!fileName(name)) { damaged = true; continue; }
        try {
          const marker: Marker = JSON.parse(await this.io.read(`${root}/${id}/${name}`, 2048)); assertHead(marker);
          if (!eligibleMarker(marker, name, id)) throw new StorageError('corrupt', 'Invalid or unsupported native mirror marker.');
          const text = await this.io.read(`${root}/${id}/${marker.documentFile}`, MAX_DOCUMENT_BYTES);
          if (await sha256(text) !== marker.hash) throw new StorageError('corrupt', 'Native mirror checksum differs.');
          const parsed = parseProject(text);
          if (!parsed.ok || parsed.document.id !== id) throw new StorageError('corrupt', 'Native drawing is invalid.');
          valid.push({ head: { projectId: id, epoch: marker.epoch, seq: marker.seq, hash: marker.hash }, document: parsed.document, warning: false });
        } catch { damaged = true; }
      }
      if (!valid.length && names.some(n => n.endsWith('.ready.json'))) { this.#warnings.push('A phone backup is damaged or unsupported. Its files are retained; other validated backups remain available.'); continue; }
      if (damaged) this.#warnings.push('Some phone backup files are damaged or unsupported and remain untouched.');
      // Sequence order is meaningful only within an epoch, never across epochs.
      const epochs = new Set(valid.map(c => c.head.epoch));
      for (const epoch of epochs) {
        const group = valid.filter(c => c.head.epoch === epoch), seq = Math.max(...group.map(c => c.head.seq));
        const newest = group.filter(c => c.head.seq === seq);
        for (const c of newest) if (!candidates.some(p => sameHead(p.head, c.head))) candidates.push({ ...c, warning: damaged });
      }
    }
    if (!candidates.length && this.#warnings.length) throw new StorageError('corrupt', this.#warnings[0]!);
    return candidates;
  }
  write(head: Head, document: Immutable<ProjectDoc>): Promise<void> {
    // Serialization covers both I/O and pruning, so a delayed old write cannot
    // finish/prune after a newer write from this editor's single mirror instance.
    const operation = this.#tail.then(() => this.#write(head, document));
    this.#tail = operation.catch(() => undefined); return operation;
  }
  async #write(head: Head, document: Immutable<ProjectDoc>): Promise<void> {
    assertHead(head); const text = serializeProject(document);
    if (document.id !== head.projectId || await sha256(text) !== head.hash || !parseProject(text).ok) throw new StorageError('corrupt', 'Native save does not match its validated drawing.');
    const existing = await this.read(head.projectId), sameEpoch = existing.filter(c => c.head.epoch === head.epoch);
    if (sameEpoch.some(c => c.head.seq > head.seq || c.head.seq === head.seq && c.head.hash !== head.hash)) throw new StorageError('conflict', 'Native mirror has a different or newer head. Both drawings are retained.');
    if (sameEpoch.some(c => sameHead(c.head, head))) return;
    if (existing.some(c => c.head.epoch !== head.epoch)) throw new StorageError('conflict', 'Native mirror epoch differs; choose a recovery copy instead of overwriting.');
    const folder = `${root}/${head.projectId}`, stem = `${head.epoch}_${head.seq}_${crypto.randomUUID()}`, documentFile = `${stem}.json`, ready = `${stem}.ready.json`;
    await this.io.write(`${folder}/${documentFile}.tmp`, text);
    await this.io.rename(`${folder}/${documentFile}.tmp`, `${folder}/${documentFile}`);
    if (await this.io.read(`${folder}/${documentFile}`, MAX_DOCUMENT_BYTES) !== text) throw new StorageError('io', 'Native drawing readback failed. Previous backup is retained.');
    const marker: Marker = { ...head, storageVersion: 1, documentFile }, encoded = JSON.stringify(marker);
    await this.io.write(`${folder}/${ready}.tmp`, encoded); await this.io.rename(`${folder}/${ready}.tmp`, `${folder}/${ready}`);
    if (await this.io.read(`${folder}/${ready}`, 2048) !== encoded) throw new StorageError('io', 'Native commit-marker readback failed.');
    // Keep the two newest validated markers in this epoch. Unknown/invalid
    // files are never removed here; a failure retains them for recovery/support.
    const names = await this.io.list(folder), records: { name: string; marker: Marker }[] = []; let preserveFolder = false;
    for (const name of names.filter(n => n.endsWith('.ready.json'))) {
      if (!fileName(name)) { preserveFolder = true; continue; }
      try {
        const m: Marker = JSON.parse(await this.io.read(`${folder}/${name}`, 2048)); assertHead(m);
        if (eligibleMarker(m, name, head.projectId) && m.epoch === head.epoch) {
          const saved = await this.io.read(`${folder}/${m.documentFile}`, MAX_DOCUMENT_BYTES);
          const parsed = parseProject(saved);
          if (await sha256(saved) === m.hash && parsed.ok && parsed.document.id === m.projectId) records.push({ name, marker: m });
          else preserveFolder = true;
        } else preserveFolder = true;
      } catch { preserveFolder = true; /* Preserve damaged/partial files and any referenced documents. */ }
    }
    // Unsupported or malformed markers might reference older documents. Until
    // their format is understood, preserve the whole folder instead of guessing
    // which referenced original can be deleted safely.
    if (preserveFolder) return;
    records.sort((a, b) => b.marker.seq - a.marker.seq);
    for (const record of records.slice(2)) {
      // Remove the obsolete marker first; a failed cleanup leaves a harmless
      // orphan document, never a dangling ready marker for a current backup.
      try { await this.io.remove(`${folder}/${record.name}`); await this.io.remove(`${folder}/${record.marker.documentFile}`); } catch { /* Cleanup is not the commit acknowledgment. */ }
    }
  }
}
export async function capacitorMirror(): Promise<NativeMirror> {
  const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
  const directory = Directory.Data;
  const io: MirrorIo = {
    list: async path => {
      try { return (await Filesystem.readdir({ path, directory })).files.map(f => f.name); }
      catch (e) { if (e && typeof e === 'object' && 'code' in e && e.code === 'OS-PLUG-FILE-0008') return []; throw e; }
    },
    read: async (path, maximumBytes) => {
      const info = await Filesystem.stat({ path, directory });
      if (info.type !== 'file' || !Number.isFinite(info.size) || info.size < 0 || info.size > maximumBytes) throw new StorageError('size', 'Native file exceeds its size limit.');
      const data = (await Filesystem.readFile({ path, directory, encoding: Encoding.UTF8 })).data;
      if (typeof data !== 'string' || new TextEncoder().encode(data).byteLength > maximumBytes) throw new StorageError('size', 'Native file exceeds its read limit.'); return data;
    },
    write: async (path, data) => { await Filesystem.writeFile({ path, directory, data, encoding: Encoding.UTF8, recursive: true }); },
    rename: async (from, to) => { await Filesystem.rename({ from, to, directory }); },
    remove: async path => { await Filesystem.deleteFile({ path, directory }); },
  };
  return new NativeMirror(io);
}
