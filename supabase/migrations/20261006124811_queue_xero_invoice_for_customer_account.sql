create or replace function public.queue_xero_import_for_customer_account(
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
  normalized_registration text;
  reference_tokens text[];
  normalized_description_registration text;
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

  normalized_registration := regexp_replace(upper(btrim(vehicle.registration)), '[^A-Z0-9]+', '', 'g');
  reference_tokens := regexp_split_to_array(upper(coalesce(queued.identifiers->>'reference', '')), '[^A-Z0-9]+');
  normalized_description_registration := regexp_replace(upper(coalesce(queued.identifiers->>'descriptionRegistration', '')), '[^A-Z0-9]+', '', 'g');

  if normalized_registration = ''
    or not (
      normalized_registration = any(reference_tokens)
      or normalized_description_registration = normalized_registration
    )
  then
    raise exception 'verified_workshop_registration_required' using errcode = '22023';
  end if;

  update public.vault_import_queue
  set status = 'waiting_for_customer',
      reason = 'Verified workshop customer has not completed their PSI account yet.',
      identifiers = queued.identifiers
        || jsonb_build_object(
          'xeroContactName', queued.identifiers->>'contactName',
          'contactName', contact.display_name,
          'verifiedWorkshopContactId', contact.id,
          'verifiedWorkshopVehicleId', vehicle.id,
          'descriptionRegistration', vehicle.registration
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

revoke all on function public.queue_xero_import_for_customer_account(uuid, uuid, uuid)
from public, anon, authenticated;
grant execute on function public.queue_xero_import_for_customer_account(uuid, uuid, uuid)
to authenticated;
