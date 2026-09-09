create or replace function private.queue_booking_push_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
        left('New ' || case when new.booking_type = 'dyno' then 'dyno' else 'service' end || ' enquiry · ' || coalesce((select registration from public.customer_vehicles where id = new.vehicle_id), 'vehicle'), 80),
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
    when 'date_approved' then 'Workshop date approved'
    when 'cancelled' then 'Booking request updated'
    when 'confirmed' then 'Booking confirmed'
    when 'completed' then 'PSI visit completed'
    else null
  end,
  case new.state
    when 'date_proposed' then 'PSI has proposed a workshop date. Open Bookings to review it.'
    when 'date_approved' then 'Your workshop date is approved. Open Bookings for the latest details.'
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
$$;

revoke all on function private.queue_booking_push_notifications() from public, anon, authenticated;
