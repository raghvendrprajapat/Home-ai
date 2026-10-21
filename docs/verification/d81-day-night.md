# D81 verification — 2026-10-21

Base main: `95070af97e3b1164af45662906e17a8c07eb0bfa` (D77 decor merged through PR #141). Node 24.19.0, pnpm 11.19.0. New tests are Codex-authored, not independent fixtures.

## Completed local evidence

- `pnpm install --frozen-lockfile`: exit 0; 312 packages installed, lockfile unchanged.
- `pnpm check` in the execution context that permits subprocesses: exit 0; 101 Vitest files, **837 passed**; **31 Node tests passed**, no failures/skips. Acceptance guard: 5 files unchanged. Catalog: 78 assets, 0 validator errors/warnings, 78 rights records; 12 texture/HDRI rights records; 78 immutable historical versions retained.
- `GHARPLAN_CHROMIUM_PATH=/usr/bin/chromium pnpm e2e tests/e2e/day-night.spec.ts tests/e2e/camera-quality-image.spec.ts`: **9 passed (1.2m)**. Original six camera/quality/PNG/gesture tests are unchanged; three new cases verify Night pixels/toggles, preserved Walk/Low renderer, and a real furniture edit/one Undo moving the actual lamp source.
- Rendered canvas pixel evidence (0–255 luminance): Night lamps on **48.933404485887685**, off **39.1037823036632**; difference **9.829622182224483** (>1 required by the new test). Actual Mid furnished Night sample: **145 draw calls**, below the locked 200 limit. This is software WebGL evidence, not real-phone FPS.
- `GHARPLAN_CHROMIUM_PATH=/usr/bin/chromium pnpm acceptance`: **36 passed, 1 skipped (2.1m)**. The skip is the existing locked `test.fixme`, not a new skip or change. All five locked file hashes are unchanged.
- Actual shade positions: floor lamp `(3.35, 1.46, 2.25)` metres; bedside lamp `(5.295, 0.88, 0.34)`. Editing the latter to X5400/elevation650 gives `(5.4,1.01,0.34)`; one Undo restores it and the exact exported drawing. Light toggling does not replace the canvas, change camera/history, or grow reported GPU object counts.
- Screenshots with lamps on/off were visually inspected as a supplement to the pixel/model assertions. They show warm illumination and the intentionally dark background. They do not establish production readiness or independent review.

## Diagnosed environment failures (not hidden)

The first full check in the restricted process sandbox failed the unchanged SDK discovery test. An isolated diagnostic reproduced `spawnSync … EPERM` (including with normal PATH); the same untouched test passed when run in the permitted execution context, followed by the full check above. No test or assertion was changed to fix the environment.

Pinned Chromium 156.0.8078.4/revision1248 download was denied with HTTP403 `Domain forbidden` at `cdn.playwright.dev`. Local browser evidence uses system **Chromium151.0.7922.173 + SwiftShader** explicitly. CI retains the pinned browser and unchanged required jobs. Do not call a local fallback run the pinned CI result.

## Remaining gates

The final pre-commit check, production build and exact-head PR CI results are reported in the PR once they actually complete. A recorded pending step is not a pass. Every required check—Check, Acceptance (independent), Cloud database, Android debug—must be COMPLETED SUCCESS on the exact 40-character head before squash merge.

Real Low/Mid phones, performance/thermal calibration, live Supabase/Google, paid/live AI, external designer/security review, release packaging and final Claude review remain pending as applicable; this task authorizes none of the gated checks. Night point lights are decorative, unshadowed and may leak through walls. Low is mood-only. No physical lighting accuracy claim.

## Owner check steps (only after real-phone testing is authorised)

1. On each Low/Mid phone, open the PR preview or matching debug APK and choose Skip welcome.
2. Open 3D → Project → 3D camera and quality. Choose Medium, then Lighting preset → Night; close Project.
3. Toggle Night lights: the floor beside the floor lamp and bedside table should brighten/dim. Turn Low walls off to inspect full walls and wall pictures.
4. Enter Walk, open Project and change Night → Daylight → Night. Walk stays active; Exit walk mode remains available.
5. Choose Low. Night is darker, with no local lamp lighting, textures or shadows. This is intentional; Medium costs more GPU work.
6. Switch back to 2D and reopen/export the drawing. Changing lighting alone must not add an Undo step or change its contents. Report visual problems or stutter; no phone result has been claimed here.
