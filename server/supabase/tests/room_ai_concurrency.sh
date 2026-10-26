#!/usr/bin/env bash
# D86 Room photo AI races with two real sessions (same style as concurrency.sh). Session 1 reserves the last slot and
# keeps its transaction open for a while; session 2 must wait on the settings-row lock and then see that slot taken.
# Runs inside the database prepared by run.sh (room_ai.test.sql already ran there). Claude-authored builder test.
set -euo pipefail
u1='00000000-0000-4000-8000-0000000000c3'
u2='00000000-0000-4000-8000-0000000000c4'
as() { echo "set role authenticated; set request.jwt.claims = '{\"sub\":\"$1\",\"role\":\"authenticated\"}';"; }
q() { psql -q -X -A -t -v ON_ERROR_STOP=1 -c "$1"; }
fail() { echo "FAIL $1"; exit 1; }
tmp="${TMPDIR:-/tmp}/ai-race.$$"
# Session 1: run $2 as user $1 inside a transaction that holds the lock for 1.5 s.
slow() { psql -q -X -A -t -v ON_ERROR_STOP=1 > "$tmp" <<SQL &
$(as "$1")
begin;
select 'first:' || ($2)::text;
select pg_sleep(1.5);
commit;
SQL
}
first() { wait; grep '^first:' "$tmp" | sed 's/^first://'; rm -f "$tmp"; }

q "insert into auth.users (id) values ('$u1'), ('$u2')" >/dev/null
q "update ai.settings set enabled = true, monthly_cap_usd = 3, free_previews_per_month = 3, est_edit_usd = 0.08" >/dev/null
q "delete from ai.jobs where created_at >= date_trunc('month', now(), 'UTC') and status <> 'refunded'" >/dev/null
for i in 1 2; do q "$(as $u1) select public.reserve_ai_job('race-used-$i', 'edit') ->> 'status'" | grep -qx reserved || fail "setup $i"; done

# 1. Two different taps race for the person's third (last) preview: exactly one gets it.
slow "$u1" "public.reserve_ai_job('race-last-a', 'edit') ->> 'status'"
sleep 0.5
second=$(q "$(as $u1) select public.reserve_ai_job('race-last-b', 'edit')::text")
a=$(first)
[ "$a" = 'reserved' ] || fail "last preview, first session: $a"
[ "$second" = '{"ok": false, "code": "NO_PREVIEWS_LEFT", "details": {"limit": 3}}' ] || fail "last preview, second session: $second"
[ "$(q "select count(*) from ai.jobs where user_id = '$u1' and kind = 'edit' and status <> 'refunded'")" = 3 ] || fail 'three jobs'
echo 'ok  two parallel reservations for the last preview: one wins, the other waits for the lock and is refused'

# 2. The same tap sent twice at once (a retry racing its original): one job, both answers name it.
slow "$u2" "public.reserve_ai_job('race-same-1', 'edit') ->> 'jobId'"
sleep 0.5
retry=$(q "$(as $u2) select public.reserve_ai_job('race-same-1', 'edit')::text")
a=$(first)
[ "$retry" = "{\"ok\": true, \"jobId\": \"$a\", \"status\": \"reserved\", \"replayed\": true}" ] || fail "racing retry: $retry (first $a)"
[ "$(q "select count(*) from ai.jobs where client_job_id = 'race-same-1'")" = 1 ] || fail 'one row'
echo 'ok  a retry racing its original gets the same job; one row, one preview'

# 3. Two accounts race for the last US$0.08 under the monthly cap: one passes, the other is AI_PAUSED.
spent=$(q "select public.gp_ai_spent()")
q "update ai.settings set monthly_cap_usd = $spent + 0.10" >/dev/null
slow "$u2" "public.reserve_ai_job('race-cap-u2', 'edit') ->> 'status'"
sleep 0.5
other=$(q "$(as $u1) select public.reserve_ai_job('race-cap-u1', 'segment', '$u1/race-session-1')::text")
a=$(first)
[ "$a" = 'reserved' ] || fail "cap, first session: $a"
# 0.02 of the cap is left after the edit: a 0.01 tap still fits, a second edit would not.
[ "$(echo "$other" | grep -o '"status": "reserved"')" = '"status": "reserved"' ] || fail "cap, small tap: $other"
slow "$u1" "public.reserve_ai_job('race-cap-u1b', 'segment', '$u1/race-session-1') ->> 'status'"
sleep 0.5
over=$(q "$(as $u2) select public.reserve_ai_job('race-cap-u2b', 'edit')::text")
a=$(first)
[ "$a" = 'reserved' ] || fail "cap, second tap: $a"
[ "$over" = '{"ok": false, "code": "AI_PAUSED"}' ] || fail "cap, edit over the cap: $over"
total=$(q "select public.gp_ai_spent() <= (select monthly_cap_usd from ai.settings)")
[ "$total" = t ] || fail 'spend above the cap'
echo 'ok  racing accounts never push the estimated monthly spend above the cap'
q "update ai.settings set monthly_cap_usd = 3" >/dev/null
echo 'ALL ROOM AI CONCURRENCY TESTS PASSED'
