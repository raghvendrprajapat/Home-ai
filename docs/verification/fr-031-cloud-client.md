# FR-031 cloud sign-in and saving verification (D67)

These are Claude-authored tests run against a stand-in for Supabase. They are not a real Supabase or Google check, not a phone test and not a security review.

## Tests
- **`apps/web/src/cloud/cloud-save.test.ts` (7 tests).** These run the §H.5 client rules against an in-memory copy of the D65 save rules:
  - The first save sends base 0. On success only the revision moves.
  - Only one save is in flight; edits made meanwhile go in the next save with the newest geometry.
  - A lost answer is retried with the identical request and replayed, not saved twice.
  - Back-off goes 2/4/8/16/32/60/60 s, and coming back online retries at once.
  - A conflict pauses saving and keeps the local work.
  - The bundled sample is reported as not in the cloud.
  - A drawing opened from the cloud does not re-upload, and closing mid-save applies nothing.
- **`apps/web/src/cloud/config.test.ts` (5 tests).**
  - Only `https://<ref>.supabase.co` URLs are accepted.
  - Secret and service-role keys are refused.
  - Transport failures map to retry and unknown answers to "unexpected".
  - The app reconnects on its own only after an earlier sign-in or a return from Google.
  - The library loads once and a failed load can be retried.
- **`tests/e2e/cloud.spec.ts` (4 browser tests).** The real supabase-js runs against the routed stand-in:
  - The Google authorize redirect carries a PKCE challenge, the token exchange works, and the code leaves the address bar.
  - The sample becomes a new cloud project at version 1, and an edit makes version 2.
  - A dropped request is retried with an identical body.
  - A newer cloud head pauses saving without overwriting anything.
  - Opening from the Projects screen shows version 3 and sends no save.
- **Mutation check:** making the retry build a new request fails the "no connection" browser test, because the received request differs from the expected one.

## Results (2026-10-18, local)
- `vitest run apps/web/src/cloud`: 12/12 passed.
- `playwright test tests/e2e/cloud.spec.ts`: 4/4 passed.
- `pnpm check` (after merging main): 75 files, 549 tests passed.
- Full browser suite: 163 passed, 1 failed. The failure is the known sandbox-only UX-005 rotation-handle tap, which also fails on `main` here and passes in CI. The 48 px touch-target test (UX-004) passes with the new cloud panel.

## Pending
- A real Supabase project and real Google sign-in (owner setup in `docs/decisions/cloud-client.md`).
- Android sign-in.
- Phone tests.
