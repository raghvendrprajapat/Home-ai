import type { ProjectDoc } from '@gharplan/core-model';
import sample from '../../../../docs/examples/sample-project.json';

/** Codex-generated analytic workload: isolated orthogonal rooms, dimensioned boxes. */
export function perfFixture(kind: 'sample' | 'large'): ProjectDoc {
  const p = structuredClone(sample) as ProjectDoc;
  if (kind === 'sample') return p;
  p.id = 'prj_perf_200'; p.name = 'Performance: 200 walls / 100 objects'; p.revision = 0;
  p.junctions = []; p.walls = []; p.rooms = []; p.openings = []; p.furniture = []; p.lights = []; p.cameras = [];
  for (let i = 0; i < 50; i++) {
    const x = (i % 10) * 5000, y = Math.floor(i / 10) * 4000, ids = [0, 1, 2, 3].map(n => `pj_${i}_${n}`);
    for (const [n, dx, dy] of [[0, 0, 0], [1, 4000, 0], [2, 4000, 3000], [3, 0, 3000]])
      p.junctions.push({ id: ids[n!]!, floorId: 'f0', x: x + dx!, y: y + dy! });
    for (let n = 0; n < 4; n++) p.walls.push({ ...sample.walls[0]!, id: `pw_${i}_${n}`, a: ids[n]!, b: ids[(n + 1) % 4]!, thickness: 200 });
    p.rooms.push({ ...sample.rooms[0]!, id: `pr_${i}`, boundary: ids, name: `Test room ${i + 1}` });
    for (let n = 0; n < 2; n++) p.furniture.push({ ...sample.furniture[0]!, id: `pf_${i}_${n}`, position: { x: x + 1200 + n * 1600, y: y + 1500 }, rotationDeg: 0,
      size: { w: 800, d: 600, h: 700 }, materialOverrides: {} });
  }
  return p;
}
