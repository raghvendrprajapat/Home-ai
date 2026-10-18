# FR-031/032/033/043 cloud database verification (D65)

Claude-authored checks (D52/D63 continuation). Not independent fixtures and not a security review; final Claude
review and a real Supabase deployment remain release gates.

## Commands
- `pnpm db:test` (= `bash server/supabase/tests/run.sh`) on local PostgreSQL 16 with a superuser connection.
- `pnpm check` (unchanged product checks).

## What the tests prove (on the Supabase stand-in)
| Test IDs | Check |
|---|---|
| SEC-009 | every `public` table has row level security on; every `public` function pins an empty `search_path` |
| SEC-001 | another account and signed-out visitors list/read/load nothing |
| SEC-002 | another account cannot save over, claim the id of, restore, trash, delete or share someone's project |
| SEC-003 | signed-in clients cannot insert/update/delete tables, read receipts/audit, call internal helpers or the purge |
| SEC-005 | only SHA-256 of a link token is stored; the owner cannot read the hash; revoked/trashed/deleted links read nothing |
| REL-006 | stale saves get `REVISION_CONFLICT` with the current head and write nothing; two real concurrent sessions on one base: one wins, the other waits for the lock and conflicts |
| REL-008 | a retry with the same key replays (also after the head moved, also after pruning, also racing the original); same key with other content or base is refused |
| REL-012 | first save makes revision 1; stored snapshot = sent document with the new revision; sha256 of the stored text |
| FR-032 | 25 revisions keep exactly the newest 20; restoring r6 at head 25 makes r26 with r6's content; stale/pruned restores refused |
| FR-043 | deletion needs the confirmation word; afterwards the auth user, profile, projects, versions, receipts, links and the user's audit rows are gone, other accounts untouched |
| Mutation checks | removing one `enable row level security` line fails SEC-009; disabling the head comparison fails the first stale-save test |

## Results (2026-10-18, local PostgreSQL 16)
```
ALL CLOUD DATABASE TESTS PASSED
ok  REL-006 concurrent saves on one base: one wins (r2), the other waits for the lock and conflicts
ok  REL-006 head is the winner; the loser wrote nothing
ok  REL-008 a retry racing its original replays revision 3; one version row
ALL CONCURRENCY TESTS PASSED
```
Mutation runs: `FAIL SEC-009 every public table has RLS on: got 1, expected 0` (exit 3); disabling the head check:
`duplicate key value violates unique constraint "project_versions_pkey"` (exit 3).

## Pending
Real Supabase project (owner-created), deletion from `auth.users` on real Supabase, the app screens and sign-in,
Edge Function validation, phone tests.
