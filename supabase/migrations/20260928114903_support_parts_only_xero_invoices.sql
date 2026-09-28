-- A parts-only sale belongs to a verified customer vehicle but is not a PSI
-- workshop job. Keep the same protected Xero review boundary without creating
-- a booking, workshop job, desktop folder or service-completion candidate.

alter table public.vault_records
  alter column job_id drop not null;

create or replace function private.check_vault_publication()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if old.customer_id is distinct from new.customer_id
    or old.vehicle_id is distinct from new.vehicle_id
    or old.job_id is distinct from new.job_id then
    raise exception 'vault_record_target_immutable';
  end if;
  if new.published_at is not null
    and exists(select 1 from public.vault_assets asset where asset.record_id = new.id and not asset.ready) then
    raise exception 'vault_uploads_incomplete';
  end if;
  if new.published_at is not null
    and new.kind = 'dyno'
    and not exists(
      select 1 from public.vault_assets asset
      where asset.record_id = new.id
        and asset.ready
        and asset.mime_type = 'application/pdf'
    ) then
    raise exception 'dyno_pdf_required';
  end if;
  return new;
end
$function$;

revoke all on function private.check_vault_publication()
  from public, anon, authenticated;

create or replace function private.notify_vault_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  -- Parts-only records have no workshop job. They are immediately visible in
  -- vehicle history and do not create a job-scoped update counter.
  if new.job_id is not null
    and new.published_at is not null
    and (tg_op = 'INSERT' or old.published_at is null) then
    insert into public.vault_updates(job_id, customer_id, vehicle_id, record_count)
    values(new.job_id, new.customer_id, new.vehicle_id, 1)
    on conflict(job_id) do update
      set record_count = public.vault_updates.record_count + 1,
          updated_at = now();
  end if;
  return new;
end
$function$;

revoke all on function private.notify_vault_update()
  from public, anon, authenticated;

create function private.confirm_xero_parts_only_import(
  p_queue_id uuid,
  p_customer_id uuid,
  p_vehicle_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  queued public.vault_import_queue%rowtype;
  vehicle public.customer_vehicles%rowtype;
  v_tenant_id uuid;
  v_contact_id uuid;
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
    v_tenant_id := (queued.identifiers ->> 'tenantId')::uuid;
    v_contact_id := (queued.identifiers ->> 'contactId')::uuid;
  exception when others then
    raise exception 'xero_invoice_details_required';
  end;

  select customer_vehicle.* into vehicle
  from public.customer_vehicles customer_vehicle
  where customer_vehicle.id = p_vehicle_id
    and customer_vehicle.customer_id = p_customer_id
    and customer_vehicle.archived_at is null;

  if vehicle.id is null
    or not exists (
      select 1
      from public.customer_profiles profile
      where profile.user_id = p_customer_id
        and profile.account_state = 'active'
    )
    or (queued.identifiers ->> 'invoiceStatus') not in ('AUTHORISED', 'PAID')
    or (queued.identifiers ->> 'currency') <> 'AUD' then
    raise exception 'xero_parts_only_customer_vehicle_mismatch';
  end if;

  insert into private.xero_customer_links(
    tenant_id,
    contact_id,
    customer_id,
    verified_by,
    verified_at
  ) values (
    v_tenant_id,
    v_contact_id,
    p_customer_id,
    (select auth.uid()),
    now()
  )
  on conflict (tenant_id, contact_id) do update
  set customer_id = excluded.customer_id,
      verified_by = excluded.verified_by,
      verified_at = excluded.verified_at;

  update public.vault_import_queue
  set job_id = null,
      status = 'matched',
      identifiers = queued.identifiers || jsonb_build_object(
        'partsOnly', true,
        'partsOnlyCustomerId', p_customer_id,
        'partsOnlyVehicleId', p_vehicle_id,
        'partsOnlyConfirmedBy', (select auth.uid()),
        'partsOnlyConfirmedAt', now()
      ),
      reason = 'Owner verified this as a parts-only sale for the selected active customer vehicle.',
      available_at = now(),
      last_error_code = null,
      completed_at = null
  where id = p_queue_id;
end
$function$;

revoke all on function private.confirm_xero_parts_only_import(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.confirm_xero_parts_only_import(uuid, uuid, uuid)
  to authenticated;

create function public.confirm_xero_parts_only_import(
  p_queue_id uuid,
  p_customer_id uuid,
  p_vehicle_id uuid
)
returns void
language sql
security invoker
set search_path = ''
as $function$
  select private.confirm_xero_parts_only_import(p_queue_id, p_customer_id, p_vehicle_id)
$function$;

revoke all on function public.confirm_xero_parts_only_import(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.confirm_xero_parts_only_import(uuid, uuid, uuid)
  to authenticated;
