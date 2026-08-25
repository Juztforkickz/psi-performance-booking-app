create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  booking_updates_enabled boolean not null default true,
  booking_reminders_enabled boolean not null default true,
  workshop_alerts_enabled boolean not null default true,
  sound_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('android', 'ios')),
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_devices_expo_token_format check (expo_push_token ~ '^ExponentPushToken\[[A-Za-z0-9_-]+\]$|^ExpoPushToken\[[A-Za-z0-9_-]+\]$')
);

create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  booking_request_id uuid references public.booking_requests(id) on delete cascade,
  kind text not null check (kind in ('booking_request_received', 'new_booking_request', 'booking_date_proposed', 'booking_date_approved', 'booking_cancelled', 'booking_confirmed', 'booking_completed')),
  title text not null check (char_length(title) between 1 and 80),
  body text not null check (char_length(body) between 1 and 240),
  deep_link text not null default '/bookings' check (deep_link in ('/bookings', '/staff')),
  source_event_key text not null unique,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.push_notification_jobs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.notification_events(id) on delete cascade,
  booking_request_id uuid references public.booking_requests(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'processing', 'succeeded', 'failed', 'cancelled')),
  attempt_count integer not null default 0 check (attempt_count >= 0 and attempt_count <= 20),
  available_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  completed_at timestamptz,
  provider_ticket_id text,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notification_events_recipient_created_idx on public.notification_events (recipient_user_id, created_at desc);
create index push_devices_user_enabled_idx on public.push_devices (user_id, enabled);
create index push_notification_jobs_ready_idx on public.push_notification_jobs (status, available_at, created_at);

alter table public.notification_preferences enable row level security;
alter table public.push_devices enable row level security;
alter table public.notification_events enable row level security;
alter table public.push_notification_jobs enable row level security;

create policy notification_preferences_own_select on public.notification_preferences for select to authenticated using ((select auth.uid()) = user_id);
create policy notification_preferences_own_insert on public.notification_preferences for insert to authenticated with check ((select auth.uid()) = user_id);
create policy notification_preferences_own_update on public.notification_preferences for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy push_devices_own_select on public.push_devices for select to authenticated using ((select auth.uid()) = user_id);
create policy push_devices_own_insert on public.push_devices for insert to authenticated with check ((select auth.uid()) = user_id);
create policy push_devices_own_update on public.push_devices for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy push_devices_own_delete on public.push_devices for delete to authenticated using ((select auth.uid()) = user_id);

create policy notification_events_own_select on public.notification_events for select to authenticated using ((select auth.uid()) = recipient_user_id);
create policy notification_events_own_update on public.notification_events for update to authenticated using ((select auth.uid()) = recipient_user_id) with check ((select auth.uid()) = recipient_user_id);

revoke all on public.notification_preferences, public.push_devices, public.notification_events, public.push_notification_jobs from anon, authenticated;
grant select, insert on public.notification_preferences to authenticated;
grant update (booking_updates_enabled, booking_reminders_enabled, workshop_alerts_enabled, sound_enabled, updated_at) on public.notification_preferences to authenticated;
grant select, insert, delete on public.push_devices to authenticated;
grant update (enabled, last_seen_at, updated_at) on public.push_devices to authenticated;
grant select on public.notification_events to authenticated;
grant update (read_at) on public.notification_events to authenticated;

create or replace function private.queue_notification_event(
  target_user_id uuid,
  target_booking_id uuid,
  event_kind text,
  event_title text,
  event_body text,
  event_deep_link text,
  event_key text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_event_id uuid;
begin
  insert into public.notification_events (recipient_user_id, booking_request_id, kind, title, body, deep_link, source_event_key)
  values (target_user_id, target_booking_id, event_kind, event_title, event_body, event_deep_link, event_key)
  on conflict (source_event_key) do nothing
  returning id into created_event_id;

  if created_event_id is not null then
    insert into public.push_notification_jobs (event_id, booking_request_id, recipient_user_id)
    values (created_event_id, target_booking_id, target_user_id);
  end if;
end;
$$;

revoke all on function private.queue_notification_event(uuid, uuid, text, text, text, text, text) from public, anon, authenticated;

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
begin
  if tg_op = 'INSERT' then
    perform private.queue_notification_event(new.customer_id, new.id, 'booking_request_received', 'Booking request received', 'Your request is waiting for PSI workshop review.', '/bookings', 'customer_request_received:' || new.id::text);
    for staff_user_id in
      select user_id from public.staff_members where status = 'active' and user_id is not null
    loop
      perform private.queue_notification_event(staff_user_id, new.id, 'new_booking_request', 'New booking request', 'A new customer request is ready for workshop review.', '/staff', 'staff_request_received:' || new.id::text || ':' || staff_user_id::text);
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

create trigger queue_booking_push_notifications
after insert or update of state on public.booking_requests
for each row execute function private.queue_booking_push_notifications();

