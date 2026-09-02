create table private.deleted_customer_identities (
  user_id uuid primary key,
  deletion_requested_at timestamptz not null,
  deletion_started_at timestamptz not null default now(),
  deletion_completed_at timestamptz,
  completed_by uuid not null,
  status text not null default 'processing' check (status in ('processing', 'completed'))
);

revoke all on private.deleted_customer_identities from public, anon, authenticated;

create or replace function private.customer_identity_access_allowed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and not exists (
      select 1
      from private.deleted_customer_identities deleted_identity
      where deleted_identity.user_id = (select auth.uid())
    )
$$;

revoke all on function private.customer_identity_access_allowed() from public, anon;
grant execute on function private.customer_identity_access_allowed() to authenticated;

create policy "locked identities cannot access customer profiles"
on public.customer_profiles as restrictive for all to authenticated
using ((select private.customer_identity_access_allowed()))
with check ((select private.customer_identity_access_allowed()));

create policy "locked identities cannot access customer vehicles"
on public.customer_vehicles as restrictive for all to authenticated
using ((select private.customer_identity_access_allowed()))
with check ((select private.customer_identity_access_allowed()));

create policy "locked identities cannot access booking requests"
on public.booking_requests as restrictive for all to authenticated
using ((select private.customer_identity_access_allowed()))
with check ((select private.customer_identity_access_allowed()));

create policy "locked identities cannot access dyno records"
on public.dyno_records as restrictive for all to authenticated
using ((select private.customer_identity_access_allowed()))
with check ((select private.customer_identity_access_allowed()));

create policy "locked identities cannot access repair records"
on public.repair_records as restrictive for all to authenticated
using ((select private.customer_identity_access_allowed()))
with check ((select private.customer_identity_access_allowed()));

create policy "locked identities cannot access recommended work"
on public.recommended_work as restrictive for all to authenticated
using ((select private.customer_identity_access_allowed()))
with check ((select private.customer_identity_access_allowed()));

create policy "locked identities cannot access invoices"
on public.invoices as restrictive for all to authenticated
using ((select private.customer_identity_access_allowed()))
with check ((select private.customer_identity_access_allowed()));

create policy "locked identities cannot access vehicle files"
on public.vehicle_files as restrictive for all to authenticated
using ((select private.customer_identity_access_allowed()))
with check ((select private.customer_identity_access_allowed()));

create policy "locked identities cannot access service completions"
on public.service_completions as restrictive for all to authenticated
using ((select private.customer_identity_access_allowed()))
with check ((select private.customer_identity_access_allowed()));

create policy "locked identities cannot access odometer readings"
on public.odometer_readings as restrictive for all to authenticated
using ((select private.customer_identity_access_allowed()))
with check ((select private.customer_identity_access_allowed()));

create policy "locked identities cannot access deletion requests"
on public.account_deletion_requests as restrictive for all to authenticated
using ((select private.customer_identity_access_allowed()))
with check ((select private.customer_identity_access_allowed()));

create policy "locked identities cannot access notification preferences"
on public.notification_preferences as restrictive for all to authenticated
using ((select private.customer_identity_access_allowed()))
with check ((select private.customer_identity_access_allowed()));

create policy "locked identities cannot access push devices"
on public.push_devices as restrictive for all to authenticated
using ((select private.customer_identity_access_allowed()))
with check ((select private.customer_identity_access_allowed()));

create policy "locked identities cannot access notification events"
on public.notification_events as restrictive for all to authenticated
using ((select private.customer_identity_access_allowed()))
with check ((select private.customer_identity_access_allowed()));

create policy "locked identities cannot access private vehicle storage"
on storage.objects as restrictive for all to authenticated
using (
  bucket_id not in ('vehicle-photos', 'vehicle-documents')
  or (select private.customer_identity_access_allowed())
)
with check (
  bucket_id not in ('vehicle-photos', 'vehicle-documents')
  or (select private.customer_identity_access_allowed())
);

create or replace function public.begin_customer_account_deletion(
  p_user_id uuid,
  p_completed_by uuid,
  p_staff_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.account_deletion_requests%rowtype;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_user_id is null or p_completed_by is null then
    raise exception 'deletion_target_required' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.staff_members staff
    where staff.user_id = p_completed_by
      and staff.status = 'active'
      and staff.role = 'owner'
      and lower(btrim(staff.email)) = 'matt@psiperformance.com.au'
  ) then
    raise exception 'owner_required' using errcode = '42501';
  end if;
  if exists (
    select 1
    from public.staff_members staff
    where staff.user_id = p_user_id
      and staff.status = 'active'
  ) then
    raise exception 'staff_identity_cannot_be_deleted' using errcode = '42501';
  end if;

  select * into request_row
  from public.account_deletion_requests request
  where request.user_id = p_user_id
    and request.status in ('requested', 'in_review')
  for update;
  if not found then
    raise exception 'active_deletion_request_required' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.customer_profiles customer where customer.user_id = p_user_id
  ) and not exists (
    select 1 from private.deleted_customer_identities deleted_identity
    where deleted_identity.user_id = p_user_id and deleted_identity.status = 'processing'
  ) then
    raise exception 'customer_profile_not_found' using errcode = 'P0002';
  end if;

  insert into private.deleted_customer_identities (
    user_id,
    deletion_requested_at,
    deletion_started_at,
    completed_by,
    status
  ) values (
    p_user_id,
    request_row.requested_at,
    now(),
    p_completed_by,
    'processing'
  )
  on conflict (user_id) do update
  set completed_by = excluded.completed_by,
      status = 'processing';

  update public.customer_profiles
  set account_state = 'disabled', updated_at = now()
  where user_id = p_user_id;

  update public.account_deletion_requests
  set status = 'in_review',
      staff_note = nullif(left(btrim(coalesce(p_staff_note, '')), 500), ''),
      updated_at = now()
  where user_id = p_user_id;

  return jsonb_build_object(
    'locked', true,
    'requestedAt', request_row.requested_at
  );
end
$$;

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
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
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
  delete from public.vehicle_files where customer_id = p_user_id;
  delete from public.odometer_readings where customer_id = p_user_id;
  delete from public.repair_records where customer_id = p_user_id;
  delete from public.service_completions where customer_id = p_user_id;
  delete from public.invoices where customer_id = p_user_id;
  delete from public.recommended_work where customer_id = p_user_id;
  delete from public.dyno_records where customer_id = p_user_id;
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

create or replace function public.finish_customer_account_deletion(
  p_user_id uuid,
  p_completed_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  completion_id uuid := gen_random_uuid();
  completed_at timestamptz := now();
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  update private.deleted_customer_identities
  set deletion_completed_at = completed_at,
      completed_by = p_completed_by,
      status = 'completed'
  where user_id = p_user_id
    and status = 'processing';
  if not found then
    raise exception 'processing_deletion_not_found' using errcode = 'P0002';
  end if;

  delete from public.audit_events
  where customer_id = p_user_id
     or actor_user_id = p_user_id
     or record_id = p_user_id;

  insert into public.audit_events (
    table_name,
    record_id,
    customer_id,
    action,
    actor_user_id,
    actor_kind,
    occurred_at
  ) values (
    'account_deletion_completion',
    completion_id,
    null,
    'delete',
    p_completed_by,
    'staff',
    completed_at
  );

  return jsonb_build_object(
    'completed', true,
    'completedAt', completed_at,
    'completionReference', completion_id
  );
end
$$;

revoke all on function public.begin_customer_account_deletion(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.complete_customer_account_data(uuid, uuid) from public, anon, authenticated;
revoke all on function public.finish_customer_account_deletion(uuid, uuid) from public, anon, authenticated;
grant execute on function public.begin_customer_account_deletion(uuid, uuid, text) to service_role;
grant execute on function public.complete_customer_account_data(uuid, uuid) to service_role;
grant execute on function public.finish_customer_account_deletion(uuid, uuid) to service_role;
