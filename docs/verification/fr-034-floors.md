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

## Audit (2026-10-19)
An audit of FR-034/035 with the H.6 sample plus "+ Add floor" (outer walls copied, upper floor at 3000 mm) found six problems. All six are fixed. The tests below were written by Claude, the same agent that made the fixes. They are not independent review. Each fix was checked by undoing it and confirming its test then fails (mutation check).

| # | Finding | Fix | Tests |
|---|---|---|---|
| 1 (medium) | In 3D, the pick and selection box of a door or window always used the ground floor height. An upstairs door could not be picked, and a "phantom" door blocked the ground wall below it. | `openingBounds` (render3d/camera.ts) uses the host wall's floor elevation. It is shared by picking, the selection outline and "focus selection". | `floors-3d.test.ts` "an upstairs door is picked at its own floor height": box 3.0–5.1 m; a ray at 0.5 m picks ground wall w1, at 1.0 m the ground window, at 4.0 m the upstairs door. |
| 2 (medium) | "Cut away floors above" (D64) only clipped at the wall top + 5 mm. Upper room floors at exactly 3.0 m stayed visible, covering the ground floor. Three.js picking ignores clipping, so hidden upstairs rooms, walls, doors and furniture could still be picked. | The 3D scene now hides everything that belongs to a floor above the active one: walls, room floors, ceilings, thresholds, stairs, roofs, furniture boxes and furniture models. The Low tier keeps floors in separate batches so this works there too. Picking also drops hits and door/window boxes on those floors. The clip plane and "Show floors above" work as before. | `floors-3d.test.ts` "low/mid ground-floor cutaway …": with the ground floor active, a downward ray at plan (2000, 2500) mm picks the ground Living room; an upstairs item is not picked, and nothing drawn belongs to the upper floor. Upper floor active: the same ray picks the upstairs room. `floors.spec.ts` now also checks the 3D view's hidden-floor count (1, then 0). |
| 3 (medium) | The view-only share page drew all floors into one plan image and listed every floor's rooms together. | With two or more floors, the page shows one plan image and one room list per floor, lowest first, under the floor's name. The image text says "Floor plan of {name}, {floor}" (new Hindi + English text). A one-floor drawing looks exactly as before. | `cloud/SharedView.test.tsx` (jsdom): one floor gives 1 image, 1 list, no floor headings (this test also passes on the old code, as intended). Two floors give "Ground floor" then "Upar"; the ground rooms are Living 20.64 m² and Bedroom 15.87 m²; upstairs, (8000−230) × (5000−230) mm = 37.06 m²; the images are drawn from 7 and 6 walls. |
| 4 (low) | Rename floor (`UpdateFloor`) accepted blank or 5000-character names that `AddFloor` refuses. A file with a blank floor name was accepted. | `UpdateFloor` uses the same rule as `AddFloor`: the name is trimmed and must have 1–60 characters. Loaded files are checked by trimmed length too (`floor-name`). The JSON schema is not changed: it cannot express "after trimming", and changing the accepted schema fixture is not needed for the check. Names that were valid before still load. | `floors.test.ts` "UpdateFloor and loaded files use the AddFloor name rule". |
| 5 (low) | 3D ceiling lights used the ground floor height for every floor. | New `pointLightPosition` (render3d/lighting.ts) uses the light's own floor. | `floors-3d.test.ts` "a point light hangs from its own floor": upper floor 3000 + 2900 mm gives 5.9 m; ground gives 2.9 m. |
| 6 (minor) | Changes to floors only (add a floor without copying, rename, delete an empty floor) did not report the floor as changed, so the drawing's "last changed" time did not update. | Floors are now included in the change list of every command. | `floors.test.ts` "floor-only edits report the floor as changed and move updatedAt". |

**Results (local, 2026-10-19, Node 24.19.0):**
- `pnpm check`: schema, catalog, lint and typecheck pass; vitest 91 files, 688 tests passed; node script tests 22/22 passed.
- `floors.spec.ts`, `structures.spec.ts` and `cloud-share.spec.ts`: 9/9 passed.
- 3D regression specs (picking-furniture, furniture-models, context-resources, scene-builder, furniture-3d-gestures, camera-quality-image, walk-mode, split-view): 51/51 passed (6.1 min).
- Mutation check: each of the 6 fixes was undone one at a time (finding 2 twice: the scene hiding and the picking filter separately). Every time, the matching new test failed. With the fixes back in place, all tests pass.

**Still pending:** phone tests on Low and Mid phones, and the final Claude review. The Hindi text was written by Claude.
