# FR-034 — multiple floors

2026-10-18 · [D64](../decisions/multiple-floors.md) · [D63](../codex-start-here.md) · [handoff](../claude-code-handoff.md).

**Status: complete locally; the required pinned-CI jobs for the exact PR head are reported in the PR, not here.**

## Evidence (local, Node 24.19.0, this sandbox's Chromium 141 / SwiftShader)

### Core-model unit tests (`floors.test.ts`, 8 cases, analytic on the H.6 sample)
- **Adding a floor:** the new floor gets level 1 and elevation 3000. The ground floor is untouched.
- **Copying the outline:** only 230 mm outer walls come up, giving one upstairs room of (8000 − 230) × (5000 − 230) = **37 062 900 mm²**. Ground rooms stay at **20 642 175** and **15 872 175 mm²**.
- **Identical stacked floors:** a 100 mm upstairs partition on exactly the ground partition line gives upstairs rooms of 4335 × 4770 and 3335 × 4770. Nothing is shared across floors.
- **Rectangle upstairs:** a 150 mm rectangle on the ground wall line does not trigger the ground floor's shared-wall rule. Its room is 2850 × 2850.
- **Deleting a floor:** it removes everything on that floor, and Undo restores the exact document. The last floor cannot be deleted. Deleting the ground floor takes its doors, windows and furniture.
- **Ordering and limits:** levels and elevations stay ordered (elevations 0, 3200, 6200, 9200, 12200, 15200 after a raise to 3200). There are at most 6 floors. Bad names and bad sources are rejected atomically.
- **Validation:** ordered floors are accepted. Duplicate levels and non-increasing elevations are rejected with code `floors`.

### Geometry property test (`packages/geometry/src/floors.test.ts`)
- 60 runs with random offsets of the whole sample copied onto a second floor, including exactly on top. Each floor's faces and footprints are identical to that floor derived alone.
- Exactly stacked floors keep the H.6 clear areas on both floors.

### Browser tests (`tests/e2e/floors.spec.ts`, 4 cases)
- **Add with copy:**
  - "+ Add floor" with the copy checkbox makes "Floor 1" active at 3000 mm, with only 230 mm walls and one room.
  - The header shows "2 floors". Ground walls are byte-identical.
  - Clicking (4500, 2500) picks the room upstairs, but the partition wall downstairs.
  - Undo restores the exact original document.
- **Wall upstairs:** a wall drawn upstairs with the wall tool lands on the upper floor and splits it into two rooms. Ground walls and rooms are unchanged.
- **3D cutaway and walking:**
  - On the ground floor, 3D clips at 3000 mm. "Show floors above" removes the clip. On the top floor nothing is clipped.
  - Walking upstairs reports eye 1600 mm above floor elevation 3000 mm.
- **Delete:** deleting needs confirmation and names the floor. Undo restores the exact document. A single floor's delete button is disabled.
- The 5 existing walk-mode cases still pass with the change.

## Failures and fixes recorded honestly
- **Room identity crossed floors.** Copying the outline first failed with "More than one room would inherit the same identity": room identity compared the new upstairs room with the ground rooms below it. Fixed so identity, clear areas and room choices are per floor.
- **Change detection crossed floors.** Adding a floor first bumped the `rev` of ground-floor walls, because the 500 mm neighbour check that marks walls for 3D rebuild ignored floors. The browser test caught it (ground walls not byte-identical). Fixed so the check never crosses floors.
- **Existing test unchanged.** An existing validation test expected the error code `floors` for a duplicated floor. The new floor rules use the same code, so that test was not changed.
- **Floor tabs were too small.** The full browser run (158 passed, 2 failed) caught that the floor tab buttons were 40 px tall, below the 48 px touch-target rule (UX-004 responsive buttons). They are now at least 48 × 48 px, and that test passes. The other failure, UX-005 rotation-handle tap, is a known sandbox-only failure: it also fails on `main` here and passes in CI.
- **After merging `main` (D63):** `pnpm check` passes 73 files / 537 tests. The interactions, floors and foundation specs pass 17/17.
- **Test-authoring mistakes**, fixed in the new tests only:
  - floor-relative walk data versus camera height (the walk diagnostics now also report the floor elevation);
  - read-only type casts.

## Limits
- No floor slabs between levels.
- No stairs or roofs yet (FR-035).
- No copying of rooms or furniture between floors.
- No physical phone, mobile-optimization or independent-review claim. The Hindi strings were written by Claude.
