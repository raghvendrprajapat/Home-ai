# FR-008 — wall-segment dragging

2026-10-17 · [D53](../decisions/wall-segment-drag.md) · [handoff](../claude-code-handoff.md) · [final Codex checkpoint](https://github.com/raghvendrprajapat/Home-ai/issues/98).

Built by Claude Code under the owner's D52 continuation. A selected straight wall drags sideways as one atomic `MoveJunctions`; collinear neighbours follow, perpendicular walls stretch, hosted openings stay, impossible drags are rejected unchanged, one Undo. **Status: complete locally; the required pinned-CI jobs for the exact PR head are reported in the PR, not here.**

## Evidence (local, this cloud sandbox: Chromium 141.0.7390.37 / SwiftShader, Node 24.19.0)

- Unit/property (Claude-authored, analytic): `view2d.test.ts` and `snapping.test.ts`, 7 new cases. Sample w7 +100 mm equals the atomic `MoveWall` result byte for byte (ignoring the `updatedAt` clock) with exact 21119175/15395175 mm²; top wall w1 drags the chain j1-j2-j3 (areas 20209425/15539425 mm²); vertical outer wall w6 −200 mm (21596175 mm² living); a 5 mm neighbour is rejected unchanged; an 80-run property over w7 positions 3500–7500 mm checks the analytic areas `4770·x − 822825` and `4770·(7827.5 − x)`; `snapLine` priority/hysteresis/disable/250 mm cap and an integer-output property.
- Browser (`tests/e2e/wall-drag.spec.ts`, 5 cases, 22 s): mouse drag with live preview, one commit, one Undo; collinear-chain drag; unselected wall still pans; Escape cancels; collision rejected with no history entry; touch tap-select, hold and drag with the loupe showing `4600, 3000`.
- `pnpm check` under Node 24.19.0: 65 files, 460 product tests, 18 tooling tests passed.
- Whole existing browser suite on the frozen code (runtime/test hashes recorded before the run): **132 passed, 1 failed (11.6 m)**. The 1 failure is `furniture-gestures.spec.ts` "UX-005 stationary mouse/touch rotation-handle tap … Enter rotates once": after pressing Undo its final canonical export still showed the rotated sofa. It is **not caused by this change**: the identical test fails 3/3 on unmodified `main` (`c7bc342`) in a separate worktree in this same sandbox, and 4/4 on this branch. Codex recorded 128/128 on local Chromium 151 and pinned CI Chromium 156; this sandbox has Chromium 141, so I attribute it to the browser/environment difference but have **not proven the cause**. The test and its assertions were not changed. Pinned CI is the gate for it.

## Failures and fixes recorded honestly

- Test-authoring mistakes found while running: comparing documents including the wall-clock `updatedAt`; reading `rev` (every commit bumps it 0→1); a click on the Export button while the mouse was still held mid-drag; two lint/type issues in the new tests. All were fixed in the new tests; no existing assertion changed.
- Self-review found two defects before any evidence was frozen: a press handler that could throw if wall setup failed after the gesture had begun (setup is now computed first), and a touch loupe centred on the wall's anchor instead of under the finger (now under the finger, on the snapped line).
- `assets:check` fails on this sandbox's default Node 22 (`catalog-blob-set`); it passes on the pinned Node 24.19.0 (reproducible-build difference between Node versions). Not related to this change.
- One `pnpm check` run on the frozen code failed a 30 s timeout in the Codex-authored `core-model` property "mixed edit/undo/redo sequences" test (heavy; the whole file takes ~39 s alone on this 4-core sandbox). `packages/` is unchanged by this task. The file passed alone and the next full `pnpm check` passed. The deadline and test were not changed.

## Limits

No physical phone, mobile-optimization, provider, release or independent-review claim. Browser touch simulation is ordinary regression evidence. Wall-clock timing of drags was not measured against the 200 ms target on devices. D36 scopes remain locked.
