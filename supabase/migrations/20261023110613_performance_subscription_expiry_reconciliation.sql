-- No history deletion, trial restart, payment mutation or notification replay.
create table if not exists private.performance_expiry_audit (
  id bigint generated always as identity primary key,
  subscription_id uuid not null,
  customer_id uuid not null,
  previous_status text not null,
  expires_at timestamptz not null,
  reconciled_at timestamptz not null default now()
);
alter table private.performance_expiry_audit enable row level security;
revoke all on private.performance_expiry_audit from public, anon, authenticated;

create or replace function private.reconcile_performance_expiry()
returns integer language plpgsql security definer set search_path = '' as $$
declare corrected integer;
begin
  with due as (
    select id, customer_id, status, expires_at
    from public.performance_subscriptions
    where not is_permanent and expires_at <= now()
      and status in ('active', 'grace_period')
    for update skip locked
  ), changed as (
    update public.performance_subscriptions s
    set status = 'expired', auto_renews = false
    from due where s.id = due.id
    returning s.id, s.customer_id, due.status, s.expires_at
  )
  insert into private.performance_expiry_audit(subscription_id, customer_id, previous_status, expires_at)
  select id, customer_id, status, expires_at from changed;
  get diagnostics corrected = row_count;
  return corrected;
end $$;
revoke all on function private.reconcile_performance_expiry() from public, anon, authenticated, service_role;

-- Preserve verified_at: it orders provider responses, not local clock updates.
create or replace function private.normalize_performance_expiry()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not new.is_permanent and new.expires_at <= now()
    and new.status in ('active','grace_period') then
    new.status := 'expired';
    new.auto_renews := false;
  end if;
  return new;
end $$;
revoke all on function private.normalize_performance_expiry() from public, anon, authenticated, service_role;
drop trigger if exists normalize_performance_expiry on public.performance_subscriptions;
create trigger normalize_performance_expiry before insert or update
on public.performance_subscriptions for each row execute function private.normalize_performance_expiry();

-- Account status works before a customer adds their first vehicle.
create or replace function private.performance_account_status()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare chosen public.performance_subscriptions%rowtype; ended boolean;
begin
  if (select auth.uid()) is null or not private.customer_identity_access_allowed() then
    raise exception 'customer_access_denied' using errcode = '42501';
  end if;
  select * into chosen from public.performance_subscriptions s
  where s.customer_id = (select auth.uid()) and s.status in ('active','grace_period')
    and (s.is_permanent or s.expires_at > now())
    and (s.environment='production' or (select allow_sandbox from private.performance_settings where singleton))
  order by s.is_permanent desc,
    (s.provider <> 'complimentary') desc,
    (s.provider_reference <> 'trial:' || s.customer_id::text) desc,
    s.expires_at desc nulls first limit 1;
  ended := exists(select 1 from public.performance_subscriptions s
    where s.customer_id=(select auth.uid()) and not s.is_permanent
      and s.expires_at <= now() and s.environment='production');
  return jsonb_build_object(
    'plan',case when chosen.id is not null then 'performance_plus' else 'free' end,
    'status',case when chosen.is_permanent then 'permanent'
      when chosen.provider='complimentary' and chosen.provider_reference='trial:' || chosen.customer_id::text then 'trial'
      when chosen.id is not null then 'active' when ended then 'expired' else 'free' end,
    'is_permanent',coalesce(chosen.is_permanent,false),
    'is_trial',coalesce(chosen.provider='complimentary' and chosen.provider_reference='trial:' || chosen.customer_id::text,false),
    'expires_at',chosen.expires_at,'trial_days',14,'counts','{}'::jsonb,
    'server_time',now());
end $$;
revoke all on function private.performance_account_status() from public, anon;
grant execute on function private.performance_account_status() to authenticated;
create or replace function public.performance_account_status()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select private.performance_account_status()
$$;
revoke all on function public.performance_account_status() from public, anon;
grant execute on function public.performance_account_status() to authenticated;

-- Keep vehicle import rights distinct from an account lifetime subscription.
create or replace function private.performance_vault_overview(p_vehicle_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare counts jsonb; account_status jsonb; imported_access boolean;
begin
  account_status := private.performance_account_status();
  if not exists(select 1 from public.customer_vehicles v where v.id=p_vehicle_id
    and v.customer_id=(select auth.uid()) and v.archived_at is null) then
    raise exception 'vehicle_access_denied' using errcode='42501';
  end if;
  imported_access := private.has_completed_historical_import(p_vehicle_id);
  select coalesce(jsonb_object_agg(kind,total),'{}'::jsonb) into counts from (
    select kind,count(*) total from (
      select r.kind from public.vault_records r where r.customer_id=(select auth.uid()) and r.vehicle_id=p_vehicle_id and r.published_at is not null
      union all select 'invoice' from public.invoices i where i.customer_id=(select auth.uid()) and i.vehicle_id=p_vehicle_id and i.archived_at is null
      union all select 'dyno' from public.dyno_records d where d.customer_id=(select auth.uid()) and d.vehicle_id=p_vehicle_id and d.archived_at is null
      union all select 'service' from public.repair_records r where r.customer_id=(select auth.uid()) and r.vehicle_id=p_vehicle_id and r.archived_at is null
      union all select 'recommendation' from public.recommended_work w where w.customer_id=(select auth.uid()) and w.vehicle_id=p_vehicle_id and w.archived_at is null
      union all select 'document' from public.vehicle_files f where f.customer_id=(select auth.uid()) and f.vehicle_id=p_vehicle_id and f.file_kind='repair_document' and f.archived_at is null
    ) records group by kind
  ) c;
  return account_status || jsonb_build_object('counts',counts,'history_import_access',imported_access,
    'plan',case when account_status->>'plan'='performance_plus' then 'performance_plus'
      when imported_access then 'history_import' else 'free' end);
end $$;

-- File metadata still requires ownership and the existing identity restrictions.
alter policy "performance plus vehicle file reads" on public.vehicle_files using (
  (file_kind='vehicle_photo' and record_source='customer_entry')
  or (select private.has_performance_plus()) or private.has_completed_historical_import(vehicle_id)
  or (select private.is_active_staff())
);

-- Premium URLs are issued by the server with a deadline capped to entitlement.
-- Customers can still upload and read their ordinary vehicle/profile photos.
alter policy "performance plus document object reads" on storage.objects using (
  bucket_id <> 'vehicle-documents' or (select private.is_active_staff())
);
drop policy if exists "workshop photo links issued by server" on storage.objects;
create or replace function private.is_workshop_photo_path(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.vehicle_files f where f.bucket_id='vehicle-photos'
    and f.object_path=p_path and f.record_source='psi_record')
$$;
revoke all on function private.is_workshop_photo_path(text) from public,anon;
grant execute on function private.is_workshop_photo_path(text) to authenticated;
create policy "workshop photo links issued by server" on storage.objects as restrictive
for select to authenticated using (
  bucket_id <> 'vehicle-photos' or (select private.is_active_staff())
  or not private.is_workshop_photo_path(name)
);

-- User-scoped entry point. Staff still pass the separate record RLS first.
create or replace function private.performance_file_access(p_vehicle_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare account_status jsonb;
begin
  if (select auth.uid()) is null or not private.customer_identity_access_allowed() then
    raise exception 'file_access_denied' using errcode='42501';
  end if;
  if private.is_active_staff() then return jsonb_build_object('unlimited',true); end if;
  account_status := private.performance_vault_overview(p_vehicle_id);
  if account_status->>'plan'='history_import' or (account_status->>'history_import_access')::boolean
    or (account_status->>'is_permanent')::boolean then
    return jsonb_build_object('unlimited',true);
  end if;
  if account_status->>'plan' <> 'performance_plus' then
    raise exception 'file_access_denied' using errcode='42501';
  end if;
  return jsonb_build_object('unlimited',false,'expires_at',account_status->'expires_at','server_time',now());
end $$;
revoke all on function private.performance_file_access(uuid) from public,anon;
grant execute on function private.performance_file_access(uuid) to authenticated;
create or replace function public.performance_file_access(p_vehicle_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select private.performance_file_access(p_vehicle_id)
$$;
revoke all on function public.performance_file_access(uuid) from public,anon;
grant execute on function public.performance_file_access(uuid) to authenticated;

-- Replace a named schedule rather than creating duplicate dispatchers.
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
    and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime'
      and schemaname='public' and tablename='performance_subscriptions') then
    alter publication supabase_realtime add table public.performance_subscriptions;
  end if;
end $$;
select cron.schedule('psi-performance-expiry-reconciliation','* * * * *',
  'select private.reconcile_performance_expiry()');
select private.reconcile_performance_expiry();
