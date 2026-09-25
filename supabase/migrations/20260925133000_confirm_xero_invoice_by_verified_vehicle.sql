-- Xero references often contain a vehicle registration rather than PSI's
-- internal job reference. An owner may explicitly confirm that invoice against
-- a verified customer job when the exact active vehicle registration appears
-- in the Xero reference. The import worker still rechecks the customer, job and
-- vehicle ownership before publishing the PDF.

create or replace function private.confirm_xero_import_match(
  p_queue_id uuid,
  p_customer_id uuid,
  p_job_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  queued public.vault_import_queue%rowtype;
  job public.workshop_jobs%rowtype;
  vehicle public.customer_vehicles%rowtype;
  tenant_id uuid;
  contact_id uuid;
  invoice_reference text;
  normalized_reference text;
  normalized_registration text;
begin
  if not private.is_owner_staff() then
    raise exception 'owner_aal2_required' using errcode = '42501';
  end if;

  select * into queued
  from public.vault_import_queue
  where id = p_queue_id
    and source = 'xero'
    and status in ('needs_review', 'failed')
  for update;
  if not found then
    raise exception 'xero_import_not_reviewable';
  end if;

  begin
    tenant_id := (queued.identifiers ->> 'tenantId')::uuid;
    contact_id := (queued.identifiers ->> 'contactId')::uuid;
  exception when others then
    raise exception 'xero_invoice_details_required';
  end;

  invoice_reference := upper(btrim(coalesce(queued.identifiers ->> 'reference', '')));

  select workshop_job.* into job
  from public.workshop_jobs workshop_job
  where workshop_job.id = p_job_id;

  select customer_vehicle.* into vehicle
  from public.customer_vehicles customer_vehicle
  where customer_vehicle.id = job.vehicle_id
    and customer_vehicle.customer_id = p_customer_id
    and customer_vehicle.archived_at is null;

  normalized_reference := ' ' || btrim(regexp_replace(invoice_reference, '[^A-Z0-9]+', ' ', 'g')) || ' ';
  normalized_registration := regexp_replace(upper(btrim(coalesce(vehicle.registration, ''))), '[^A-Z0-9]+', '', 'g');

  if job.id is null
    or job.customer_id <> p_customer_id
    or vehicle.id is null
    or not exists (
      select 1
      from public.customer_profiles profile
      where profile.user_id = p_customer_id
        and profile.account_state = 'active'
    )
    or (
      upper(btrim(job.reference)) <> invoice_reference
      and (
        normalized_registration = ''
        or position(' ' || normalized_registration || ' ' in normalized_reference) = 0
      )
    ) then
    raise exception 'xero_customer_vehicle_job_mismatch';
  end if;

  insert into private.xero_customer_links(
    tenant_id,
    contact_id,
    customer_id,
    verified_by,
    verified_at
  ) values (
    tenant_id,
    contact_id,
    p_customer_id,
    (select auth.uid()),
    now()
  )
  on conflict (tenant_id, contact_id) do update
  set customer_id = excluded.customer_id,
      verified_by = excluded.verified_by,
      verified_at = excluded.verified_at;

  update public.vault_import_queue
  set job_id = p_job_id,
      status = 'matched',
      reason = 'Customer and active vehicle registration verified against the selected PSI job by the owner.',
      available_at = now(),
      last_error_code = null,
      completed_at = null
  where id = p_queue_id;
end
$function$;

revoke all on function private.confirm_xero_import_match(uuid, uuid, uuid)
from public, anon, authenticated;
grant execute on function private.confirm_xero_import_match(uuid, uuid, uuid)
to authenticated;
