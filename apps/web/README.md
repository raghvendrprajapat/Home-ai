# GharPlan web proof — PH0-T04

Run commands from the repository root, using Node 24.19.0 and pnpm 11.19.0:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm build
pnpm dev
```

The development server uses port 5173 with strict port selection. The sample plan is now editable: drag a corner, enter precise X/Y coordinates, fit/pan/zoom the drawing, toggle its grid and undo/redo. Area labels use the geometry engine's clear inside area. Connected orthogonal groups move together; invalid commands reject atomically. Touch handles have larger picking targets, and a second finger cancels an edit until both fingers lift.

The sample is **in memory only**: reload restores it. There is no 3D, persistence, account system or Android build yet. English/Hindi full application flows start in PH1-T03. Konva owns a dedicated inner canvas container; React owns the controls and overlays. Konva state is never project data.

The workspace has three packages: this React/Vite app, pure tested `geometry`, and the tested canonical `core-model`. Unit/property tests include exact sample areas, atomic edits/history and raw snapping; empty test runs fail. Browser regression evidence and replay instructions are in `docs/verification/ph0-t04.md`. Screenshots do not establish geometry correctness or phone performance.

CI runs on pull requests and validates the frozen install, lint, strict TypeScript checks in all packages, the executed smoke test and a production build. See the dependency register for exact versions, compatibility and licensing. Playwright E2E starts in PH1-T05; Android/device benchmarks start in PH0-T07.
