-- Schedule consented six- and twelve-month service reminders from the actual
-- PSI service-completion date. Each reminder becomes available one calendar
-- month before its corresponding due date. The trusted integration worker
-- sends the email and creates the customer's in-app/push notification.

alter table public.booking_integration_jobs
  drop constraint booking_integration_jobs_job_kind_check;

alter table public.booking_integration_jobs
  add column service_completion_id uuid references public.service_completions(id) on delete restrict,
  add column service_due_on date,
  add column service_interval_months smallint,
  add constraint booking_integration_jobs_job_kind_check check (job_kind in (
    'notify_psi_request_received',
    'notify_customer_request_received',
    'notify_customer_date_proposed',
    'notify_customer_date_approved',
    'notify_customer_cancelled',
    'notify_psi_booking_confirmed',
    'notify_customer_booking_confirmed',
    'notify_customer_service_due',
    'sync_google_calendar_confirmed',
    'sync_google_calendar_cancelled'
  )),
  add constraint booking_integration_jobs_service_reminder_fields_check check (
    (
      job_kind = 'notify_customer_service_due'
      and service_completion_id is not null
      and service_due_on is not null
      and service_interval_months in (6, 12)
    )
    or (
      job_kind <> 'notify_customer_service_due'
      and service_completion_id is null
      and service_due_on is null
      and service_interval_months is null
    )
  );

create unique index booking_integration_jobs_service_reminder_unique_idx
  on public.booking_integration_jobs (service_completion_id, service_interval_months)
  where job_kind = 'notify_customer_service_due';

create or replace function private.queue_service_due_reminders()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  completed_on date := (new.completed_at at time zone 'Australia/Melbourne')::date;
  interval_months smallint;
  due_on date;
  remind_on date;
begin
  if not exists (
    select 1
    from public.booking_requests as booking
    where booking.id = new.booking_request_id
      and booking.customer_id = new.customer_id
      and booking.booking_type = 'service'
      and booking.request_context -> 'serviceReminderConsent' = 'true'::jsonb
  ) then
    return new;
  end if;

  foreach interval_months in array array[6, 12]::smallint[] loop
    due_on := (completed_on + make_interval(months => interval_months))::date;
    remind_on := (due_on - interval '1 month')::date;

    insert into public.booking_integration_jobs (
      booking_request_id,
      customer_id,
      job_kind,
      dedupe_key,
      available_at,
      service_completion_id,
      service_due_on,
      service_interval_months
    ) values (
      new.booking_request_id,
      new.customer_id,
      'notify_customer_service_due',
      concat(new.booking_request_id::text, ':notify_customer_service_due:', interval_months::text, ':', new.id::text),
      make_timestamptz(
        extract(year from remind_on)::integer,
        extract(month from remind_on)::integer,
        extract(day from remind_on)::integer,
        9,
        0,
        0,
        'Australia/Melbourne'
      ),
      new.id,
      due_on,
      interval_months
    )
    on conflict (dedupe_key) do nothing;
  end loop;

  return new;
end
$$;

revoke all on function private.queue_service_due_reminders()
from public, anon, authenticated, service_role;

create trigger queue_service_due_reminders
after insert on public.service_completions
for each row execute function private.queue_service_due_reminders();

alter table public.notification_events
  drop constraint notification_events_kind_check;

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
    'service_reminder'
  ));

alter table public.notification_events
  drop constraint notification_events_deep_link_check;

alter table public.notification_events
  add constraint notification_events_deep_link_check
    check (deep_link in ('/booking', '/bookings', '/staff', '/events'));
