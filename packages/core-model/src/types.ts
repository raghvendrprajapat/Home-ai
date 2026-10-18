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
/**
 * FR-035 (D66) straight stair. `position` is the centre of its plan footprint; it climbs `height` mm in `steps` equal
 * risers over `length` mm. `rotationDeg` is the climb direction, clockwise on screen: 0 north (up the screen), 90 east.
 */
export interface Stair {
  id: string; floorId: string; position: { x: number; y: number }; rotationDeg: 0 | 90 | 180 | 270;
  width: number; length: number; height: number; steps: number; material: string; rev: number;
}
/** FR-035 (D66) roof over one floor's outer wall rectangle plus `overhang`, resting on top of that floor's walls. */
export interface Roof {
  id: string; floorId: string; kind: 'flat' | 'gable'; pitchDeg: number; overhang: number; ridgeAxis: 'x' | 'y'; material: string; rev: number;
}
export interface CameraPreset { id: string; name: string; mode: 'orbit' | 'walk'; position: number[]; target: number[] }
export interface ProjectDoc {
  schemaVersion: 1; id: string; name: string; units: 'metric' | 'imperial'; createdAt: string; updatedAt: string;
  revision: number; floors: Floor[]; junctions: Junction[]; walls: Wall[]; openings: Opening[];
  rooms: Room[]; furniture: FurnitureItem[]; materials: MaterialDef[]; lights: Light[]; cameras: CameraPreset[];
  /** FR-035: absent when the project has none, so older one-floor documents stay byte-identical. */
  stairs?: Stair[]; roofs?: Roof[];
}
export interface ValidationIssue { code: string; message: string; entityIds: string[] }
export interface AsyncTag { projectId: string; sessionId: string; localGeneration: number; dependencyHash: string }
