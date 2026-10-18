# FR-035 stairs and roofs verification (D66)

These are Claude-authored analytic tests, property tests and browser tests. They are not independent fixtures and not a phone test.

## Tests
- **`packages/core-model/src/structures.test.ts` (8 tests)**
  - A 3000 mm climb in 16 steps over 4000 mm gives a 187.5 mm riser, a 250 mm tread and footprint [1550, 500, 2450, 4500].
  - First and last steps are exact, and all four directions are checked.
  - fast-check property, 80 runs, seed 20261018: the steps tile the footprint exactly, the top step equals the full height, and the risers are equal.
  - **Roof on the H.6 outer rectangle** [-115, -115, 8115, 5115]:
    - Overhang 300 gives [-415, -415, 8415, 5415] with the base at 3000.
    - A 30° gable along X rises 2915 / √3 mm.
    - A 45° gable along Y rises 4115 mm.
  - **Commands:**
    - Add, edit and delete are atomic, and Undo restores the exact original document.
    - Ten out-of-range or invalid stairs are refused without any change.
    - Exactly one roof per floor: SetRoof adds it, changes it in place (same id, keeps its finish) and removes it.
    - The first roof needs a material.
    - Deleting a floor takes its stairs and roof.
    - Validation refuses two roofs on one floor and a missing material.
    - The recovery copy renames every reference.
- **`apps/web/src/render3d/structures.test.ts` (5 tests)**
  - **Stair and roof shapes:**
    - The 16-step stair mesh has 160 triangles, spans x 1.55–2.45 m, z 0.5–4.5 m and height 0–3 m.
    - The 45° gable spans the outer rectangle and peaks 4.115 m above the 3.0 m wall tops.
    - The flat slab is 150 mm thick, and the scene bounds include it.
  - Every triangle's front face agrees with its normal, for the stair, both gable directions and the flat slab.
  - **Rebuilds:**
    - A roof edit rebuilds only that roof.
    - A wall height change moves the roof.
    - A finish change only rebinds.
    - A removed stair reports as removed.
- **`apps/web/src/editor/structure-symbol.test.ts` (3 tests):** riser lines, arrow and outline in all four directions, and the roof outline with overhang.
- **`tests/e2e/structures.spec.ts` (3 browser tests)**
  - **Stairs:**
    - "+ Add stairs" puts a 17-step stair (176.5 mm × 250 mm) at the floor centre (4000, 2500).
    - The stair can be turned and widened.
    - Width 500 is refused with a message and leaves the document unchanged.
    - Undo restores the exact original document.
  - **Roof:**
    - A sloped roof shows in 3D together with the stair.
    - Switching it to flat changes the finish.
    - "No roof" removes it, and Undo restores the original document.
  - **Floors:** a roof set upstairs belongs to that floor only.

## Results (2026-10-18, local)
- `pnpm check` (final, after the panel polish): 76 files, 553 tests passed.
- `structures.spec.ts`: 3/3 passed.
- The test run caught two mistakes in my own tests, not in the app:
  - The lookups for the direction and roof drop-downs used label text, but a label that wraps a drop-down also contains its option texts.
  - One test title claimed a floor-deletion check that the test did not perform; the title is now accurate.
- Screenshots of the 2D plan, the 3D gable roof and the 3D stair looked as intended.

## Pending
- Phone tests on Low and Mid phones.
- Final Claude review.
- Stair openings in upper floors (no floor slabs exist yet).
