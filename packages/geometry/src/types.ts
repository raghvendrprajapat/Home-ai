/** Canonical integer-mm inputs; rectangles/polygons below are derived half-mm data. */
export type Point = readonly [number, number];
export type Rect = readonly [number, number, number, number];
export interface Junction { id: string; floorId: string; x: number; y: number }
export interface Wall {
  id: string; floorId: string; a: string; b: string; thickness: number; height: number;
  leftMaterial: string; rightMaterial: string; rev: number;
}
export interface Room {
  id: string; floorId: string; boundary: string[]; name: string; type: string;
  ceilingHeight: number; floorMaterial: string; rev: number;
}
export interface Plan { junctions: Junction[]; walls: Wall[]; rooms: Room[] }
export interface Face {
  boundary: string[]; corners: Point[]; centrelineSignedAreaMm2: number;
  clearRects: Rect[]; clearPolygons: Point[][]; clearAreaMm2: number;
  clearRect: Rect; smallSpaceWarning: boolean; roomId: string;
}
export interface FootprintPiece { ownerId: string; rect: Rect }
export interface DerivedPlan {
  faces: Face[]; footprints: FootprintPiece[];
  footprintUnionAreaMm2: number; outerBoundaryRect: Rect | null;
}
export interface LineageChild { id: string; start: number; end: number; reversed: boolean }
export interface Lineage { wallId: string; children: LineageChild[] }
export type Operation =
  | { op: 'analyze' | 'validate' }
  | { op: 'addWall'; from: Point; to: Point; thickness: number; height: number; floorId?: string; leftMaterial?: string; rightMaterial?: string }
  | { op: 'moveJunctions'; moves: { junction: string; to: Point }[] }
  | { op: 'deleteWall'; wall: string };
export type GeometryResult =
  | { accepted: true; plan: Plan; derived: DerivedPlan; lineage: Lineage[]; checkRoomNamesHint: boolean }
  | { accepted: false; plan: Plan; error: GeometryError };
export class GeometryError extends Error {
  constructor(public readonly code: string, message: string, public readonly entityIds: string[] = []) {
    super(message); this.name = 'GeometryError';
  }
}
export const MIN_WALL_LENGTH = 10;
export const DOMAIN = 100_000;
export const SMALL_SPACE_AREA = 250_000;
