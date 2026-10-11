# GharPlan web proof — PH0-T05

Run commands from the repository root, using Node 24.19.0 and pnpm 11.19.0:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm build
pnpm dev
```

The development server uses port 5173 with strict port selection. The sample plan is now editable: drag a corner, enter precise X/Y coordinates, fit/pan/zoom the drawing, toggle its grid and undo/redo. Area labels use the geometry engine's clear inside area. Connected orthogonal groups move together; invalid commands reject atomically. Touch handles have larger picking targets, and a second finger cancels an edit until both fingers lift.

Switch to **3D view** for real wall openings, clear-area floors, door thresholds and dimensioned furniture placeholders. Drag to orbit, use two fingers to pan/zoom, or focus the canvas and use arrow keys / + / −. The precision controls and undo/redo update both views from the same core-model. Only changed mesh buffers/GPU geometries rebuild; outdated worker results are rejected. Context loss, worker startup and engine-load failures preserve the live model and offer 2D continuation.

The sample is **in memory only**: reload restores it. Persistence, the asset catalog/textures, accounts and Android build remain pending. English/Hindi full application flows start in PH1-T03. Konva/Three own dedicated inner canvas containers; React owns controls and overlays. Renderer state is never project data. Three.js is loaded only when 3D is selected.

The workspace has three packages: this React/Vite app, pure tested `geometry`, and the tested canonical `core-model`. Unit/property tests include exact areas, atomic history, snapping, solid volumes, welded surface edges, ray probes through holes and fault-injected async results. Browser evidence and replay instructions are in `docs/verification/ph0-t04.md` and `ph0-t05.md`. Screenshots do not establish geometry correctness or phone performance.

CI runs on pull requests and validates the frozen install, lint, strict TypeScript checks in all packages, the executed smoke test and a production build. See the dependency register for exact versions, compatibility and licensing. Playwright E2E starts in PH1-T05; Android/device benchmarks start in PH0-T07.
