# PH4-T04 stage C — visible surface colours

2026-10-16 · [D49](../decisions/surface-material-controls.md) · [results](ph4-t04c-results.json).

Both editor views now offer canonical wall-left/right and room-floor swatches with direction labels and English/Hindi text. New blank drawings can install a missing local-library colour and paint in one transaction/Undo. Existing material definitions are preserved. The same material IDs drive flat2D/plan-PNG fills and3D bindings; selection outlines leave colour visible. Solid colours work; patterns/textures and furniture variants remain separate, and physical-device200ms/external gates are not claimed complete.

## Verification and scope

Final pnpm check passed452product tests/65files in23.43s and18tooling cases. All118browser cases passed together in8.2m; final10focused surface cases passed in38.9s. Android debug BUILD SUCCESSFUL in31s;16webfiles byte-equal, manifest/compiled registration/v2signature and actual packaged feature-byte checks passed. APK SHA256:4f4e43b8434f91d20876336064c36b8783891a10e1a24e0922ed62ed34ce32c3. Source hashes, exact pixels, native input evidence, scoped memory/context diagnostics and protected-input checks are recorded in the JSON. Seven permanent unit/property cases cover atomic new-library paint, exact no-op/Undo/Redo, floor/neighbor isolation, immutable intent ownership, invalid target/material/ID rejection, analytic cardinal/reversed strip colours, exact rectangle coverage and100seeded geometry cases. Palette tests preserve imported definitions/user names. Accepted independent fixtures remain unchanged.

Actual browser cases check every named side ID, raw2D pixels, canonical room/wall/material isolation, two separate paints undone one at a time, no-op history, Redo/save/reload, unchanged unsaved room-name draft, known2D/PNG floor pixels and a projected visible3D wall face. Both left and right can be painted independently. Empty-drawing controls are disabled, and new blank drawings atomically install a finish before applying it. Hindi navigation keeps material identity. PNG sample projection uses an independently calculated known sample envelope;3D samples use the captured image aspect and independent camera basis. Screenshots are supplemental layout inspection only.

Native-input cases positively require delivered clicks with unchanged button rectangles while generation changes or a2D→3D→2D mode roundtrip happens; canonical JSON/history must remain unchanged. Held Space cannot retarget the opposite side, while a fresh Enter applies once. Native multi-touch cannot paint until all contacts end, then a fresh primary tap works. An injected lost pointer-up followed by blur and a positively verified trusted primary native touch checks recovery. Final release movement is tested with actual move-event delivery deliberately blocked, so missed previews cannot bypass the final6px acceptance threshold.

Linux Chromium/SwiftShader execution is distinct from pinnedCI and physical Android phones. Actual context recovery and warmed renderer lifetime diagnostics are scoped to this sample/main-frame/owned resources; they do not measure whole-process, worker/native/driver/phone memory. Android checks are existing debug compilation/packaging only. Native-provider, real Low/Mid, accessibility/external/final-Claude and other D36 gates remain pending.

## Failures and corrections

The first new unit run passed6/failed1 because a wall paint inherited conservative geometry-dependency revision increments on an otherwise unchanged room. The exact room equality assertion was retained; ApplySurfaceMaterial now skips inherited geometry-only revision propagation while preserving its directly edited entity revision and all other commands' behavior. Worker material invalidation continues to derive actual IDs. The initial typecheck also rejected mutable ProjectDoc parameters used with immutable snapshots; read-only helpers now accept the actual immutable snapshot document type without casts or mutations.

The first6-case browser run passed5/failed1 at navigation because the new Hindi test looked for an English “Done” button that does not exist in settings. The observed button is “वापस”; the corrected test keeps all original material/history assertions. All8cases then passed. Self-audit reproduced a separate real defect: an injected missing pointer-up left stale held IDs across blur and blocked a fresh trusted primary touch. The permanent case failed before the fix and passed after blur/hidden retire the intent and clear stale held IDs. Continuing nonprimary contacts still cannot start paint.

A second audit regression blocked actual pointermove delivery but still delivered a20px same-button release/click. It failed before the fix because paint committed. The release handler now checks final displacement against the unchanged6px threshold before admitting the click; final results are in the adjacent JSON. No existing assertion, timeout, accepted fixture or performance threshold is relaxed. No new dependency, schema, immutable asset or owner-research change is made. This self-audit is not independent certification.

## Traceability

| Requirement | Evidence | Remaining |
|---|---|---|
| FR-022 / SYNC-005 | Per-side/floor controls, atomic library paint, exact neighbor/Undo/no-op/reload checks, CPU/GPU foundation, actual2D/3D/PNG colour probes | Physical200ms, textures/broader corpus; furniture variants remain Should |
| REN-003 | Analytic side direction/strip coverage, shared canonical IDs, independent pixel probes; existing UV/buffer/lighting corpus | External reviewed visual baselines and texture corpus |
| SYNC-001/006/008 | Tag/context/input fences, genuine stale native click regressions, same-model mode roundtrip, complete worker/Undo suite | Physical/native-provider/external validation |
| UX-004/005/009 | Native touch/key/swatch interaction, disabled empty state, Hindi, no-op and PNG evidence | Real Low/Mid and accessibility/novice study gates |

Only after separate explicit D36 permission, prospective phone steps are: open a two-room drawing, select the shared wall, paint left and right different colours, compare flat2D/3D, paint one floor, verify the other room unchanged, Undo/Redo and reopen in Hindi. Record phone/OS/WebView/build/timings. These are future instructions, not executed or authorization. All D36 scopes remain unstarted. Catalog breadth and remaining authorized editor controls follow.
