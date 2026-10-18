# FR-043 account deletion and export verification (D70)

These are Claude-authored tests against the Supabase stand-in. They are not a real Supabase check, not a phone test and not a security or legal review.

## Tests
- **`apps/web/src/cloud/account.test.ts` (3 tests).**
  - **Recent sign-in:** deletion is allowed within exactly 10 minutes of signing in. A missing or invalid time, or one more than a minute in the future, is refused.
  - **Export:** it asks for trashed drawings too and lists drawings that could not be read. It gives nothing when the list itself fails.
- **`tests/e2e/cloud-account.spec.ts` (3 browser tests).**
  - **Export, then deletion:**
    - The export file holds the cloud drawing at version 1.
    - The delete button stays disabled until exactly `DELETE` is typed.
    - Deletion clears the cloud and signs out, and the confirmation stays visible.
    - The device drawing is still saved, and the linked-drawings list is cleared.
  - **Old sign-in:** a sign-in from an hour earlier must sign in again; the delete button is not offered.
  - **Public page:** `/delete-account.html` shows the English steps and the Hindi section.
- **Bug caught:** the first run found that the "deleted" confirmation vanished when sign-out closed the account section. The message now lives in the cloud panel.

## Results (2026-10-18, local)
- `account.test.ts` 3/3 passed; the cloud unit tests 20/20.
- `cloud-account.spec.ts` 3/3 passed; all cloud browser tests 13/13.
