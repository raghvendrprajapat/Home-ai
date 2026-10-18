# FR-033 view-only share links verification (D69)

These are Claude-authored tests against the Supabase stand-in. They are not a real Supabase check, not a phone test and not a security review.

## Tests
- **`apps/web/src/cloud/share-link.test.ts` (2 tests).**
  - The token sits after `#` and reads back exactly.
  - Anything that is not exactly 64 lowercase hex characters is ignored.
- **`tests/e2e/cloud-share.spec.ts` (2 browser tests).**
  - **Owner and visitor:**
    - The owner creates a link of the expected form, and it shows in the list.
    - A separate, never-signed-in browser context opens it. It sees the name, the "View-only" badge, two rooms and the plan image.
    - The visitor saves a copy, which opens in the normal app with a new id and revision 0.
    - The owner stops the link, and a new visit shows "This link is not available".
  - **Malformed link:** it opens the normal app.

## Results (2026-10-18, local)
- `pnpm check`: 77 files, 557 tests passed.
- `cloud-share.spec.ts` 2/2 passed; all cloud browser tests (FR-031/032/033) 10/10.
