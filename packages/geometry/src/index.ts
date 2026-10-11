import { assignRooms } from './identity';
import { derivePlan } from './derive';
import { normalizePlan, validateInputs } from './graph';
import { assertCoordinate, freshId } from './primitives';
import { GeometryError } from './types';
import type { GeometryResult, Operation, Plan, Point } from './types';

export * from './types';
export * from './primitives';
export * from './graph';
export * from './derive';
export * from './regions';
export * from './spatial';

/** Pure candidate transaction; core-model is the sole committer of canonical state. */
export function applyGeometry(input: Plan, operation: Operation): GeometryResult {
  try {
    if (!['analyze', 'validate', 'addWall', 'moveJunctions', 'deleteWall'].includes(operation.op))
      throw new GeometryError('operation', 'Unsupported geometry operation.');
    validateInputs(input);
    if (operation.op === 'analyze' || operation.op === 'validate') {
      const derived = derivePlan(input);
      const assigned = assignRooms(input, input, derived);
      return { accepted: true, plan: input, derived, lineage: [], checkRoomNamesHint: assigned.checkRoomNamesHint };
    }
    const plan: Plan = { junctions: input.junctions.map(j => ({ ...j })), walls: input.walls.map(w => ({ ...w })), rooms: input.rooms.map(r => ({ ...r, boundary: [...r.boundary] })) };
    if (operation.op === 'addWall') {
      for (const value of [...operation.from, ...operation.to]) assertCoordinate(value);
      const floorId = operation.floorId ?? input.junctions[0]?.floorId ?? 'f0';
      const used = new Set([...plan.junctions, ...plan.walls, ...plan.rooms].map(e => e.id));
      const endpoint = (p: Point): string => {
        const old = plan.junctions.find(j => j.floorId === floorId && j.x === p[0] && j.y === p[1]);
        if (old) return old.id;
        const id = freshId('junction', used); plan.junctions.push({ id, floorId, x: p[0], y: p[1] }); return id;
      };
      plan.walls.push({ id: freshId('wall', used), floorId, a: endpoint(operation.from), b: endpoint(operation.to),
        thickness: operation.thickness, height: operation.height, leftMaterial: operation.leftMaterial ?? 'm_default',
        rightMaterial: operation.rightMaterial ?? 'm_default', rev: 0 });
    } else if (operation.op === 'moveJunctions') {
      const moved = new Set<string>();
      for (const move of operation.moves) {
        assertCoordinate(move.to[0]); assertCoordinate(move.to[1]);
        if (moved.has(move.junction)) throw new GeometryError('duplicate-move', 'A junction may be moved only once per transaction.');
        moved.add(move.junction);
        const j = plan.junctions.find(j => j.id === move.junction);
        if (!j) throw new GeometryError('junction', 'The moved junction does not exist.', [move.junction]);
        j.x = move.to[0]; j.y = move.to[1];
      }
    } else if (operation.op === 'deleteWall') {
      if (!plan.walls.some(w => w.id === operation.wall)) throw new GeometryError('wall', 'The deleted wall does not exist.', [operation.wall]);
      plan.walls = plan.walls.filter(w => w.id !== operation.wall);
    }
    const normalized = normalizePlan(plan), derived = derivePlan(normalized.plan);
    const assigned = assignRooms(input, normalized.plan, derived);
    normalized.plan.rooms = assigned.rooms;
    // Exact duplicate/contained additions are canonical no-ops, including entity order and IDs.
    const sameWalls = JSON.stringify(normalized.plan.walls) === JSON.stringify(input.walls);
    const sameGeometry = sameWalls && (operation.op === 'addWall' ||
      JSON.stringify(normalized.plan.junctions) === JSON.stringify(input.junctions));
    return { accepted: true, plan: sameGeometry ? input : normalized.plan, derived,
      lineage: normalized.lineage, checkRoomNamesHint: assigned.checkRoomNamesHint };
  } catch (error) {
    if (!(error instanceof GeometryError)) throw error;
    return { accepted: false, plan: input, error };
  }
}
