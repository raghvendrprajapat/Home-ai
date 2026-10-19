# Cloud features audit (2026-10-19)

The owner asked for an audit and verification of all earlier work that was still pending. A separate review agent read the FR-031/032/033/043 database migration, the client save queue, the share, account and Android sign-in code and the spec (§H.5, §D.8). It confirmed each finding with a probe: vitest against the real `CloudSaver`, or SQL on a local PostgreSQL 16.

These are Claude-authored checks against stand-ins. They are not a real Supabase or Google check, not a phone test and not the final independent security review, which stays a release gate.

## Sound
Checked and found correct:
- **Database access:**
  - Row security is on for every table, and there are no direct writes for `anon`/`authenticated`.
  - The token hash is unreadable, and internal helpers are not executable by users.
  - Every SECURITY DEFINER function pins `search_path=""`.
- **Save function:**
  - Ownership is checked under the row lock, and receipts before the head; there is no last-write-wins.
  - Pruning keeps 20 versions.
- **Share links:** tokens have 244 bits, only their hash is stored, and they stay after `#`.
- **Account deletion:** the cascade removes everything.
- **Secrets:** none are present.
- **Client save queue:**
  - A retry resends the same request.
  - Only the revision moves after a save.
  - "Keep mine" and "Inspect" create copies.

## Findings and fixes
| # | Finding (severity) | Fix | Tests |
|---|---|---|---|
| 1 | **High.** Each time a cloud drawing was opened, an unchanged copy was uploaded as a new version. About 20 reopenings pushed the real history out of the 20 kept versions. A save that committed but lost its answer, followed by an app restart, showed a false conflict (and "Keep mine" then duplicated the drawing). The §H.5 "local recovery" step was missing. | Per drawing, this device remembers the acknowledged revision and a content tag, plus the tag of a save still waiting for its answer (`gharplan.cloud.sync`; cleared with the cloud links after account deletion). Reopening an unchanged drawing uploads nothing. If the app closed before it stored the acknowledged revision, it takes that revision. On a conflict, if the cloud head is exactly the unanswered save, the drawing takes that revision and keeps saving newer edits on top. Any other head is still a real conflict. | `cloud-save.test.ts`: 5 new cases. `cloud.spec.ts` "reopening an unchanged cloud drawing uploads nothing" (3 reloads, still version 1). |
| 2 | **Medium.** Account deletion was checked for a recent sign-in only in the app. A valid but old token could call `delete_account` directly. | The database checks the sign-in time from the token's `amr` (within 10 minutes, at most 60 s in the future). Otherwise it returns `REAUTH_REQUIRED`, and the app asks the person to sign in again. | SQL: a token without a sign-in time is refused, an 11-minute-old sign-in is refused, nothing is removed, and a 2-minute-old sign-in deletes. `cloud-account.spec.ts`: a server refusal shows the sign-in-again message and nothing is deleted. |
| 3 | **Low.** Taking a drawing out of the trash silently brought its old view-only links back. | Trashing revokes the drawing's live links. A new link can be made after restoring. | SQL: no live link after untrash, the old link stays dead, and a new link works. |
| 4 | **Low.** A document with no `name` (or `revision`) gave a database error instead of `INVALID_DOCUMENT`, because `jsonb_typeof(null) <> 'string'` is null. | The checks now use `is distinct from`. | SQL: missing name and missing revision give `INVALID_DOCUMENT`. |
| 5 | **Low.** A failed Android sign-in (Google refused, or the code was not accepted) left the app silently signed out. | Our deep link with an error, or a refused code, is reported. This includes a cold start, where the failure is kept until the session connects. The cloud panel shows "Could not reach the cloud". | `native-signin.test.ts`: 2 new cases. |

## Mutation checks
Removing each fix makes its tests fail:
- **#1 (client):**
  - Without the in-sync check, the reopen test fails.
  - Without the lost-save recovery, 2 tests fail.
  - If the pending tag is overwritten, the edits-after-relaunch test fails.
  - The reopen browser test against the previous `cloud-save.ts` shows "version 2" instead of 1.
- **#2 and #3 (SQL):** without the trash revoke or the sign-in check, the SQL suite stops at that test.
- **#4:** without the new migration, the SQL suite stops at the missing-name case with the old not-null error.
- **#5:** without the failure report, both new tests fail.

## Not changed
- The server does not skip identical saves; the client now avoids sending them.
- A second device with no edits now stays on its acknowledged revision instead of conflicting. It does not load the newer cloud version by itself.
- Deleting from `auth.users` on real Supabase is still unproven (D65).

## Results (local, 2026-10-19)
- `pnpm check`: 89 test files, 721 tests passed.
- **About the property tests:** two earlier runs had time-outs in two Codex property tests (`core-model.test.ts`). They happened while another full test run was using the same 4-core machine (load about 9). That file passed 29/29 on its own, and the rerun above passed.
- `pnpm db:test` on PostgreSQL 16: all cloud database tests and both concurrency tests passed.
- Cloud browser tests (`cloud`, `cloud-account`, `cloud-versions`, `cloud-share`): 15/15 passed. The new reopen test also passed 3/3 when repeated.
