-- Serialise Xero refresh-token rotation. Xero rotates refresh tokens on use,
-- so only one trusted worker may refresh a tenant connection at a time.
alter table private.xero_connections
  add column refresh_lock_token uuid,
  add column refresh_lock_until timestamptz;

create or replace function public.claim_xero_refresh(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  connection private.xero_connections%rowtype;
  lock_token uuid := gen_random_uuid();
begin
  select * into connection
  from private.xero_connections
  where tenant_id = p_tenant_id
  for update;

  if not found then
    raise exception 'xero_connection_not_found';
  end if;
  if connection.refresh_lock_until is not null and connection.refresh_lock_until > now() then
    raise exception 'xero_refresh_busy';
  end if;

  update private.xero_connections
  set refresh_lock_token = lock_token,
      refresh_lock_until = now() + interval '90 seconds'
  where tenant_id = p_tenant_id;

  return jsonb_build_object(
    'tenant_id', connection.tenant_id,
    'owner_id', connection.owner_id,
    'sealed_tokens', connection.sealed_tokens,
    'revision', connection.revision,
    'lock_token', lock_token
  );
end
$$;

create or replace function public.commit_xero_refresh(
  p_tenant_id uuid,
  p_lock_token uuid,
  p_expected_revision bigint,
  p_sealed_tokens text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_sealed_tokens is null or octet_length(p_sealed_tokens) < 40 then
    raise exception 'xero_invalid_sealed_tokens';
  end if;

  update private.xero_connections
  set sealed_tokens = p_sealed_tokens,
      revision = revision + 1,
      updated_at = now(),
      refresh_lock_token = null,
      refresh_lock_until = null
  where tenant_id = p_tenant_id
    and refresh_lock_token = p_lock_token
    and revision = p_expected_revision;

  if not found then
    raise exception 'xero_refresh_conflict';
  end if;
end
$$;

create or replace function public.release_xero_refresh(
  p_tenant_id uuid,
  p_lock_token uuid
)
returns void
language sql
security definer
set search_path = ''
as $$
  update private.xero_connections
  set refresh_lock_token = null,
      refresh_lock_until = null
  where tenant_id = p_tenant_id
    and refresh_lock_token = p_lock_token
$$;

revoke all on function public.claim_xero_refresh(uuid) from public, anon, authenticated;
revoke all on function public.commit_xero_refresh(uuid, uuid, bigint, text) from public, anon, authenticated;
revoke all on function public.release_xero_refresh(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_xero_refresh(uuid) to service_role;
grant execute on function public.commit_xero_refresh(uuid, uuid, bigint, text) to service_role;
grant execute on function public.release_xero_refresh(uuid, uuid) to service_role;
