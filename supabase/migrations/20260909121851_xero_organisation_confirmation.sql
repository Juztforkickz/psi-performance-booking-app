create table private.xero_connection_candidates (
 tenant_id uuid primary key,
 tenant_name text not null check(length(tenant_name) between 1 and 250),
 sealed_tokens text not null check(length(sealed_tokens) between 40 and 40000),
 owner_id uuid not null references auth.users(id) on delete cascade,
 expires_at timestamptz not null default now()+interval '15 minutes'
);
alter table private.xero_connection_candidates enable row level security;
revoke all on private.xero_connection_candidates from public,anon,authenticated;
create index xero_candidates_owner_idx on private.xero_connection_candidates(owner_id);

create function public.stage_xero_connection(p_tenant_id uuid,p_tenant_name text,p_owner_id uuid,p_sealed_tokens text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.staff_members where user_id=p_owner_id and role='owner' and status='active') then raise exception 'owner_unavailable'; end if;
 delete from private.xero_connection_candidates where expires_at<=now();
 insert into private.xero_connection_candidates(tenant_id,tenant_name,owner_id,sealed_tokens)
 values(p_tenant_id,p_tenant_name,p_owner_id,p_sealed_tokens)
 on conflict(tenant_id) do update set tenant_name=excluded.tenant_name,owner_id=excluded.owner_id,
 sealed_tokens=excluded.sealed_tokens,expires_at=now()+interval '15 minutes';
end $$;
revoke all on function public.stage_xero_connection(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.stage_xero_connection(uuid,text,uuid,text) to service_role;

create function private.xero_connection_candidates()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_owner_staff() or coalesce((select auth.jwt()->>'aal'),'')<>'aal2' then raise exception 'owner_mfa_required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('tenant_id',tenant_id,'tenant_name',tenant_name)) from private.xero_connection_candidates where owner_id=(select auth.uid()) and expires_at>now()),'[]'::jsonb);
end $$;
revoke all on function private.xero_connection_candidates() from public,anon,authenticated;
grant execute on function private.xero_connection_candidates() to authenticated;
create function public.xero_connection_candidates()
returns jsonb language sql stable security invoker set search_path='' as $$ select private.xero_connection_candidates() $$;
revoke all on function public.xero_connection_candidates() from public,anon,authenticated;
grant execute on function public.xero_connection_candidates() to authenticated;

create function private.confirm_xero_organisation(p_tenant_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare candidate private.xero_connection_candidates%rowtype;
begin
 if not private.is_owner_staff() or coalesce((select auth.jwt()->>'aal'),'')<>'aal2' then raise exception 'owner_mfa_required' using errcode='42501'; end if;
 select * into candidate from private.xero_connection_candidates where tenant_id=p_tenant_id and owner_id=(select auth.uid()) and expires_at>now() for update;
 if not found then raise exception 'connection_confirmation_expired'; end if;
 if exists(select 1 from private.xero_connections where tenant_id<>p_tenant_id) then raise exception 'different_organisation_already_connected'; end if;
 insert into private.xero_connections(tenant_id,owner_id,sealed_tokens) values(candidate.tenant_id,candidate.owner_id,candidate.sealed_tokens)
 on conflict(tenant_id) do update set owner_id=excluded.owner_id,sealed_tokens=excluded.sealed_tokens,updated_at=now(),revision=private.xero_connections.revision+1;
 delete from private.xero_connection_candidates where owner_id=(select auth.uid());
end $$;
revoke all on function private.confirm_xero_organisation(uuid) from public,anon,authenticated;
grant execute on function private.confirm_xero_organisation(uuid) to authenticated;
create function public.confirm_xero_organisation(p_tenant_id uuid)
returns void language sql security invoker set search_path='' as $$ select private.confirm_xero_organisation(p_tenant_id) $$;
revoke all on function public.confirm_xero_organisation(uuid) from public,anon,authenticated;
grant execute on function public.confirm_xero_organisation(uuid) to authenticated;
