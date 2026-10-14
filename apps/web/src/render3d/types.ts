import type { AsyncTag, ProjectDoc } from '@gharplan/core-model';

/** Renderer-owned derived buffers. Coordinates are metres in Three's X/Y/Z frame. */
export interface MeshData {
  id: string; entityId: string; category: 'wall' | 'floor' | 'threshold' | 'ceiling';
  positions: Float64Array; normals: Float32Array; uv: Float32Array;
  groups: { start: number; count: number; materialId: string }[];
}
export interface CeilingWarning {roomIds:[string,string];wallIds:string[];heightsMm:[number,number]}
export interface SceneBundle {
  invalidation?: import('./dependencies').SceneInvalidation;
  ceilingWarnings?: CeilingWarning[];
  meshes: MeshData[];
  bounds: [number, number, number, number, number, number] | null;
  stats: { boxes: number; quads: number; vertices: number; wallVolumeMm3: number; meshesBuilt: number };
}
export interface BuildRequest { requestId:number; tag: AsyncTag; document: ProjectDoc }
export type BuildReply = { requestId:number; tag: AsyncTag; ok: true; bundle: SceneBundle } | { requestId:number; tag: AsyncTag; ok: false; message: string };
