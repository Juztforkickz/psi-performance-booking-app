-- Run only as the database test administrator. This creates disposable identities
-- with random IDs and example.invalid addresses; no existing customer is targeted.
-- Booking outbox/notification rows remain uncommitted and invisible to workers.
-- Keep this entire script in one transaction and NEVER remove the final ROLLBACK.
-- This tests database orchestration, not Auth HTTP or physical Storage deletion.

begin isolation level repeatable read;

select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

do $$
declare
  target_id uuid := gen_random_uuid();
  control_id uuid := gen_random_uuid();
  vehicle_id uuid := gen_random_uuid();
  booking_id uuid := gen_random_uuid();
  owner_id uuid;
  target_email text := 'delete-jwt-' || target_id::text || '@example.invalid';
  control_email text := 'delete-control-' || control_id::text || '@example.invalid';
  rpc_signature text;
  rejected boolean;
  summary jsonb;
  completion jsonb;
  before_counts jsonb;
  after_counts jsonb;
  control_before jsonb;
  owner_before jsonb;
  existing_audit_max bigint;
  existing_audit_count bigint;
begin
  select staff.user_id into strict owner_id
  from public.staff_members staff
  where staff.status = 'active' and staff.role = 'owner'
    and lower(btrim(staff.email)) = 'matt@psiperformance.com.au';

  -- Verify the RPC boundary independently of the guard inside SECURITY DEFINER.
  foreach rpc_signature in array array[
    'public.begin_customer_account_deletion(uuid,uuid,text)',
    'public.complete_customer_account_data(uuid,uuid)',
    'public.finish_customer_account_deletion(uuid,uuid)'
  ] loop
    if has_function_privilege('anon', rpc_signature, 'EXECUTE')
      or has_function_privilege('authenticated', rpc_signature, 'EXECUTE')
      or not has_function_privilege('service_role', rpc_signature, 'EXECUTE') then
      raise exception 'Unexpected deletion RPC grants: %', rpc_signature;
    end if;
  end loop;

  select coalesce(max(id), 0), count(*)
  into existing_audit_max, existing_audit_count from public.audit_events;
  select to_jsonb(staff) into owner_before
  from public.staff_members staff where staff.user_id = owner_id;

  insert into auth.users (
    id, aud, role, email, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values
    (target_id, 'authenticated', 'authenticated', target_email, now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    (control_id, 'authenticated', 'authenticated', control_email, now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

  if (select count(*) from public.customer_profiles
      where user_id in (target_id, control_id)) <> 2 then
    raise exception 'Disposable customer profiles were not created by Auth trigger';
  end if;

  insert into public.customer_vehicles (
    id, customer_id, registration, year, make, model, created_by
  ) values (vehicle_id, target_id, 'DELJWT', 2026, 'Regression', 'Disposable', target_id);

  insert into public.booking_requests (
    id, customer_id, vehicle_id, booking_type, request_notes, created_by
  ) values (booking_id, target_id, vehicle_id, 'service',
    'Rollback-only deletion JWT regression; never a live enquiry.', target_id);

  insert into public.performance_subscriptions (
    customer_id, provider, provider_reference, environment, status, expires_at
  ) values (target_id, 'complimentary', 'regression:' || target_id::text,
    'production', 'active', now() + interval '1 day');

  insert into public.account_deletion_requests (user_id) values (target_id);

  -- Compare unaffected records in the same MVCC snapshot, so background activity
  -- cannot produce a false count mismatch. The second identity is a control.
  select jsonb_build_object(
    'auth', (select count(*) from auth.users where id <> target_id),
    'profiles', (select count(*) from public.customer_profiles where user_id <> target_id),
    'vehicles', (select count(*) from public.customer_vehicles where customer_id <> target_id),
    'bookings', (select count(*) from public.booking_requests where customer_id <> target_id),
    'subscriptions', (select count(*) from public.performance_subscriptions where customer_id <> target_id),
    'requests', (select count(*) from public.account_deletion_requests where user_id <> target_id),
    'locks', (select count(*) from private.deleted_customer_identities where user_id <> target_id),
    'staff', (select count(*) from public.staff_members),
    'storage', (select count(*) from storage.objects)
  ) into before_counts;
  select to_jsonb(profile) into control_before
  from public.customer_profiles profile where profile.user_id = control_id;

  perform set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  rejected := false;
  begin
    perform public.begin_customer_account_deletion(target_id, owner_id, null);
  exception when insufficient_privilege then
    if sqlerrm <> 'service_role_required' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'Authenticated claims could begin deletion'; end if;

  rejected := false;
  begin
    perform public.complete_customer_account_data(target_id, owner_id);
  exception when insufficient_privilege then
    if sqlerrm <> 'service_role_required' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'Authenticated claims could clean customer data'; end if;

  rejected := false;
  begin
    perform public.finish_customer_account_deletion(target_id, owner_id);
  exception when insufficient_privilege then
    if sqlerrm <> 'service_role_required' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'Authenticated claims could finish deletion'; end if;

  -- An empty pooled-session setting must deny access, not cause invalid JSON.
  perform set_config('request.jwt.claims', '', true);
  rejected := false;
  begin
    perform public.begin_customer_account_deletion(target_id, owner_id, null);
  exception when insufficient_privilege then
    if sqlerrm <> 'service_role_required' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'Missing claims could begin deletion'; end if;

  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  rejected := false;
  begin
    perform public.begin_customer_account_deletion(target_id, control_id, null);
  exception when insufficient_privilege then
    if sqlerrm <> 'owner_required' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'Non-owner could authorize deletion'; end if;

  -- This must reject BEFORE looking for a request or touching the real owner.
  rejected := false;
  begin
    perform public.begin_customer_account_deletion(owner_id, owner_id, null);
  exception when insufficient_privilege then
    if sqlerrm <> 'staff_identity_cannot_be_deleted' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'Owner/staff self-deletion was accepted'; end if;

  if exists (select 1 from private.deleted_customer_identities
      where user_id in (target_id, control_id)) then
    raise exception 'Denied requests changed a customer lock';
  end if;

  -- No legacy role GUC: this is the production regression exercised end to end.
  if nullif(current_setting('request.jwt.claim.role', true), '') is not null then
    raise exception 'Regression accidentally supplied the legacy role claim';
  end if;
  perform public.begin_customer_account_deletion(target_id, owner_id, 'Disposable rollback test');
  perform public.begin_customer_account_deletion(target_id, owner_id, 'Disposable retry');

  if not exists (select 1 from public.customer_profiles
      where user_id = target_id and account_state = 'disabled')
    or not exists (select 1 from public.account_deletion_requests
      where user_id = target_id and status = 'in_review') then
    raise exception 'Deletion did not lock the disposable account before cleanup';
  end if;

  perform set_config('request.jwt.claims', jsonb_build_object(
    'role', 'authenticated', 'sub', target_id::text)::text, true);
  if private.customer_identity_access_allowed() then
    raise exception 'Locked identity retained access with an existing JWT';
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object(
    'role', 'authenticated', 'sub', control_id::text)::text, true);
  if not private.customer_identity_access_allowed() then
    raise exception 'Deletion lock affected the unrelated control identity';
  end if;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);

  summary := public.complete_customer_account_data(target_id, owner_id);
  if (summary ->> 'bookingsRemoved')::integer is distinct from 1
    or (summary ->> 'vehiclesRemoved')::integer is distinct from 1 then
    raise exception 'Synthetic booking/vehicle cleanup was incomplete';
  end if;
  -- A failed later external step must allow the database stage to be repeated.
  perform public.begin_customer_account_deletion(target_id, owner_id, 'Disposable cleanup retry');
  summary := public.complete_customer_account_data(target_id, owner_id);
  if (summary ->> 'bookingsRemoved')::integer is distinct from 0
    or (summary ->> 'vehiclesRemoved')::integer is distinct from 0 then
    raise exception 'Repeated cleanup did not report an already-empty target';
  end if;

  delete from auth.users where id = target_id and email = target_email;
  if not found then raise exception 'Disposable Auth identity was not deleted'; end if;
  completion := public.finish_customer_account_deletion(target_id, owner_id);

  if (completion ->> 'completed') is distinct from 'true'
    or not exists (select 1 from private.deleted_customer_identities
      where user_id = target_id and status = 'completed'
        and deletion_completed_at is not null and completed_by = owner_id)
    or exists (select 1 from auth.users where id = target_id)
    or exists (select 1 from public.customer_profiles where user_id = target_id)
    or exists (select 1 from public.account_deletion_requests where user_id = target_id)
    or exists (select 1 from public.performance_subscriptions where customer_id = target_id)
    or exists (select 1 from public.booking_integration_jobs where customer_id = target_id)
    or exists (select 1 from public.notification_events
      where recipient_user_id = target_id or booking_request_id = booking_id)
    or exists (select 1 from public.push_notification_jobs
      where recipient_user_id = target_id or booking_request_id = booking_id)
    or exists (select 1 from public.audit_events
      where customer_id = target_id or actor_user_id = target_id or record_id = target_id) then
    raise exception 'Disposable identity cleanup/finalization left customer data';
  end if;

  select jsonb_build_object(
    'auth', (select count(*) from auth.users where id <> target_id),
    'profiles', (select count(*) from public.customer_profiles where user_id <> target_id),
    'vehicles', (select count(*) from public.customer_vehicles where customer_id <> target_id),
    'bookings', (select count(*) from public.booking_requests where customer_id <> target_id),
    'subscriptions', (select count(*) from public.performance_subscriptions where customer_id <> target_id),
    'requests', (select count(*) from public.account_deletion_requests where user_id <> target_id),
    'locks', (select count(*) from private.deleted_customer_identities where user_id <> target_id),
    'staff', (select count(*) from public.staff_members),
    'storage', (select count(*) from storage.objects)
  ) into after_counts;
  if after_counts is distinct from before_counts
    or control_before is distinct from (select to_jsonb(profile)
      from public.customer_profiles profile where profile.user_id = control_id)
    or owner_before is distinct from (select to_jsonb(staff)
      from public.staff_members staff where staff.user_id = owner_id)
    or existing_audit_count <> (select count(*) from public.audit_events where id <= existing_audit_max) then
    raise exception 'Deletion affected records outside the disposable target';
  end if;
end
$$;

rollback;
