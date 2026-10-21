-- Diagnostics use the existing owned-vehicle, approval-first workflow.
-- No customer bookings, payments or permissions are changed by this migration.
create or replace function private.valid_diagnostics_request(context jsonb, notes text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(
    jsonb_typeof(context -> 'diagnosticsDetails') = 'object'
    and context ->> 'vehiclePowertrain' in ('petrol','diesel','hev','phev','bev')
    and length(btrim(notes)) between 10 and 1200
    and context #>> '{diagnosticsDetails,helpNeeded}' in ('diagnosis','known_repair','both','unsure')
    and context #>> '{diagnosticsDetails,drivingStatus}' in ('normal','issue','not_drivable','unsure')
    and context #>> '{diagnosticsDetails,warningLights}' in ('yes','no','unsure')
    and (
      context #>> '{diagnosticsDetails,helpNeeded}' = 'known_repair'
      or (length(btrim(context #>> '{diagnosticsDetails,startedWhen}')) > 0
          and length(btrim(context #>> '{diagnosticsDetails,occursWhen}')) > 0)
    )
    and (context #>> '{diagnosticsDetails,warningLights}' <> 'yes'
      or length(btrim(context #>> '{diagnosticsDetails,warningDetails}')) > 0)
    and (coalesce(context #>> '{diagnosticsDetails,odometerKm}', '') = ''
      or context #>> '{diagnosticsDetails,odometerKm}' ~ '^[0-9]{1,7}$')
    and not exists (
      select 1 from jsonb_each(case when jsonb_typeof(context -> 'diagnosticsDetails') = 'object'
        then context -> 'diagnosticsDetails' else '{}'::jsonb end) item
      where jsonb_typeof(item.value) <> 'string'
        or length(item.value #>> '{}') > case when item.key = 'odometerKm' then 7 else 600 end
        or item.key not in ('helpNeeded','startedWhen','occursWhen','drivingStatus','warningLights','warningDetails','odometerKm','previousDiagnosis','recentWork')
    )
    and coalesce((context ->> 'serviceReminderConsent') = 'false', true)
  , false);
$$;
revoke all on function private.valid_diagnostics_request(jsonb,text) from public, anon, authenticated;

alter table public.booking_requests drop constraint booking_requests_booking_type_check;
alter table public.booking_requests add constraint booking_requests_booking_type_check
  check (booking_type in ('service','dyno','diagnostics'));

CREATE OR REPLACE FUNCTION private.validate_booking_workflow()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_id uuid := auth.uid();
  actor_is_staff boolean := false;
  actor_is_service boolean := coalesce(auth.jwt() ->> 'role', '') = 'service_role';
  melbourne_today date := (now() at time zone 'Australia/Melbourne')::date;
begin
  if actor_id is not null then
    actor_is_staff := (select private.is_active_staff());
  end if;

  if tg_op = 'INSERT' then
    if not actor_is_staff and not actor_is_service then
      new.state := 'pending_staff_review';
      new.approved_date := null;
      new.deposit_amount_cents := null;
      new.staff_note := null;
      new.reviewed_by := null;
      new.reviewed_at := null;
      new.currency := 'AUD';
    end if;
  else
    if not actor_is_staff and not actor_is_service then
      raise exception 'Only active AAL2 PSI staff or a trusted server integration can review bookings';
    end if;

    if new.customer_id is distinct from old.customer_id
      or new.vehicle_id is distinct from old.vehicle_id
      or new.booking_type is distinct from old.booking_type
      or new.created_by is distinct from old.created_by
      or new.client_request_id is distinct from old.client_request_id
      or new.request_notes is distinct from old.request_notes
      or new.request_context is distinct from old.request_context then
      raise exception 'Customer booking request details and ownership are immutable';
    end if;

    if new.state is distinct from old.state then
      if actor_is_staff and (
        (old.state = 'pending_staff_review' and new.state in ('date_proposed', 'date_approved', 'cancelled'))
        or (old.state = 'date_proposed' and new.state in ('date_proposed', 'date_approved', 'cancelled'))
        or (old.state = 'date_approved' and new.state in ('date_proposed', 'date_approved', 'cancelled'))
        or (
          old.state = 'confirmed'
          and new.state = 'completed'
          and exists (
            select 1
            from public.service_completions
            where booking_request_id = old.id
          )
        )
      ) then
        null;
      elsif actor_is_service and old.state = 'date_approved' and new.state = 'confirmed' then
        null;
      else
        raise exception 'Booking state transition is not permitted';
      end if;
    end if;

    if actor_is_staff then
      new.reviewed_by := actor_id;
      new.reviewed_at := now();
    end if;
  end if;

  if new.booking_type = 'diagnostics' and not private.valid_diagnostics_request(new.request_context, new.request_notes) then
    raise exception 'Complete the required diagnostics and repair details';
  end if;

  new.staff_note := nullif(btrim(new.staff_note), '');
  if new.state in ('date_proposed', 'date_approved', 'confirmed', 'completed') then
    if new.approved_date is null then
      raise exception 'A proposed or approved booking needs a workshop date';
    end if;
    if new.state in ('date_proposed', 'date_approved') and new.approved_date < melbourne_today then
      raise exception 'A workshop booking date cannot be in the past';
    end if;
    if new.booking_type in ('service','diagnostics') and extract(isodow from new.approved_date) not between 1 and 5 then
      raise exception 'Service and diagnostics workshop dates must be Monday to Friday';
    end if;
    if new.booking_type = 'dyno' and extract(isodow from new.approved_date) not in (1, 3, 4) then
      raise exception 'Dyno workshop dates must be Monday, Wednesday or Thursday';
    end if;
  end if;

  if new.state in ('date_approved', 'confirmed', 'completed') then
    new.deposit_amount_cents := case new.booking_type
      when 'service' then 10000
      when 'diagnostics' then 10000
      when 'dyno' then 30000
    end;
  elsif new.state in ('pending_staff_review', 'date_proposed', 'cancelled') then
    new.deposit_amount_cents := null;
  end if;
  new.currency := 'AUD';
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.confirm_booking_payment(p_payment_attempt_id uuid, p_provider text, p_provider_event_id text, p_provider_payment_id text, p_amount_cents integer, p_currency text, p_paid_at timestamp with time zone, p_provider_receipt_url text DEFAULT NULL::text, p_payload_hash text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  attempt public.booking_payment_attempts%rowtype;
  booking public.booking_requests%rowtype;
  expected_amount integer;
begin
  select * into attempt
  from public.booking_payment_attempts
  where id = p_payment_attempt_id
  for update;
  if not found then raise exception 'Payment attempt not found'; end if;

  select * into booking
  from public.booking_requests
  where id = attempt.booking_request_id
  for update;
  if not found then raise exception 'Booking not found'; end if;

  expected_amount := case booking.booking_type when 'service' then 10000 when 'diagnostics' then 10000 when 'dyno' then 30000 end;
  if expected_amount is null or attempt.provider <> p_provider
    or attempt.customer_id <> booking.customer_id
    or attempt.amount_cents <> expected_amount
    or p_amount_cents <> expected_amount
    or attempt.currency <> 'AUD'
    or upper(p_currency) <> 'AUD'
    or booking.deposit_amount_cents <> expected_amount
    or booking.currency <> 'AUD' then
    raise exception 'Payment does not match approved booking';
  end if;

  if attempt.state = 'paid' and booking.state in ('confirmed', 'completed') then
    return booking.id;
  end if;
  if attempt.state not in ('awaiting_payment', 'bank_transfer_pending', 'processing')
    or booking.state <> 'date_approved' then
    raise exception 'Payment transition is not permitted';
  end if;

  insert into public.booking_payment_events (
    payment_attempt_id, booking_request_id, customer_id, provider,
    provider_event_id, event_type, amount_cents, currency, payload_hash
  ) values (
    attempt.id, booking.id, booking.customer_id, p_provider,
    p_provider_event_id,
    case when p_provider = 'manual_bank_transfer' then 'bank_transfer_verified' else 'payment_succeeded' end,
    p_amount_cents, 'AUD', p_payload_hash
  ) on conflict (provider, provider_event_id) do nothing;

  update public.booking_payment_attempts
  set state = 'paid', provider_payment_id = p_provider_payment_id,
      provider_receipt_url = p_provider_receipt_url, paid_at = p_paid_at
  where id = attempt.id;

  update public.booking_requests
  set state = 'confirmed'
  where id = booking.id and state = 'date_approved';
  if not found then raise exception 'Booking confirmation failed'; end if;

  return booking.id;
end
$function$
;

CREATE OR REPLACE FUNCTION private.ensure_workshop_job_for_booking()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  vehicle_registration text;
begin
  if new.state not in ('confirmed', 'completed') then
    return new;
  end if;

  select upper(btrim(vehicle.registration))
  into vehicle_registration
  from public.customer_vehicles vehicle
  where vehicle.id = new.vehicle_id
    and vehicle.customer_id = new.customer_id
    and vehicle.archived_at is null;

  if vehicle_registration is null then
    raise exception 'Confirmed booking vehicle is unavailable';
  end if;

  insert into public.workshop_jobs(
    booking_request_id,
    customer_id,
    vehicle_id,
    reference,
    title,
    job_date,
    created_by
  ) values (
    new.id,
    new.customer_id,
    new.vehicle_id,
    'PSI-' || upper(replace(new.id::text, '-', '')),
    case new.booking_type
      when 'dyno' then 'Dyno tuning · ' || vehicle_registration
      when 'diagnostics' then 'Diagnostics & Repairs · ' || vehicle_registration
      else 'Service · ' || vehicle_registration
    end,
    new.approved_date,
    new.reviewed_by
  )
  on conflict (booking_request_id) do nothing;

  return new;
end
$function$
;

CREATE OR REPLACE FUNCTION private.queue_booking_push_notifications()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  staff_user_id uuid;
  status_title text;
  status_body text;
  customer_display text;
  vehicle_display text;
  request_summary text;
begin
  if tg_op = 'INSERT' then
    select coalesce(
      nullif(trim(concat_ws(' ', profile.first_name, profile.last_name)), ''),
      profile.email,
      'Customer'
    )
    into customer_display
    from public.customer_profiles as profile
    where profile.user_id = new.customer_id;

    select trim(concat_ws(' ', vehicle.year::text, vehicle.make, vehicle.model)) || ' · ' || vehicle.registration
    into vehicle_display
    from public.customer_vehicles as vehicle
    where vehicle.id = new.vehicle_id and vehicle.customer_id = new.customer_id;

    request_summary := regexp_replace(
      coalesce(nullif(trim(new.request_notes), ''), 'No additional enquiry notes supplied.'),
      '\s+',
      ' ',
      'g'
    );

    perform private.queue_notification_event(
      new.customer_id,
      new.id,
      'booking_request_received',
      'Booking request received',
      'Your request is waiting for PSI workshop review.',
      '/bookings',
      'customer_request_received:' || new.id::text
    );

    for staff_user_id in
      select user_id from public.staff_members where status = 'active' and user_id is not null
    loop
      perform private.queue_notification_event(
        staff_user_id,
        new.id,
        'new_booking_request',
        left('New ' || case new.booking_type when 'dyno' then 'dyno' when 'diagnostics' then 'diagnostics and repairs' else 'service' end || ' enquiry · ' || coalesce((select registration from public.customer_vehicles where id = new.vehicle_id), 'vehicle'), 80),
        left(coalesce(customer_display, 'Customer') || ' · ' || coalesce(vehicle_display, 'Vehicle details unavailable') || ' · ' || request_summary, 240),
        '/staff',
        'staff_request_received:' || new.id::text || ':' || staff_user_id::text
      );
    end loop;
    return new;
  end if;

  if new.state is not distinct from old.state then return new; end if;
  select case new.state
    when 'date_proposed' then 'Workshop date proposed'
    when 'date_approved' then 'Date approved · deposit ready'
    when 'cancelled' then 'Booking request updated'
    when 'confirmed' then 'Booking confirmed'
    when 'completed' then 'PSI visit completed'
    else null
  end,
  case new.state
    when 'date_proposed' then 'PSI has proposed a workshop date. Open Bookings to review it.'
    when 'date_approved' then 'Open Bookings now to choose card, Apple Pay, Google Pay or bank transfer for your deposit.'
    when 'cancelled' then 'This request has been cancelled. Open Bookings for the PSI note.'
    when 'confirmed' then 'Your PSI booking is confirmed.'
    when 'completed' then 'Your completed PSI visit is now in your vehicle history.'
    else null
  end into status_title, status_body;

  if status_title is not null then
    perform private.queue_notification_event(new.customer_id, new.id, 'booking_' || new.state, status_title, status_body, '/bookings', 'customer_state:' || new.id::text || ':' || new.state);
  end if;
  return new;
end;
$function$
;
