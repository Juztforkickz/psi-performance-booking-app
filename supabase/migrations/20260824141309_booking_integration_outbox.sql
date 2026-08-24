-- Durable, provider-neutral work queue for booking email and Calendar jobs.
-- No provider credentials or customer message bodies are stored here. Jobs
-- are created by the booking trigger, are visible only to AAL2 PSI staff and
-- can be changed only by the trusted server role used by a future worker.

create table public.booking_integration_jobs (
  id uuid primary key default gen_random_uuid(),
  booking_request_id uuid not null references public.booking_requests(id) on delete restrict,
  customer_id uuid not null references public.customer_profiles(user_id) on delete restrict,
  job_kind text not null check (job_kind in (
    'notify_psi_request_received',
    'notify_customer_request_received',
    'notify_customer_date_proposed',
    'notify_customer_date_approved',
    'notify_customer_cancelled',
    'notify_psi_booking_confirmed',
    'notify_customer_booking_confirmed',
    'sync_google_calendar_confirmed'
  )),
  status text not null default 'pending' check (status in (
    'pending',
    'processing',
    'blocked_configuration',
    'succeeded',
    'failed',
    'cancelled'
  )),
  dedupe_key text not null unique,
  attempt_count integer not null default 0 check (attempt_count between 0 and 20),
  available_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  completed_at timestamptz,
  provider_reference text,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_integration_jobs_dedupe_size_check
    check (octet_length(dedupe_key) between 1 and 220),
  constraint booking_integration_jobs_provider_reference_size_check
    check (provider_reference is null or octet_length(provider_reference) <= 500),
  constraint booking_integration_jobs_error_code_size_check
    check (last_error_code is null or octet_length(last_error_code) <= 160)
);

create index booking_integration_jobs_pending_idx
  on public.booking_integration_jobs (status, available_at, created_at)
  where status in ('pending', 'failed', 'blocked_configuration');
create index booking_integration_jobs_booking_idx
  on public.booking_integration_jobs (booking_request_id, created_at desc);
create index booking_integration_jobs_customer_idx
  on public.booking_integration_jobs (customer_id, created_at desc);

create or replace function private.enqueue_booking_integration_job(
  p_booking_request_id uuid,
  p_customer_id uuid,
  p_job_kind text,
  p_discriminator text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.booking_integration_jobs (
    booking_request_id,
    customer_id,
    job_kind,
    dedupe_key
  ) values (
    p_booking_request_id,
    p_customer_id,
    p_job_kind,
    concat(p_booking_request_id::text, ':', p_job_kind, ':', p_discriminator)
  )
  on conflict (dedupe_key) do nothing;
end
$$;

revoke all on function private.enqueue_booking_integration_job(uuid, uuid, text, text)
from public, anon, authenticated, service_role;

create or replace function private.queue_booking_integration_jobs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  discriminator text;
begin
  if tg_op = 'INSERT' then
    perform private.enqueue_booking_integration_job(
      new.id,
      new.customer_id,
      'notify_psi_request_received',
      'created'
    );
    perform private.enqueue_booking_integration_job(
      new.id,
      new.customer_id,
      'notify_customer_request_received',
      'created'
    );
    return new;
  end if;

  if new.state is not distinct from old.state
    and new.approved_date is not distinct from old.approved_date then
    return new;
  end if;

  discriminator := concat(new.state, ':', coalesce(new.approved_date::text, 'no-date'));
  case new.state
    when 'date_proposed' then
      perform private.enqueue_booking_integration_job(
        new.id,
        new.customer_id,
        'notify_customer_date_proposed',
        discriminator
      );
    when 'date_approved' then
      perform private.enqueue_booking_integration_job(
        new.id,
        new.customer_id,
        'notify_customer_date_approved',
        discriminator
      );
    when 'cancelled' then
      perform private.enqueue_booking_integration_job(
        new.id,
        new.customer_id,
        'notify_customer_cancelled',
        discriminator
      );
    when 'confirmed' then
      perform private.enqueue_booking_integration_job(
        new.id,
        new.customer_id,
        'notify_customer_booking_confirmed',
        discriminator
      );
      perform private.enqueue_booking_integration_job(
        new.id,
        new.customer_id,
        'notify_psi_booking_confirmed',
        discriminator
      );
      perform private.enqueue_booking_integration_job(
        new.id,
        new.customer_id,
        'sync_google_calendar_confirmed',
        discriminator
      );
    else
      null;
  end case;
  return new;
end
$$;

revoke all on function private.queue_booking_integration_jobs()
from public, anon, authenticated, service_role;

create trigger booking_integration_jobs_set_updated_at
before update on public.booking_integration_jobs
for each row execute function private.set_updated_at();

create trigger queue_booking_integration_jobs
after insert or update of state, approved_date on public.booking_requests
for each row execute function private.queue_booking_integration_jobs();

create trigger audit_booking_integration_jobs
after insert or update or delete on public.booking_integration_jobs
for each row execute function private.record_audit_event();

alter table public.booking_integration_jobs enable row level security;

create policy "staff can view booking integration jobs"
on public.booking_integration_jobs for select to authenticated
using ((select private.is_active_staff()));

revoke all on public.booking_integration_jobs from public, anon, authenticated;
grant select on public.booking_integration_jobs to authenticated;
grant select, insert, update, delete on public.booking_integration_jobs to service_role;
