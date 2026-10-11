import { expect, it } from 'vitest';
import fc from 'fast-check';
import { ProjectStore, validateProject } from '@gharplan/core-model';
import { buildScene } from '../render3d/mesh';
import { perfFixture } from './fixtures';
import { BenchmarkRun, heapReading, percentiles } from './metrics';
import type { RenderReading } from './metrics';

const frame = (at: number, generation: number): RenderReading => ({ at, generation, drawCalls: 40, triangles: 100, geometries: 10, textures: 0, renderer: 'test-only', graphicsVersion: 'test-only' });
it('large workload is valid, deterministic and has exact independent analytic room/furniture counts', () => {
  const document = perfFixture('large'); expect(document).toEqual(perfFixture('large'));
  expect(validateProject(document)).toEqual([]);
  const store = new ProjectStore(document, 'fixture'); expect(document.walls).toHaveLength(200); expect(document.junctions).toHaveLength(200);
  expect(document.rooms).toHaveLength(50); expect(document.furniture).toHaveLength(100);
  expect(store.getSnapshot().derived.faces.every(f => f.clearAreaMm2 === 3800 * 2800)).toBe(true);
  const b = buildScene(document); expect(b.meshes.filter(m => m.category === 'wall')).toHaveLength(200); expect(b.meshes.filter(m => m.category === 'floor')).toHaveLength(50);
  expect(b.stats.wallVolumeMm3).toBe(50 * 2 * 200 * (4000 + 3000) * 3000);
  expect(store.execute({ type: 'MoveJunctions', id: 'perf_move', baseGeneration: 0, moves: [{ junction: 'pj_0_1', to: [4100, 0] }, { junction: 'pj_0_2', to: [4100, 3000] }] }).ok).toBe(true);
});
it('percentiles use nearest rank and unknown remains null instead of fabricated zero', () => {
  expect(percentiles([])).toEqual({ count: 0, min: null, p50: null, p95: null, p99: null, max: null });
  expect(percentiles(Array.from({ length: 100 }, (_, i) => i + 1))).toEqual({ count: 100, min: 1, p50: 50, p95: 95, p99: 99, max: 100 });
  fc.assert(fc.property(fc.array(fc.integer({ min: 0, max: 10000 }), { minLength: 1, maxLength: 1000 }), values => {
    const r = percentiles(values); expect(r.min! <= r.p50! && r.p50! <= r.p95! && r.p95! <= r.p99! && r.p99! <= r.max!).toBe(true);
    expect(values.includes(r.p95!)).toBe(true); expect(percentiles([...values].reverse())).toEqual(r);
  }), { seed: 20261011, numRuns: 200 });
  expect(() => percentiles([NaN])).toThrow(); expect(() => percentiles([-1])).toThrow();
});
it('warm-up and frames across its boundary are excluded; quick diagnostics never claim device protocol', () => {
  const run = new BenchmarkRun('2d', 0, 100, 1000); run.frame(90); run.frame(105); run.frame(120);
  run.preview(99, 88); run.preview(121, 10); run.frame(135); run.command(140, 12);
  const r = run.report(1100); expect(r.frameMs.count).toBe(2); expect(r.frameMs.p95).toBe(15); expect(r.previewMs.count).toBe(1);
  expect(r.editingFrameMs.count).toBe(1); expect(r.fps).toBe(3); expect(r.observedIntervalFps).toBeCloseTo(1000 / 15); expect(r.protocol).toBe('quick-diagnostic'); expect(r.sufficientInteraction).toBe(false);
});
it('commit-to-submitted latency matches only the actual generation; coalesced/outstanding samples remain visible', () => {
  const run = new BenchmarkRun('3d', 0, 0, 1000);
  run.committed(1, 20); run.committed(2, 30); run.rendered(frame(90, 2)); run.rendered(frame(100, 2)); run.committed(3, 120);
  const r = run.report(1000); expect(r.commitToSubmitted3dMs).toEqual({ count: 1, min: 60, p50: 60, p95: 60, p99: 60, max: 60 });
  expect(r.coalescedCommitSamples).toBe(1); expect(r.outstandingCommitSamples).toBe(1); expect(r.drawCalls.p95).toBe(40);
  run.rendered(frame(1100, 3)); expect(run.report(1100).outstandingCommitSamples).toBe(1);
});
it('interruption/partial runs never have a complete uninterrupted result; unsupported heap is unknown', () => {
  const run = new BenchmarkRun('3d', 0, 20000, 300000); run.interruptions.push('Page hidden');
  const r = run.report(25000); expect(r.fullDuration).toBe(false); expect(r.uninterrupted).toBe(false); expect(r.protocol).toBe('device-5-minute-run');
  expect(heapReading({} as Performance)).toEqual({ scope: 'main-frame-js-heap', supported: false, usedJsHeapBytes: null, totalJsHeapBytes: null, jsHeapLimitBytes: null });
});
it('whole-window FPS includes a four-second missing-draw tail; pending time is explicit', () => {
  const run = new BenchmarkRun('3d', 0, 0, 5000);
  for (let i = 0; i <= 60; i++) run.rendered(frame(i * 1000 / 60, 0));
  run.committed(1, 1000); run.scenePending(1000);
  const r = run.report(5000); expect(r.fps).toBe(12.2); expect(r.observedIntervalFps).toBeCloseTo(60);
  expect(r.sceneUnavailableMs).toBe(4000); expect(r.outstandingCommitSamples).toBe(1); expect(r.lastFrameOffsetMs).toBe(1000);
});
it('rejected or no-op 2D command attempts cannot count as sufficient editing interaction', () => {
  const run = new BenchmarkRun('2d', 0, 0, 5000);
  for (let i = 0; i < 30; i++) run.preview(100 + i * 20, 2);
  run.command(800, 4);
  expect(run.report(5000).sufficientInteraction).toBe(false);
  expect(run.report(5000).committedChanges).toBe(0);
  run.committed(1, 900);
  expect(run.report(5000).sufficientInteraction).toBe(true);
  expect(run.report(5000).committedChanges).toBe(1);
  expect(run.report(5000).outstandingCommitSamples).toBe(0);
});
