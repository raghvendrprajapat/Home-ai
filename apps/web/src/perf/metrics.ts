export interface RenderReading { at: number; generation: number; drawCalls: number; triangles: number; geometries: number; textures: number; renderer: string; graphicsVersion: string }
export interface Percentiles { count: number; min: number | null; p50: number | null; p95: number | null; p99: number | null; max: number | null }
export function percentiles(input: readonly number[]): Percentiles {
  if (input.some(n => !Number.isFinite(n) || n < 0)) throw new Error('Invalid performance sample.');
  const sorted = [...input].sort((a, b) => a - b);
  const at = (p: number) => sorted.length ? sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)]! : null;
  return { count: sorted.length, min: sorted[0] ?? null, p50: at(0.5), p95: at(0.95), p99: at(0.99), max: sorted.at(-1) ?? null };
}
export interface DeviceMetadata { model: string; ram: string; os: string; browserOrWebView: string; container: 'browser' | 'Android WebView'; thermalStart: string; thermalEnd: string }
export class BenchmarkRun {
  frames: number[] = []; previews: number[] = []; commands: number[] = []; latency: number[] = [];
  editingFrames: number[] = []; #lastPreviewAt = -Infinity; #coalesced = 0;
  #frameCount = 0; #committedChanges = 0; #firstFrame: number | undefined; #lastFrame: number | undefined; #unavailableAt: number | undefined; #unavailableMs = 0;
  drawCalls: number[] = []; latestGpu: RenderReading | undefined; interruptions: string[] = [];
  #previous: number | undefined; #pending = new Map<number, number>(); #overflow = false;
  constructor(readonly mode: '2d' | '3d', readonly start: number, readonly warmupMs: number, readonly durationMs: number) {}
  measuring(at: number): boolean { return at >= this.start + this.warmupMs && at <= this.start + this.warmupMs + this.durationMs; }
  #push(to: number[], value: number): void {
    if (!Number.isFinite(value) || value < 0) { this.interruptions.push('Invalid timing sample.'); return; }
    if (to.length >= 100_000) { this.#overflow = true; return; } to.push(value);
  }
  frame(at: number): void {
    if (this.measuring(at)) { this.#frameCount++; this.#firstFrame ??= at; this.#lastFrame = at; }
    if (this.measuring(at) && this.#previous !== undefined && this.measuring(this.#previous)) {
      this.#push(this.frames, at - this.#previous);
      if (this.mode === '2d' && at - this.#lastPreviewAt <= 250) this.#push(this.editingFrames, at - this.#previous);
    }
    this.#previous = at;
  }
  preview(at: number, duration: number): void { this.#lastPreviewAt = at; if (this.measuring(at)) this.#push(this.previews, duration); }
  command(at: number, duration: number): void { if (this.measuring(at)) this.#push(this.commands, duration); }
  committed(generation: number, at: number): void { if (this.measuring(at)) { this.#committedChanges++; if (this.mode === '3d') this.#pending.set(generation, at); } }
  scenePending(at: number): void { this.#unavailableAt ??= at; }
  #unavailableUntil(at: number): number {
    if (this.#unavailableAt === undefined) return 0;
    return Math.max(0, Math.min(at, this.start + this.warmupMs + this.durationMs) - Math.max(this.#unavailableAt, this.start + this.warmupMs));
  }
  rendered(reading: RenderReading): void {
    if (this.mode !== '3d') return;
    this.frame(reading.at); this.latestGpu = reading;
    this.#unavailableMs += this.#unavailableUntil(reading.at); this.#unavailableAt = undefined;
    if (!this.measuring(reading.at)) return;
    if (this.measuring(reading.at)) this.#push(this.drawCalls, reading.drawCalls);
    const committed = this.#pending.get(reading.generation);
    if (committed !== undefined && this.measuring(reading.at)) this.#push(this.latency, reading.at - committed);
    // Coalesced generations that were never shown are counted explicitly, not given zero latency.
    for (const generation of this.#pending.keys()) if (generation <= reading.generation) { if (generation < reading.generation) this.#coalesced++; this.#pending.delete(generation); }
  }
  report(at: number) {
    const elapsedMs = Math.max(0, at - this.start - this.warmupMs), fullDuration = elapsedMs >= this.durationMs;
    const enoughInput = this.mode === '2d' ? this.previews.length >= 30 && this.commands.length >= 1 && this.#committedChanges >= 1 : this.frames.length >= 150 && this.latency.length >= 20;
    const sum = this.frames.reduce((n, t) => n + t, 0);
    return { mode: this.mode, warmupMs: this.warmupMs, requestedDurationMs: this.durationMs, measuredElapsedMs: Math.min(elapsedMs, this.durationMs), fullDuration,
      protocol: this.durationMs === 300_000 && this.warmupMs >= 20_000 ? 'device-5-minute-run' : 'quick-diagnostic',
      sufficientInteraction: enoughInput, uninterrupted: this.interruptions.length === 0 && !this.#overflow,
      cadenceType: this.mode === '2d' ? 'raf-cadence' : 'valid-scene-draw-submissions', measuredFrames: this.#frameCount,
      fps: this.#frameCount && elapsedMs > 0 ? this.#frameCount * 1000 / Math.min(elapsedMs, this.durationMs) : null,
      observedIntervalFps: sum > 0 ? this.frames.length * 1000 / sum : null,
      firstFrameOffsetMs: this.#firstFrame === undefined ? null : this.#firstFrame - this.start - this.warmupMs,
      lastFrameOffsetMs: this.#lastFrame === undefined ? null : this.#lastFrame - this.start - this.warmupMs,
      sceneUnavailableMs: this.mode === '3d' ? this.#unavailableMs + this.#unavailableUntil(at) : null,
      frameMs: percentiles(this.frames), previewMs: percentiles(this.previews), commandMs: percentiles(this.commands),
      editingFrameMs: percentiles(this.editingFrames), editingFps: this.editingFrames.length ? this.editingFrames.length * 1000 / this.editingFrames.reduce((n, t) => n + t, 0) : null,
      committedChanges: this.#committedChanges, commitToSubmitted3dMs: percentiles(this.latency), outstandingCommitSamples: this.#pending.size, coalescedCommitSamples: this.#coalesced,
      drawCalls: percentiles(this.drawCalls), rendererResources: this.latestGpu ? { geometries: this.latestGpu.geometries, textures: this.latestGpu.textures, trianglesLastFrame: this.latestGpu.triangles, gpuRenderer: this.latestGpu.renderer, graphicsVersion: this.latestGpu.graphicsVersion, gpuMemoryBytes: null, gpuTimeMs: null } : null,
      interruptions: [...this.interruptions], sampleOverflow: this.#overflow };
  }
}
export function heapReading(perf: Performance): { scope: 'main-frame-js-heap'; supported: boolean; usedJsHeapBytes: number | null; totalJsHeapBytes: number | null; jsHeapLimitBytes: number | null } {
  const memory = (perf as Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
  return memory ? { scope: 'main-frame-js-heap', supported: true, usedJsHeapBytes: memory.usedJSHeapSize, totalJsHeapBytes: memory.totalJSHeapSize, jsHeapLimitBytes: memory.jsHeapSizeLimit } :
    { scope: 'main-frame-js-heap', supported: false, usedJsHeapBytes: null, totalJsHeapBytes: null, jsHeapLimitBytes: null };
}
