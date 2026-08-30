create table public.psi_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 80),
  description text check (description is null or char_length(description) <= 1000),
  location text check (location is null or char_length(location) <= 160),
  starts_at timestamptz not null,
  ends_at timestamptz,
  reminder_minutes_before integer not null default 90 check (reminder_minutes_before between 0 and 10080),
  status text not null default 'draft' check (status in ('draft', 'published', 'cancelled')),
  created_by uuid not null references auth.users(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint psi_events_end_after_start check (ends_at is null or ends_at > starts_at),
  constraint psi_events_publish_state check (
    (status = 'draft' and published_at is null)
    or (status = 'published' and published_at is not null)
    or status = 'cancelled'
  )
);

create index psi_events_customer_feed_idx
on public.psi_events (starts_at, created_at desc)
where status = 'published';

create index psi_events_staff_feed_idx
on public.psi_events (status, starts_at, created_at desc);

alter table public.psi_events enable row level security;

create policy "authenticated users can view allowed psi events"
on public.psi_events for select to authenticated
using (status = 'published' or (select private.is_active_staff()));

create policy "staff can create psi events"
on public.psi_events for insert to authenticated
with check (
  (select private.is_active_staff())
  and created_by = (select auth.uid())
);

create policy "staff can update psi events"
on public.psi_events for update to authenticated
using ((select private.is_active_staff()))
with check ((select private.is_active_staff()));

revoke all on public.psi_events from anon, authenticated;
grant select on public.psi_events to authenticated;
grant insert (title, description, location, starts_at, ends_at, reminder_minutes_before, status, created_by, published_at)
on public.psi_events to authenticated;
grant update (title, description, location, starts_at, ends_at, reminder_minutes_before, status, published_at)
on public.psi_events to authenticated;

create trigger psi_events_set_updated_at
before update on public.psi_events
for each row execute function private.set_updated_at();

create trigger audit_psi_events
after insert or update on public.psi_events
for each row execute function private.record_audit_event();

alter table public.notification_events
  add column psi_event_id uuid references public.psi_events(id) on delete set null;

alter table public.notification_events
  drop constraint notification_events_kind_check,
  add constraint notification_events_kind_check check (
    kind in (
      'booking_request_received',
      'new_booking_request',
      'booking_date_proposed',
      'booking_date_approved',
      'booking_cancelled',
      'booking_confirmed',
      'booking_completed',
      'psi_event_published',
      'psi_event_updated',
      'psi_event_cancelled'
    )
  );

alter table public.notification_events
  drop constraint notification_events_deep_link_check,
  add constraint notification_events_deep_link_check check (deep_link in ('/bookings', '/staff', '/events'));

create index notification_events_psi_event_idx on public.notification_events (psi_event_id);

create or replace function private.queue_psi_event_notification(
  target_user_id uuid,
  target_event_id uuid,
  event_kind text,
  event_title text,
  event_body text,
  event_key text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_notification_id uuid;
begin
  insert into public.notification_events (
    recipient_user_id,
    psi_event_id,
    kind,
    title,
    body,
    deep_link,
    source_event_key
  ) values (
    target_user_id,
    target_event_id,
    event_kind,
    event_title,
    event_body,
    '/events',
    event_key
  )
  on conflict (source_event_key) do nothing
  returning id into created_notification_id;

  if created_notification_id is not null then
    insert into public.push_notification_jobs (event_id, recipient_user_id)
    values (created_notification_id, target_user_id);
  end if;
end;
$$;

revoke all on function private.queue_psi_event_notification(uuid, uuid, text, text, text, text)
from public, anon, authenticated;

create or replace function private.queue_psi_event_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  customer_user_id uuid;
  notification_kind text;
  notification_title text;
  notification_body text;
  notification_key text;
  melbourne_start text;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'published' then return new; end if;
    notification_kind := 'psi_event_published';
    notification_title := 'New PSI event';
    notification_key := 'psi_event:' || new.id::text || ':published';
  elsif old.status <> 'published' and new.status = 'published' then
    notification_kind := 'psi_event_published';
    notification_title := 'New PSI event';
    notification_key := 'psi_event:' || new.id::text || ':published';
  elsif old.status = 'published' and new.status = 'cancelled' then
    notification_kind := 'psi_event_cancelled';
    notification_title := 'PSI event update';
    notification_key := 'psi_event:' || new.id::text || ':cancelled';
  elsif old.status = 'published'
    and new.status = 'published'
    and row(old.title, old.description, old.location, old.starts_at, old.ends_at)
      is distinct from row(new.title, new.description, new.location, new.starts_at, new.ends_at)
  then
    notification_kind := 'psi_event_updated';
    notification_title := 'PSI event updated';
    notification_key := 'psi_event:' || new.id::text || ':updated:' || md5(concat_ws('|', new.title, new.description, new.location, new.starts_at::text, new.ends_at::text));
  else
    return new;
  end if;

  melbourne_start := to_char(new.starts_at at time zone 'Australia/Melbourne', 'FMDay FMDD FMMonth YYYY at FMHH12:MIam');
  notification_body := case notification_kind
    when 'psi_event_cancelled' then left(new.title || ' has been cancelled.', 240)
    when 'psi_event_updated' then left(new.title || ' is now ' || melbourne_start || '.', 240)
    else left(new.title || ' · ' || melbourne_start || '.', 240)
  end;

  for customer_user_id in
    select profile.user_id
    from public.customer_profiles as profile
    where profile.account_state = 'active'
  loop
    perform private.queue_psi_event_notification(
      customer_user_id,
      new.id,
      notification_kind,
      notification_title,
      notification_body,
      notification_key || ':' || customer_user_id::text
    );
  end loop;

  return new;
end;
$$;

revoke all on function private.queue_psi_event_notifications() from public, anon, authenticated;

create trigger queue_psi_event_notifications
after insert or update of status, title, description, location, starts_at, ends_at on public.psi_events
for each row execute function private.queue_psi_event_notifications();
