-- Keep PSI's team-visible Calendar event aligned when a confirmed booking date changes
-- or a confirmed booking is cancelled.
alter table public.booking_integration_jobs
  drop constraint booking_integration_jobs_job_kind_check;
alter table public.booking_integration_jobs
  add constraint booking_integration_jobs_job_kind_check check (job_kind in (
    'notify_psi_request_received',
    'notify_customer_request_received',
    'notify_customer_date_proposed',
    'notify_customer_date_approved',
    'notify_customer_cancelled',
    'notify_psi_booking_confirmed',
    'notify_customer_booking_confirmed',
    'sync_google_calendar_confirmed',
    'sync_google_calendar_cancelled'
  ));

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
    perform private.enqueue_booking_integration_job(new.id, new.customer_id, 'notify_psi_request_received', 'created');
    perform private.enqueue_booking_integration_job(new.id, new.customer_id, 'notify_customer_request_received', 'created');
    return new;
  end if;

  if new.state is not distinct from old.state
    and new.approved_date is not distinct from old.approved_date then
    return new;
  end if;

  discriminator := concat(new.state, ':', coalesce(new.approved_date::text, 'no-date'));
  case new.state
    when 'date_proposed' then
      perform private.enqueue_booking_integration_job(new.id, new.customer_id, 'notify_customer_date_proposed', discriminator);
    when 'date_approved' then
      perform private.enqueue_booking_integration_job(new.id, new.customer_id, 'notify_customer_date_approved', discriminator);
    when 'cancelled' then
      perform private.enqueue_booking_integration_job(new.id, new.customer_id, 'notify_customer_cancelled', discriminator);
      if old.state in ('confirmed','completed')
        or exists (select 1 from public.booking_calendar_events event where event.booking_request_id = new.id and event.sync_state = 'synced') then
        perform private.enqueue_booking_integration_job(new.id, new.customer_id, 'sync_google_calendar_cancelled', discriminator);
      end if;
    when 'confirmed' then
      perform private.enqueue_booking_integration_job(new.id, new.customer_id, 'notify_customer_booking_confirmed', discriminator);
      perform private.enqueue_booking_integration_job(new.id, new.customer_id, 'notify_psi_booking_confirmed', discriminator);
      perform private.enqueue_booking_integration_job(new.id, new.customer_id, 'sync_google_calendar_confirmed', discriminator);
    else
      null;
  end case;
  return new;
end
$$;

revoke all on function private.queue_booking_integration_jobs()
from public, anon, authenticated, service_role;
