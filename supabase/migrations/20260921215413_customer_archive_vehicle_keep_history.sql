-- Removing a car from the customer's active garage must not delete or rewrite
-- PSI files, dyno results, invoices, workshop jobs, or completed bookings.
-- Only an open booking keeps the car active until the booking is resolved.
create or replace function public.customer_archive_vehicle(p_vehicle_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid := (select auth.uid());
  v_vehicle public.customer_vehicles%rowtype;
begin
  if v_customer_id is null then raise exception 'Sign in to manage your garage.'; end if;
  perform 1 from public.customer_profiles
   where user_id = v_customer_id and account_state = 'active' for update;
  if not found then raise exception 'Customer account is unavailable.'; end if;
  select * into v_vehicle from public.customer_vehicles
   where id = p_vehicle_id and customer_id = v_customer_id and archived_at is null for update;
  if not found then raise exception 'Vehicle is not in your garage.'; end if;
  if v_vehicle.is_primary then raise exception 'Choose another primary vehicle first.'; end if;
  if v_vehicle.created_by <> v_customer_id then
    raise exception 'PSI-created vehicles can only be removed by PSI.';
  end if;
  if exists (select 1 from public.booking_requests
    where vehicle_id = p_vehicle_id and customer_id = v_customer_id
      and archived_at is null and state not in ('completed', 'cancelled')) then
    raise exception 'This vehicle has an open booking. Resolve it before removing the vehicle.';
  end if;

  -- A sold/removed car must not keep sending its old service reminders.
  update public.booking_integration_jobs as job
     set status = 'cancelled', completed_at = now()
    from public.booking_requests as booking
   where job.booking_request_id = booking.id
     and booking.vehicle_id = p_vehicle_id
     and booking.customer_id = v_customer_id
     and job.job_kind = 'notify_customer_service_due'
     and job.status in ('pending', 'failed', 'blocked_configuration');

  update public.customer_vehicles set archived_at = now(), is_primary = false
   where id = p_vehicle_id and customer_id = v_customer_id;
end;
$$;

revoke all on function public.customer_archive_vehicle(uuid) from public, anon;
grant execute on function public.customer_archive_vehicle(uuid) to authenticated;
