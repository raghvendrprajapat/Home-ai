import type { AsyncTag, ProjectDoc } from '@gharplan/core-model';

/** App supplies immutable catalog pins; renderer never imports catalog/storage. */
export interface FurnitureAssetData {
  id:string;version:number;lod:0|1;sha256:string;bytes:ArrayBuffer;
  dims:Readonly<{w:number;d:number;h:number}>;triangles:number;
}
export interface FurnitureAssetSource {
  load(id:string,version:number,lod:0|1,signal:AbortSignal,onProgress:(received:number,total:number|undefined)=>void):Promise<FurnitureAssetData>;
}

export interface MaterialRange {start:number;count:number;slot:'left'|'right'|'floor'|'threshold'|'ceiling'}

/** Renderer-owned derived buffers. Coordinates are metres in Three's X/Y/Z frame. */
export interface MeshData {
  id: string; entityId: string; category: 'wall' | 'floor' | 'threshold' | 'ceiling';
  positions: Float64Array; normals: Float32Array; uv: Float32Array;
  groups: { start: number; count: number; materialId: string }[];
  materialRanges?: MaterialRange[];
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
export interface ThreeControlsApi {
 pose():import('./camera').CameraPose;
 restore(pose:import('./camera').CameraPose):void;
 reset():void;
 focus(entityId:string):void;
 capture(edge:1000|2000,copy:(canvas:HTMLCanvasElement)=>Uint8ClampedArray):import('./capture').CapturedPixels;
}
