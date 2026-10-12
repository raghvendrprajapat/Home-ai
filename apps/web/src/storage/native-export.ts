import { registerPlugin } from '@capacitor/core';
import { MAX_DOCUMENT_BYTES, parseProject, utf8Bytes } from '@gharplan/core-model';
import { sha256 } from '@gharplan/persistence';
export interface NativeExportReceipt { verified: boolean; bytes: number; sha256: string }
export interface NativeExportIo {
  write(path: string, text: string): Promise<void>; read(path: string): Promise<string>; remove(path: string): Promise<void>;
  save(input: { path: string; bytes: number; sha256: string }): Promise<NativeExportReceipt>;
}
const ProjectFiles = registerPlugin<{ save(input: { path: string; bytes: number; sha256: string }): Promise<NativeExportReceipt> }>('ProjectFiles');
const nativeIo: NativeExportIo = {
  write: async (path, text) => {
    const { Directory, Encoding, Filesystem } = await import('@capacitor/filesystem');
    try { if ((await Filesystem.readdir({ path: 'exports', directory: Directory.Cache })).files.length >= 32) throw new Error('Export cache is full. Copy JSON; retained data was not removed.'); }
    catch (e) { if (!e || typeof e !== 'object' || !('code' in e) || e.code !== 'OS-PLUG-FILE-0008') throw e; }
    await Filesystem.writeFile({ path, directory: Directory.Cache, encoding: Encoding.UTF8, data: text, recursive: true });
  },
  read: async path => { const { Directory, Encoding, Filesystem } = await import('@capacitor/filesystem'); const data = (await Filesystem.readFile({ path, directory: Directory.Cache, encoding: Encoding.UTF8 })).data; if (typeof data !== 'string') throw new Error('Export cache read failed.'); return data; },
  remove: async path => { const { Directory, Filesystem } = await import('@capacitor/filesystem'); await Filesystem.deleteFile({ path, directory: Directory.Cache }); },
  save: input => ProjectFiles.save(input),
};
/** Private cache is a transport source, never the canonical private mirror. */
export async function exportNativeProject(text: string, io: NativeExportIo = nativeIo): Promise<NativeExportReceipt> {
  const bytes = utf8Bytes(text); if (bytes < 1 || bytes > MAX_DOCUMENT_BYTES || !parseProject(text).ok) throw new Error('Invalid export document.');
  const path = `exports/gharplan-${crypto.randomUUID().replaceAll('-', '')}.json`;
  try {
    await io.write(path, text); if (await io.read(path) !== text) throw new Error('Export cache readback differs.');
    const hash = await sha256(text), receipt = await io.save({ path, bytes, sha256: hash });
    if (receipt.verified !== true || receipt.bytes !== bytes || receipt.sha256 !== hash) throw new Error('Native destination was not verified.');
    return receipt;
  } finally {
    // Transport cleanup must not delay a verified receipt or a failed/cancelled
    // export. Unique paths prevent it touching a newer export or canonical data.
    void Promise.resolve().then(() => io.remove(path)).catch(() => { /* Retain an orphan; cache admission is bounded. */ });
  }
}
