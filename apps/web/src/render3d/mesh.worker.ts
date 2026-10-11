import { validateProject } from '@gharplan/core-model';
import { CachedSceneBuilder } from './mesh';
import type { BuildReply, BuildRequest } from './types';

const worker = globalThis as unknown as { onmessage: (event: { data: BuildRequest }) => void; postMessage(reply: BuildReply, transfers?: ArrayBuffer[]): void };
const builder = new CachedSceneBuilder();
worker.onmessage = ({ data }) => {
  try {
    const errors = validateProject(data.document);
    if (errors.length) throw new Error(errors[0]!.message);
    const bundle = builder.build(data.document);
    // Transfer copies: transferring the cached buffers themselves would detach future builds.
    const output = { ...bundle, meshes: bundle.meshes.map(m => ({ ...m, positions: m.positions.slice(), normals: m.normals.slice(), uv: m.uv.slice() })) };
    worker.postMessage({ tag: data.tag, ok: true, bundle: output }, output.meshes.flatMap(m => [m.positions.buffer, m.normals.buffer, m.uv.buffer] as ArrayBuffer[]));
  } catch (error) { worker.postMessage({ tag: data.tag, ok: false, message: error instanceof Error ? error.message : '3D geometry build failed.' }); }
};
