-- GharPlan cloud projects (FR-031 save, FR-032 versions, FR-033 view-only links, FR-043 deletion). D63/D65.
-- Spec: docs/combined-research.md §H.4 (tables), §H.5 (save protocol), §D.8–D.10. Deviations are listed in
-- docs/decisions/cloud-backend.md. Written for Supabase Postgres (auth.users, auth.uid()); the tests emulate both.
--
-- Rules kept here:
--  * Every table has row level security enabled (SEC-009). Clients only ever SELECT their own rows.
--  * Every write goes through a SECURITY DEFINER function with an empty search_path and fully qualified names.
--  * The head revision moves only by compare-and-set inside one transaction; never last-write-wins (§H.5).
--  * Functions return {ok:true,...} or {ok:false, code, details?}; they never echo documents they did not accept.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text, locale text default 'en', units text default 'metric' check (units in ('metric','imperial')),
  created_at timestamptz not null default now(), deleted_requested_at timestamptz
);

create table public.projects (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{2,40}$'),                  -- = ProjectDoc.id
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  current_revision int not null default 0 check (current_revision >= 0),
  thumbnail_path text, room_count int, size_bytes int,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  trashed_at timestamptz
);
create index projects_owner_updated on public.projects (owner_id, updated_at desc) where trashed_at is null;

create table public.project_versions (                                       -- immutable
  project_id text not null references public.projects(id) on delete cascade,
  revision int not null check (revision >= 1),
  snapshot jsonb not null,
  sha256 text not null,                                                      -- of snapshot::text, computed here
  created_at timestamptz not null default now(), created_by uuid references public.profiles(id) on delete set null, label text,
  primary key (project_id, revision),
  check (octet_length(snapshot::text) <= 10485760),
  check ((snapshot->>'revision')::int = revision and snapshot->>'id' = project_id)
);

create table public.project_command_receipts (                               -- idempotent saves (§H.5)
  project_id text not null references public.projects(id) on delete cascade,
  command_id text not null,
  actor uuid not null references public.profiles(id) on delete cascade,
  request_digest text not null,
  base_revision int not null, committed_revision int not null,
  committed_sha256 text not null,                                            -- lets a retry answer after the version is pruned
  created_at timestamptz not null default now(),
  primary key (project_id, command_id)
);

create table public.project_shares (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  token_hash text unique not null,                                           -- SHA-256 hex of the raw token; raw token never stored
  role text not null default 'viewer' check (role in ('viewer','commenter','editor')),  -- only 'viewer' is issued
  grantee_user_id uuid references public.profiles(id) on delete cascade,     -- null = link share
  expires_at timestamptz, created_at timestamptz not null default now(), revoked_at timestamptz
);
create index project_shares_project on public.project_shares (project_id);

create table public.audit_events (
  id bigint generated always as identity primary key,
  project_id text, actor uuid, kind text not null, safe_meta jsonb, created_at timestamptz not null default now()
);

-- Row level security: on for every table. Owners read their own rows; nobody writes tables directly.
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_versions enable row level security;
alter table public.project_command_receipts enable row level security;
alter table public.project_shares enable row level security;
alter table public.audit_events enable row level security;

create policy own_profile on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy own_projects on public.projects for select to authenticated using (owner_id = (select auth.uid()));
create policy own_versions on public.project_versions for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid())));
create policy own_shares on public.project_shares for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid())));
-- project_command_receipts and audit_events: no client policy at all.

-- Supabase grants new public tables to anon/authenticated by default; take that away and grant reads only.
revoke all on public.profiles, public.projects, public.project_versions, public.project_command_receipts,
  public.project_shares, public.audit_events from public, anon, authenticated;
grant select on public.profiles, public.projects, public.project_versions to authenticated;
grant select (id, project_id, role, expires_at, created_at, revoked_at) on public.project_shares to authenticated;  -- never token_hash

-- Helpers --------------------------------------------------------------------------------------------------

create function public.gp_fail(p_code text, p_details jsonb default null) returns jsonb
language sql immutable set search_path = '' as $$
  select case when p_details is null then jsonb_build_object('ok', false, 'code', p_code)
         else jsonb_build_object('ok', false, 'code', p_code, 'details', p_details) end
$$;

create function public.gp_sha256(p_text text) returns text
language sql immutable set search_path = '' as $$ select encode(sha256(convert_to(p_text, 'UTF8')), 'hex') $$;

-- Shape checks the database can do. Full geometry validation (§H.3) runs in the app before saving and again on
-- every load; it cannot run in SQL (see docs/decisions/cloud-backend.md, deviation 1).
create function public.gp_document_problem(p_project_id text, p_revision int, p_document jsonb) returns text
language plpgsql immutable set search_path = '' as $$
declare k text;
begin
  if p_document is null or jsonb_typeof(p_document) <> 'object' then return 'document must be an object'; end if;
  if octet_length(p_document::text) > 10485760 then return 'TOO_LARGE'; end if;
  if p_document->'schemaVersion' is distinct from '1'::jsonb then return 'schemaVersion must be 1'; end if;
  if p_document->>'id' is distinct from p_project_id or jsonb_typeof(p_document->'id') <> 'string' then return 'document.id must equal the project id'; end if;
  if jsonb_typeof(p_document->'revision') <> 'number' or p_document->'revision' <> to_jsonb(p_revision) then return 'document.revision must equal expectedServerRevision'; end if;
  if jsonb_typeof(p_document->'name') <> 'string' or length(p_document->>'name') not between 1 and 120 then return 'name must be 1-120 characters'; end if;
  foreach k in array array['floors','junctions','walls','openings','rooms','furniture','materials','lights','cameras'] loop
    if jsonb_typeof(p_document->k) is distinct from 'array' then return k || ' must be an array'; end if;
  end loop;
  if jsonb_array_length(p_document->'floors') = 0 then return 'floors must not be empty'; end if;
  return null;
end $$;

-- Writes revision r+1 for an already locked project whose head is r. Caller has checked ownership and receipts.
create function public.gp_commit(p_project_id text, p_base int, p_command_id text, p_digest text, p_document jsonb, p_kind text, p_meta jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare next_doc jsonb := jsonb_set(p_document, '{revision}', to_jsonb(p_base + 1)); digest text; saved timestamptz := now(); me uuid := auth.uid();
begin
  digest := public.gp_sha256(next_doc::text);
  insert into public.project_versions (project_id, revision, snapshot, sha256, created_by) values (p_project_id, p_base + 1, next_doc, digest, me);
  update public.projects set current_revision = p_base + 1, updated_at = saved, name = next_doc->>'name',
    room_count = jsonb_array_length(next_doc->'rooms'), size_bytes = octet_length(next_doc::text) where id = p_project_id;
  insert into public.project_command_receipts (project_id, command_id, actor, request_digest, base_revision, committed_revision, committed_sha256)
    values (p_project_id, p_command_id, me, p_digest, p_base, p_base + 1, digest);
  -- Version retention: the newest 20 revisions (§H.5). Premium retention is gated (D36) and not implemented.
  delete from public.project_versions where project_id = p_project_id and revision <= p_base + 1 - 20;
  insert into public.audit_events (project_id, actor, kind, safe_meta) values (p_project_id, me, p_kind, p_meta);
  return jsonb_build_object('ok', true, 'serverRevision', p_base + 1, 'sha256', digest, 'savedAt', saved);
end $$;

-- Locks the project and answers a receipt replay or a head conflict. Returns null when the caller may commit.
create function public.gp_precheck(p_project_id text, p_expected int, p_command_id text, p_digest text) returns jsonb
language plpgsql set search_path = '' as $$
declare head public.projects; receipt public.project_command_receipts;
begin
  select * into head from public.projects where id = p_project_id for update;
  if not found or head.owner_id <> auth.uid() then return public.gp_fail('NOT_FOUND'); end if;
  select * into receipt from public.project_command_receipts where project_id = p_project_id and command_id = p_command_id;
  if found then                                                              -- checked BEFORE the head check (§H.5)
    if receipt.actor <> auth.uid() or receipt.request_digest <> p_digest then return public.gp_fail('IDEMPOTENCY_MISMATCH'); end if;
    return jsonb_build_object('ok', true, 'serverRevision', receipt.committed_revision, 'sha256', receipt.committed_sha256,
      'savedAt', receipt.created_at, 'replayed', true);
  end if;
  if head.trashed_at is not null then return public.gp_fail('PROJECT_TRASHED'); end if;
  if head.current_revision <> p_expected then return public.gp_fail('REVISION_CONFLICT', jsonb_build_object('currentServerRevision', head.current_revision)); end if;
  return null;
end $$;

create function public.gp_ensure_profile() returns uuid language plpgsql set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then return null; end if;
  insert into public.profiles (id) values (me) on conflict (id) do nothing;
  return me;
end $$;

-- FR-031 save (§H.5) ---------------------------------------------------------------------------------------

create function public.save_snapshot(p_project_id text, p_expected_revision int, p_command_id text, p_document jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.gp_ensure_profile(); problem text; digest text; early jsonb; owner uuid; project_count int;
begin
  if me is null then return public.gp_fail('NOT_SIGNED_IN'); end if;
  if p_project_id is null or p_project_id !~ '^[A-Za-z0-9_-]{2,40}$' or p_command_id is null or p_command_id !~ '^[A-Za-z0-9_-]{1,80}$'
     or p_expected_revision is null or p_expected_revision < 0 then return public.gp_fail('INVALID_REQUEST'); end if;
  problem := public.gp_document_problem(p_project_id, p_expected_revision, p_document);
  if problem = 'TOO_LARGE' then return public.gp_fail('TOO_LARGE'); end if;
  if problem is not null then return public.gp_fail('INVALID_DOCUMENT', jsonb_build_object('reason', problem)); end if;
  digest := public.gp_sha256(jsonb_build_array(p_project_id, p_expected_revision, p_command_id, p_document)::text);
  if p_expected_revision = 0 then                                            -- first save creates the project row
    select owner_id into owner from public.projects where id = p_project_id;
    if owner is not null and owner <> me then return public.gp_fail('PROJECT_ID_TAKEN'); end if;
    if owner is null then
      select count(*) into project_count from public.projects where owner_id = me;
      if project_count >= 200 then return public.gp_fail('PROJECT_LIMIT', jsonb_build_object('limit', 200)); end if;
      insert into public.projects (id, owner_id, name) values (p_project_id, me, p_document->>'name') on conflict (id) do nothing;
      select owner_id into owner from public.projects where id = p_project_id;  -- another account may have won the insert race
      if owner <> me then return public.gp_fail('PROJECT_ID_TAKEN'); end if;
    end if;
  end if;
  early := public.gp_precheck(p_project_id, p_expected_revision, p_command_id, digest);
  if early is not null then return early; end if;
  return public.gp_commit(p_project_id, p_expected_revision, p_command_id, digest, p_document, 'save', jsonb_build_object('base', p_expected_revision));
end $$;

-- Latest snapshot of an owned project, read in one statement so revision and content always match.
create function public.load_project(p_project_id text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if auth.uid() is null then return public.gp_fail('NOT_SIGNED_IN'); end if;
  select jsonb_build_object('ok', true, 'serverRevision', p.current_revision, 'name', p.name, 'trashedAt', p.trashed_at,
      'updatedAt', p.updated_at, 'sha256', v.sha256, 'document', v.snapshot)
    into result from public.projects p join public.project_versions v on v.project_id = p.id and v.revision = p.current_revision
    where p.id = p_project_id and p.owner_id = auth.uid();
  return coalesce(result, public.gp_fail('NOT_FOUND'));
end $$;

-- FR-032 restore: an old version becomes a new head r+1; the head never moves backwards (§H.5).
create function public.restore_version(p_project_id text, p_from_revision int, p_expected_revision int, p_command_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); digest text; early jsonb; old jsonb;
begin
  if me is null then return public.gp_fail('NOT_SIGNED_IN'); end if;
  if p_command_id is null or p_command_id !~ '^[A-Za-z0-9_-]{1,80}$' or p_expected_revision is null or p_from_revision is null then return public.gp_fail('INVALID_REQUEST'); end if;
  digest := public.gp_sha256(jsonb_build_array('restore', p_project_id, p_from_revision, p_expected_revision, p_command_id)::text);
  early := public.gp_precheck(p_project_id, p_expected_revision, p_command_id, digest);
  if early is not null then return early; end if;
  select snapshot into old from public.project_versions where project_id = p_project_id and revision = p_from_revision;
  if old is null then return public.gp_fail('VERSION_NOT_FOUND'); end if;
  return public.gp_commit(p_project_id, p_expected_revision, p_command_id, digest, old, 'restore', jsonb_build_object('from', p_from_revision));
end $$;

-- Trash (30 days) and permanent delete ----------------------------------------------------------------------

create function public.trash_project(p_project_id text, p_trashed boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return public.gp_fail('NOT_SIGNED_IN'); end if;
  update public.projects set trashed_at = case when p_trashed then now() else null end
    where id = p_project_id and owner_id = auth.uid() and (trashed_at is null) = p_trashed;
  if not found then return public.gp_fail('NOT_FOUND'); end if;
  insert into public.audit_events (project_id, actor, kind) values (p_project_id, auth.uid(), case when p_trashed then 'trash' else 'untrash' end);
  return jsonb_build_object('ok', true);
end $$;

create function public.delete_project(p_project_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return public.gp_fail('NOT_SIGNED_IN'); end if;
  delete from public.projects where id = p_project_id and owner_id = auth.uid();  -- versions, receipts and shares cascade
  if not found then return public.gp_fail('NOT_FOUND'); end if;
  insert into public.audit_events (project_id, actor, kind) values (p_project_id, auth.uid(), 'delete');
  return jsonb_build_object('ok', true);
end $$;

-- Scheduled job (service role only): remove projects that stayed in the trash for 30 days.
create function public.purge_trashed() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  delete from public.projects where trashed_at < now() - interval '30 days';
  get diagnostics n = row_count;
  return n;
end $$;

-- FR-033 view-only links ------------------------------------------------------------------------------------

create function public.create_share(p_project_id text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare token text; share uuid; active int;
begin
  if auth.uid() is null then return public.gp_fail('NOT_SIGNED_IN'); end if;
  perform 1 from public.projects where id = p_project_id and owner_id = auth.uid() and trashed_at is null and current_revision > 0 for update;
  if not found then return public.gp_fail('NOT_FOUND'); end if;
  select count(*) into active from public.project_shares where project_id = p_project_id and revoked_at is null;
  if active >= 10 then return public.gp_fail('SHARE_LIMIT', jsonb_build_object('limit', 10)); end if;
  -- Two random UUIDv4 values: 244 random bits, above the 128 bits §H.4 asks for. Only the hash is stored.
  token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.project_shares (project_id, token_hash, role) values (p_project_id, public.gp_sha256(token), 'viewer') returning id into share;
  insert into public.audit_events (project_id, actor, kind, safe_meta) values (p_project_id, auth.uid(), 'share_create', jsonb_build_object('share', share));
  return jsonb_build_object('ok', true, 'shareId', share, 'token', token);
end $$;

create function public.revoke_share(p_share_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare project text;
begin
  if auth.uid() is null then return public.gp_fail('NOT_SIGNED_IN'); end if;
  update public.project_shares s set revoked_at = now() from public.projects p
    where s.id = p_share_id and s.revoked_at is null and p.id = s.project_id and p.owner_id = auth.uid() returning s.project_id into project;
  if project is null then return public.gp_fail('NOT_FOUND'); end if;
  insert into public.audit_events (project_id, actor, kind, safe_meta) values (project, auth.uid(), 'share_revoke', jsonb_build_object('share', p_share_id));
  return jsonb_build_object('ok', true);
end $$;

-- Anyone holding a live link may read the current head. Unknown, revoked, expired or trashed all look the same.
create function public.get_shared_project(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then return public.gp_fail('NOT_FOUND'); end if;
  select jsonb_build_object('ok', true, 'serverRevision', p.current_revision, 'name', p.name, 'document', v.snapshot)
    into result from public.project_shares s
    join public.projects p on p.id = s.project_id and p.trashed_at is null
    join public.project_versions v on v.project_id = p.id and v.revision = p.current_revision
    where s.token_hash = public.gp_sha256(p_token) and s.revoked_at is null and (s.expires_at is null or s.expires_at > now());
  return coalesce(result, public.gp_fail('NOT_FOUND'));
end $$;

-- FR-043 account deletion: access ends now and every project row goes with the auth user (cascade).
create function public.delete_account(p_confirm text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then return public.gp_fail('NOT_SIGNED_IN'); end if;
  if p_confirm is distinct from 'DELETE' then return public.gp_fail('CONFIRMATION_REQUIRED'); end if;
  delete from public.audit_events where actor = me;
  delete from auth.users where id = me;                                     -- profiles → projects → versions/receipts/shares cascade
  insert into public.audit_events (kind) values ('account_delete');         -- no user id kept
  return jsonb_build_object('ok', true);
end $$;

-- Execute rights: Postgres grants EXECUTE to PUBLIC by default, so remove it everywhere first.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.save_snapshot(text, int, text, jsonb), public.load_project(text),
  public.restore_version(text, int, int, text), public.trash_project(text, boolean), public.delete_project(text),
  public.create_share(text), public.revoke_share(uuid), public.delete_account(text) to authenticated;
grant execute on function public.get_shared_project(text) to anon, authenticated;
grant execute on function public.purge_trashed() to service_role;
