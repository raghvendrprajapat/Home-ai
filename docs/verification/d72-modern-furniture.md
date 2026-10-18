# D72 modern furniture verification

These are Claude-authored checks. They are not an aesthetic review by a designer, not a phone test and not independent fixtures.

## Tests
- **`tools/asset-pipeline/pipeline.test.mjs`: 4 new tests (14 in total).**
  - **Rounded box (100 generated sizes, radii and step counts):**
    - The outer size is exact.
    - The surface is closed and consistently wound (every edge appears once in each direction).
    - Normals are unit length and point outward.
    - The volume lies between the analytic flat-slab volume and the analytic true rounded-box volume.
  - **Cylinder (100 cases on every axis and side count):** the extents are exact and the volume equals the analytic inscribed-polygon prism, (n/2)·ru·rv·sin(2π/n)·length.
  - **Modern sofa source:**
    - One untransformed node per part, in source order.
    - Materials are named colour-finish, with metallic/roughness checked against hand-written values.
    - The triangle count equals the analytic count (2,744).
    - The preview is under 128 KiB with every point inside the frame.
  - **Rejections:** unknown shapes or finishes, an oversized radius, unsupported step/side counts, extra keys, duplicate parts, schema 1 parts, a wrong licence type and a size that does not match the parts.
- **`apps/web/src/catalog/modern-furniture.test.ts`: 8 tests.** Every new design is decoded by the app's real 3D decoder from the shipped files. Each check:
  - The part names match the source.
  - The size and ground level are exact.
  - The hand-chosen back part sits at +Z and the front part at −Z.
  - The app's main-material rule picks the intended colour: fabric for sofas, the top for tables, the body for the TV unit, the frame for the bookshelf.
- **`apps/web/src/catalog/catalog.test.ts`:**
  - The production catalog has 38 published versions and 32 listed items, with exact per-category counts.
  - Every upgraded ID still has version 1.
  - Searching "sofa" finds exactly the four sofa/armchair IDs.
- **`tests/e2e/starter-catalog.spec.ts`:** updated to the 32-item catalog (24 + 8 pages, 32 thumbnails created and released). The placed two-seat sofa now pins version 2.
- **`tests/e2e/modern-furniture.spec.ts` (new):**
  - The L-shape sofa, TV unit, coffee table and accent armchair are placed through the real catalog dialog with position and rotation.
  - Each pins its newest version and exact size.
  - Each loads as a real 3D model, and the drawn triangles equal the catalog's counts.
- **Mutation checks:**
  - Removing the winding flip on the back faces of rounded boxes fails the closure test.
  - Scaling cylinder normals by 1.01 fails the unit-normal test.

## Results (2026-10-18, local)
- `node --test tools/asset-pipeline/pipeline.test.mjs`: 14/14 passed.
- `vitest run apps/web/src/catalog`: 21/21 passed.
- `pnpm schema:check`, `assets:check` (38 assets, 0 validator errors or warnings), `assets:versions` (30 historical versions unchanged), `lint`, `typecheck` and `scripts/architecture-boundaries.test.mjs`: passed.
- Browser tests: `catalog.spec.ts` 5/5, `starter-catalog.spec.ts` 3/3, `modern-furniture.spec.ts` 1/1.
- `pnpm test`: 582 passed, 2 failed. Both failures are time limits in `packages/core-model/src/core-model.test.ts`, a file this change does not touch.
  - They fail the same way on unchanged `main` code in this session's container, at 34 s against a 30 s limit.
  - They passed in CI for PR #118.

## Pending
- Bedroom, dining and storage redesigns.
- Designer/aesthetic review.
- Low/Mid phone tests (gated).
