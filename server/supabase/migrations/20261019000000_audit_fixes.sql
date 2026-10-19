-- Audit (2026-10-19) fixes to the FR-031/033/043 functions. Replaces three functions; privileges are kept.

-- A missing name or revision gave a database error instead of INVALID_DOCUMENT: jsonb_typeof(null) <> 'string' is null.
create or replace function public.gp_document_problem(p_project_id text, p_revision int, p_document jsonb) returns text
language plpgsql immutable set search_path = '' as $$
declare k text;
begin
  if p_document is null or jsonb_typeof(p_document) <> 'object' then return 'document must be an object'; end if;
  if octet_length(p_document::text) > 10485760 then return 'TOO_LARGE'; end if;
  if p_document->'schemaVersion' is distinct from '1'::jsonb then return 'schemaVersion must be 1'; end if;
  if p_document->>'id' is distinct from p_project_id or jsonb_typeof(p_document->'id') is distinct from 'string' then return 'document.id must equal the project id'; end if;
  if jsonb_typeof(p_document->'revision') is distinct from 'number' or p_document->'revision' <> to_jsonb(p_revision) then return 'document.revision must equal expectedServerRevision'; end if;
  if jsonb_typeof(p_document->'name') is distinct from 'string' or length(p_document->>'name') not between 1 and 120 then return 'name must be 1-120 characters'; end if;
  foreach k in array array['floors','junctions','walls','openings','rooms','furniture','materials','lights','cameras'] loop
    if jsonb_typeof(p_document->k) is distinct from 'array' then return k || ' must be an array'; end if;
  end loop;
  if jsonb_array_length(p_document->'floors') = 0 then return 'floors must not be empty'; end if;
  return null;
end $$;

-- Moving a drawing to the trash ends its view-only links for good; taking it out of the trash does not bring them back.
create or replace function public.trash_project(p_project_id text, p_trashed boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return public.gp_fail('NOT_SIGNED_IN'); end if;
  update public.projects set trashed_at = case when p_trashed then now() else null end
    where id = p_project_id and owner_id = auth.uid() and (trashed_at is null) = p_trashed;
  if not found then return public.gp_fail('NOT_FOUND'); end if;
  if p_trashed then update public.project_shares set revoked_at = now() where project_id = p_project_id and revoked_at is null; end if;
  insert into public.audit_events (project_id, actor, kind) values (p_project_id, auth.uid(), case when p_trashed then 'trash' else 'untrash' end);
  return jsonb_build_object('ok', true);
end $$;

-- FR-043 (§D.8 "recent auth"): the database itself refuses unless the token comes from a sign-in in the last 10 minutes.
-- Supabase puts the sign-in time in the token's amr entries (seconds); a refreshed token keeps it, so a stolen or
-- long-lived session cannot delete the account.
create or replace function public.delete_account(p_confirm text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); amr jsonb := auth.jwt()->'amr'; signed_in numeric;
begin
  if me is null then return public.gp_fail('NOT_SIGNED_IN'); end if;
  if p_confirm is distinct from 'DELETE' then return public.gp_fail('CONFIRMATION_REQUIRED'); end if;
  if jsonb_typeof(amr) = 'array' then
    select max((e->>'timestamp')::numeric) into signed_in from jsonb_array_elements(amr) e where jsonb_typeof(e->'timestamp') = 'number';
  end if;
  if signed_in is null or signed_in < extract(epoch from now()) - 600 or signed_in > extract(epoch from now()) + 60 then return public.gp_fail('REAUTH_REQUIRED'); end if;
  delete from public.audit_events where actor = me;
  delete from auth.users where id = me;                                     -- profiles → projects → versions/receipts/shares cascade
  insert into public.audit_events (kind) values ('account_delete');         -- no user id kept
  return jsonb_build_object('ok', true);
end $$;
