# GharPlan web skeleton — PH0-T01

Run commands from the repository root, using Node 24.19.0 and pnpm 11.19.0:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm build
pnpm dev
```

The development server uses port 5173 with strict port selection. The screen currently contains only the GharPlan heading. There is no editor, 3D view, persistence, account system or Android build yet. English/Hindi application flows start in PH1-T03.

The workspace has exactly three packages: this React/Vite app, pure `geometry`, and `core-model`. The latter two are empty entry points for their later tasks; checking their types is not proof of geometry/model correctness. The smoke test exercises the React shell, and an empty test run fails.

CI runs on pull requests and validates the frozen install, lint, strict TypeScript checks in all packages, the executed smoke test and a production build. See the dependency register for exact versions, compatibility and licensing. Playwright E2E starts in PH1-T05; Android/device benchmarks start in PH0-T07.
