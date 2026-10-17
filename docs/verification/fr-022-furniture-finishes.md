# FR-022 — furniture colour variants

2026-10-17 · [D59](../decisions/furniture-finishes.md) · [handoff](../claude-code-handoff.md).

Built by Claude Code under the owner's D52 continuation.

- `SetFurnitureFinish` sets a main-colour finish on the selected furniture.
- The selection panel has eight original swatches plus Original colours.
- The 2D plan and the PNG fill show the finish.
- The 3D view recolours the model's main material.

**Status: complete locally; the required pinned-CI jobs for the exact PR head are reported in the PR, not here.**

## Evidence (local, Node 24.19.0, this sandbox's Chromium 141 / SwiftShader)

**Unit tests, core-model** (`furniture-finish.test.ts`, 4 cases):
- The finish material is installed once and reused. Both chosen items get `{ main: 'm_fin_navy' }`, and untouched items keep their overrides.
- `null` clears the overrides, and each change reverses with one exact Undo.
- Repeating the same finish is a no-op without history.
- Invalid selections, a same-ID conflicting definition and malformed materials (bad colour, bad ID, roughness 2) are rejected atomically.

**Unit test, renderer** (`furniture-assets.test.ts`, new case), analytic:
- A 0.54 m³ body beats a 0.001 m³ handle as the main material.
- Two of four items in navy give two displays.
- The navy display's body material is a clone with exactly `#2f3e5c`. The shared body material keeps its colour, and the handle material is shared and unchanged.
- Removing the finish disposes the clone once.
- An override pointing at a missing material, or with an extra key, is reported as unsupported and not drawn as a model.

**Browser tests** (`tests/e2e/furniture-finish.spec.ts`, 3 cases):
- The swatches are disabled with no selection. Colouring sofa + TV navy writes `{ main: 'm_fin_navy' }` and installs one definition.
- The real 2D canvas pixel at the sofa centre changes from the plain fill `#c8af90` to `#2f3e5c`.
- A repeated click is a no-op, Original colours restores the plain fill, and two Undos restore the exact exported document.
- A selection that includes a wall disables the swatches.
- A placed catalog desk coloured teak still loads as the **real 3D model** (phase ready, 6 meshes, 72 triangles), not the fallback box. On `main` before this change, any override made it fall back.
- Related browser suites re-run (`furniture-models`, `surface-controls`, `plan-image`, `material-bindings`): passed 29/29 together with the new spec.
- `pnpm check` under Node 24.19.0: 70 files, 517 product tests, 18 tooling tests passed.
- Whole browser suite on the frozen branch code: **150 passed, 1 failed (13.1 m)**. The 1 failure is the same `furniture-gestures.spec.ts` "UX-005 … rotation-handle tap … Enter rotates once" deep-equality failure that fails on unmodified `main` in this sandbox (Chromium 141) and passed in pinned CI for PRs #100–#105. Not caused by this change; cause unproven; pinned CI is the gate.
- After D58 (PR #105) merged, `main` was merged into this branch. Three additive conflicts (the Selection panel and both docs) were resolved by keeping both sides. On the merged tree:
  - `pnpm check` passed: 71 files, 523 product tests, 18 tooling tests.
  - The finish, grouping, alignment and selection browser specs passed 18/18.

## Failures and fixes recorded honestly

- The first command draft rewrote the override object even when it was already equal, so repeating a finish added a history entry. Found by the no-op test; the command now skips unchanged items.
- A renderer-test mistake: the analytic handle box stuck out beyond the model's stated depth, so the existing size check correctly refused to draw it. The handle was moved inside the body in the test only.

## Limits

- Only the 2D fill and the CPU/GPU material setup are verified. 3D colour pixels were not compared.
- The neutral fallback box is not recoloured.
- No physical phone, mobile-optimization or independent-review claim.
- The Hindi strings were written by Claude and have had no native-speaker review.
- D36 scopes remain locked.
