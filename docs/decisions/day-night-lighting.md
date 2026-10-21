# D81 — day/night and decorative lamp lighting

Owner approval: 2026-10-21, after the D80 handoff and PR #141 merge. One task; branch `d81-day-night-lamps-20261021`.

## Behaviour and boundaries

- Project → 3D camera and quality → Lighting preset now offers Daylight, Warm, Night (English/Hindi).
- Night is a view setting, never project data. The live renderer, orbit camera and Walk state survive preset changes. A mode change cancels a held furniture transform before adjusting lighting.
- Night lowers the sun/environment fill and uses a dark blue background. It is a decorative preview, not a geolocation/time-of-day simulation or an electrical/lighting calculation.
- On Mid/High, at most two non-shadow point sources illuminate the active floor. Known floor/table lamp v1 instances come first, deterministically by object ID; remaining slots use the project's existing point-light records. Day/Warm retain the previous limits: Low 0, Mid 0, High 2.
- Bulb centres come from our original source geometry: floor lamp 1460/1600 of actual height; table lamp 360/450. Position includes the floor elevation and the piece's own elevation. They follow actual 3D drag previews, cancel/commit and subsequent scene updates. Hidden raised pieces in a low-wall view do not emit. Other asset versions have no invented bulb anchor.
- Night lights checkbox turns these sources off for comparison. Low keeps zero point sources, textures and shadows; its night view is ambient mood only. No quality-tier thresholds or general mobile optimisation changes.
- Unshadowed lights can illuminate through walls. The UI explains this. No physically accurate illumination, GI, automatic fixture placement or photorealistic-night promise.

## Architecture and trade-offs

`night-lighting.ts` derives bounded sources from the immutable document. `BoundedPointLights` owns actual Three objects, updates them in place and detaches/disposes them on teardown. The existing scene/worker/model and millimetre-to-Three mapping remain authoritative. No new schema, saved preference, dependency, network request, asset or texture.

Two night sources add fragment-shader work even when draw calls stay unchanged. The furnished sample must continue to satisfy the locked ≤200 Mid draw-call and texture-memory acceptance tests. Physical GPU/frame-rate/thermal evidence remains pending and gated by D36/D63.

The owner permitted `charmlinn/blueprint3d-modern` and `ch-bas/threejs-sims-house-builder` as references only. This implementation extends our existing Three.js lighting; no code snippet, model or texture from either repository was copied/adapted. If a future snippet is adapted, first record it in `dependencies.md` and retain its MIT notice. No Next.js migration.

## Verification

Codex-authored analytic/property/actual-Three lifecycle tests and browser pixel/model/camera/history tests supplement the unchanged independent acceptance suite. These new tests are the builder's tests, not independent fixtures. Actual results and pending gates are recorded in `docs/verification/d81-day-night.md` and the PR.
