alter table public.notification_events
  drop constraint if exists notification_events_kind_check;

alter table public.notification_events
  add constraint notification_events_kind_check check (kind in (
    'booking_request_received',
    'new_booking_request',
    'booking_date_proposed',
    'booking_date_approved',
    'booking_cancelled',
    'booking_confirmed',
    'booking_completed',
    'psi_event_published',
    'psi_event_updated',
    'psi_event_cancelled',
    'service_reminder',
    'xero_invoice_review',
    'car_sale_published',
    'performance_subscription_started'
  ));

create or replace function private.queue_owner_performance_subscription_alert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
  created_event_id uuid;
  customer_name text;
begin
  if new.provider <> 'revenuecat'
    or new.environment <> 'production'
    or new.status not in ('active', 'grace_period')
    or new.is_permanent
  then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.environment = 'production'
      and old.status in ('active', 'grace_period')
    then
      return new;
    end if;
  end if;

  select id into owner_id
  from auth.users
  where lower(email) = 'matt@psiperformance.com.au'
  limit 1;

  if owner_id is null then
    return new;
  end if;

  select nullif(btrim(concat_ws(' ', first_name, last_name)), '')
  into customer_name
  from public.customer_profiles
  where user_id = new.customer_id;

  insert into public.notification_events (
    recipient_user_id,
    booking_request_id,
    kind,
    title,
    body,
    deep_link,
    source_event_key
  ) values (
    owner_id,
    null,
    'performance_subscription_started',
    'Performance+ subscription received',
    coalesce(customer_name, 'A customer') || ' activated Performance+.',
    '/staff',
    'performance_subscription_started:' || new.id::text || ':' ||
      to_char(new.verified_at at time zone 'UTC', 'YYYYMMDDHH24MISSMS')
  )
  on conflict (source_event_key) do nothing
  returning id into created_event_id;

  if created_event_id is not null then
    insert into public.push_notification_jobs (event_id, booking_request_id, recipient_user_id)
    values (created_event_id, null, owner_id);
  end if;

  return new;
end
$$;

revoke all on function private.queue_owner_performance_subscription_alert()
from public, anon, authenticated, service_role;

drop trigger if exists queue_owner_performance_subscription_alert
on public.performance_subscriptions;

create trigger queue_owner_performance_subscription_alert
after insert or update of status, environment, verified_at
on public.performance_subscriptions
for each row execute function private.queue_owner_performance_subscription_alert();
