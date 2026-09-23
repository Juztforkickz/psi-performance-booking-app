-- Give each customer one 14-day Performance+ trial when PSI publishes their
-- first workshop photo gallery. The trial never renews, never charges the
-- customer and cannot be restarted by publishing another gallery.

create or replace function private.start_performance_trial(p_customer_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_expires_at timestamptz;
begin
  if p_customer_id is null or not exists (
    select 1 from public.customer_profiles profile
    where profile.user_id = p_customer_id
      and profile.account_state = 'active'
  ) then
    raise exception 'active_customer_required' using errcode = '22023';
  end if;

  select subscription.expires_at
  into v_expires_at
  from public.performance_subscriptions subscription
  where subscription.provider = 'complimentary'
    and subscription.provider_reference = 'trial:' || p_customer_id::text
    and subscription.environment = 'production'
  limit 1;

  if found then
    return v_expires_at;
  end if;

  insert into public.performance_subscriptions (
    customer_id,
    provider,
    provider_reference,
    environment,
    status,
    expires_at,
    auto_renews,
    verified_at,
    is_permanent
  ) values (
    p_customer_id,
    'complimentary',
    'trial:' || p_customer_id::text,
    'production',
    'active',
    now() + interval '14 days',
    false,
    now(),
    false
  )
  returning expires_at into v_expires_at;

  return v_expires_at;
end
$function$;
revoke all on function private.start_performance_trial(uuid) from public, anon, authenticated;

create or replace function private.start_performance_trial_from_gallery()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.kind = 'media' and new.published_at is not null then
    if tg_op = 'INSERT' or (tg_op = 'UPDATE' and old.published_at is null) then
      perform private.start_performance_trial(new.customer_id);
    end if;
  end if;
  return new;
end
$function$;

revoke all on function private.start_performance_trial_from_gallery() from public, anon, authenticated;

drop trigger if exists start_performance_trial_on_gallery_insert on public.vault_records;
create trigger start_performance_trial_on_gallery_insert
after insert on public.vault_records
for each row execute function private.start_performance_trial_from_gallery();

drop trigger if exists start_performance_trial_on_gallery_publish on public.vault_records;
create trigger start_performance_trial_on_gallery_publish
after update of published_at on public.vault_records
for each row execute function private.start_performance_trial_from_gallery();

-- Owner-only fallback for an existing customer whose PSI photo folder already
-- exists. It returns the original deadline and never extends a used trial.
create or replace function public.start_customer_performance_trial(p_customer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_existing_expires_at timestamptz;
  v_expires_at timestamptz;
begin
  if not private.is_owner_staff() then
    raise exception 'owner_aal2_required' using errcode = '42501';
  end if;

  select subscription.expires_at
  into v_existing_expires_at
  from public.performance_subscriptions subscription
  where subscription.customer_id = p_customer_id
    and subscription.provider = 'complimentary'
    and subscription.provider_reference = 'trial:' || p_customer_id::text
    and subscription.environment = 'production'
  limit 1;

  if found then
    return jsonb_build_object(
      'started', false,
      'expires_at', v_existing_expires_at,
      'active', v_existing_expires_at > now()
    );
  end if;

  v_expires_at := private.start_performance_trial(p_customer_id);
  return jsonb_build_object('started', true, 'expires_at', v_expires_at, 'active', true);
end
$function$;

revoke all on function public.start_customer_performance_trial(uuid) from public, anon;
grant execute on function public.start_customer_performance_trial(uuid) to authenticated;

create or replace function private.performance_vault_overview(p_vehicle_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  counts jsonb;
  entitled boolean;
  permanent_access boolean;
  access_expires_at timestamptz;
  trial_access boolean;
  other_access boolean;
begin
  if (select auth.uid()) is null
    or not private.customer_identity_access_allowed()
    or not exists (
      select 1 from public.customer_vehicles vehicle
      where vehicle.id = p_vehicle_id
        and vehicle.customer_id = (select auth.uid())
        and vehicle.archived_at is null
    )
  then
    raise exception 'vehicle_access_denied' using errcode = '42501';
  end if;

  entitled := private.has_performance_plus();

  select coalesce(jsonb_object_agg(kind, total), '{}'::jsonb)
  into counts
  from (
    select kind, count(*) total
    from (
      select record.kind
      from public.vault_records record
      where record.customer_id = (select auth.uid())
        and record.vehicle_id = p_vehicle_id
        and record.published_at is not null
      union all
      select 'invoice' from public.invoices invoice
      where invoice.customer_id = (select auth.uid()) and invoice.vehicle_id = p_vehicle_id and invoice.archived_at is null
      union all
      select 'dyno' from public.dyno_records dyno
      where dyno.customer_id = (select auth.uid()) and dyno.vehicle_id = p_vehicle_id and dyno.archived_at is null
      union all
      select 'service' from public.repair_records repair
      where repair.customer_id = (select auth.uid()) and repair.vehicle_id = p_vehicle_id and repair.archived_at is null
      union all
      select 'recommendation' from public.recommended_work work
      where work.customer_id = (select auth.uid()) and work.vehicle_id = p_vehicle_id and work.archived_at is null
      union all
      select 'document' from public.vehicle_files file
      where file.customer_id = (select auth.uid()) and file.vehicle_id = p_vehicle_id
        and file.file_kind = 'repair_document' and file.archived_at is null
    ) records
    group by kind
  ) totals;

  select
    coalesce(bool_or(subscription.is_permanent), false),
    max(subscription.expires_at) filter (where not subscription.is_permanent),
    coalesce(bool_or(
      subscription.provider = 'complimentary'
      and subscription.provider_reference = 'trial:' || (select auth.uid())::text
      and subscription.expires_at > now()
    ), false),
    coalesce(bool_or(
      not (
        subscription.provider = 'complimentary'
        and subscription.provider_reference = 'trial:' || (select auth.uid())::text
      )
    ), false)
  into permanent_access, access_expires_at, trial_access, other_access
  from public.performance_subscriptions subscription
  where subscription.customer_id = (select auth.uid())
    and subscription.status in ('active', 'grace_period')
    and (subscription.is_permanent or subscription.expires_at > now())
    and (
      subscription.environment = 'production'
      or (select allow_sandbox from private.performance_settings where singleton)
    );

  return jsonb_build_object(
    'plan', case when entitled then 'performance_plus' else 'free' end,
    'counts', counts,
    'expires_at', case when permanent_access then null else access_expires_at end,
    'is_permanent', permanent_access,
    'is_trial', trial_access and not other_access,
    'trial_days', 14
  );
end
$function$;
