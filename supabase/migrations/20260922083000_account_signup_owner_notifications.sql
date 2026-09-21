-- Email PSI once when a customer finishes their own account setup.
-- Existing completed accounts are a baseline, not a backlog of notifications.
create table public.account_signup_notification_jobs (
  customer_id uuid primary key references public.customer_profiles(user_id) on delete cascade,
  status text not null check (status in ('baseline', 'pending', 'processing', 'succeeded', 'failed', 'blocked_configuration')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  available_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  completed_at timestamptz,
  provider_reference text,
  last_error_code text
);

create index account_signup_notification_jobs_due_idx
  on public.account_signup_notification_jobs (available_at, created_at)
  where status in ('pending', 'failed', 'blocked_configuration');

alter table public.account_signup_notification_jobs enable row level security;
revoke all on public.account_signup_notification_jobs from public, anon, authenticated;
grant select, update on public.account_signup_notification_jobs to service_role;

insert into public.account_signup_notification_jobs (customer_id, status)
select profile.user_id, 'baseline'
from public.customer_profiles profile
where profile.account_state = 'active'
  and btrim(coalesce(profile.first_name, '')) <> ''
  and btrim(coalesce(profile.last_name, '')) <> ''
  and btrim(coalesce(profile.mobile, '')) <> ''
  and exists (
    select 1 from public.customer_vehicles vehicle
    where vehicle.customer_id = profile.user_id and vehicle.archived_at is null
  );

create or replace function private.enqueue_completed_customer_account(p_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Portal-created invitations do not count as a customer completing setup.
  if auth.uid() is distinct from p_customer_id then return; end if;

  if exists (
    select 1 from public.customer_profiles profile
    where profile.user_id = p_customer_id
      and profile.account_state = 'active'
      and btrim(coalesce(profile.first_name, '')) <> ''
      and btrim(coalesce(profile.last_name, '')) <> ''
      and btrim(coalesce(profile.mobile, '')) <> ''
      and exists (
        select 1 from public.customer_vehicles vehicle
        where vehicle.customer_id = p_customer_id and vehicle.archived_at is null
      )
      and not exists (
        select 1 from public.staff_members staff
        where staff.user_id = p_customer_id and staff.status = 'active'
      )
  ) then
    insert into public.account_signup_notification_jobs (customer_id, status)
    values (p_customer_id, 'pending')
    on conflict (customer_id) do nothing;
  end if;
end
$$;

revoke all on function private.enqueue_completed_customer_account(uuid)
from public, anon, authenticated, service_role;

create or replace function private.enqueue_account_from_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.enqueue_completed_customer_account(new.user_id);
  return new;
end
$$;

create or replace function private.enqueue_account_from_vehicle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.enqueue_completed_customer_account(new.customer_id);
  return new;
end
$$;

revoke all on function private.enqueue_account_from_profile() from public, anon, authenticated, service_role;
revoke all on function private.enqueue_account_from_vehicle() from public, anon, authenticated, service_role;

create trigger customer_profile_account_signup_notification
after insert or update of first_name, last_name, mobile, account_state
on public.customer_profiles
for each row execute function private.enqueue_account_from_profile();

create trigger customer_vehicle_account_signup_notification
after insert or update of archived_at
on public.customer_vehicles
for each row execute function private.enqueue_account_from_vehicle();

create or replace function public.count_completed_customer_accounts()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)
  from public.customer_profiles profile
  where profile.account_state = 'active'
    and btrim(coalesce(profile.first_name, '')) <> ''
    and btrim(coalesce(profile.last_name, '')) <> ''
    and btrim(coalesce(profile.mobile, '')) <> ''
    and exists (
      select 1 from public.customer_vehicles vehicle
      where vehicle.customer_id = profile.user_id and vehicle.archived_at is null
    )
    and not exists (
      select 1 from public.staff_members staff
      where staff.user_id = profile.user_id and staff.status = 'active'
    )
$$;

revoke all on function public.count_completed_customer_accounts()
from public, anon, authenticated;
grant execute on function public.count_completed_customer_accounts() to service_role;

-- Reuse the existing verified scheduler token, project URL and gateway JWT.
create or replace function private.invoke_account_signup_worker()
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
    raise exception 'account_signup_scheduler_not_configured';
  end if;

  update public.account_signup_notification_jobs
  set status = 'failed', available_at = now(), last_error_code = 'worker_timeout'
  where status = 'processing' and last_attempt_at < now() - interval '15 minutes';

  return net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/process-booking-integrations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_jwt,
      'apikey', anon_jwt,
      'x-psi-cron-token', cron_token
    ),
    body := '{"action":"process_account_signups","limit":10}'::jsonb,
    timeout_milliseconds := 10000
  );
end
$$;

revoke all on function private.invoke_account_signup_worker()
from public, anon, authenticated, service_role;

do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'psi-account-signup-notifications';
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
  perform cron.schedule(
    'psi-account-signup-notifications',
    '*/5 * * * *',
    'select private.invoke_account_signup_worker();'
  );
end
$$;
