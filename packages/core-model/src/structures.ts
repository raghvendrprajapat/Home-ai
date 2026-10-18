import type { Floor, Junction, Roof, Stair, Wall } from './types';

/** Read-only views are enough: snapshots handed out by the store are deeply readonly. */
type PlanParts = { readonly junctions: readonly Readonly<Junction>[]; readonly walls: readonly Readonly<Wall>[] };
type WithFloors = PlanParts & { readonly floors: readonly Readonly<Floor>[] };

/**
 * FR-035 (D66) derived stair and roof geometry. Plan frame: X east, Y south (screen down), Z up, millimetres.
 * Results may be fractional (risers, roof rise); they are derived data and never written back to the model.
 */
export type PlanRect = readonly [x0: number, y0: number, x1: number, y1: number];
/** Unit climb direction for each stair rotation, clockwise on screen from north. */
export const STAIR_DIRECTIONS: Readonly<Record<Stair['rotationDeg'], readonly [number, number]>> = { 0: [0, -1], 90: [1, 0], 180: [0, 1], 270: [-1, 0] };
export const STRUCTURE_DISCLAIMER = 'Planning tool only, not construction, structural or building-code advice.';

export function stairFootprint(stair: Readonly<Pick<Stair, 'position' | 'rotationDeg' | 'width' | 'length'>>): PlanRect {
  const along = stair.rotationDeg % 180 === 0, hx = (along ? stair.width : stair.length) / 2, hy = (along ? stair.length : stair.width) / 2;
  return [stair.position.x - hx, stair.position.y - hy, stair.position.x + hx, stair.position.y + hy];
}
export const stairRiser = (stair: Pick<Stair, 'height' | 'steps'>) => stair.height / stair.steps;
export const stairTread = (stair: Pick<Stair, 'length' | 'steps'>) => stair.length / stair.steps;
/** Equal steps from the bottom (first) to the top (last); step i rises to (i + 1) risers. */
export function stairSteps(stair: Pick<Stair, 'position' | 'rotationDeg' | 'width' | 'length' | 'height' | 'steps'>): { rect: PlanRect; top: number }[] {
  const [dx, dy] = STAIR_DIRECTIONS[stair.rotationDeg], tread = stairTread(stair), half = stair.width / 2;
  const startX = stair.position.x - dx * stair.length / 2, startY = stair.position.y - dy * stair.length / 2;
  return Array.from({ length: stair.steps }, (_, i) => {
    const ax = startX + dx * i * tread, ay = startY + dy * i * tread, bx = startX + dx * (i + 1) * tread, by = startY + dy * (i + 1) * tread;
    const rect: PlanRect = dx === 0 ? [stair.position.x - half, Math.min(ay, by), stair.position.x + half, Math.max(ay, by)] : [Math.min(ax, bx), stair.position.y - half, Math.max(ax, bx), stair.position.y + half];
    return { rect, top: (i + 1) * stair.height / stair.steps };
  });
}

/** Outer rectangle of one floor's walls: each wall as its centreline widened by half its thickness on every side. */
export function floorOuterRect(document: PlanParts, floorId: string): PlanRect | null {
  const junctions = new Map(document.junctions.map(j => [j.id, j])), walls = document.walls.filter(w => w.floorId === floorId);
  if (!walls.length) return null;
  let rect: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const w of walls) {
    const a = junctions.get(w.a)!, b = junctions.get(w.b)!, t = w.thickness / 2;
    rect = [Math.min(rect[0], a.x - t, b.x - t), Math.min(rect[1], a.y - t, b.y - t), Math.max(rect[2], a.x + t, b.x + t), Math.max(rect[3], a.y + t, b.y + t)];
  }
  return rect;
}
export interface RoofShape { rect: PlanRect; base: number; rise: number }
/** The roof covers the floor's outer wall rectangle plus the overhang and rests on that floor's tallest wall. */
export function roofShape(document: WithFloors, roof: Pick<Roof, 'floorId' | 'kind' | 'pitchDeg' | 'overhang' | 'ridgeAxis'>): RoofShape | null {
  const outer = floorOuterRect(document, roof.floorId), floor = document.floors.find(f => f.id === roof.floorId);
  if (!outer || !floor) return null;
  const o = roof.overhang, rect: PlanRect = [outer[0] - o, outer[1] - o, outer[2] + o, outer[3] + o];
  const base = floor.elevation + Math.max(...document.walls.filter(w => w.floorId === roof.floorId).map(w => w.height));
  const halfSpan = (roof.ridgeAxis === 'x' ? rect[3] - rect[1] : rect[2] - rect[0]) / 2;
  return { rect, base, rise: roof.kind === 'gable' ? halfSpan * Math.tan(roof.pitchDeg * Math.PI / 180) : 0 };
}
