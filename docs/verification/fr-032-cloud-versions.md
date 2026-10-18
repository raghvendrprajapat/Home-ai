# FR-032 conflict choices and version history verification (D68)

These are Claude-authored tests against the Supabase stand-in. They are not a real Supabase check, not a phone test and not a security review.

## Tests
- **`packages/core-model/src/server-adopt.test.ts` (3 tests).**
  - `adoptServerRevision` moves only the revision forward. It refuses equal, backwards or stale bases without change.
  - `replaceFromServer` takes a newer head of the same drawing exactly, advances the generation and clears undo/redo.
  - `replaceFromServer` refuses another drawing, an older or equal revision, and invalid content, without change.
- **`apps/web/src/cloud/cloud-save.test.ts` (3 new tests, 10 in total).**
  - Replace after review sends base 3 with document revision 3 and this device's geometry, and ends at revision 4.
  - A lost answer during replace is replayed and the revision is adopted once (head 6).
  - `markInSync` and `markConflict` work as described.
- **`tests/e2e/cloud-versions.spec.ts` (4 browser tests)** with the real supabase-js against the routed stand-in:
  - Inspecting opens a separate, unlinked copy of the 1-floor cloud head.
  - Saving mine as a new cloud project gives version 1 with 2 floors, and the old project stays at 3.
  - Replace needs a confirmation naming version 3, lands as version 4, and versions 1–4 are all kept.
  - Restoring version 1 at head 3 gives version 4 with 1 floor and Undo disabled; version 2 opens as a copy with 2 floors.

## Results (2026-10-18, local)
- `pnpm check`: 76 files, 555 tests passed.
- `cloud-versions.spec.ts`: 4/4 passed; with `cloud.spec.ts` (now on the shared stand-in) 8/8.
