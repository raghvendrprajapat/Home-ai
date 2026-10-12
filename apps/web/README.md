# GharPlan web and Android proofs — PH0-T08

Run commands from the repository root, using Node 24.19.0 and pnpm 11.19.0:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm build
pnpm dev
```

The development server uses port 5173 with strict port selection. The sample plan is now editable: drag a corner, enter precise X/Y coordinates, fit/pan/zoom the drawing, toggle its grid and undo/redo. Area labels use the geometry engine's clear inside area. Connected orthogonal groups move together; invalid commands reject atomically. Touch handles have larger picking targets, and a second finger cancels an edit until both fingers lift.

Switch to **3D view** for real wall openings, clear-area floors, door thresholds and dimensioned furniture placeholders. Drag to orbit, use two fingers to pan/zoom, or focus the canvas and use arrow keys / + / −. The precision controls and undo/redo update both views from the same core-model. Only changed mesh buffers/GPU geometries rebuild; outdated worker results are rejected. Context loss, worker startup and engine-load failures preserve the live model and offer 2D continuation.

The editable drawing now autosaves to transactional IndexedDB. Android additionally mirrors validated full copies through the private native Filesystem plugin. The save label acknowledges the current document only after the required writes finish; a failed or stalled phone backup warns while browser autosave continues. Reload with newer journal entries offers recovery before editing. Conflicts retain exportable in-memory changes; damaged or unsupported originals stay untouched, and repaired drawings/native backups open as separate copies with new IDs. Undo history is session-only; recovered content starts a new editor session.

**Export drawing** downloads complete JSON in a normal browser. Android currently shows the complete JSON with a guarded copy action; native file download/share and full import are pending PH1-T04. Keep independent backups: clearing application data or uninstalling can remove both local stores. Accounts, project-list/blank-project flows and the asset catalog remain pending. Android compilation, signature/manifest/config/assets and native plugin packaging are verified; phone execution/durability remain pending. See [`../../docs/verification/ph0-t08.md`](../../docs/verification/ph0-t08.md) and the [phone recovery procedure](../../docs/benchmarks/local-recovery.md). English/Hindi full application flows start in PH1-T03. Konva/Three own dedicated inner canvas containers; React owns controls and overlays. Renderer state is never project data. Three.js is loaded only when 3D is selected.

The workspace contains this React/Vite app, pure tested `geometry`, canonical `core-model`, and the platform-specific `persistence` package. Unit/property tests include exact areas, atomic history, snapping, solid volumes, welded surface edges, ray probes through holes, transactional abort/CAS, checkpoint replay, native I/O faults and fault-injected async results. Browser evidence and replay instructions are in `docs/verification/ph0-t04.md`, `ph0-t05.md` and `ph0-t08.md`. Screenshots do not establish geometry correctness or phone performance.

CI runs on pull requests and validates the frozen install, lint, strict TypeScript checks in all packages, executed unit/property tests and a production build. Its Android debug job also builds/lints and inspects a signed debug APK. See the dependency register for exact versions, compatibility and licensing. Comprehensive Playwright E2E infrastructure starts in PH1-T05; retained browser proof scripts already exercise the current views.

PH0-T06 adds the disposable `/perf` engineering page: sample and generated 200-wall / 100-object workloads, warm-up, timed 2D dragging / 3D orbit with scripted edits, actual input/build/device metadata and JSON download. It uploads nothing and never edits the main project. Use three five-minute runs after 20-second warm-up on each real phone, in Chrome and Android WebView; short diagnostics do not pass a release gate. See [`../../docs/verification/ph0-t06.md`](../../docs/verification/ph0-t06.md) for replay, exact measurements, limitations and phone steps. The cloud diagnostic exposed expensive large-plan previews/validation and 645 draw calls; those costs still need optimization. Reload clears test reports, so export first.

Android: `pnpm android:sync` builds/copies local assets; `pnpm android:debug` compiles/lints with JDK 21 and SDK 36. Toolchain, separate debug package, actual APK evidence, USB installation/inspection, same-build Chrome comparison, debug-key mismatch recovery and native report-export limitation are documented in [`../../docs/benchmarks/phase0.md`](../../docs/benchmarks/phase0.md) and [`../../docs/verification/ph0-t07.md`](../../docs/verification/ph0-t07.md). Native report download is pending; the lab preserves JSON for USB inspection. Do not treat compilation or Linux browser probes as phone results.
