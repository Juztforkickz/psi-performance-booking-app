begin;

-- This rollback-only fixture validates the reminder projection itself. The
-- separate service-history suite covers the AAL2 staff completion boundary.
alter table public.service_completions disable trigger validate_service_completion;
alter table public.service_completions disable trigger project_service_completion;

do $$
declare
  consented_booking uuid := 'cccccccc-cccc-4ccc-8ccc-cccccccccc10';
  declined_booking uuid := 'cccccccc-cccc-4ccc-8ccc-cccccccccc11';
  customer_id uuid := '11111111-1111-4111-8111-111111111110';
  vehicle_id uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10';
begin
  insert into auth.users (id, email) values
    (customer_id, 'service-reminder-customer@example.invalid');

  insert into public.customer_vehicles (id, customer_id, make, model, year, registration, created_by)
  values (vehicle_id, customer_id, 'Holden', 'Commodore', 2017, 'REM-001', customer_id);

  insert into public.booking_requests (
    id, customer_id, vehicle_id, booking_type, state, approved_date, created_by, request_context
  ) values
    (consented_booking, customer_id, vehicle_id, 'service', 'confirmed', '2026-03-31', customer_id, '{"serviceReminderConsent":true}'::jsonb),
    (declined_booking, customer_id, vehicle_id, 'service', 'confirmed', '2026-04-01', customer_id, '{"serviceReminderConsent":false}'::jsonb);

  insert into public.service_completions (
    id, booking_request_id, customer_id, vehicle_id, completed_at, summary, created_by
  ) values (
    'dddddddd-dddd-4ddd-8ddd-dddddddddd10',
    consented_booking,
    customer_id,
    vehicle_id,
    '2026-03-31T10:00:00+11:00',
    'Synthetic consented service reminder test.',
    customer_id
  );

  if (select count(*) from public.booking_integration_jobs where booking_request_id = consented_booking and job_kind = 'notify_customer_service_due') <> 2 then
    raise exception 'Reminder test failed: consented service did not schedule exactly two reminders';
  end if;

  if not exists (
    select 1 from public.booking_integration_jobs
    where booking_request_id = consented_booking
      and service_interval_months = 6
      and service_due_on = '2026-09-30'
      and (available_at at time zone 'Australia/Melbourne')::date = '2026-08-30'
  ) then
    raise exception 'Reminder test failed: six-month reminder did not clamp and schedule one month before due';
  end if;

  if not exists (
    select 1 from public.booking_integration_jobs
    where booking_request_id = consented_booking
      and service_interval_months = 12
      and service_due_on = '2027-03-31'
      and (available_at at time zone 'Australia/Melbourne')::date = '2027-02-28'
  ) then
    raise exception 'Reminder test failed: twelve-month reminder did not schedule one calendar month before due';
  end if;

  insert into public.service_completions (
    id, booking_request_id, customer_id, vehicle_id, completed_at, summary, created_by
  ) values (
    'dddddddd-dddd-4ddd-8ddd-dddddddddd11',
    declined_booking,
    customer_id,
    vehicle_id,
    '2026-04-01T10:00:00+11:00',
    'Synthetic declined service reminder test.',
    customer_id
  );

  if exists (select 1 from public.booking_integration_jobs where booking_request_id = declined_booking and job_kind = 'notify_customer_service_due') then
    raise exception 'Reminder test failed: declined service created a reminder';
  end if;
end
$$;

rollback;
