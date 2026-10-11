import type { Rect } from './types';

/** Inclusive 1000-mm grid broad phase. Large entries stay in a bounded overflow list. */
export function candidatePairs(boxes: readonly Rect[]): [number, number][] {
  const cells = new Map<string, number[]>(); const large: number[] = [];
  const pairs = new Set<string>();
  const add = (a: number, b: number) => { if (a !== b) pairs.add(`${Math.min(a, b)},${Math.max(a, b)}`); };
  boxes.forEach((r, i) => {
    const x0 = Math.floor(r[0] / 1000), x1 = Math.floor(r[2] / 1000);
    const y0 = Math.floor(r[1] / 1000), y1 = Math.floor(r[3] / 1000);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > 4096) { large.push(i); return; }
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      const key = `${x},${y}`, bucket = cells.get(key) ?? [];
      for (const other of bucket) add(i, other);
      bucket.push(i); cells.set(key, bucket);
    }
  });
  for (const i of large) for (let j = 0; j < boxes.length; j++) add(i, j);
  return [...pairs].map(key => key.split(',').map(Number) as [number, number]).filter(([i, j]) => {
    const a = boxes[i]!, b = boxes[j]!;
    return a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
  }).sort(([a, b], [c, d]) => a - c || b - d);
}
