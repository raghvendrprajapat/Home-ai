-- Room photo AI database tests (D86). Claude-authored builder tests; not independent fixtures.
-- Run by server/supabase/tests/run.sh after bootstrap.sql, every migration and cloud_projects.test.sql.
-- Expected values come from the owner's numbers (US$3 cap, 3 previews, 20 taps a day, estimates 0.08 / 0.01),
-- never from the functions under test.
\set ON_ERROR_STOP 1
\set QUIET 1
\pset format unaligned
\pset tuples_only on

create schema if not exists t;
create or replace function t.eq(label text, actual anyelement, expected anyelement) returns void language plpgsql as $$
begin
  if actual is distinct from expected then raise exception 'FAIL %: got %, expected %', label, actual, expected; end if;
  raise notice 'ok  %', label;
end $$;
grant usage on schema t to anon, authenticated, service_role;
grant execute on all functions in schema t to anon, authenticated, service_role;

insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000a1', 'ai1@example.test'), ('00000000-0000-4000-8000-0000000000a2', 'ai2@example.test');
\set as_1 'set role authenticated; set request.jwt.claims = ''{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}'';'
\set as_2 'set role authenticated; set request.jwt.claims = ''{"sub":"00000000-0000-4000-8000-0000000000a2","role":"authenticated"}'';'
\set as_anon 'set role anon; set request.jwt.claims = '''';'
\set as_service 'set role service_role; set request.jwt.claims = ''{"role":"service_role"}'';'
\set as_admin 'reset role; set request.jwt.claims = '''';'

-- Shape and defaults -------------------------------------------------------------------------------------------
:as_admin
select t.eq('RLS is on for both AI tables',
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'ai' and c.relkind = 'r' and c.relrowsecurity), 2::bigint);
select t.eq('owner defaults: on, US$3 cap, 3 previews, 0.08 / 0.01 estimates, 20 taps a day',
  (select row(enabled, monthly_cap_usd, free_previews_per_month, est_edit_usd, est_segment_usd, segment_daily_limit)::text from ai.settings), '(t,3.0000,3,0.0800,0.0100,20)');
select t.eq('every public function still pins an empty search_path',
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and not coalesce(p.proconfig @> array['search_path=""'], false)), 0::bigint);

-- Signed out: nothing. ------------------------------------------------------------------------------------------
:as_anon
do $$ begin perform public.ai_quota(); raise exception 'FAIL anon may call ai_quota';
exception when insufficient_privilege then raise notice 'ok  anon cannot call ai_quota'; end $$;
do $$ begin perform public.reserve_ai_job('anon-job-0001', 'edit'); raise exception 'FAIL anon may reserve';
exception when insufficient_privilege then raise notice 'ok  anon cannot reserve'; end $$;
:as_admin
set role authenticated; set request.jwt.claims = '';
select t.eq('a token without a user is NOT_SIGNED_IN', public.reserve_ai_job('nouser-0001', 'edit'), '{"ok":false,"code":"NOT_SIGNED_IN"}'::jsonb);

-- Quota and idempotent reservations --------------------------------------------------------------------------
:as_1
select t.eq('fresh account: 3 of 3 previews, 20 taps, not paused', public.ai_quota(),
  '{"ok":true,"enabled":true,"paused":false,"segmentPaused":false,"previewsPerMonth":3,"previewsLeft":3,"segmentsLeft":20}'::jsonb);
select t.eq('bad client job id is refused', public.reserve_ai_job('short', 'edit'), '{"ok":false,"code":"INVALID_REQUEST"}'::jsonb);
select t.eq('unknown kind is refused', public.reserve_ai_job('job-1-aaaa', 'video'), '{"ok":false,"code":"INVALID_REQUEST"}'::jsonb);
select t.eq('a folder of another account is refused', public.reserve_ai_job('job-1-aaaa', 'edit', '00000000-0000-4000-8000-0000000000a2/job-1-aaaa'), '{"ok":false,"code":"INVALID_REQUEST"}'::jsonb);
select t.eq('the results folder is refused', public.reserve_ai_job('job-1-aaaa', 'segment', '00000000-0000-4000-8000-0000000000a1/results'), '{"ok":false,"code":"INVALID_REQUEST"}'::jsonb);
select t.eq('a path that climbs out is refused', public.reserve_ai_job('job-1-aaaa', 'segment', '00000000-0000-4000-8000-0000000000a1/../x'), '{"ok":false,"code":"INVALID_REQUEST"}'::jsonb);
select public.reserve_ai_job('job-1-aaaa', 'edit') as r1 \gset
select t.eq('first reservation: reserved, 2 previews left', (:'r1'::jsonb) - 'jobId', '{"ok":true,"status":"reserved","previewsLeft":2}'::jsonb);
select t.eq('same client job id: same job, replayed', public.reserve_ai_job('job-1-aaaa', 'edit'),
  jsonb_build_object('ok', true, 'jobId', (:'r1'::jsonb)->'jobId', 'status', 'reserved', 'replayed', true));
select t.eq('the replay did not take a second preview', public.ai_quota() ->> 'previewsLeft', '2');
select t.eq('same key for another kind is a mismatch', public.reserve_ai_job('job-1-aaaa', 'segment'), '{"ok":false,"code":"IDEMPOTENCY_MISMATCH"}'::jsonb);
select t.eq('default folder is <user>/<client job id>', (select input_folder from ai.jobs where id = ((:'r1'::jsonb)->>'jobId')::uuid), '00000000-0000-4000-8000-0000000000a1/job-1-aaaa');
select t.eq('the estimate held is 0.08', (select est_cost_usd from ai.jobs where id = ((:'r1'::jsonb)->>'jobId')::uuid), 0.08::numeric);
select t.eq('get_ai_job for the owner', public.get_ai_job(((:'r1'::jsonb)->>'jobId')::uuid) - 'createdAt',
  jsonb_build_object('ok', true, 'jobId', (:'r1'::jsonb)->'jobId', 'kind', 'edit', 'status', 'reserved', 'outputPath', null));
select public.reserve_ai_job('job-2-aaaa', 'edit') ->> 'jobId' as j2 \gset
select public.reserve_ai_job('job-3-aaaa', 'edit') ->> 'jobId' as j3 \gset
select t.eq('3 per month: the fourth is refused', public.reserve_ai_job('job-4-aaaa', 'edit'), '{"ok":false,"code":"NO_PREVIEWS_LEFT","details":{"limit":3}}'::jsonb);
select t.eq('a refused reservation wrote nothing', (select count(*) from ai.jobs where client_job_id = 'job-4-aaaa'), 0::bigint);
select t.eq('quota shows 0 left', public.ai_quota() ->> 'previewsLeft', '0');
select t.eq('an earlier key still replays when the month is used up', public.reserve_ai_job('job-1-aaaa', 'edit') ->> 'replayed', 'true');

-- RLS isolation -------------------------------------------------------------------------------------------------
:as_2
select t.eq('B sees none of A''s jobs', (select count(*) from ai.jobs), 0::bigint);
select t.eq('B cannot read A''s job through get_ai_job', public.get_ai_job(:'j2'::uuid), '{"ok":false,"code":"NOT_FOUND"}'::jsonb);
select t.eq('B still has 3 previews', public.ai_quota() ->> 'previewsLeft', '3');
do $$ begin perform 1 from ai.settings; raise exception 'FAIL settings readable by a client';
exception when insufficient_privilege then raise notice 'ok  clients cannot read ai.settings'; end $$;
do $$ begin update ai.settings set monthly_cap_usd = 1000; raise exception 'FAIL settings writable by a client';
exception when insufficient_privilege then raise notice 'ok  clients cannot change ai.settings'; end $$;
do $$ begin insert into ai.jobs (user_id, client_job_id, kind, est_cost_usd, input_folder) values (auth.uid(), 'forged-0001', 'edit', 0, 'x'); raise exception 'FAIL client insert';
exception when insufficient_privilege then raise notice 'ok  clients cannot insert jobs'; end $$;
do $$ begin update ai.jobs set status = 'refunded'; raise exception 'FAIL client update';
exception when insufficient_privilege then raise notice 'ok  clients cannot update jobs'; end $$;
:as_1
select t.eq('A sees exactly its own 3 jobs', (select count(*) from ai.jobs), 3::bigint);

-- Clients cannot call service functions -------------------------------------------------------------------------
do $$ begin perform public.finish_ai_job(gen_random_uuid(), false, null, 'x'); raise exception 'FAIL client finish';
exception when insufficient_privilege then raise notice 'ok  clients cannot call finish_ai_job (a self-refund)'; end $$;
do $$ begin perform public.claim_ai_job(gen_random_uuid()); raise exception 'FAIL client claim';
exception when insufficient_privilege then raise notice 'ok  clients cannot call claim_ai_job'; end $$;
do $$ begin perform public.start_ai_job(gen_random_uuid(), 'r'); raise exception 'FAIL client start';
exception when insufficient_privilege then raise notice 'ok  clients cannot call start_ai_job'; end $$;
do $$ begin perform public.ai_expired_paths(); raise exception 'FAIL client expired paths';
exception when insufficient_privilege then raise notice 'ok  clients cannot list expired paths'; end $$;
do $$ begin perform public.mark_ai_purged(array[]::uuid[]); raise exception 'FAIL client purge';
exception when insufficient_privilege then raise notice 'ok  clients cannot mark purged'; end $$;
do $$ begin perform public.ai_job_for_webhook(gen_random_uuid(), 'r'); raise exception 'FAIL client webhook lookup';
exception when insufficient_privilege then raise notice 'ok  clients cannot call ai_job_for_webhook'; end $$;
do $$ begin perform public.gp_ai_expire_stale(); raise exception 'FAIL client helper';
exception when insufficient_privilege then raise notice 'ok  clients cannot call internal helpers'; end $$;
:as_service
do $$ begin perform public.reserve_ai_job('svc-job-0001', 'edit'); raise exception 'FAIL service reserve';
exception when insufficient_privilege then raise notice 'ok  the service role cannot reserve for nobody'; end $$;

-- Lifecycle: claim once, start, finish; refund frees the preview ---------------------------------------------
select t.eq('claim moves reserved → submitting', public.claim_ai_job(:'j2'::uuid) - 'jobId',
  '{"ok":true,"userId":"00000000-0000-4000-8000-0000000000a1","kind":"edit","folder":"00000000-0000-4000-8000-0000000000a1/job-2-aaaa"}'::jsonb);
select t.eq('a second claim is refused (never two provider calls)', public.claim_ai_job(:'j2'::uuid), '{"ok":false,"code":"NOT_CLAIMABLE","details":{"status":"submitting"}}'::jsonb);
select t.eq('start records the request id', public.start_ai_job(:'j2'::uuid, 'req-2'), '{"ok":true}'::jsonb);
select t.eq('start again with the same id replays', public.start_ai_job(:'j2'::uuid, 'req-2'), '{"ok":true,"replayed":true}'::jsonb);
select t.eq('webhook lookup by job id and signed request id', public.ai_job_for_webhook(:'j2'::uuid, 'req-2') ->> 'status', 'running');
select t.eq('webhook lookup with another request id finds nothing', public.ai_job_for_webhook(:'j2'::uuid, 'req-other'), '{"ok":false,"code":"NOT_FOUND"}'::jsonb);
select t.eq('a result outside the owner''s results folder is refused',
  public.finish_ai_job(:'j2'::uuid, true, '00000000-0000-4000-8000-0000000000a2/results/x.jpg', null), '{"ok":false,"code":"INVALID_REQUEST"}'::jsonb);
select t.eq('a provider error refunds', public.finish_ai_job(:'j2'::uuid, false, null, 'provider error'), '{"ok":true,"status":"refunded"}'::jsonb);
select t.eq('finishing twice keeps the first answer', public.finish_ai_job(:'j2'::uuid, true, '00000000-0000-4000-8000-0000000000a1/results/x.jpg', null),
  '{"ok":true,"status":"refunded","replayed":true}'::jsonb);
select t.eq('success path', public.claim_ai_job(:'j3'::uuid) ->> 'ok', 'true');
select t.eq('start j3', public.start_ai_job(:'j3'::uuid, 'req-3'), '{"ok":true}'::jsonb);
select t.eq('a finished job does not take another request id',
  (select public.start_ai_job(:'j2'::uuid, 'req-3') ->> 'code'), 'NOT_FOUND');
select t.eq('finish j3 succeeded', public.finish_ai_job(:'j3'::uuid, true, '00000000-0000-4000-8000-0000000000a1/results/' || :'j3' || '.jpg', null), '{"ok":true,"status":"succeeded"}'::jsonb);
:as_1
select t.eq('the owner sees the result path', public.get_ai_job(:'j3'::uuid) ->> 'outputPath', '00000000-0000-4000-8000-0000000000a1/results/' || :'j3' || '.jpg');
select t.eq('the refund gave one preview back', public.ai_quota() ->> 'previewsLeft', '1');
select public.reserve_ai_job('job-5-aaaa', 'edit') ->> 'status' as s5 \gset
select t.eq('so a new preview can be reserved', :'s5'::text, 'reserved');
select t.eq('then the month is used up again', public.reserve_ai_job('job-6-aaaa', 'edit') ->> 'code', 'NO_PREVIEWS_LEFT');

-- 'failed' (the provider may have charged): the preview comes back, the money still counts ----------------------
:as_service
select t.eq('claim j5', public.claim_ai_job((select id from ai.jobs where client_job_id = 'job-5-aaaa')) ->> 'ok', 'true');
select t.eq('an unclear provider answer is failed, not refunded',
  public.finish_ai_job((select id from ai.jobs where client_job_id = 'job-5-aaaa'), false, null, 'timeout', true), '{"ok":true,"status":"failed"}'::jsonb);
:as_admin
select t.eq('this month: 3 jobs not refunded = 0.24 estimated', public.gp_ai_spent(), 0.24::numeric);
:as_1
select t.eq('failed gives the preview back', public.ai_quota() ->> 'previewsLeft', '1');
:as_service
select t.eq('a late successful result still turns failed into succeeded',
  public.finish_ai_job((select id from ai.jobs where client_job_id = 'job-5-aaaa'), true, '00000000-0000-4000-8000-0000000000a1/results/late.jpg', null), '{"ok":true,"status":"succeeded"}'::jsonb);
:as_admin
update ai.jobs set status = 'failed', output_path = null where client_job_id = 'job-5-aaaa';  -- back to failed for the next checks

-- Stale jobs expire (a lost app or a lost provider answer never keeps a preview forever) -----------------------
:as_2
select public.reserve_ai_job('stale-reserved', 'edit') ->> 'jobId' as stale_r \gset
select public.reserve_ai_job('stale-running', 'edit') ->> 'jobId' as stale_x \gset
:as_service
select t.eq('claim stale-running', public.claim_ai_job(:'stale_x'::uuid) ->> 'ok', 'true');
select t.eq('start stale-running', public.start_ai_job(:'stale_x'::uuid, 'req-stale') ->> 'ok', 'true');
:as_admin
update ai.jobs set created_at = now() - interval '16 minutes' where id = :'stale_r'::uuid;
update ai.jobs set created_at = now() - interval '61 minutes' where id = :'stale_x'::uuid;
:as_2
select t.eq('B gets both previews back after the jobs went stale', public.ai_quota() ->> 'previewsLeft', '3');
select t.eq('a reservation never sent is refunded', public.get_ai_job(:'stale_r'::uuid) ->> 'status', 'refunded');
select t.eq('a running job with no answer for an hour is failed', public.get_ai_job(:'stale_x'::uuid) ->> 'status', 'failed');

-- Segment taps: 20 a day, they do not use the 3 previews ----------------------------------------------------
:as_2
select t.eq('a tap may use a session folder of the person''s own',
  public.reserve_ai_job('tap-00001', 'segment', '00000000-0000-4000-8000-0000000000a2/session-0001') ->> 'status', 'reserved');
select t.eq('the tap holds 0.01', (select est_cost_usd from ai.jobs where client_job_id = 'tap-00001'), 0.01::numeric);
do $$ declare i int; begin
  for i in 2..20 loop perform t.eq('tap ' || i, public.reserve_ai_job('tap-' || lpad(i::text, 5, '0'), 'segment', '00000000-0000-4000-8000-0000000000a2/session-0001') ->> 'status', 'reserved'); end loop;
end $$;
select t.eq('the 21st tap today is refused', public.reserve_ai_job('tap-00021', 'segment', '00000000-0000-4000-8000-0000000000a2/session-0001'),
  '{"ok":false,"code":"SEGMENT_LIMIT","details":{"limit":20}}'::jsonb);
select t.eq('taps did not use previews', (public.ai_quota() ->> 'previewsLeft') || '/' || (public.ai_quota() ->> 'segmentsLeft'), '3/0');
:as_admin
update ai.jobs set created_at = now() - interval '1 day' where client_job_id like 'tap-%' and created_at >= date_trunc('day', now(), 'UTC') and client_job_id <> 'tap-00020';
:as_2
select t.eq('yesterday''s taps do not count today', public.ai_quota() ->> 'segmentsLeft', '19');

-- The global monthly cap (kill-switch) ----------------------------------------------------------------------------
:as_admin
-- Last month's spending never counts. Put 2.70 of estimated spend into last month and 2.75 into this month.
insert into ai.jobs (user_id, client_job_id, kind, status, est_cost_usd, input_folder, created_at)
  values (null, 'old-month-01', 'edit', 'succeeded', 2.70, '00000000-0000-4000-8000-0000000000a1/old-month-01', date_trunc('month', now(), 'UTC') - interval '1 day');
select t.eq('spent this month before the filler', public.gp_ai_spent(), (select sum(est_cost_usd) from ai.jobs where created_at >= date_trunc('month', now(), 'UTC') and status <> 'refunded'));
select public.gp_ai_spent() as spent_now \gset
insert into ai.jobs (user_id, client_job_id, kind, status, est_cost_usd, input_folder)
  values (null, 'filler-0001', 'edit', 'succeeded', 2.92 - :'spent_now'::numeric, '00000000-0000-4000-8000-0000000000a1/filler-0001');
select t.eq('this month: 2.92 estimated (cap 3.00)', public.gp_ai_spent(), 2.92::numeric);
:as_2
select t.eq('2.92 + 0.08 = 3.00 is still within the cap: not paused', public.ai_quota() ->> 'paused', 'false');
select public.reserve_ai_job('cap-last-01', 'edit') ->> 'status' as cap_last \gset
select t.eq('the reservation that reaches exactly US$3 passes', :'cap_last'::text, 'reserved');
select t.eq('now AI is paused for this month', public.ai_quota() ->> 'paused', 'true');
select t.eq('a further preview is refused: AI_PAUSED', public.reserve_ai_job('cap-over-01', 'edit'), '{"ok":false,"code":"AI_PAUSED"}'::jsonb);
select t.eq('a tap (0.01) is refused too', public.reserve_ai_job('cap-tap-0001', 'segment', '00000000-0000-4000-8000-0000000000a2/session-0001') ->> 'code', 'AI_PAUSED');
select t.eq('segment paused flag', public.ai_quota() ->> 'segmentPaused', 'true');
:as_service
select t.eq('refunding the last job frees its money', public.finish_ai_job((select id from ai.jobs where client_job_id = 'cap-last-01'), false, null, 'provider error'), '{"ok":true,"status":"refunded"}'::jsonb);
:as_2
select t.eq('so AI is available again', public.ai_quota() ->> 'paused', 'false');
:as_admin
update ai.settings set enabled = false;
:as_2
select t.eq('the owner''s switch: enabled = false refuses everything', public.reserve_ai_job('off-job-0001', 'edit'), '{"ok":false,"code":"AI_DISABLED"}'::jsonb);
select t.eq('and quota says paused', public.ai_quota() ->> 'paused', 'true');
:as_admin
update ai.settings set enabled = true;
delete from ai.jobs where client_job_id in ('filler-0001', 'old-month-01');

-- Cleanup after 7 days and after account deletion ----------------------------------------------------------------
:as_admin
update ai.jobs set created_at = now() - interval '8 days' where id = :'j3'::uuid;
:as_service
select t.eq('expired paths: the job folder and its result', (select array_agg(path order by path) from public.ai_expired_paths() where job_id = :'j3'::uuid),
  array['00000000-0000-4000-8000-0000000000a1/job-3-aaaa/', '00000000-0000-4000-8000-0000000000a1/results/' || :'j3' || '.jpg']);
select t.eq('a job of this week is not listed', (select count(*) from public.ai_expired_paths() where job_id = :'j2'::uuid), 0::bigint);
select t.eq('mark purged', public.mark_ai_purged(array[:'j3'::uuid]), 1);
select t.eq('a purged job is not listed again', (select count(*) from public.ai_expired_paths() where job_id = :'j3'::uuid), 0::bigint);
:as_admin
delete from auth.users where id = '00000000-0000-4000-8000-0000000000a1';
select t.eq('account deletion keeps the jobs for the monthly cap but drops the owner', (select count(*) from ai.jobs where user_id is null and input_folder like '00000000-0000-4000-8000-0000000000a1/%'), 4::bigint);
:as_service
select t.eq('a deleted account''s folders are listed for deletion at once',
  (select count(*) from public.ai_expired_paths() where path like '00000000-0000-4000-8000-0000000000a1/%' and path like '%/'), 3::bigint);
:as_admin
select 'ALL ROOM AI DATABASE TESTS PASSED';
