import type { AsyncTag, ProjectDoc } from '@gharplan/core-model';

/** Renderer-owned derived buffers. Coordinates are metres in Three's X/Y/Z frame. */
export interface MeshData {
  id: string; entityId: string; category: 'wall' | 'floor' | 'threshold';
  positions: Float64Array; normals: Float32Array; uv: Float32Array;
  groups: { start: number; count: number; materialId: string }[];
}
export interface SceneBundle {
  meshes: MeshData[];
  bounds: [number, number, number, number, number, number] | null;
  stats: { boxes: number; quads: number; vertices: number; wallVolumeMm3: number; meshesBuilt: number };
}
export interface BuildRequest { tag: AsyncTag; document: ProjectDoc }
export type BuildReply = { tag: AsyncTag; ok: true; bundle: SceneBundle } | { tag: AsyncTag; ok: false; message: string };
