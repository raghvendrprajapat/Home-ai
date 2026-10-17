# FR-019 — turning furniture together

2026-10-17 · [D58](../decisions/furniture-group-rotation.md) · [D57 grouping](../decisions/furniture-grouping.md) · [handoff](../claude-code-handoff.md).

Built by Claude Code under the owner's D52 continuation.

- **New command:** `RotateFurniture` turns the selected items about the centre of their combined box.
- **Controls:** Selection-panel ±90° buttons, and Q/E (15°) for a selected group.

**Status: complete locally; the required pinned-CI jobs for the exact PR head are reported in the PR, not here.**

## Evidence (local, Node 24.19.0, this sandbox's Chromium 141 / SwiftShader)

**Unit tests** (Claude-authored, analytic): `furniture-rotate.test.ts`, 6 cases. All values below were worked out by hand.

- **Pivot:** for sofa + tv, the combined box is x 300..3150 and y 200..4750, so the pivot is (1725, 2475).
- **+90°:** sofa goes to (−100, 2050) at 270°, tv to (3800, 3000) at 90°.
- **−90°:** sofa goes to (3550, 2900) at 90°, tv to (−350, 1950) at 270°.
- **180°:** sofa goes to (2150, 650) at 0°, tv to (1200, 4550) at 180°.
- Four quarter turns give back the same document, apart from rev/updatedAt.
- A single item turns in place.
- 0° and ±360° are no-ops without history. One Undo restores the exact document.
- **Property test** (200 runs, every integer angle, random subsets of the four sample items):
  - positions stay integer and rotations stay in [0, 360);
  - each rotation changes by exactly the angle;
  - every pairwise centre distance changes by at most √2 mm.
- **Rejections:** invalid selections and angles reject atomically. A 45° turn that would leave the ±100,000 mm domain is rejected, while a 90° turn of the same pair is accepted.

**Browser test** (`tests/e2e/furniture-group.spec.ts`, new case 5):
- In the real UI, "Turn selection 90° right" gives exactly the hand values above.
- Q on the canvas turns both members by −15° (255° and 75°).
- Two Undos restore the positions.
- The buttons are disabled for a single item.
- All 5 grouping browser cases pass.

**Whole checks:**
- `pnpm check` under Node 24.19.0: 70 files, 518 product tests, 18 tooling tests passed.
- Whole browser suite on the frozen branch code: **148 passed, 1 failed (12.9 m)**. The 1 failure is the same `furniture-gestures.spec.ts` "UX-005 … rotation-handle tap … Enter rotates once" deep-equality failure that fails on unmodified `main` in this sandbox (Chromium 141) and passed in pinned CI for PRs #100–#104. Not caused by this change; cause unproven; pinned CI is the gate.

## Limits

- No physical phone, mobile-optimization or independent-review claim.
- Non-right angles round each centre by up to 0.5 mm per turn.
- No drag-to-rotate for groups and no 3D group turning.
- The Hindi strings were written by Claude and have had no native-speaker review.
- D36 scopes remain locked.
