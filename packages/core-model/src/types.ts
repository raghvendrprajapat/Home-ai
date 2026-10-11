import type { Junction, Room, Wall } from '@gharplan/geometry';
export type { Junction, Room, Wall };
export type RoomType = 'living' | 'bedroom' | 'kitchen' | 'bathroom' | 'dining' | 'pooja' | 'balcony' | 'utility' | 'hall' | 'study' | 'other';
export interface Floor { id: string; name: string; level: number; elevation: number; defaultWallHeight: number }
export interface Opening {
  id: string; wallId: string; kind: 'door' | 'window' | 'opening'; assetId: string;
  offset: number; width: number; height: number; sill: number; flipX: boolean; flipY: boolean; rev: number;
}
export interface FurnitureItem {
  id: string; floorId: string; assetId: string; assetVersion: number;
  position: { x: number; y: number }; elevation: number; rotationDeg: number;
  size: { w: number; d: number; h: number }; materialOverrides: Record<string, string>; groupId?: string; rev: number;
}
export interface MaterialDef {
  id: string; name: string; baseColor: string; textureAssetId?: string; uvScaleMm?: number; roughness: number; metalness: number;
}
export interface Light {
  id: string; floorId: string; kind: 'point' | 'spot' | 'strip' | 'ambient'; position: { x: number; y: number };
  height: number; lumens: number; colorTempK: number; castsShadow: boolean; fixtureAssetId?: string; rev: number;
}
export interface CameraPreset { id: string; name: string; mode: 'orbit' | 'walk'; position: number[]; target: number[] }
export interface ProjectDoc {
  schemaVersion: 1; id: string; name: string; units: 'metric' | 'imperial'; createdAt: string; updatedAt: string;
  revision: number; floors: Floor[]; junctions: Junction[]; walls: Wall[]; openings: Opening[];
  rooms: Room[]; furniture: FurnitureItem[]; materials: MaterialDef[]; lights: Light[]; cameras: CameraPreset[];
}
export interface ValidationIssue { code: string; message: string; entityIds: string[] }
export interface AsyncTag { projectId: string; sessionId: string; localGeneration: number; dependencyHash: string }
