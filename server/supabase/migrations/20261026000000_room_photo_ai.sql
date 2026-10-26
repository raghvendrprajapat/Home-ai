-- GharPlan Room photo AI, Phase 2 (D86). Owner decisions 2026-10-26: whole-app AI spend cap US$3 per calendar month
-- (UTC), 3 free AI previews per signed-in account per month, fal.ai as provider, uploads and results deleted after 7 days.
-- Design: docs/decisions/room-photo-visualizer.md. Same rules as the cloud migration:
--  * Row level security on every table; clients only ever SELECT their own rows, and only through RLS.
--  * Every write goes through a SECURITY DEFINER function with an empty search_path and fully qualified names.
--  * Functions return {ok:true,...} or {ok:false, code, details?} (public.gp_fail).
--
-- The brief's `ai_settings` and `ai_jobs` live in their own schema as ai.settings and ai.jobs: the schema is not exposed
-- through the REST API (the app reads jobs only through get_ai_job), and the public schema keeps its six cloud tables.
--
-- Money: the provider does not publish a per-image price for the edit model (token-based), so every job reserves a
-- conservative ESTIMATE from ai.settings (owner-tunable). The monthly cap compares the sum of this month's estimates of
-- jobs that were not refunded, plus the new job's estimate, against monthly_cap_usd, under a lock on the settings row,
-- so two reservations can never both take the last slot.
--
-- Job states: reserved (quota held, nothing sent) → submitting (the server is calling the provider) → running (the
-- provider accepted it) → succeeded | refunded (nothing was charged: frees the preview and the money) | failed (the
-- provider may have charged: the person gets the preview back, the money still counts against the monthly cap).

create schema ai;
revoke all on schema ai from public;
grant usage on schema ai to authenticated, service_role;

create table ai.settings (                                                    -- exactly one row
  id boolean primary key default true check (id),
  enabled boolean not null default true,                                       -- false = every new AI call is refused
  monthly_cap_usd numeric(10, 4) not null default 3 check (monthly_cap_usd >= 0),
  free_previews_per_month int not null default 3 check (free_previews_per_month >= 0),
  est_edit_usd numeric(10, 4) not null default 0.08 check (est_edit_usd > 0),
  est_segment_usd numeric(10, 4) not null default 0.01 check (est_segment_usd > 0),
  segment_daily_limit int not null default 20 check (segment_daily_limit >= 0),
  updated_at timestamptz not null default now()
);
insert into ai.settings default values;

create table ai.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,                  -- null after account deletion; the spend still counts
  client_job_id text not null check (client_job_id ~ '^[A-Za-z0-9_-]{8,64}$'), -- idempotency key chosen by the app
  kind text not null check (kind in ('edit', 'segment')),
  status text not null default 'reserved' check (status in ('reserved', 'submitting', 'running', 'succeeded', 'failed', 'refunded')),
  est_cost_usd numeric(10, 4) not null check (est_cost_usd >= 0),
  provider_request_id text check (provider_request_id ~ '^[A-Za-z0-9_-]{1,100}$'),
  input_folder text not null,                                                  -- <user id>/<folder>: the person's uploads for this job
  output_path text,                                                            -- <user id>/results/<job id>.jpg
  error text check (length(error) <= 300),
  created_at timestamptz not null default now(),
  started_at timestamptz, finished_at timestamptz,
  purged_at timestamptz,                                                       -- storage files removed by room-ai-cleanup
  unique (user_id, client_job_id)
);
create index ai_jobs_month on ai.jobs (created_at);
create index ai_jobs_user on ai.jobs (user_id, kind, created_at);
create index ai_jobs_open on ai.jobs (status, created_at) where status in ('reserved', 'submitting', 'running');
create unique index ai_jobs_request on ai.jobs (provider_request_id) where provider_request_id is not null;

alter table ai.settings enable row level security;
alter table ai.jobs enable row level security;
create policy own_ai_jobs on ai.jobs for select to authenticated using (user_id = (select auth.uid()));
-- ai.settings: no client policy at all.
revoke all on ai.settings, ai.jobs from public, anon, authenticated;
grant select on ai.jobs to authenticated;
grant select, update on ai.settings to service_role;                           -- the owner tunes estimates in the SQL editor
grant select on ai.jobs to service_role;

-- Helpers (not callable by clients) -------------------------------------------------------------------------

create function public.gp_ai_month_start() returns timestamptz
language sql stable set search_path = '' as $$ select pg_catalog.date_trunc('month', now(), 'UTC') $$;

-- Jobs that never finished: a reservation never submitted gives everything back; a provider call without an answer
-- gives the preview back but keeps counting the money (the provider may have charged). A late webhook may still
-- turn a 'failed' job into 'succeeded' (finish_ai_job).
create function public.gp_ai_expire_stale() returns void
language sql set search_path = '' as $$
  update ai.jobs set status = 'refunded', finished_at = now(), error = 'expired before it was sent'
    where status = 'reserved' and created_at < now() - interval '15 minutes';
  update ai.jobs set status = 'failed', finished_at = now(), error = 'no answer from the provider'
    where (status = 'submitting' and created_at < now() - interval '15 minutes') or (status = 'running' and created_at < now() - interval '60 minutes');
$$;

-- This month's estimated spend of the whole app (every account, deleted ones included).
create function public.gp_ai_spent() returns numeric
language sql stable set search_path = '' as $$
  select coalesce(sum(est_cost_usd), 0) from ai.jobs where created_at >= public.gp_ai_month_start() and status <> 'refunded'
$$;

create function public.gp_ai_previews_used(p_user uuid) returns int
language sql stable set search_path = '' as $$
  select count(*)::int from ai.jobs where user_id = p_user and kind = 'edit' and created_at >= public.gp_ai_month_start()
    and status not in ('refunded', 'failed')
$$;

create function public.gp_ai_segments_today(p_user uuid) returns int
language sql stable set search_path = '' as $$
  select count(*)::int from ai.jobs where user_id = p_user and kind = 'segment' and created_at >= pg_catalog.date_trunc('day', now(), 'UTC')
    and status <> 'refunded'
$$;

-- Client functions -------------------------------------------------------------------------------------------

-- What the signed-in person may still do this month. Amounts of money are never shown to clients.
create function public.ai_quota() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); s ai.settings; spent numeric;
begin
  if me is null then return public.gp_fail('NOT_SIGNED_IN'); end if;
  perform public.gp_ai_expire_stale();
  select * into s from ai.settings where id;
  spent := public.gp_ai_spent();
  return jsonb_build_object('ok', true, 'enabled', s.enabled,
    'paused', not s.enabled or spent + s.est_edit_usd > s.monthly_cap_usd,
    'segmentPaused', not s.enabled or spent + s.est_segment_usd > s.monthly_cap_usd,
    'previewsPerMonth', s.free_previews_per_month,
    'previewsLeft', greatest(0, s.free_previews_per_month - public.gp_ai_previews_used(me)),
    'segmentsLeft', greatest(0, s.segment_daily_limit - public.gp_ai_segments_today(me)));
end $$;

-- Holds one AI call for the signed-in person. Atomic and idempotent: the same client_job_id always answers the same
-- job and never takes a second preview or a second share of the cap. All reservations queue on the settings row lock,
-- so the per-person limit and the monthly cap hold under concurrency.
create function public.reserve_ai_job(p_client_job_id text, p_kind text, p_folder text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); s ai.settings; job ai.jobs; folder text; est numeric; used int;
begin
  if me is null then return public.gp_fail('NOT_SIGNED_IN'); end if;
  if p_client_job_id is null or p_client_job_id !~ '^[A-Za-z0-9_-]{8,64}$' or p_kind is null or p_kind not in ('edit', 'segment') then return public.gp_fail('INVALID_REQUEST'); end if;
  folder := coalesce(p_folder, me::text || '/' || p_client_job_id);
  -- Uploads always sit in a folder of the person's own: <user id>/<8-64 safe characters>.
  if folder !~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{8,64}$' or split_part(folder, '/', 1) <> me::text or split_part(folder, '/', 2) = 'results' then return public.gp_fail('INVALID_REQUEST'); end if;
  select * into s from ai.settings where id for update;                       -- the lock every reservation waits for
  perform public.gp_ai_expire_stale();
  select * into job from ai.jobs where user_id = me and client_job_id = p_client_job_id;
  if found then
    if job.kind <> p_kind or job.input_folder <> folder then return public.gp_fail('IDEMPOTENCY_MISMATCH'); end if;
    return jsonb_build_object('ok', true, 'jobId', job.id, 'status', job.status, 'replayed', true);
  end if;
  if not s.enabled then return public.gp_fail('AI_DISABLED'); end if;
  if p_kind = 'edit' then
    est := s.est_edit_usd; used := public.gp_ai_previews_used(me);
    if used >= s.free_previews_per_month then return public.gp_fail('NO_PREVIEWS_LEFT', jsonb_build_object('limit', s.free_previews_per_month)); end if;
  else
    est := s.est_segment_usd;
    if public.gp_ai_segments_today(me) >= s.segment_daily_limit then return public.gp_fail('SEGMENT_LIMIT', jsonb_build_object('limit', s.segment_daily_limit)); end if;
  end if;
  if public.gp_ai_spent() + est > s.monthly_cap_usd then return public.gp_fail('AI_PAUSED'); end if;
  insert into ai.jobs (user_id, client_job_id, kind, est_cost_usd, input_folder) values (me, p_client_job_id, p_kind, est, folder) returning * into job;
  return jsonb_build_object('ok', true, 'jobId', job.id, 'status', job.status,
    'previewsLeft', case when p_kind = 'edit' then greatest(0, s.free_previews_per_month - used - 1) end);
end $$;

-- The owner of a job reads its state (the app polls this). Other people's jobs look like missing ones.
create function public.get_ai_job(p_job_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); job ai.jobs;
begin
  if me is null then return public.gp_fail('NOT_SIGNED_IN'); end if;
  perform public.gp_ai_expire_stale();
  select * into job from ai.jobs where id = p_job_id and user_id = me;
  if not found then return public.gp_fail('NOT_FOUND'); end if;
  return jsonb_build_object('ok', true, 'jobId', job.id, 'kind', job.kind, 'status', job.status, 'outputPath', job.output_path, 'createdAt', job.created_at);
end $$;

-- Service functions (Edge Functions with the service role only) ---------------------------------------------

-- Moves a reserved job to 'submitting' exactly once, so two submit calls can never both pay the provider.
create function public.claim_ai_job(p_job_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare job ai.jobs;
begin
  update ai.jobs set status = 'submitting', started_at = now() where id = p_job_id and status = 'reserved' returning * into job;
  if found then return jsonb_build_object('ok', true, 'jobId', job.id, 'userId', job.user_id, 'kind', job.kind, 'folder', job.input_folder); end if;
  select * into job from ai.jobs where id = p_job_id;
  if not found then return public.gp_fail('NOT_FOUND'); end if;
  return public.gp_fail('NOT_CLAIMABLE', jsonb_build_object('status', job.status));
end $$;

create function public.start_ai_job(p_job_id uuid, p_request_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare job ai.jobs;
begin
  if p_request_id is null or p_request_id !~ '^[A-Za-z0-9_-]{1,100}$' then return public.gp_fail('INVALID_REQUEST'); end if;
  update ai.jobs set status = 'running', provider_request_id = p_request_id where id = p_job_id and status = 'submitting' returning * into job;
  if found then return jsonb_build_object('ok', true); end if;
  -- A webhook may already have finished it, or this is a repeat with the same request id.
  select * into job from ai.jobs where id = p_job_id;
  if found and (job.provider_request_id = p_request_id or job.provider_request_id is null and job.status in ('succeeded', 'failed')) then
    update ai.jobs set provider_request_id = p_request_id where id = p_job_id and provider_request_id is null;
    return jsonb_build_object('ok', true, 'replayed', true);
  end if;
  return public.gp_fail('NOT_FOUND');
end $$;

-- Settles a job. ok → 'succeeded'; otherwise 'refunded' (nothing charged) or, when the provider may have charged,
-- 'failed'. Idempotent: a finished job keeps its state, except that a late successful result may still turn a
-- 'failed' (timed out) job into 'succeeded'.
create function public.finish_ai_job(p_job_id uuid, p_ok boolean, p_output_path text, p_error text, p_cost_incurred boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare job ai.jobs; next text := case when p_ok then 'succeeded' when p_cost_incurred then 'failed' else 'refunded' end;
begin
  select * into job from ai.jobs where id = p_job_id for update;
  if not found then return public.gp_fail('NOT_FOUND'); end if;
  if p_ok and job.kind = 'edit' and (job.user_id is null or p_output_path is null or p_output_path !~ ('^' || job.user_id::text || '/results/[A-Za-z0-9_-]{1,80}\.jpg$')) then return public.gp_fail('INVALID_REQUEST'); end if;
  if p_ok and job.kind = 'segment' and p_output_path is not null then return public.gp_fail('INVALID_REQUEST'); end if;
  if job.status in ('reserved', 'submitting', 'running') or (p_ok and job.status = 'failed') then
    update ai.jobs set status = next, finished_at = now(), output_path = case when p_ok then p_output_path end,
      error = case when p_ok then null else left(coalesce(p_error, 'failed'), 300) end where id = p_job_id;
    return jsonb_build_object('ok', true, 'status', next);
  end if;
  return jsonb_build_object('ok', true, 'status', job.status, 'replayed', true);
end $$;

-- The webhook finds its job by the id it put in the callback address, checked against the signed request id.
create function public.ai_job_for_webhook(p_job_id uuid, p_request_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare job ai.jobs;
begin
  select * into job from ai.jobs where id = p_job_id and kind = 'edit' and (provider_request_id is null or provider_request_id = p_request_id);
  if not found then return public.gp_fail('NOT_FOUND'); end if;
  return jsonb_build_object('ok', true, 'jobId', job.id, 'userId', job.user_id, 'status', job.status, 'folder', job.input_folder);
end $$;

-- Storage that room-ai-cleanup must delete: every job folder and result older than 7 days or of a deleted account,
-- and (on Supabase, where the storage schema exists) any object in the bucket older than 7 days or whose first
-- folder is no longer an account. Folder entries end with '/'.
create function public.ai_expired_paths(p_limit int default 500) returns table (job_id uuid, path text)
language plpgsql security definer set search_path = '' as $$
begin
  return query
    select j.id, p.path from (select * from ai.jobs where purged_at is null and (created_at < now() - interval '7 days' or user_id is null)
        order by created_at limit greatest(1, least(coalesce(p_limit, 500), 5000))) j
      cross join lateral (values (j.input_folder || '/'), (j.output_path)) as p(path)
      where p.path is not null;
  if to_regclass('storage.objects') is not null then
    return query execute
      'select null::uuid, o.name from storage.objects o where o.bucket_id = ''room-photos'' and (o.created_at < now() - interval ''7 days''
         or not exists (select 1 from auth.users u where u.id::text = split_part(o.name, ''/'', 1))) order by o.created_at limit $1'
      using greatest(1, least(coalesce(p_limit, 500), 5000));
  end if;
end $$;

create function public.mark_ai_purged(p_job_ids uuid[]) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update ai.jobs set purged_at = now() where id = any(p_job_ids) and purged_at is null;
  get diagnostics n = row_count;
  return n;
end $$;

-- Execute rights: only the new functions are touched (the cloud functions keep their grants).
revoke execute on function public.gp_ai_month_start(), public.gp_ai_expire_stale(), public.gp_ai_spent(), public.gp_ai_previews_used(uuid),
  public.gp_ai_segments_today(uuid), public.ai_quota(), public.reserve_ai_job(text, text, text), public.get_ai_job(uuid),
  public.claim_ai_job(uuid), public.start_ai_job(uuid, text), public.finish_ai_job(uuid, boolean, text, text, boolean),
  public.ai_job_for_webhook(uuid, text), public.ai_expired_paths(int), public.mark_ai_purged(uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.ai_quota(), public.reserve_ai_job(text, text, text), public.get_ai_job(uuid) to authenticated;
grant execute on function public.claim_ai_job(uuid), public.start_ai_job(uuid, text), public.finish_ai_job(uuid, boolean, text, text, boolean),
  public.ai_job_for_webhook(uuid, text), public.ai_expired_paths(int), public.mark_ai_purged(uuid[]) to service_role;

-- Storage (Supabase only) -----------------------------------------------------------------------------------
-- A private bucket: JPEG/PNG up to 5 MB each. A signed-in person may upload, read, replace and delete files only in
-- their own folder (<user id>/...), and may never write in <user id>/results/ (only the server writes results).
-- Plain PostgreSQL (the CI database tests) has no storage schema, so this part is skipped there. If it fails on a
-- real project, docs/setup/room-photo-ai.md explains how to create the bucket and these policies by hand.
do $storage$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    raise notice 'storage schema not found: room-photos bucket and policies skipped (plain PostgreSQL)';
    return;
  end if;
  execute $sql$
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('room-photos', 'room-photos', false, 5242880, array['image/jpeg', 'image/png'])
    on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png']
  $sql$;
  execute $sql$
    create policy room_photos_read_own on storage.objects for select to authenticated
    using (bucket_id = 'room-photos' and split_part(name, '/', 1) = (select auth.uid())::text)
  $sql$;
  execute $sql$
    create policy room_photos_upload_own on storage.objects for insert to authenticated
    with check (bucket_id = 'room-photos' and split_part(name, '/', 1) = (select auth.uid())::text and split_part(name, '/', 2) <> 'results')
  $sql$;
  execute $sql$
    create policy room_photos_replace_own on storage.objects for update to authenticated
    using (bucket_id = 'room-photos' and split_part(name, '/', 1) = (select auth.uid())::text and split_part(name, '/', 2) <> 'results')
    with check (bucket_id = 'room-photos' and split_part(name, '/', 1) = (select auth.uid())::text and split_part(name, '/', 2) <> 'results')
  $sql$;
  execute $sql$
    create policy room_photos_delete_own on storage.objects for delete to authenticated
    using (bucket_id = 'room-photos' and split_part(name, '/', 1) = (select auth.uid())::text)
  $sql$;
end
$storage$;
