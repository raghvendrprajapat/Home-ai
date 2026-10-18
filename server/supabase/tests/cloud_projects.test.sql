-- Cloud project database tests (FR-031/032/033/043). Claude-authored; not independent fixtures.
-- Run by server/supabase/tests/run.sh on a fresh database after bootstrap.sql and every migration.
-- Expected values are written from the spec (§H.4/§H.5, §D.8), never read back from the functions under test.
\set ON_ERROR_STOP 1
\set QUIET 1
\pset format unaligned
\pset tuples_only on

create schema t;
create table t.sample (doc jsonb);
\set sample `cat "$SAMPLE_PROJECT"`
insert into t.sample values (:'sample'::jsonb);
create function t.eq(label text, actual anyelement, expected anyelement) returns void language plpgsql as $$
begin
  if actual is distinct from expected then raise exception 'FAIL %: got %, expected %', label, actual, expected; end if;
  raise notice 'ok  %', label;
end $$;
-- The sample at server revision r, optionally renamed / re-identified.
create function t.doc(r int, name text default null, id text default null) returns jsonb language sql as $$
  select jsonb_set(jsonb_set(jsonb_set(doc, '{revision}', to_jsonb(r)), '{name}', to_jsonb(coalesce(name, doc->>'name'))),
    '{id}', to_jsonb(coalesce(id, doc->>'id'))) from t.sample
$$;
create table t.kept (k text primary key, v text);
grant usage on schema t to anon, authenticated, service_role;
grant execute on all functions in schema t to anon, authenticated, service_role;
grant select, insert, update on t.sample, t.kept to anon, authenticated;

insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000000a', 'a@example.test'), ('00000000-0000-4000-8000-00000000000b', 'b@example.test');
\set as_a 'set role authenticated; set request.jwt.claims = ''{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}'';'
\set as_b 'set role authenticated; set request.jwt.claims = ''{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}'';'
\set as_anon 'set role anon; set request.jwt.claims = '''';'
\set as_admin 'reset role; set request.jwt.claims = '''';'

-- SEC-009: every table has row level security enabled. ---------------------------------------------------
select t.eq('SEC-009 every public table has RLS on',
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','p') and not c.relrowsecurity), 0::bigint);
select t.eq('SEC-009 six tables exist',
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'), 6::bigint);
select t.eq('every public function pins an empty search_path',
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and not coalesce(p.proconfig @> array['search_path=""'], false)), 0::bigint);

-- REL-012 / §H.5: first save creates revision 1 from expectedServerRevision 0. --------------------------------
:as_a
select t.eq('first save', public.save_snapshot('prj_sample_2room', 0, 'save-a-0001', t.doc(0)) - 'savedAt' - 'sha256', '{"ok":true,"serverRevision":1}'::jsonb);
select t.eq('head row', (select row(current_revision, name, room_count)::text from public.projects where id = 'prj_sample_2room'), '(1,"Sample 1BHK (living + bedroom)",2)');
select t.eq('stored snapshot carries the new server revision', (select snapshot->'revision' from public.project_versions where project_id = 'prj_sample_2room' and revision = 1), '1'::jsonb);
select t.eq('stored snapshot equals the sent document apart from revision',
  (select snapshot from public.project_versions where project_id = 'prj_sample_2room' and revision = 1), t.doc(1));
select t.eq('sha256 is of the stored snapshot text',
  (select sha256 = encode(sha256(convert_to(snapshot::text, 'UTF8')), 'hex') from public.project_versions where project_id = 'prj_sample_2room' and revision = 1), true);
select t.eq('load_project returns the head', (select r - 'updatedAt' - 'sha256' - 'trashedAt' from (select public.load_project('prj_sample_2room') r) x),
  jsonb_build_object('ok', true, 'serverRevision', 1, 'name', 'Sample 1BHK (living + bedroom)', 'document', t.doc(1)));
select t.eq('second save', public.save_snapshot('prj_sample_2room', 1, 'save-a-0002', t.doc(1, 'Renamed')) ->> 'serverRevision', '2');
select t.eq('name follows the head', (select name from public.projects where id = 'prj_sample_2room'), 'Renamed');

-- REL-006: a stale base never overwrites; the answer names the current head. -----------------------------------
select t.eq('REL-006 stale save conflicts', public.save_snapshot('prj_sample_2room', 1, 'save-a-0003', t.doc(1, 'Stale')),
  '{"ok":false,"code":"REVISION_CONFLICT","details":{"currentServerRevision":2}}'::jsonb);
select t.eq('REL-006 stale first save conflicts too', public.save_snapshot('prj_sample_2room', 0, 'save-a-0004', t.doc(0)),
  '{"ok":false,"code":"REVISION_CONFLICT","details":{"currentServerRevision":2}}'::jsonb);
select t.eq('REL-006 nothing written by conflicts', (select row(current_revision, name, (select count(*) from public.project_versions where project_id = 'prj_sample_2room'))::text from public.projects where id = 'prj_sample_2room'), '(2,Renamed,2)');

-- REL-008: a retry with the same key replays; a reused key with new content is refused; receipt before head check.
select t.eq('REL-008 lost-response retry replays revision 1 even though the head is now 2',
  public.save_snapshot('prj_sample_2room', 0, 'save-a-0001', t.doc(0)) - 'savedAt' - 'sha256', '{"ok":true,"serverRevision":1,"replayed":true}'::jsonb);
select t.eq('REL-008 replay answers with the committed hash',
  public.save_snapshot('prj_sample_2room', 0, 'save-a-0001', t.doc(0)) ->> 'sha256', (select sha256 from public.project_versions where project_id = 'prj_sample_2room' and revision = 1));
select t.eq('REL-008 same key, different content', public.save_snapshot('prj_sample_2room', 1, 'save-a-0002', t.doc(1, 'Other')), '{"ok":false,"code":"IDEMPOTENCY_MISMATCH"}'::jsonb);
select t.eq('REL-008 same key, different base', public.save_snapshot('prj_sample_2room', 2, 'save-a-0002', t.doc(2, 'Renamed')), '{"ok":false,"code":"IDEMPOTENCY_MISMATCH"}'::jsonb);
select t.eq('REL-008 replays wrote nothing', (select current_revision from public.projects where id = 'prj_sample_2room'), 2);

-- Shape checks before any write. ------------------------------------------------------------------------------
select t.eq('document id must match', public.save_snapshot('prj_sample_2room', 2, 'bad-1', t.doc(2, null, 'prj_other')) ->> 'code', 'INVALID_DOCUMENT');
select t.eq('document revision must match the base', public.save_snapshot('prj_sample_2room', 2, 'bad-2', t.doc(3)) ->> 'code', 'INVALID_DOCUMENT');
select t.eq('schemaVersion must be 1', public.save_snapshot('prj_sample_2room', 2, 'bad-3', jsonb_set(t.doc(2), '{schemaVersion}', '2')) ->> 'code', 'INVALID_DOCUMENT');
select t.eq('walls must be an array', public.save_snapshot('prj_sample_2room', 2, 'bad-4', jsonb_set(t.doc(2), '{walls}', '{}')) ->> 'code', 'INVALID_DOCUMENT');
select t.eq('empty name refused', public.save_snapshot('prj_sample_2room', 2, 'bad-5', t.doc(2, '')) ->> 'code', 'INVALID_DOCUMENT');
select t.eq('121-character name refused', public.save_snapshot('prj_sample_2room', 2, 'bad-6', t.doc(2, repeat('x', 121))) ->> 'code', 'INVALID_DOCUMENT');
select t.eq('a document over 10 MiB is refused', public.save_snapshot('prj_sample_2room', 2, 'bad-7', jsonb_set(t.doc(2), '{cameras}', jsonb_build_array(repeat('x', 10485760)))) ->> 'code', 'TOO_LARGE');
select t.eq('bad command id refused', public.save_snapshot('prj_sample_2room', 2, 'has space', t.doc(2)) ->> 'code', 'INVALID_REQUEST');
select t.eq('missing project with a non-zero base', public.save_snapshot('prj_missing', 4, 'x-1', t.doc(4, null, 'prj_missing')) ->> 'code', 'NOT_FOUND');
select t.eq('shape failures wrote nothing', (select count(*) from public.project_versions), 2::bigint);

-- SEC-001/002: another account sees and changes nothing. ------------------------------------------------------
:as_b
select t.eq('SEC-001 B lists no projects', (select count(*) from public.projects), 0::bigint);
select t.eq('SEC-001 B reads no versions', (select count(*) from public.project_versions), 0::bigint);
select t.eq('SEC-001 B cannot load A''s project', public.load_project('prj_sample_2room'), '{"ok":false,"code":"NOT_FOUND"}'::jsonb);
select t.eq('SEC-002 B cannot save over A''s head', public.save_snapshot('prj_sample_2room', 2, 'save-b-0001', t.doc(2, 'Hijack')), '{"ok":false,"code":"NOT_FOUND"}'::jsonb);
select t.eq('SEC-002 B cannot claim A''s project id', public.save_snapshot('prj_sample_2room', 0, 'save-b-0002', t.doc(0)), '{"ok":false,"code":"PROJECT_ID_TAKEN"}'::jsonb);
select t.eq('SEC-002 B cannot restore A''s versions', public.restore_version('prj_sample_2room', 1, 2, 'restore-b-1'), '{"ok":false,"code":"NOT_FOUND"}'::jsonb);
select t.eq('SEC-002 B cannot trash A''s project', public.trash_project('prj_sample_2room', true), '{"ok":false,"code":"NOT_FOUND"}'::jsonb);
select t.eq('SEC-002 B cannot delete A''s project', public.delete_project('prj_sample_2room'), '{"ok":false,"code":"NOT_FOUND"}'::jsonb);
select t.eq('SEC-002 B cannot share A''s project', public.create_share('prj_sample_2room'), '{"ok":false,"code":"NOT_FOUND"}'::jsonb);
select t.eq('B can save its own copy under a new id', public.save_snapshot('prj_copy_b', 0, 'save-b-0003', t.doc(0, 'B copy', 'prj_copy_b')) ->> 'serverRevision', '1');

-- SEC-003: no direct table writes and no helper calls for signed-in clients. ------------------------------------
do $$ begin insert into public.projects (id, owner_id, name) values ('prj_direct', auth.uid(), 'x'); raise exception 'FAIL direct insert allowed';
exception when insufficient_privilege then raise notice 'ok  SEC-003 direct project insert refused'; end $$;
do $$ begin update public.project_versions set snapshot = '{}' where true; raise exception 'FAIL direct version update allowed';
exception when insufficient_privilege then raise notice 'ok  SEC-003 direct version update refused'; end $$;
do $$ begin delete from public.project_command_receipts where true; raise exception 'FAIL receipt delete allowed';
exception when insufficient_privilege then raise notice 'ok  SEC-003 receipt delete refused'; end $$;
do $$ begin perform count(*) from public.audit_events; raise exception 'FAIL audit read allowed';
exception when insufficient_privilege then raise notice 'ok  SEC-003 audit read refused'; end $$;
do $$ begin perform public.gp_commit('prj_copy_b', 1, 'x', 'x', '{}', 'save', null); raise exception 'FAIL helper callable';
exception when insufficient_privilege then raise notice 'ok  SEC-003 internal helper not callable'; end $$;
do $$ begin perform public.purge_trashed(); raise exception 'FAIL purge callable by a user';
exception when insufficient_privilege then raise notice 'ok  SEC-003 purge is service-only'; end $$;

-- Signed-out callers reach nothing except a share lookup. ----------------------------------------------------
:as_anon
do $$ begin perform count(*) from public.projects; raise exception 'FAIL anon read allowed';
exception when insufficient_privilege then raise notice 'ok  SEC-001 anon cannot read projects'; end $$;
do $$ begin perform public.save_snapshot('prj_x', 0, 'k', '{}'); raise exception 'FAIL anon save allowed';
exception when insufficient_privilege then raise notice 'ok  SEC-001 anon cannot save'; end $$;
select t.eq('anon share lookup with a junk token', public.get_shared_project('not-a-token'), '{"ok":false,"code":"NOT_FOUND"}'::jsonb);

-- FR-032 version history: newest 20 kept; restore makes a new head. ------------------------------------------
:as_a
do $$ declare r int; begin
  for r in 2..24 loop perform t.eq('bulk save ' || r, public.save_snapshot('prj_sample_2room', r, 'bulk-' || r, t.doc(r, 'Version ' || (r + 1))) ->> 'serverRevision', (r + 1)::text); end loop;
end $$;
select t.eq('retention keeps exactly the newest 20 (6..25)', (select array[count(*), min(revision), max(revision)] from public.project_versions where project_id = 'prj_sample_2room'), array[20::bigint, 6, 25]);
select t.eq('a retry of a pruned revision still replays from its receipt', public.save_snapshot('prj_sample_2room', 0, 'save-a-0001', t.doc(0)) ->> 'serverRevision', '1');
select t.eq('restore r6 at head 25 creates r26', public.restore_version('prj_sample_2room', 6, 25, 'restore-a-1') - 'savedAt' - 'sha256', '{"ok":true,"serverRevision":26}'::jsonb);
select t.eq('restored content is r6 with the new revision', (select snapshot from public.project_versions where project_id = 'prj_sample_2room' and revision = 26), t.doc(26, 'Version 6'));
select t.eq('restore retry replays', public.restore_version('prj_sample_2room', 6, 25, 'restore-a-1') ->> 'replayed', 'true');
select t.eq('restore key reused for another version', public.restore_version('prj_sample_2room', 7, 25, 'restore-a-1') ->> 'code', 'IDEMPOTENCY_MISMATCH');
select t.eq('restore from a stale head conflicts', public.restore_version('prj_sample_2room', 7, 25, 'restore-a-2'), '{"ok":false,"code":"REVISION_CONFLICT","details":{"currentServerRevision":26}}'::jsonb);
select t.eq('restore of a pruned version', public.restore_version('prj_sample_2room', 3, 26, 'restore-a-3') ->> 'code', 'VERSION_NOT_FOUND');
select t.eq('history after restore: 7..26', (select array[count(*), min(revision), max(revision)] from public.project_versions where project_id = 'prj_sample_2room'), array[20::bigint, 7, 26]);

-- FR-033 view-only links. --------------------------------------------------------------------------------------
select public.create_share('prj_sample_2room') ->> 'token' as token \gset share_
insert into t.kept values ('token', :'share_token');
select t.eq('token is 64 lowercase hex characters', (select v ~ '^[0-9a-f]{64}$' from t.kept where k = 'token'), true);
select t.eq('owner sees the share row', (select count(*) from public.project_shares where revoked_at is null), 1::bigint);
do $$ begin perform token_hash from public.project_shares; raise exception 'FAIL token hash readable';
exception when insufficient_privilege then raise notice 'ok  SEC-005 token hash is not readable by the owner'; end $$;
:as_admin
select t.eq('SEC-005 only the SHA-256 of the token is stored', (select token_hash from public.project_shares), encode(sha256(convert_to(:'share_token', 'UTF8')), 'hex'));
select t.eq('SEC-005 the raw token is stored nowhere', (select count(*) from public.project_shares where token_hash = :'share_token'), 0::bigint);
:as_anon
select t.eq('a signed-out viewer opens the head through the link', public.get_shared_project(:'share_token'),
  jsonb_build_object('ok', true, 'serverRevision', 26, 'name', 'Version 6', 'document', t.doc(26, 'Version 6')));
select t.eq('a different token finds nothing', public.get_shared_project(repeat('0', 64)), '{"ok":false,"code":"NOT_FOUND"}'::jsonb);
:as_a
select t.eq('trash hides the link', public.trash_project('prj_sample_2room', true), '{"ok":true}'::jsonb);
:as_anon
select t.eq('trashed project not visible by link', public.get_shared_project(:'share_token') ->> 'code', 'NOT_FOUND');
:as_a
select t.eq('a trashed project refuses saves', public.save_snapshot('prj_sample_2room', 26, 'save-a-trashed', t.doc(26)) ->> 'code', 'PROJECT_TRASHED');
select t.eq('trashing twice is not found', public.trash_project('prj_sample_2room', true) ->> 'code', 'NOT_FOUND');
select t.eq('untrash', public.trash_project('prj_sample_2room', false), '{"ok":true}'::jsonb);
select t.eq('revoke the link', public.revoke_share((select id from public.project_shares limit 1)), '{"ok":true}'::jsonb);
select t.eq('revoking twice is not found', public.revoke_share((select id from public.project_shares limit 1)) ->> 'code', 'NOT_FOUND');
:as_anon
select t.eq('a revoked link finds nothing', public.get_shared_project(:'share_token') ->> 'code', 'NOT_FOUND');
:as_b
select t.eq('B cannot revoke A''s links', public.revoke_share(gen_random_uuid()) ->> 'code', 'NOT_FOUND');
select t.eq('B sees no share rows of A', (select count(*) from public.project_shares), 0::bigint);

-- Trash purge after 30 days (scheduled job runs as the service role). ------------------------------------------
:as_b
select t.eq('B trashes its copy', public.trash_project('prj_copy_b', true), '{"ok":true}'::jsonb);
:as_admin
update public.projects set trashed_at = now() - interval '29 days' where id = 'prj_copy_b';
set role service_role;
select t.eq('29 days in the trash: kept', public.purge_trashed(), 0);
reset role;
update public.projects set trashed_at = now() - interval '31 days' where id = 'prj_copy_b';
set role service_role;
select t.eq('31 days in the trash: purged', public.purge_trashed(), 1);
reset role;
select t.eq('purged versions are gone', (select count(*) from public.project_versions where project_id = 'prj_copy_b'), 0::bigint);

-- Project quota (anti-abuse): 200 projects per account. --------------------------------------------------------
:as_b
do $$ declare i int; begin
  for i in 1..200 loop perform t.eq('quota save ' || i, public.save_snapshot('prj_q' || i, 0, 'q-' || i, t.doc(0, null, 'prj_q' || i)) ->> 'serverRevision', '1'); end loop;
end $$;
select t.eq('the 201st project is refused', public.save_snapshot('prj_q201', 0, 'q-201', t.doc(0, null, 'prj_q201')), '{"ok":false,"code":"PROJECT_LIMIT","details":{"limit":200}}'::jsonb);
select t.eq('a delete frees a slot', public.delete_project('prj_q1'), '{"ok":true}'::jsonb);
select t.eq('then the next project saves', public.save_snapshot('prj_q201', 0, 'q-201', t.doc(0, null, 'prj_q201')) ->> 'serverRevision', '1');

-- FR-043 account deletion. -------------------------------------------------------------------------------------
:as_a
select public.create_share('prj_sample_2room') ->> 'token' as token \gset live_
select t.eq('deletion needs the confirmation word', public.delete_account('yes'), '{"ok":false,"code":"CONFIRMATION_REQUIRED"}'::jsonb);
select t.eq('delete A''s account', public.delete_account('DELETE'), '{"ok":true}'::jsonb);
:as_anon
select t.eq('A''s live link stops working at once', public.get_shared_project(:'live_token') ->> 'code', 'NOT_FOUND');
:as_admin
select t.eq('A''s auth user is gone', (select count(*) from auth.users where id = '00000000-0000-4000-8000-00000000000a'), 0::bigint);
select t.eq('A''s profile is gone', (select count(*) from public.profiles where id = '00000000-0000-4000-8000-00000000000a'), 0::bigint);
select t.eq('A''s projects, versions, receipts and shares are gone',
  (select array[(select count(*) from public.projects where id = 'prj_sample_2room'), (select count(*) from public.project_versions where project_id = 'prj_sample_2room'),
    (select count(*) from public.project_command_receipts where project_id = 'prj_sample_2room'), (select count(*) from public.project_shares)]), array[0::bigint, 0, 0, 0]);
select t.eq('no audit row keeps A''s id', (select count(*) from public.audit_events where actor = '00000000-0000-4000-8000-00000000000a'), 0::bigint);
select t.eq('B keeps all 200 projects', (select count(*) from public.projects where owner_id = '00000000-0000-4000-8000-00000000000b'), 200::bigint);
:as_a
select t.eq('a deleted account''s old token reads nothing', (select count(*) from public.projects), 0::bigint);
:as_admin
select 'ALL CLOUD DATABASE TESTS PASSED';
