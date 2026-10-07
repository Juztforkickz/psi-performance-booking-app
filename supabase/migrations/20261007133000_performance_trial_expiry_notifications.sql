-- Notify each eligible customer once after their real complimentary
-- Performance+ trial expires. Existing trials keep their original deadline.

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
    'performance_subscription_started',
    'performance_trial_ended',
    'customer_message_received',
    'staff_message_received'
  ));

alter table public.notification_events
  drop constraint if exists notification_events_deep_link_check;

alter table public.notification_events
  add constraint notification_events_deep_link_check check (
    deep_link in (
      '/booking',
      '/bookings',
      '/staff',
      '/events',
      '/customer-cars-for-sale',
      '/messages',
      '/performance-plus'
    )
  );

create table public.performance_trial_expiry_notification_jobs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references public.customer_profiles(user_id) on delete cascade,
  trial_subscription_id uuid not null unique references public.performance_subscriptions(id) on delete cascade,
  account_created_at timestamptz not null,
  trial_expires_at timestamptz not null,
  status text not null default 'pending' check (status in (
    'pending',
    'processing',
    'blocked_configuration',
    'succeeded',
    'failed',
    'cancelled'
  )),
  attempt_count integer not null default 0 check (attempt_count between 0 and 20),
  available_at timestamptz not null,
  last_attempt_at timestamptz,
  completed_at timestamptz,
  in_app_event_id uuid references public.notification_events(id) on delete set null,
  push_delivery_status text check (push_delivery_status is null or push_delivery_status in (
    'sent',
    'not_registered',
    'failed'
  )),
  push_provider_reference text check (
    push_provider_reference is null or octet_length(push_provider_reference) <= 1000
  ),
  email_delivery_status text not null default 'pending' check (email_delivery_status in (
    'pending',
    'sent',
    'failed',
    'blocked_configuration'
  )),
  email_provider_reference text check (
    email_provider_reference is null or octet_length(email_provider_reference) <= 500
  ),
  last_error_code text check (last_error_code is null or octet_length(last_error_code) <= 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index performance_trial_expiry_jobs_ready_idx
on public.performance_trial_expiry_notification_jobs (status, available_at, created_at)
where status in ('pending', 'failed', 'blocked_configuration');

alter table public.performance_trial_expiry_notification_jobs enable row level security;
revoke all on public.performance_trial_expiry_notification_jobs from public, anon, authenticated;
grant select, insert, update, delete on public.performance_trial_expiry_notification_jobs to service_role;

create trigger performance_trial_expiry_jobs_set_updated_at
before update on public.performance_trial_expiry_notification_jobs
for each row execute function private.set_updated_at();

create or replace function private.queue_performance_trial_expiry_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile public.customer_profiles%rowtype;
begin
  if new.provider <> 'complimentary'
    or new.provider_reference <> 'trial:' || new.customer_id::text
    or new.environment <> 'production'
    or new.is_permanent
    or new.expires_at is null
  then
    return new;
  end if;

  select * into profile
  from public.customer_profiles
  where user_id = new.customer_id;

  if profile.user_id is null
    or profile.account_state <> 'active'
    or lower(btrim(profile.email)) = 'matt@psiperformance.com.au'
    or exists (
      select 1 from public.staff_members staff
      where staff.user_id = new.customer_id and staff.status = 'active'
    )
  then
    return new;
  end if;

  insert into public.performance_trial_expiry_notification_jobs (
    customer_id,
    trial_subscription_id,
    account_created_at,
    trial_expires_at,
    available_at
  ) values (
    new.customer_id,
    new.id,
    profile.created_at,
    new.expires_at,
    new.expires_at
  )
  on conflict (customer_id) do update
  set trial_subscription_id = excluded.trial_subscription_id,
      account_created_at = excluded.account_created_at,
      trial_expires_at = excluded.trial_expires_at,
      available_at = excluded.available_at
  where public.performance_trial_expiry_notification_jobs.status in (
    'pending', 'failed', 'blocked_configuration'
  );

  return new;
end
$$;

revoke all on function private.queue_performance_trial_expiry_notification()
from public, anon, authenticated, service_role;

drop trigger if exists queue_performance_trial_expiry_notification
on public.performance_subscriptions;

create trigger queue_performance_trial_expiry_notification
after insert or update of expires_at, status
on public.performance_subscriptions
for each row execute function private.queue_performance_trial_expiry_notification();

insert into public.performance_trial_expiry_notification_jobs (
  customer_id,
  trial_subscription_id,
  account_created_at,
  trial_expires_at,
  available_at
)
select
  subscription.customer_id,
  subscription.id,
  profile.created_at,
  subscription.expires_at,
  greatest(subscription.expires_at, now() + interval '30 minutes')
from public.performance_subscriptions subscription
join public.customer_profiles profile on profile.user_id = subscription.customer_id
where subscription.provider = 'complimentary'
  and subscription.provider_reference = 'trial:' || subscription.customer_id::text
  and subscription.environment = 'production'
  and not subscription.is_permanent
  and subscription.expires_at is not null
  and profile.account_state = 'active'
  and lower(btrim(profile.email)) <> 'matt@psiperformance.com.au'
  and not exists (
    select 1 from public.staff_members staff
    where staff.user_id = subscription.customer_id and staff.status = 'active'
  )
  and not exists (
    select 1
    from public.performance_subscriptions current_access
    where current_access.customer_id = subscription.customer_id
      and current_access.id <> subscription.id
      and current_access.environment = 'production'
      and current_access.status in ('active', 'grace_period')
      and (
        current_access.is_permanent
        or current_access.expires_at > now()
      )
  )
on conflict (customer_id) do nothing;

create or replace function private.cancel_trial_expiry_notification_after_subscription()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.environment = 'production'
    and new.status in ('active', 'grace_period')
    and (
      new.is_permanent
      or (
        new.expires_at > now()
        and not (
          new.provider = 'complimentary'
          and new.provider_reference = 'trial:' || new.customer_id::text
        )
      )
    )
  then
    update public.performance_trial_expiry_notification_jobs
    set status = 'cancelled',
        completed_at = now(),
        last_error_code = 'performance_plus_already_active'
    where customer_id = new.customer_id
      and status in ('pending', 'failed', 'blocked_configuration');
  end if;
  return new;
end
$$;

revoke all on function private.cancel_trial_expiry_notification_after_subscription()
from public, anon, authenticated, service_role;

drop trigger if exists cancel_trial_expiry_notification_after_subscription
on public.performance_subscriptions;

create trigger cancel_trial_expiry_notification_after_subscription
after insert or update of status, expires_at, is_permanent
on public.performance_subscriptions
for each row execute function private.cancel_trial_expiry_notification_after_subscription();

create or replace function private.invoke_performance_trial_expiry_worker()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_url text;
  anon_jwt text;
  cron_token text;
begin
  select decrypted_secret into project_url from vault.decrypted_secrets
  where name = 'psi_service_reminder_project_url';
  select decrypted_secret into anon_jwt from vault.decrypted_secrets
  where name = 'psi_service_reminder_anon_jwt';
  select decrypted_secret into cron_token from vault.decrypted_secrets
  where name = 'psi_service_reminder_cron_token';

  if project_url is null or anon_jwt is null or cron_token is null then
    raise exception 'performance_trial_expiry_scheduler_not_configured';
  end if;

  update public.performance_trial_expiry_notification_jobs
  set status = 'failed',
      available_at = now(),
      last_error_code = 'worker_timeout'
  where status = 'processing'
    and last_attempt_at < now() - interval '15 minutes';

  return net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/process-performance-trial-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_jwt,
      'apikey', anon_jwt,
      'x-psi-cron-token', cron_token
    ),
    body := '{"action":"process_queue","limit":10}'::jsonb,
    timeout_milliseconds := 10000
  );
end
$$;

revoke all on function private.invoke_performance_trial_expiry_worker()
from public, anon, authenticated, service_role;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'psi-performance-trial-expiry-notifications';

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  perform cron.schedule(
    'psi-performance-trial-expiry-notifications',
    '*/15 * * * *',
    'select private.invoke_performance_trial_expiry_worker();'
  );
end
$$;
