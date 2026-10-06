create or replace function public.queue_xero_import_for_customer_account_confirmed(
  p_queue_id uuid,
  p_workshop_contact_id uuid,
  p_workshop_vehicle_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  queued public.vault_import_queue%rowtype;
  contact public.workshop_contacts%rowtype;
  vehicle public.workshop_vehicles%rowtype;
begin
  if auth.uid() is null
    or not private.is_owner_staff()
    or coalesce((select auth.jwt()->>'aal'), '') <> 'aal2'
  then
    raise exception 'owner_mfa_required' using errcode = '42501';
  end if;

  select value.* into queued
  from public.vault_import_queue value
  where value.id = p_queue_id
    and value.source = 'xero'
    and value.status in ('needs_review', 'failed')
  for update;

  if queued.id is null then
    raise exception 'xero_import_not_reviewable' using errcode = '22023';
  end if;
  if queued.reason = 'invoice_status_requires_review'
    or upper(coalesce(queued.identifiers->>'invoiceStatus', '')) not in ('AUTHORISED', 'PAID')
  then
    raise exception 'issued_or_paid_xero_invoice_required' using errcode = '22023';
  end if;

  select value.* into contact
  from public.workshop_contacts value
  where value.id = p_workshop_contact_id
    and value.status = 'active';

  select value.* into vehicle
  from public.workshop_vehicles value
  where value.id = p_workshop_vehicle_id
    and value.workshop_contact_id = p_workshop_contact_id
    and value.status = 'active';

  if contact.id is null or vehicle.id is null then
    raise exception 'active_workshop_customer_vehicle_required' using errcode = '22023';
  end if;

  update public.vault_import_queue
  set status = 'waiting_for_customer',
      reason = 'Owner confirmed this invoice belongs to a workshop customer who has not completed their PSI account.',
      identifiers = queued.identifiers
        || jsonb_build_object(
          'xeroContactName', queued.identifiers->>'contactName',
          'contactName', contact.display_name,
          'verifiedWorkshopContactId', contact.id,
          'verifiedWorkshopVehicleId', vehicle.id,
          'descriptionRegistration', vehicle.registration,
          'waitingConfirmedBy', auth.uid(),
          'waitingConfirmedAt', now()
        ),
      available_at = now(),
      completed_at = null,
      last_error_code = null
  where id = queued.id;

  return jsonb_build_object(
    'queueId', queued.id,
    'status', 'waiting_for_customer',
    'workshopContactId', contact.id,
    'workshopVehicleId', vehicle.id
  );
end
$$;

revoke all on function public.queue_xero_import_for_customer_account_confirmed(uuid, uuid, uuid)
from public, anon, authenticated;
grant execute on function public.queue_xero_import_for_customer_account_confirmed(uuid, uuid, uuid)
to authenticated;

create or replace function public.create_xero_waiting_customer(
  p_queue_id uuid,
  p_display_name text,
  p_email text,
  p_mobile text,
  p_registration text,
  p_year integer,
  p_make text,
  p_model text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  contact_id uuid;
  vehicle_id uuid;
  normalized_email text := nullif(lower(btrim(p_email)), '');
  normalized_mobile text := nullif(btrim(p_mobile), '');
  normalized_registration text := upper(regexp_replace(btrim(p_registration), '[^A-Z0-9]+', '', 'g'));
  result jsonb;
begin
  if actor_id is null
    or not private.is_owner_staff()
    or coalesce((select auth.jwt()->>'aal'), '') <> 'aal2'
  then
    raise exception 'owner_mfa_required' using errcode = '42501';
  end if;
  if octet_length(btrim(p_display_name)) not between 1 and 160
    or (normalized_email is null and normalized_mobile is null)
    or (normalized_email is not null and normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
    or (normalized_mobile is not null and octet_length(normalized_mobile) not between 6 and 40)
    or octet_length(normalized_registration) not between 1 and 20
    or p_year not between 1900 and 2200
    or octet_length(btrim(p_make)) not between 1 and 80
    or octet_length(btrim(p_model)) not between 1 and 100
  then
    raise exception 'invalid_waiting_customer_or_vehicle' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.workshop_vehicles vehicle
    where vehicle.status = 'active'
      and regexp_replace(upper(btrim(vehicle.registration)), '[^A-Z0-9]+', '', 'g') = normalized_registration
  ) then
    raise exception 'existing_workshop_vehicle_match_available' using errcode = '22023';
  end if;

  insert into public.workshop_contacts(display_name, email, mobile, created_by)
  values (btrim(p_display_name), normalized_email, normalized_mobile, actor_id)
  returning id into contact_id;

  insert into public.workshop_vehicles(workshop_contact_id, registration, year, make, model, created_by)
  values (contact_id, normalized_registration, p_year::smallint, btrim(p_make), btrim(p_model), actor_id)
  returning id into vehicle_id;

  select public.queue_xero_import_for_customer_account_confirmed(p_queue_id, contact_id, vehicle_id)
  into result;
  return result;
end
$$;

revoke all on function public.create_xero_waiting_customer(uuid, text, text, text, text, integer, text, text)
from public, anon, authenticated;
grant execute on function public.create_xero_waiting_customer(uuid, text, text, text, text, integer, text, text)
to authenticated;

create or replace function private.match_waiting_xero_imports_for_customer(p_customer_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  customer public.customer_profiles%rowtype;
  queued public.vault_import_queue%rowtype;
  contact public.workshop_contacts%rowtype;
  source_vehicle public.workshop_vehicles%rowtype;
  target_vehicle_id uuid;
  created_job_id uuid;
  matched_count integer := 0;
begin
  if auth.uid() is distinct from p_customer_id then
    return 0;
  end if;

  select value.* into customer
  from public.customer_profiles value
  where value.user_id = p_customer_id
    and value.account_state = 'active'
    and btrim(coalesce(value.first_name, '')) <> ''
    and btrim(coalesce(value.last_name, '')) <> ''
    and btrim(coalesce(value.mobile, '')) <> '';
  if customer.user_id is null then return 0; end if;

  for queued in
    select value.*
    from public.vault_import_queue value
    where value.status = 'waiting_for_customer'
      and value.source = 'xero'
      and coalesce(value.identifiers->>'verifiedWorkshopContactId', '') <> ''
      and coalesce(value.identifiers->>'verifiedWorkshopVehicleId', '') <> ''
    order by value.created_at, value.id
    for update
  loop
    select value.* into contact
    from public.workshop_contacts value
    where value.id::text = queued.identifiers->>'verifiedWorkshopContactId'
      and value.status in ('active', 'claimed');
    select value.* into source_vehicle
    from public.workshop_vehicles value
    where value.id::text = queued.identifiers->>'verifiedWorkshopVehicleId'
      and value.workshop_contact_id = contact.id
      and value.status in ('active', 'claimed');
    if contact.id is null or source_vehicle.id is null then continue; end if;

    select value.id into target_vehicle_id
    from public.customer_vehicles value
    where value.customer_id = customer.user_id
      and value.archived_at is null
      and regexp_replace(upper(btrim(value.registration)), '[^A-Z0-9]+', '', 'g')
        = regexp_replace(upper(btrim(source_vehicle.registration)), '[^A-Z0-9]+', '', 'g')
    order by value.created_at, value.id
    limit 1;
    if target_vehicle_id is null then continue; end if;

    if not (
      (contact.email is not null and lower(btrim(contact.email)) = lower(btrim(customer.email)))
      or (
        regexp_replace(lower(btrim(contact.display_name)), '[[:space:]]+', ' ', 'g')
          = regexp_replace(lower(btrim(coalesce(customer.first_name, '') || ' ' || coalesce(customer.last_name, ''))), '[[:space:]]+', ' ', 'g')
        and private.normalized_identity_mobile(contact.mobile) is not null
        and private.normalized_identity_mobile(contact.mobile) = private.normalized_identity_mobile(customer.mobile)
      )
    ) then continue; end if;

    if coalesce(queued.identifiers->>'invoiceNumber', '') = ''
      or coalesce(queued.identifiers->>'invoiceDate', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      or coalesce(queued.identifiers->>'tenantId', '') !~ '^[0-9a-fA-F-]{36}$'
      or coalesce(queued.identifiers->>'contactId', '') !~ '^[0-9a-fA-F-]{36}$'
    then continue; end if;

    insert into public.workshop_jobs(customer_id, vehicle_id, reference, title, job_date, created_by)
    values (
      customer.user_id,
      target_vehicle_id,
      'XERO ' || regexp_replace(upper(queued.identifiers->>'invoiceNumber'), '[^A-Z0-9]+', ' ', 'g') || ' - ' || source_vehicle.registration,
      'Xero invoice ' || queued.identifiers->>'invoiceNumber',
      (queued.identifiers->>'invoiceDate')::date,
      contact.created_by
    )
    on conflict (reference) do update set reference = excluded.reference
    returning id into created_job_id;

    insert into private.xero_customer_links(tenant_id, contact_id, customer_id, verified_by, verified_at)
    values ((queued.identifiers->>'tenantId')::uuid, (queued.identifiers->>'contactId')::uuid, customer.user_id, contact.created_by, now())
    on conflict (tenant_id, contact_id) do update
      set customer_id = excluded.customer_id,
          verified_by = excluded.verified_by,
          verified_at = excluded.verified_at;

    update public.vault_import_queue
    set status = 'matched',
        job_id = created_job_id,
        reason = 'Customer completed their PSI account. Secure invoice syncing is queued.',
        available_at = now(),
        completed_at = null,
        last_error_code = null
    where id = queued.id;

    update public.workshop_vehicles
    set status = 'claimed', claimed_vehicle_id = target_vehicle_id
    where id = source_vehicle.id and status = 'active';
    matched_count := matched_count + 1;
  end loop;

  update public.workshop_contacts value
  set status = 'claimed', claimed_customer_id = customer.user_id, claimed_at = now(), claimed_by = customer.user_id
  where value.status = 'active'
    and not exists (
      select 1 from public.workshop_vehicles vehicle
      where vehicle.workshop_contact_id = value.id and vehicle.status = 'active'
    )
    and exists (
      select 1 from public.vault_import_queue queue
      where queue.identifiers->>'verifiedWorkshopContactId' = value.id::text
        and queue.status in ('matched', 'imported')
    );

  return matched_count;
end
$$;

revoke all on function private.match_waiting_xero_imports_for_customer(uuid)
from public, anon, authenticated, service_role;

create or replace function private.match_waiting_xero_after_customer_vehicle_save()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 or new.archived_at is not null or auth.uid() is distinct from new.customer_id then
    return new;
  end if;
  perform private.match_waiting_xero_imports_for_customer(new.customer_id);
  return new;
end
$$;

revoke all on function private.match_waiting_xero_after_customer_vehicle_save()
from public, anon, authenticated, service_role;

drop trigger if exists zz_match_waiting_xero_after_customer_vehicle_save on public.customer_vehicles;
create trigger zz_match_waiting_xero_after_customer_vehicle_save
after insert or update of registration, archived_at on public.customer_vehicles
for each row execute function private.match_waiting_xero_after_customer_vehicle_save();

create or replace function private.match_waiting_xero_after_customer_profile_save()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 or auth.uid() is distinct from new.user_id then return new; end if;
  perform private.match_waiting_xero_imports_for_customer(new.user_id);
  return new;
end
$$;

revoke all on function private.match_waiting_xero_after_customer_profile_save()
from public, anon, authenticated, service_role;

drop trigger if exists zz_match_waiting_xero_after_customer_profile_save on public.customer_profiles;
create trigger zz_match_waiting_xero_after_customer_profile_save
after insert or update of first_name, last_name, mobile, email on public.customer_profiles
for each row execute function private.match_waiting_xero_after_customer_profile_save();
