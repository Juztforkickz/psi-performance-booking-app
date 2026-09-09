-- Represent owner access explicitly. Paid and beta entitlements remain bounded.
alter table public.performance_subscriptions
  add column is_permanent boolean not null default false;

alter table public.performance_subscriptions
  alter column expires_at drop not null;

alter table public.performance_subscriptions
  add constraint performance_subscriptions_expiry_shape_check check (
    (not is_permanent and expires_at is not null)
    or (
      is_permanent
      and expires_at is null
      and provider = 'complimentary'
      and provider_reference = 'permanent:' || customer_id::text
      and environment = 'production'
      and status in ('active', 'revoked')
      and not auto_renews
    )
  );

create or replace function private.has_performance_plus()
returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null
 and (select private.customer_identity_access_allowed())
 and exists (
 select 1 from public.performance_subscriptions s
 where s.customer_id=(select auth.uid())
 and (s.is_permanent or s.expires_at>now())
 and s.status in ('active','grace_period')
 and (s.environment='production' or (select allow_sandbox from private.performance_settings where singleton))
 )
$$;
revoke all on function private.has_performance_plus() from public, anon;
grant execute on function private.has_performance_plus() to authenticated;

create or replace function private.performance_vault_overview(p_vehicle_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 counts jsonb;
 entitled boolean;
 permanent_access boolean;
 access_expires_at timestamptz;
begin
 if (select auth.uid()) is null or not private.customer_identity_access_allowed()
 or not exists(select 1 from public.customer_vehicles v where v.id=p_vehicle_id and v.customer_id=(select auth.uid()) and v.archived_at is null)
 then raise exception 'vehicle_access_denied' using errcode='42501'; end if;

 entitled:=private.has_performance_plus();
 select coalesce(jsonb_object_agg(kind,total),'{}'::jsonb) into counts from
 (select kind,count(*) total from (select r.kind from public.vault_records r where r.customer_id=(select auth.uid()) and r.vehicle_id=p_vehicle_id and r.published_at is not null union all select 'invoice' from public.invoices i where i.customer_id=(select auth.uid()) and i.vehicle_id=p_vehicle_id and i.archived_at is null) records group by kind) c;

 select coalesce(bool_or(s.is_permanent),false),
 max(s.expires_at) filter (where not s.is_permanent)
 into permanent_access,access_expires_at
 from public.performance_subscriptions s
 where s.customer_id=(select auth.uid())
 and s.status in ('active','grace_period')
 and (s.is_permanent or s.expires_at>now())
 and (s.environment='production' or (select allow_sandbox from private.performance_settings where singleton));

 return jsonb_build_object(
   'plan',case when entitled then 'performance_plus' else 'free' end,
   'counts',counts,
   'expires_at',case when permanent_access then null else access_expires_at end,
   'is_permanent',permanent_access
 );
end $$;
revoke all on function private.performance_vault_overview(uuid) from public,anon;
grant execute on function private.performance_vault_overview(uuid) to authenticated;
