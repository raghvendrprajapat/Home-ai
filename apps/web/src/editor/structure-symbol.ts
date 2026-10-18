import { roofShape, STAIR_DIRECTIONS, stairFootprint, stairSteps } from '@gharplan/core-model';
import type { PlanRect, Stair } from '@gharplan/core-model';
import type { Point2 } from './view2d';

/**
 * FR-035 (D66) 2D plan symbols, in plan millimetres. A stair is its footprint, one line per riser between treads
 * and an arrow pointing up the climb from the bottom step's middle to the top edge (the usual plan convention).
 */
export interface StairSymbol { outline: PlanRect; risers: [Point2, Point2][]; arrow: [Point2, Point2] }
export function stairSymbol(stair: Pick<Stair, 'position' | 'rotationDeg' | 'width' | 'length' | 'height' | 'steps'>): StairSymbol {
  const steps = stairSteps(stair), [dx, dy] = STAIR_DIRECTIONS[stair.rotationDeg];
  // The edge shared by step i and step i + 1, on the side facing the climb.
  const risers = steps.slice(0, -1).map(({ rect: [x0, y0, x1, y1] }): [Point2, Point2] =>
    dx === 0 ? (dy < 0 ? [[x0, y0], [x1, y0]] : [[x0, y1], [x1, y1]]) : dx > 0 ? [[x1, y0], [x1, y1]] : [[x0, y0], [x0, y1]]);
  const half = stair.length / 2, tread = stair.length / stair.steps, { x, y } = stair.position;
  return { outline: stairFootprint(stair), risers, arrow: [[x - dx * (half - tread / 2), y - dy * (half - tread / 2)], [x + dx * half, y + dy * half]] };
}
/** The dashed roof edge shown on its floor's plan, or null when the floor has no walls yet. */
export function roofOutline(document: Parameters<typeof roofShape>[0], roof: Parameters<typeof roofShape>[1]): PlanRect | null {
  return roofShape(document, roof)?.rect ?? null;
}
