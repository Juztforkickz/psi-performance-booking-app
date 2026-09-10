-- Saved customer vehicle-report acceptance test.
-- All fixtures use reserved .invalid addresses and roll back.

begin;

insert into auth.users (
  id, aud, role, email, email_confirmed_at, raw_app_meta_data,
  raw_user_meta_data, created_at, updated_at
) values
  (
    '71111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated',
    'saved-reports-a@example.invalid', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '72222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated',
    'saved-reports-b@example.invalid', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.customer_vehicles (
  id, customer_id, registration, year, make, model, is_primary, created_by
) values
  (
    '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '71111111-1111-4111-8111-111111111111',
    'SAVE01', 2026, 'PSI test', 'Saved reports A', true,
    '71111111-1111-4111-8111-111111111111'
  ),
  (
    '7bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '72222222-2222-4222-8222-222222222222',
    'SAVE02', 2026, 'PSI test', 'Saved reports B', true,
    '72222222-2222-4222-8222-222222222222'
  );

-- A PSI invoice exists for customer A but remains behind the PSI invoice
-- entitlement boundary. The customer-created invoice below remains visible.
insert into public.invoices (
  id, customer_id, vehicle_id, invoice_number, invoice_date, summary,
  currency, record_source, created_by
) values (
  '7ddddddd-dddd-4ddd-8ddd-dddddddddddd',
  '71111111-1111-4111-8111-111111111111',
  '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'PSI-LOCKED-TEST', current_date, 'PSI-only invoice fixture',
  'AUD', 'psi_record', '71111111-1111-4111-8111-111111111111'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"71111111-1111-4111-8111-111111111111","email":"saved-reports-a@example.invalid","role":"authenticated","aal":"aal1"}',
  true
);
select set_config('request.jwt.claim.sub', '71111111-1111-4111-8111-111111111111', true);

insert into public.dyno_records (
  id, customer_id, vehicle_id, tested_at, power_kw_at_hubs,
  torque_nm_at_hubs, fuel, notes, record_source, created_by
) values (
  '7ccccccc-cccc-4ccc-8ccc-cccccccccccc',
  '71111111-1111-4111-8111-111111111111',
  '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  now(), 300, 600, '98 RON', 'Saved dyno fixture', 'customer_entry',
  '71111111-1111-4111-8111-111111111111'
);

insert into public.repair_records (
  id, customer_id, vehicle_id, record_kind, title, repair_date,
  notes, record_source, created_by
) values (
  '7eeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  '71111111-1111-4111-8111-111111111111',
  '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'repair', 'Saved repair fixture', current_date, 'Customer-provided history',
  'customer_entry', '71111111-1111-4111-8111-111111111111'
);

insert into public.recommended_work (
  id, customer_id, vehicle_id, title, timing, notes, status,
  record_source, created_by
) values (
  '7fffffff-ffff-4fff-8fff-ffffffffffff',
  '71111111-1111-4111-8111-111111111111',
  '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Saved future-work fixture', 'At next visit', 'Customer-provided note',
  'monitor', 'customer_entry', '71111111-1111-4111-8111-111111111111'
);

insert into public.invoices (
  id, customer_id, vehicle_id, invoice_number, invoice_date, summary,
  amount_cents, currency, record_source, created_by
) values (
  '73333333-3333-4333-8333-333333333333',
  '71111111-1111-4111-8111-111111111111',
  '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'CUSTOMER-SAVED-TEST', current_date, 'Customer-provided invoice',
  42350, 'AUD', 'customer_entry',
  '71111111-1111-4111-8111-111111111111'
);

insert into public.vehicle_files (
  id, customer_id, vehicle_id, dyno_record_id, file_kind, bucket_id,
  object_path, mime_type, file_size_bytes, record_source, created_by
) values (
  '74444444-4444-4444-8444-444444444444',
  '71111111-1111-4111-8111-111111111111',
  '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '7ccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'dyno_graph', 'vehicle-documents',
  '71111111-1111-4111-8111-111111111111/vehicles/7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/customer-dyno/7ccccccc-cccc-4ccc-8ccc-cccccccccccc.jpg',
  'image/jpeg', 1024, 'customer_entry',
  '71111111-1111-4111-8111-111111111111'
);

insert into public.vehicle_files (
  id, customer_id, vehicle_id, invoice_id, file_kind, bucket_id,
  object_path, mime_type, file_size_bytes, record_source, created_by
) values (
  '75555555-5555-4555-8555-555555555555',
  '71111111-1111-4111-8111-111111111111',
  '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '73333333-3333-4333-8333-333333333333',
  'invoice', 'vehicle-documents',
  '71111111-1111-4111-8111-111111111111/vehicles/7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/customer-invoice/73333333-3333-4333-8333-333333333333.jpg',
  'image/jpeg', 1024, 'customer_entry',
  '71111111-1111-4111-8111-111111111111'
);

do $$
declare
  affected_rows integer;
begin
  if (select count(*) from public.dyno_records where id = '7ccccccc-cccc-4ccc-8ccc-cccccccccccc') <> 1
    or (select count(*) from public.repair_records where id = '7eeeeeee-eeee-4eee-8eee-eeeeeeeeeeee') <> 1
    or (select count(*) from public.recommended_work where id = '7fffffff-ffff-4fff-8fff-ffffffffffff') <> 1
    or (select count(*) from public.invoices where id = '73333333-3333-4333-8333-333333333333') <> 1
    or (select count(*) from public.vehicle_files where id in ('74444444-4444-4444-8444-444444444444', '75555555-5555-4555-8555-555555555555')) <> 2 then
    raise exception 'saved report acceptance failed: own records did not persist';
  end if;

  if (select count(*) from public.invoices where id = '7ddddddd-dddd-4ddd-8ddd-dddddddddddd') <> 0 then
    raise exception 'saved report acceptance failed: PSI invoice entitlement was bypassed';
  end if;

  update public.dyno_records set notes = 'forbidden edit'
  where id = '7ccccccc-cccc-4ccc-8ccc-cccccccccccc';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then
    raise exception 'saved report acceptance failed: dyno entry was editable';
  end if;

  update public.repair_records set notes = 'forbidden edit'
  where id = '7eeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then
    raise exception 'saved report acceptance failed: repair entry was editable';
  end if;

  update public.recommended_work set notes = 'forbidden edit'
  where id = '7fffffff-ffff-4fff-8fff-ffffffffffff';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then
    raise exception 'saved report acceptance failed: future-work entry was editable';
  end if;

  update public.invoices set summary = 'forbidden edit'
  where id = '73333333-3333-4333-8333-333333333333';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then
    raise exception 'saved report acceptance failed: customer invoice was editable';
  end if;

  begin
    insert into public.invoices (
      customer_id, vehicle_id, invoice_number, invoice_date, summary,
      currency, record_source, created_by
    ) values (
      '71111111-1111-4111-8111-111111111111',
      '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'FORBIDDEN-PSI-SOURCE', current_date, 'Must fail',
      'AUD', 'psi_record', '71111111-1111-4111-8111-111111111111'
    );
    raise exception 'saved report acceptance failed: customer published PSI invoice';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.invoices (
      customer_id, vehicle_id, invoice_number, invoice_date, summary,
      currency, record_source, created_by
    ) values (
      '71111111-1111-4111-8111-111111111111',
      '7bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'FORBIDDEN-CROSS-VEHICLE', current_date, 'Must fail',
      'AUD', 'customer_entry', '71111111-1111-4111-8111-111111111111'
    );
    raise exception 'saved report acceptance failed: cross-customer vehicle accepted';
  exception when insufficient_privilege then null;
  end;
end;
$$;

rollback;
