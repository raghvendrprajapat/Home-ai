# FR-019 — overlap warnings for a whole group

2026-10-18 · [D61](../decisions/furniture-group-advisories.md) · [handoff](../claude-code-handoff.md).

**Status: complete locally; the required pinned-CI jobs for the exact PR head are reported in the PR, not here.**

## Evidence (local, Node 24.19.0, this sandbox's Chromium 141 / SwiftShader)

**Unit test** (`furniture-advisories.test.ts`, new case, analytic on the H.6 sample):
- Sofa and TV in place give no overlap.
- The sofa moved to x 6250 (box 5250..7250 × 3850..4750) overlaps exactly the wardrobe (5350..7150 × 4200..4800).
- The TV stacked on the sofa (both members) reports nothing.
- The TV at y = 50 (depth 400 mm) crosses north wall `w1` (y −115..115) and is reported.
- A missing member gives "unavailable".

**Browser test** (`tests/e2e/furniture-group.spec.ts`, new case 6):
- A real drag of the grouped sofa onto the wardrobe turns the canvas warning on during the live preview and after the commit.
- Undo clears it.

**Related suites:** all 6 grouping cases and the 5 existing advisory cases pass.

**Whole checks:**
- `pnpm check` under Node 24.19.0: 71 files, 527 product tests, 18 tooling tests passed.
- Whole browser suite on the frozen branch code: **154 passed, 1 failed (9.7 m)**. The 1 failure is the same `furniture-gestures.spec.ts` "UX-005 … rotation-handle tap … Enter rotates once" deep-equality failure that fails on unmodified `main` in this sandbox (Chromium 141) and passed in pinned CI for PRs #100–#107. Not caused by this change; cause unproven; pinned CI is the gate.

## Limits

- 2D only.
- No group wall snapping.
- No physical phone, mobile-optimization or independent-review claim.
- D36 scopes remain locked.
