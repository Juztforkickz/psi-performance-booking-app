begin;

select set_config('request.jwt.claims', '{"role":"service_role"}', true);

alter table public.service_completions disable trigger validate_service_completion;
alter table public.service_completions disable trigger project_service_completion;

do $$
declare
  customer_id uuid := '12111111-1111-4111-8111-111111111110';
  vehicle_id uuid := 'a2aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10';
  booking_id uuid := 'c2cccccc-cccc-4ccc-8ccc-cccccccccc10';
  job_id uuid;
  record_id uuid := 'e2eeeeee-eeee-4eee-8eee-eeeeeeeeee10';
begin
  insert into auth.users (id, email) values
    (customer_id, 'job-automation-customer@example.invalid');

  insert into public.customer_vehicles (id, customer_id, make, model, year, registration, created_by)
  values (vehicle_id, customer_id, 'Porsche', '911', 2026, 'JOB-001', customer_id);

  insert into public.booking_requests (
    id, customer_id, vehicle_id, booking_type, state, approved_date, created_by
  ) values (
    booking_id, customer_id, vehicle_id, 'service', 'confirmed', '2026-09-15', customer_id
  );

  select id into job_id from public.workshop_jobs where booking_request_id = booking_id;
  if job_id is null then raise exception 'Booking job test failed: confirmed booking has no job'; end if;
  if (select reference from public.workshop_jobs where id = job_id) <> 'PSI-C2CCCCCCCCCC4CCC8CCCCCCCCCCCCC10' then
    raise exception 'Booking job test failed: reference is not deterministic';
  end if;

  update public.booking_requests set state = 'confirmed' where id = booking_id;
  if (select count(*) from public.workshop_jobs where booking_request_id = booking_id) <> 1 then
    raise exception 'Booking job test failed: duplicate job created';
  end if;

  insert into public.vault_records (
    id, job_id, customer_id, vehicle_id, kind, title, occurred_on, source, source_reference
  ) values (
    record_id, job_id, customer_id, vehicle_id, 'invoice', 'Test Xero invoice', '2026-09-15', 'xero', 'test:invoice'
  );

  insert into public.service_completion_candidates (
    booking_request_id, job_id, customer_id, vehicle_id, source_record_id,
    invoice_number, invoice_status, suggested_completed_date, suggested_summary
  ) values (
    booking_id, job_id, customer_id, vehicle_id, record_id,
    'INV-TEST', 'AUTHORISED', '2026-09-15', 'Synthetic Xero completion suggestion.'
  );

  insert into public.service_completions (
    booking_request_id, customer_id, vehicle_id, completed_at, summary, created_by
  ) values (
    booking_id, customer_id, vehicle_id, '2026-09-15T10:00:00+10:00',
    'Synthetic confirmed completion.', customer_id
  );

  if (select state from public.service_completion_candidates where booking_request_id = booking_id) <> 'completed' then
    raise exception 'Booking job test failed: candidate did not close with staff completion';
  end if;
end
$$;

rollback;
