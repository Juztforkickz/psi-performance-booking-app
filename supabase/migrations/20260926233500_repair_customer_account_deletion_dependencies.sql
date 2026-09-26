-- Keep permanent customer deletion complete as new booking/payment tables are added.
-- The owner has already completed the retention review before this RPC is called.
create or replace function public.complete_customer_account_data(
  p_user_id uuid,
  p_completed_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking_count integer := 0;
  file_count integer := 0;
  vehicle_count integer := 0;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from private.deleted_customer_identities deleted_identity
    where deleted_identity.user_id = p_user_id
      and deleted_identity.completed_by = p_completed_by
      and deleted_identity.status = 'processing'
  ) then
    raise exception 'locked_deletion_required' using errcode = 'P0002';
  end if;

  select count(*) into booking_count
  from public.booking_requests booking
  where booking.customer_id = p_user_id;
  select count(*) into file_count
  from public.vehicle_files file
  where file.customer_id = p_user_id;
  select count(*) into vehicle_count
  from public.customer_vehicles vehicle
  where vehicle.customer_id = p_user_id;

  delete from public.push_notification_jobs
  where recipient_user_id = p_user_id
     or booking_request_id in (
       select booking.id from public.booking_requests booking where booking.customer_id = p_user_id
     );
  delete from public.notification_events
  where recipient_user_id = p_user_id
     or booking_request_id in (
       select booking.id from public.booking_requests booking where booking.customer_id = p_user_id
     );
  delete from public.push_devices where user_id = p_user_id;
  delete from public.notification_preferences where user_id = p_user_id;
  delete from public.booking_calendar_events
  where booking_request_id in (
    select booking.id from public.booking_requests booking where booking.customer_id = p_user_id
  );
  delete from public.booking_integration_jobs where customer_id = p_user_id;

  -- Payment events depend on attempts, and both depend on the booking/customer.
  delete from public.booking_payment_events
  where customer_id = p_user_id
     or booking_request_id in (
       select booking.id from public.booking_requests booking where booking.customer_id = p_user_id
     )
     or payment_attempt_id in (
       select attempt.id from public.booking_payment_attempts attempt where attempt.customer_id = p_user_id
     );
  delete from public.booking_payment_attempts
  where customer_id = p_user_id
     or booking_request_id in (
       select booking.id from public.booking_requests booking where booking.customer_id = p_user_id
     );

  delete from public.service_completion_candidates where customer_id = p_user_id;
  delete from public.vehicle_files where customer_id = p_user_id;
  delete from public.odometer_readings where customer_id = p_user_id;
  delete from public.repair_records where customer_id = p_user_id;
  delete from public.service_completions where customer_id = p_user_id;
  delete from public.invoices where customer_id = p_user_id;
  delete from public.recommended_work where customer_id = p_user_id;
  delete from public.dyno_records where customer_id = p_user_id;

  -- A workshop-only record may have been claimed by this app account. Keep the
  -- workshop record, but remove the link to the identity being erased.
  update public.workshop_contacts
  set status = 'active', claimed_customer_id = null, claimed_at = null, claimed_by = null
  where claimed_customer_id = p_user_id;
  update public.workshop_vehicles
  set status = 'active', claimed_vehicle_id = null
  where claimed_vehicle_id in (
    select vehicle.id from public.customer_vehicles vehicle where vehicle.customer_id = p_user_id
  );

  delete from public.booking_requests where customer_id = p_user_id;
  delete from public.customer_vehicles where customer_id = p_user_id;

  delete from public.audit_events
  where customer_id = p_user_id
     or actor_user_id = p_user_id
     or record_id = p_user_id;

  return jsonb_build_object(
    'bookingsRemoved', booking_count,
    'databaseFilesRemoved', file_count,
    'vehiclesRemoved', vehicle_count
  );
end
$$;

revoke all on function public.complete_customer_account_data(uuid, uuid) from public, anon, authenticated;
grant execute on function public.complete_customer_account_data(uuid, uuid) to service_role;
