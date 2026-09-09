-- Additive connection scaffolding. No customer rows, entitlements or invoices change.
create table private.xero_oauth_states (
 state_hash text primary key check(state_hash ~ '^[a-f0-9]{64}$'),
 owner_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '10 minutes'
);
alter table private.xero_oauth_states enable row level security;
revoke all on private.xero_oauth_states from public,anon,authenticated;

create table private.xero_connections (
 tenant_id uuid primary key,
 sealed_tokens text not null check(length(sealed_tokens) between 40 and 40000),
 owner_id uuid not null references auth.users(id) on delete cascade,
 connected_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 revision bigint not null default 1
);
alter table private.xero_connections enable row level security;
revoke all on private.xero_connections from public,anon,authenticated;

-- RPC boundary is deliberately narrow: customer callers cannot read the private
-- tables. The setup RPC verifies current owner MFA; token RPC is service-only.
create function public.begin_xero_oauth(p_state_hash text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_owner_staff() then raise exception 'owner_mfa_required' using errcode='42501'; end if;
 if p_state_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid_state'; end if;
 delete from private.xero_oauth_states where expires_at<=now() or owner_id=(select auth.uid());
 insert into private.xero_oauth_states(state_hash,owner_id) values(p_state_hash,(select auth.uid()));
end $$;
revoke all on function public.begin_xero_oauth(text) from public,anon,authenticated;
grant execute on function public.begin_xero_oauth(text) to authenticated;

create function public.consume_xero_oauth(p_state_hash text)
returns uuid language plpgsql security definer set search_path='' as $$
declare owner_uuid uuid;
begin
 delete from private.xero_oauth_states s where s.state_hash=p_state_hash and s.expires_at>now()
 and exists(select 1 from public.staff_members sm where sm.user_id=s.owner_id and sm.role='owner' and sm.status='active')
 returning s.owner_id into owner_uuid;
 return owner_uuid;
end $$;
revoke all on function public.consume_xero_oauth(text) from public,anon,authenticated;
grant execute on function public.consume_xero_oauth(text) to service_role;

create function public.save_xero_connection(p_tenant_id uuid,p_owner_id uuid,p_sealed_tokens text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.staff_members where user_id=p_owner_id and role='owner' and status='active')
 then raise exception 'owner_unavailable'; end if;
 insert into private.xero_connections(tenant_id,owner_id,sealed_tokens)
 values(p_tenant_id,p_owner_id,p_sealed_tokens)
 on conflict(tenant_id) do update set owner_id=excluded.owner_id,sealed_tokens=excluded.sealed_tokens,
 updated_at=now(),revision=private.xero_connections.revision+1;
end $$;
revoke all on function public.save_xero_connection(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.save_xero_connection(uuid,uuid,text) to service_role;

create function public.xero_connection_status()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_owner_staff() then raise exception 'owner_mfa_required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('tenant_id',tenant_id,'connected_at',connected_at,'updated_at',updated_at)) from private.xero_connections),'[]'::jsonb);
end $$;
revoke all on function public.xero_connection_status() from public,anon,authenticated;
grant execute on function public.xero_connection_status() to authenticated;
