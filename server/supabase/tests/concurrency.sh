#!/usr/bin/env bash
# REL-006 with two real sessions: two devices of the same account save on the same base revision at the same time.
# Session 1 commits after holding the head lock for a while; session 2 must wait on that lock and then see the new
# head. Exactly one save wins; the other gets REVISION_CONFLICT. A same-key retry racing its original replays.
# Runs inside the database prepared by run.sh (cloud_projects.test.sql already ran there).
set -euo pipefail
user='00000000-0000-4000-8000-0000000000c1'
as_user="set role authenticated; set request.jwt.claims = '{\"sub\":\"$user\",\"role\":\"authenticated\"}';"
doc() { echo "jsonb_set(jsonb_set((select doc from t.sample), '{revision}', '$1'), '{id}', '\"prj_race\"')"; }
q() { psql -q -X -A -t -v ON_ERROR_STOP=1 -c "$1"; }
fail() { echo "FAIL $1"; exit 1; }

q "insert into auth.users (id) values ('$user')" >/dev/null
q "$as_user select public.save_snapshot('prj_race', 0, 'race-0', $(doc 0)) ->> 'serverRevision'" | grep -qx 1 || fail 'setup save'

# Two different saves on base 1.
(psql -q -X -A -t -v ON_ERROR_STOP=1 <<SQL
$as_user
begin;
select 'first:' || (public.save_snapshot('prj_race', 1, 'race-1a', $(doc 1)) ->> 'serverRevision');
select pg_sleep(1.5);
commit;
SQL
) > "${TMPDIR:-/tmp}/race-a.$$" &
sleep 0.5
second=$(q "$as_user select public.save_snapshot('prj_race', 1, 'race-1b', jsonb_set($(doc 1), '{name}', '\"Device B\"'))::text")
wait
first=$(grep '^first:' "${TMPDIR:-/tmp}/race-a.$$"); rm -f "${TMPDIR:-/tmp}/race-a.$$"
[ "$first" = 'first:2' ] || fail "REL-006 first save: $first"
[ "$second" = '{"ok": false, "code": "REVISION_CONFLICT", "details": {"currentServerRevision": 2}}' ] || fail "REL-006 second save: $second"
echo 'ok  REL-006 concurrent saves on one base: one wins (r2), the other waits for the lock and conflicts'
[ "$(q "select current_revision || '/' || name from public.projects where id = 'prj_race'")" = "2/$(q "select doc->>'name' from t.sample")" ] || fail 'REL-006 head'
echo 'ok  REL-006 head is the winner; the loser wrote nothing'

# The same request sent twice at once (a retry racing its original): both answer revision 3, only one version row.
(psql -q -X -A -t -v ON_ERROR_STOP=1 <<SQL
$as_user
begin;
select 'first:' || (public.save_snapshot('prj_race', 2, 'race-2', $(doc 2)) ->> 'serverRevision');
select pg_sleep(1.5);
commit;
SQL
) > "${TMPDIR:-/tmp}/race-b.$$" &
sleep 0.5
retry=$(q "$as_user select (public.save_snapshot('prj_race', 2, 'race-2', $(doc 2)) - 'savedAt' - 'sha256')::text")
wait
first=$(grep '^first:' "${TMPDIR:-/tmp}/race-b.$$"); rm -f "${TMPDIR:-/tmp}/race-b.$$"
[ "$first" = 'first:3' ] || fail "REL-008 original: $first"
[ "$retry" = '{"ok": true, "replayed": true, "serverRevision": 3}' ] || fail "REL-008 racing retry: $retry"
[ "$(q "select count(*) from public.project_versions where project_id = 'prj_race' and revision = 3")" = 1 ] || fail 'REL-008 one row'
echo 'ok  REL-008 a retry racing its original replays revision 3; one version row'
echo 'ALL CONCURRENCY TESTS PASSED'
