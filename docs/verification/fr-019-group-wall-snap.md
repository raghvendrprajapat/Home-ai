# FR-019 — group back-to-wall snapping

2026-10-18 · [D62](../decisions/furniture-group-wall-snap.md) · [handoff](../claude-code-handoff.md).

**Status: complete locally; the required pinned-CI jobs for the exact PR head are reported in the PR, not here.**

## Evidence (local, Node 24.19.0, this sandbox's Chromium 141 / SwiftShader)

**Browser test** (`tests/e2e/furniture-group-snap.spec.ts`). It uses the same wall geometry as the existing GEO-019 test: a 115 mm wall on y = 0, and a 1000 × 600 item whose flush centre is y = floor(−57.5 − 300) = −358.
- **Snapped drag:** a real drag of the grouped item to 6 px from the flush line shows alignment key `2:-57.5:-1`.
  - The touched item moves from (2000, −500) to (2100, −358), a delta of (100, 142). The other member moves from (3000, −1500) to (3100, −1358).
  - Undo restores the exact document.
- **Shift drag:** no alignment and no −358. The members keep their (1000, −1000) offset.
- On `main` before this change, a group drag used only the grid, so this test could not reach −358.

**Related suites:** together with the group spec and the existing advisory spec, 12/12 pass.

**Whole checks:**
- `pnpm check` under Node 24.19.0: 71 files, 527 product tests, 18 tooling tests passed.
- Whole browser suite on the frozen branch code: **155 passed, 1 failed (9.7 m)**. The 1 failure is the same `furniture-gestures.spec.ts` "UX-005 … rotation-handle tap … Enter rotates once" deep-equality failure that fails on unmodified `main` in this sandbox (Chromium 141) and passed in pinned CI for PRs #100–#107. Not caused by this change; cause unproven; pinned CI is the gate.

## Limits

- Only the touched item snaps; the others are not tested against walls.
- 2D only.
- No physical phone, mobile-optimization or independent-review claim.
- D36 scopes remain locked.
