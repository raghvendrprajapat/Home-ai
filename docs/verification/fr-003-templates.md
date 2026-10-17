# FR-003 — project templates

2026-10-17 · [D54](../decisions/project-templates.md) · [handoff](../claude-code-handoff.md) · [final Codex checkpoint](https://github.com/raghvendrprajapat/Home-ai/issues/98).

Built by Claude Code under the owner's D52 continuation. The New project dialog offers Blank (default), 1 BHK, 2 BHK and four single-room presets; each opens as an ordinary editable project built through the real core-model commands. **Status: complete locally; the required pinned-CI jobs for the exact PR head are reported in the PR, not here.**

## Evidence (local, Node 24.19.0, this sandbox's Chromium 141 / SwiftShader)

- Unit (Claude-authored, analytic): `templates.test.ts`, 22 cases. For every template: `validateProject` is clean, the serialize/parse round trip is exact, every room's clear area equals a hand-derived value (for example 1 BHK living 4027.5 × 3427.5 = 13,804,256.25 mm²; 2 BHK bedroom 2585 × 2827.5 = 7,309,087.5 mm²; presets (w−230)×(d−230)), no room is below the 0.25 m² warning, opening counts match, each opening's world centre equals its stated point, no junction has more than 3 walls, one floor, integer mm, unique IDs, repeated room types are numbered, Hindi names come from the caller, builds are deterministic, an unknown template or empty name throws, and a template can be edited (a vertical line moved 100 mm) and undone byte for byte.
- Browser (`tests/e2e/templates.spec.ts`, 3 cases): create a 2 BHK from the real dialog (six named rooms, 5 doors, 8 windows, 1 archway, 230/115 mm walls, Undo disabled, no alert); a kitchen preset and the default Blank choice; Hindi labels with imperial units and a Hindi project name.
- `pnpm check` under Node 24.19.0: 66 files, 482 product tests, 18 tooling tests passed.
- Whole existing browser suite on the frozen code (runtime/test hashes recorded before the run and unchanged after): **135 passed, 1 failed (12.0 m)**. The 1 failure is the same `furniture-gestures.spec.ts` "UX-005 … rotation-handle tap … Enter rotates once" test that fails 3/3 on unmodified `main` in this sandbox (older Chromium 141) and that passed in pinned CI for PR #100; see the [FR-008 record](fr-008-wall-drag.md). It is not caused by this change; the cause is not proven and pinned CI is the gate.

## Failures and fixes recorded honestly

- The first template run failed for every multi-room layout: an exactly even split (for example 3000 × 3000 mm halves) makes the engine require an explicit "which half keeps the room identity" choice. The builder now resolves it with the engine's own `roomChoices`. The check is unchanged.
- Test-authoring mistakes found while running, all fixed in the new tests only: assuming document room order equals naming order (browser and unit), and one browser test title that claimed an edit it did not perform.
- `assets:check` still needs the pinned Node 24.19.0 (this sandbox defaults to Node 22); see the FR-008 record.

## Limits

No physical phone, mobile-optimization or independent-review claim. Template layouts are plausible starting points and have had no user, architect or native-speaker review; Hindi strings were written by Claude. No furniture in templates. D36 scopes remain locked.
