-- Workshop-only folders can be created without an app account or customer
-- email. Link them after the customer completes their own profile and vehicle
-- using a strong deterministic match: matching registration plus either the
-- verified account email, or exact full name and normalized mobile.

create or replace function private.normalized_identity_mobile(p_value text)
returns text
language sql
immutable
set search_path = ''
as $function$
  with cleaned as (
    select regexp_replace(coalesce(p_value, ''), '[^0-9]+', '', 'g') as digits
  )
  select case
    when digits ~ '^61[0-9]{9}$' then '0' || substr(digits, 3)
    when digits ~ '^0061[0-9]{9}$' then '0' || substr(digits, 5)
    else nullif(digits, '')
  end
  from cleaned
$function$;

revoke all on function private.normalized_identity_mobile(text)
from public, anon, authenticated, service_role;

do $migration$
begin
  if to_regclass('public.workshop_contacts') is null
    or to_regclass('public.workshop_vehicles') is null then
    return;
  end if;

  execute $definition$
create or replace function private.auto_claim_workshop_history_for_customer(p_customer_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  customer public.customer_profiles%rowtype;
  contact public.workshop_contacts%rowtype;
  source_vehicle public.workshop_vehicles%rowtype;
  target_vehicle_id uuid;
  vehicle_jobs integer;
  mapped_vehicles integer;
  moved_jobs integer;
  claimed_contacts integer := 0;
begin
  if (select auth.uid()) is distinct from p_customer_id then
    return 0;
  end if;

  select profile.* into customer
  from public.customer_profiles profile
  where profile.user_id = p_customer_id
    and profile.account_state = 'active'
    and btrim(coalesce(profile.first_name, '')) <> ''
    and btrim(coalesce(profile.last_name, '')) <> ''
    and btrim(coalesce(profile.mobile, '')) <> '';

  if customer.user_id is null then
    return 0;
  end if;

  for contact in
    select workshop_contact.*
    from public.workshop_contacts workshop_contact
    where workshop_contact.status = 'active'
      and exists (
        select 1
        from public.workshop_jobs job
        where job.workshop_contact_id = workshop_contact.id
          and job.workshop_vehicle_id is not null
      )
      and exists (
        select 1
        from public.workshop_vehicles workshop_vehicle
        join public.customer_vehicles app_vehicle
          on app_vehicle.customer_id = customer.user_id
         and app_vehicle.archived_at is null
         and regexp_replace(upper(btrim(app_vehicle.registration)), '[^A-Z0-9]+', '', 'g')
           = regexp_replace(upper(btrim(workshop_vehicle.registration)), '[^A-Z0-9]+', '', 'g')
        where workshop_vehicle.workshop_contact_id = workshop_contact.id
          and workshop_vehicle.status = 'active'
      )
      and (
        (
          workshop_contact.email is not null
          and lower(btrim(workshop_contact.email)) = lower(btrim(customer.email))
        )
        or (
          regexp_replace(lower(btrim(workshop_contact.display_name)), '[[:space:]]+', ' ', 'g')
            = regexp_replace(
                lower(btrim(coalesce(customer.first_name, '') || ' ' || coalesce(customer.last_name, ''))),
                '[[:space:]]+', ' ', 'g'
              )
          and private.normalized_identity_mobile(workshop_contact.mobile) is not null
          and private.normalized_identity_mobile(workshop_contact.mobile)
            = private.normalized_identity_mobile(customer.mobile)
        )
      )
    order by workshop_contact.created_at, workshop_contact.id
    for update
  loop
    mapped_vehicles := 0;
    moved_jobs := 0;

    for source_vehicle in
      select vehicle.*
      from public.workshop_vehicles vehicle
      where vehicle.workshop_contact_id = contact.id
        and vehicle.status = 'active'
      order by vehicle.created_at, vehicle.id
      for update
    loop
      select vehicle.id into target_vehicle_id
      from public.customer_vehicles vehicle
      where vehicle.customer_id = customer.user_id
        and vehicle.archived_at is null
        and regexp_replace(upper(btrim(vehicle.registration)), '[^A-Z0-9]+', '', 'g')
          = regexp_replace(upper(btrim(source_vehicle.registration)), '[^A-Z0-9]+', '', 'g')
      order by vehicle.created_at, vehicle.id
      limit 1;

      if target_vehicle_id is null then
        insert into public.customer_vehicles (
          customer_id,
          registration,
          year,
          make,
          model,
          vin_last_four,
          is_primary,
          created_by
        ) values (
          customer.user_id,
          source_vehicle.registration,
          source_vehicle.year,
          source_vehicle.make,
          source_vehicle.model,
          source_vehicle.vin_last_four,
          not exists (
            select 1 from public.customer_vehicles vehicle
            where vehicle.customer_id = customer.user_id
              and vehicle.archived_at is null
              and vehicle.is_primary
          ),
          customer.user_id
        ) returning id into target_vehicle_id;
      end if;

      update public.workshop_jobs
      set customer_id = customer.user_id,
          vehicle_id = target_vehicle_id,
          workshop_contact_id = null,
          workshop_vehicle_id = null
      where workshop_contact_id = contact.id
        and workshop_vehicle_id = source_vehicle.id;
      get diagnostics vehicle_jobs = row_count;
      moved_jobs := moved_jobs + vehicle_jobs;

      update public.workshop_vehicles
      set status = 'claimed',
          claimed_vehicle_id = target_vehicle_id
      where id = source_vehicle.id;
      mapped_vehicles := mapped_vehicles + 1;
    end loop;

    if mapped_vehicles > 0 and moved_jobs > 0 then
      update public.workshop_contacts
      set status = 'claimed',
          claimed_customer_id = customer.user_id,
          claimed_at = now(),
          claimed_by = customer.user_id
      where id = contact.id;
      claimed_contacts := claimed_contacts + 1;
    end if;
  end loop;

  return claimed_contacts;
end
$function$
$definition$;

  execute 'revoke all on function private.auto_claim_workshop_history_for_customer(uuid) from public, anon, authenticated, service_role';
end
$migration$;

create or replace function private.auto_claim_after_customer_vehicle_save()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if pg_trigger_depth() > 1
    or new.archived_at is not null
    or (select auth.uid()) is distinct from new.customer_id then
    return new;
  end if;

  if to_regprocedure('private.auto_claim_workshop_history_for_customer(uuid)') is not null then
    execute 'select private.auto_claim_workshop_history_for_customer($1)' using new.customer_id;
  end if;

  return new;
end
$function$;

revoke all on function private.auto_claim_after_customer_vehicle_save()
from public, anon, authenticated, service_role;

drop trigger if exists auto_claim_workshop_history_after_customer_vehicle_save
on public.customer_vehicles;
create trigger auto_claim_workshop_history_after_customer_vehicle_save
after insert or update of registration, archived_at
on public.customer_vehicles
for each row execute function private.auto_claim_after_customer_vehicle_save();

create or replace function private.start_trial_when_customer_completes_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  old_complete boolean := false;
  new_complete boolean;
begin
  if (select auth.uid()) is distinct from new.user_id then
    return new;
  end if;

  new_complete := new.account_state = 'active'
    and btrim(coalesce(new.first_name, '')) <> ''
    and btrim(coalesce(new.last_name, '')) <> ''
    and btrim(coalesce(new.mobile, '')) <> '';

  if tg_op = 'UPDATE' then
    old_complete := old.account_state = 'active'
      and btrim(coalesce(old.first_name, '')) <> ''
      and btrim(coalesce(old.last_name, '')) <> ''
      and btrim(coalesce(old.mobile, '')) <> '';
  end if;

  if new_complete then
    if to_regprocedure('private.auto_claim_workshop_history_for_customer(uuid)') is not null then
      execute 'select private.auto_claim_workshop_history_for_customer($1)' using new.user_id;
    end if;

    if not old_complete then
      perform private.start_performance_trial(new.user_id);
    end if;
  end if;

  return new;
end
$function$;

revoke all on function private.start_trial_when_customer_completes_account()
from public, anon, authenticated, service_role;
