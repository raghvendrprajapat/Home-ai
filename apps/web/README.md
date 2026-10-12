# GharPlan web and Android proofs — PH0-T07

Run commands from the repository root, using Node 24.19.0 and pnpm 11.19.0:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm build
pnpm dev
```

The development server uses port 5173 with strict port selection. The sample plan is now editable: drag a corner, enter precise X/Y coordinates, fit/pan/zoom the drawing, toggle its grid and undo/redo. Area labels use the geometry engine's clear inside area. Connected orthogonal groups move together; invalid commands reject atomically. Touch handles have larger picking targets, and a second finger cancels an edit until both fingers lift.

Switch to **3D view** for real wall openings, clear-area floors, door thresholds and dimensioned furniture placeholders. Drag to orbit, use two fingers to pan/zoom, or focus the canvas and use arrow keys / + / −. The precision controls and undo/redo update both views from the same core-model. Only changed mesh buffers/GPU geometries rebuild; outdated worker results are rejected. Context loss, worker startup and engine-load failures preserve the live model and offer 2D continuation.

The sample is **in memory only**: reload restores it. Persistence, the asset catalog/textures and accounts remain pending. The Android debug APK compiles and its actual manifest/config/assets/signature are verified; physical phone execution/performance remain pending. English/Hindi full application flows start in PH1-T03. Konva/Three own dedicated inner canvas containers; React owns controls and overlays. Renderer state is never project data. Three.js is loaded only when 3D is selected.

The workspace has three packages: this React/Vite app, pure tested `geometry`, and the tested canonical `core-model`. Unit/property tests include exact areas, atomic history, snapping, solid volumes, welded surface edges, ray probes through holes and fault-injected async results. Browser evidence and replay instructions are in `docs/verification/ph0-t04.md` and `ph0-t05.md`. Screenshots do not establish geometry correctness or phone performance.

CI runs on pull requests and validates the frozen install, lint, strict TypeScript checks in all packages, executed unit/property tests and a production build. Its Android debug job also builds/lints and inspects a signed debug APK. See the dependency register for exact versions, compatibility and licensing. Comprehensive Playwright E2E infrastructure starts in PH1-T05; retained browser proof scripts already exercise the current views.

PH0-T06 adds the disposable `/perf` engineering page: sample and generated 200-wall / 100-object workloads, warm-up, timed 2D dragging / 3D orbit with scripted edits, actual input/build/device metadata and JSON download. It uploads nothing and never edits the main project. Use three five-minute runs after 20-second warm-up on each real phone, in Chrome and Android WebView; short diagnostics do not pass a release gate. See [`../../docs/verification/ph0-t06.md`](../../docs/verification/ph0-t06.md) for replay, exact measurements, limitations and phone steps. The cloud diagnostic exposed expensive large-plan previews/validation and 645 draw calls; those costs still need optimization. Reload clears test reports, so export first.

Android: `pnpm android:sync` builds/copies local assets; `pnpm android:debug` compiles/lints with JDK 21 and SDK 36. Toolchain, separate debug package, actual APK evidence, USB installation/inspection, same-build Chrome comparison, debug-key mismatch recovery and native report-export limitation are documented in [`../../docs/benchmarks/phase0.md`](../../docs/benchmarks/phase0.md) and [`../../docs/verification/ph0-t07.md`](../../docs/verification/ph0-t07.md). Native report download is pending; the lab preserves JSON for USB inspection. Do not treat compilation or Linux browser probes as phone results.
