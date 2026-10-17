# FR-026 — walk mode

2026-10-17 · [D56](../decisions/walk-mode.md) · [handoff](../claude-code-handoff.md) · [final Codex checkpoint](https://github.com/raghvendrprajapat/Home-ai/issues/98).

Built by Claude Code under the owner's D52 continuation. A **Walk** button in the 3D view puts the camera at eye height in the largest room; WASD/arrows, drag-to-look and an on-screen joystick move it with swept circle collision against the derived wall footprints, doors as passages, and an always-visible Exit. **Status: in progress. The whole-suite browser result is added before merge.**

## Evidence so far (local, Node 24.19.0, this sandbox's Chromium 141 / SwiftShader)

- Unit (Claude-authored, analytic, REN-002): `walk.test.ts`, 16 cases. A 50 mm wall is never crossed at 16, 33 or 250 ms frames and the centre stops exactly 4975 − 250 = 4725; one 20 m move cannot tunnel; a 10 s stall advances only 250 ms; diagonal motion slides along a wall; on the H.6 sample the interior, exterior and window walls stop at their hand-derived lines (4442.5 − 250, 115 + 250, 4885 − 250); the 900 mm bedroom door and the 1000 mm main door are passages at every frame size; a 540 mm door, a 1799 mm lintel and any window or raised sill stay solid, while 550 mm and 1800 mm pass; a 200-run property keeps random walking inside a closed 10 × 6 m room at every frame size; starting inside a wall is pushed out; controller axes (north at yaw 0, east at yaw 90), diagonal normalisation, pitch/yaw/eye clamps and the camera pose mapping are checked analytically.
- Browser (`tests/e2e/walk-mode.spec.ts`, 5 cases, 34 s): starts at the living-room centre; W stops at y = 365 (the analytic wall stop) with nothing written to the model; the partition blocks at x = 4192.5 while the 900 mm door lets the camera into the bedroom; Exit and Escape restore the exact orbit pose; the joystick walks by touch and stops on release, dragging the view looks; +/− change eye height within 1000–2000 mm; a project with no room refuses with the "draw a room first" message.
- `pnpm check` under Node 24.19.0: 67 files, 498 product tests, 18 tooling tests passed.

## Failures and fixes recorded honestly

- A first browser run exposed a real defect: pressing + or − several times within one frame overwrote the previous press, so steps were lost (12 presses reached only 1300 mm). Presses now queue, one 100 mm step per frame.
- Test-authoring mistakes found while running, fixed in the new tests only: a sliding-wall test whose wall was shorter than a 250 ms path (the circle legitimately walked around the end), and a local variable that shadowed the page-start helper.
- `assets:check` still needs the pinned Node 24.19.0 (this sandbox defaults to Node 22); see the FR-008 record.

## Limits

Simulated input in a desktop Chromium only. No physical phone, frame-time, battery or heat measurement; no independent review. Furniture is not an obstacle; no stairs, gravity or pointer lock. Hindi strings were written by Claude and have had no native-speaker review. D36 scopes remain locked.
