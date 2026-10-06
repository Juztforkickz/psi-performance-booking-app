alter table public.customer_invitations
  add column if not exists workshop_contact_id uuid
    references public.workshop_contacts(id) on delete set null,
  add column if not exists email_delivery_status text not null default 'not_sent'
    check (email_delivery_status in ('not_sent', 'sent', 'failed')),
  add column if not exists email_sent_at timestamptz,
  add column if not exists email_provider_reference text,
  add column if not exists email_last_error_code text;

create unique index if not exists customer_invitations_workshop_contact_idx
  on public.customer_invitations(workshop_contact_id)
  where workshop_contact_id is not null;

comment on column public.customer_invitations.workshop_contact_id is
  'Owner selected workshop customer whose verified history is claimed when this invitation account is completed.';
comment on column public.customer_invitations.email_delivery_status is
  'Delivery state for the customer app download invitation email.';

create or replace function private.claim_invited_workshop_history(p_invitation_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.customer_invitations%rowtype;
  customer public.customer_profiles%rowtype;
  contact public.workshop_contacts%rowtype;
  source_vehicle public.workshop_vehicles%rowtype;
  target_vehicle_id uuid;
  queued_invoice record;
  created_job_id uuid;
  vehicle_job_count integer;
  moved_jobs integer := 0;
  mapped_vehicles integer := 0;
begin
  select value.* into invitation
  from public.customer_invitations value
  where value.id = p_invitation_id
    and value.workshop_contact_id is not null
    and value.status = 'profile_complete';

  if invitation.id is null then
    return 0;
  end if;

  select profile.* into customer
  from public.customer_profiles profile
  where profile.user_id = invitation.auth_user_id
    and profile.account_state = 'active'
    and btrim(coalesce(profile.first_name, '')) <> ''
    and btrim(coalesce(profile.last_name, '')) <> ''
    and btrim(coalesce(profile.mobile, '')) <> '';

  if customer.user_id is null then
    return 0;
  end if;

  select value.* into contact
  from public.workshop_contacts value
  where value.id = invitation.workshop_contact_id
    and value.status = 'active'
    and value.email is not null
    and lower(btrim(value.email)) = lower(btrim(invitation.email))
  for update;

  if contact.id is null then
    return 0;
  end if;

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
      insert into public.customer_vehicles(
        customer_id, registration, year, make, model, vin_last_four,
        is_primary, created_by
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
    get diagnostics vehicle_job_count = row_count;
    moved_jobs := moved_jobs + vehicle_job_count;

    for queued_invoice in
      select queue.id,
             queue.identifiers,
             queue.identifiers->>'invoiceNumber' as invoice_number,
             queue.identifiers->>'invoiceDate' as invoice_date,
             queue.identifiers->>'tenantId' as tenant_id,
             queue.identifiers->>'contactId' as xero_contact_id
      from public.vault_import_queue queue
      where queue.status = 'waiting_for_customer'
        and regexp_replace(lower(btrim(coalesce(queue.identifiers->>'contactName', ''))), '[[:space:]]+', ' ', 'g')
          = regexp_replace(lower(btrim(contact.display_name)), '[[:space:]]+', ' ', 'g')
        and (
          regexp_replace(upper(coalesce(queue.identifiers->>'reference', '')), '[^A-Z0-9]+', '', 'g')
            like '%' || regexp_replace(upper(btrim(source_vehicle.registration)), '[^A-Z0-9]+', '', 'g') || '%'
          or regexp_replace(upper(coalesce(queue.identifiers->>'descriptionRegistration', '')), '[^A-Z0-9]+', '', 'g')
            = regexp_replace(upper(btrim(source_vehicle.registration)), '[^A-Z0-9]+', '', 'g')
        )
      for update
    loop
      if queued_invoice.invoice_number is null
        or queued_invoice.invoice_date is null
        or queued_invoice.tenant_id is null
        or queued_invoice.xero_contact_id is null then
        continue;
      end if;

      insert into public.workshop_jobs(
        customer_id, vehicle_id, reference, title, job_date, created_by
      ) values (
        customer.user_id,
        target_vehicle_id,
        'XERO ' || regexp_replace(upper(queued_invoice.invoice_number), '[^A-Z0-9]+', ' ', 'g')
          || ' - ' || source_vehicle.registration,
        'Xero invoice ' || queued_invoice.invoice_number,
        queued_invoice.invoice_date::date,
        invitation.invited_by
      )
      on conflict (reference) do update
        set reference = excluded.reference
      returning id into created_job_id;

      insert into private.xero_customer_links(
        tenant_id, contact_id, customer_id, verified_by, verified_at
      ) values (
        queued_invoice.tenant_id::uuid,
        queued_invoice.xero_contact_id::uuid,
        customer.user_id,
        invitation.invited_by,
        now()
      )
      on conflict (tenant_id, contact_id) do update
        set customer_id = excluded.customer_id,
            verified_by = excluded.verified_by,
            verified_at = excluded.verified_at;

      update public.vault_import_queue
      set status = 'matched',
          job_id = created_job_id,
          reason = 'Customer completed their invited PSI account. Secure invoice syncing is queued.',
          available_at = now(),
          completed_at = null,
          last_error_code = null
      where id = queued_invoice.id;
    end loop;

    update public.workshop_vehicles
    set status = 'claimed', claimed_vehicle_id = target_vehicle_id
    where id = source_vehicle.id;
    mapped_vehicles := mapped_vehicles + 1;
  end loop;

  if mapped_vehicles > 0 then
    update public.workshop_contacts
    set status = 'claimed',
        claimed_customer_id = customer.user_id,
        claimed_at = now(),
        claimed_by = invitation.invited_by
    where id = contact.id;
  end if;

  return mapped_vehicles;
end
$$;

revoke all on function private.claim_invited_workshop_history(uuid)
from public, anon, authenticated, service_role;

create or replace function private.claim_history_after_invitation_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'profile_complete' and new.workshop_contact_id is not null then
    perform private.claim_invited_workshop_history(new.id);
  end if;
  return new;
end
$$;

revoke all on function private.claim_history_after_invitation_change()
from public, anon, authenticated, service_role;

drop trigger if exists claim_history_after_invitation_change
on public.customer_invitations;
create trigger claim_history_after_invitation_change
after insert or update of status, workshop_contact_id
on public.customer_invitations
for each row execute function private.claim_history_after_invitation_change();

create or replace function private.claim_history_after_customer_profile_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation_id uuid;
begin
  if new.account_state <> 'active'
    or btrim(coalesce(new.first_name, '')) = ''
    or btrim(coalesce(new.last_name, '')) = ''
    or btrim(coalesce(new.mobile, '')) = '' then
    return new;
  end if;

  select value.id into invitation_id
  from public.customer_invitations value
  where value.auth_user_id = new.user_id
    and value.workshop_contact_id is not null;

  if invitation_id is not null then
    perform private.claim_invited_workshop_history(invitation_id);
  end if;
  return new;
end
$$;

revoke all on function private.claim_history_after_customer_profile_change()
from public, anon, authenticated, service_role;

drop trigger if exists claim_history_after_customer_profile_change
on public.customer_profiles;
create trigger claim_history_after_customer_profile_change
after insert or update of first_name, last_name, mobile, account_state
on public.customer_profiles
for each row execute function private.claim_history_after_customer_profile_change();
