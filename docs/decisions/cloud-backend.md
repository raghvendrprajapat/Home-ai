# D65: cloud database for accounts, saving, versions, links and deletion

Status: accepted by Claude Code under the D52 continuation and the owner's D63 permission (2026-10-18).
Scope: the server half of FR-031 (cloud save), FR-032 (version history, restore), FR-033 (view-only link) and
FR-043 (account deletion). The app screens, Google sign-in and the save queue come in the following client PRs.
They share one schema (§H.4), so the database lands as one migration with one test suite.

## What exists now
- `server/supabase/migrations/20261018000000_cloud_projects.sql`: tables `profiles`, `projects`,
  `project_versions` (immutable snapshots), `project_command_receipts`, `project_shares`, `audit_events`, each with
  row level security; owners can only read their own rows and nobody writes a table directly.
- Functions (all `security definer`, empty `search_path`, fully qualified names):
  `save_snapshot`, `load_project`, `restore_version`, `trash_project`, `delete_project`, `create_share`,
  `revoke_share`, `get_shared_project` (the only one signed-out visitors may call), `delete_account`, and
  `purge_trashed` (service role only, for a daily scheduled job).
- `server/supabase/tests/`: a tiny Supabase stand-in (`bootstrap.sql`), SQL assertions and a two-session race test.
  `pnpm db:test` runs them on any PostgreSQL 16 superuser connection; CI runs them in the new "Cloud database" job.

## Save protocol (§H.5, unchanged)
Request `{projectId, expectedServerRevision, commandId, document}`. The digest is SHA-256 of the jsonb text of
`[projectId, r, commandId, document]` (jsonb text output is canonical: keys sorted, whitespace fixed). In one
transaction: lock the head row → if the receipt exists, same actor + same digest replays the committed answer,
else `IDEMPOTENCY_MISMATCH` → trashed project refuses → head ≠ r gives `REVISION_CONFLICT {currentServerRevision}` →
insert revision r+1, move the head, write the receipt and an audit row. Never last-write-wins; never auto-merge.
Answers are JSON `{ok:true, serverRevision, sha256, savedAt[, replayed]}` or `{ok:false, code, details?}`.
Codes: `NOT_SIGNED_IN`, `INVALID_REQUEST`, `INVALID_DOCUMENT`, `TOO_LARGE`, `NOT_FOUND`, `PROJECT_ID_TAKEN`,
`PROJECT_LIMIT`, `PROJECT_TRASHED`, `REVISION_CONFLICT`, `IDEMPOTENCY_MISMATCH`, `VERSION_NOT_FOUND`,
`SHARE_LIMIT`, `CONFIRMATION_REQUIRED`.

## Choices and deviations (recorded so reviewers can challenge them)
1. **No Edge Functions yet; the database checks shape only.** §D.8 puts full validation (§H.3) on the server. The
   container has no Deno/Supabase CLI to build and test Edge Functions, so the RPC checks what SQL can check:
   object shape, `schemaVersion = 1`, id and revision match, name 1–120 characters, the nine arrays, at least one
   floor, ≤ 10 MiB. Full geometry validation runs in the app before every save and again on every load (cloud,
   file or link), so a bad snapshot can never be opened as a drawing. Row level security means a modified client
   can only damage its own account's data. Moving validation into an Edge Function stays a release item.
2. **Version pruning happens inside the save**, not in a scheduled function: after each commit only the newest 20
   revisions are kept (§H.5; §N.2's "12" is the older figure). Premium's 100 is billing scope (D36, still gated).
   Receipts therefore carry `committed_sha256`, so a late retry of a pruned revision still gets its exact answer.
3. **First save creates the project** (`expectedServerRevision = 0`). If another account already uses that project
   id (for example the bundled sample's fixed id) the answer is `PROJECT_ID_TAKEN`; the app then saves a copy with
   a new id. This reveals only that the id exists, never its content.
4. **Share tokens** are two random UUIDv4 values (244 random bits, above §H.4's 128) built with the core
   `gen_random_uuid()`, so no extension is needed. Only `sha256(token)` is stored, and the owner cannot even read
   the hash column. The app will put the token after `#` in the link, so it never reaches server logs or
   referrers. Up to 10 live links per project; a link shows the current head; trash, revoke or account deletion
   stops it at once. There is no SQL rate limit on link guessing; 244 bits makes guessing hopeless, and
   Supabase's API gateway limits apply.
5. **Account deletion is immediate.** `delete_account('DELETE')` deletes the `auth.users` row, which cascades to the
   profile, projects, versions, receipts and links, and removes the user's audit rows (a single anonymous
   `account_delete` row remains). This is stricter than §FR-043's "≤ 30 days". Supabase's own backups expire on
   their schedule (to be disclosed as ≤ 90 days in the privacy policy). §D.8's "recent sign-in" check is done in
   the app by asking the user to sign in again just before deleting; SQL cannot see when the sign-in happened.
   **Not yet proven on real Supabase:** that the migration owner may delete from `auth.users` (the common
   Supabase pattern; the stand-in allows it).
6. **Anti-abuse limit:** 200 projects per account (not a paid-plan limit; billing stays gated).
7. **Trash:** 30 days, then `purge_trashed()` removes it. On real Supabase the owner enables a daily schedule
   (pg_cron) for it; until then trashed projects simply stay in the trash.

## Owner setup (no secrets in chat or code)
Live cloud features need the owner's own Supabase project; the steps come with the client PR. Only the project URL
and the public "anon" key go into the app build (they are designed to be public; row level security protects the
data). The service-role key, Google client secret and database password stay in the Supabase dashboard and never
enter this repository, CI logs or chat.

## Not done here
App screens, Google sign-in (web and Android), the save queue, conflict screen, version list, share screen,
export and the account-deletion web page. Real Supabase deployment and any phone test.
