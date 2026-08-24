-- PSI customer/workshop RLS acceptance test.
--
-- This test deliberately uses reserved .invalid email addresses and wraps every
-- fixture in a transaction that is rolled back. It is safe to run against the
-- linked test project: no test user, vehicle, record or audit row is retained.

begin;

insert into public.staff_members (email, role, status)
values ('rls-staff@example.invalid', 'staff', 'pending');

do $$
begin
  if has_table_privilege('anon', 'public.customer_profiles', 'select')
    or has_table_privilege('anon', 'public.customer_vehicles', 'select')
    or has_table_privilege('anon', 'public.booking_requests', 'insert')
    or has_table_privilege('anon', 'public.service_completions', 'select')
    or has_table_privilege('anon', 'public.invoices', 'select')
    or has_table_privilege('anon', 'public.vehicle_files', 'select') then
    raise exception 'RLS test failed: anon has a business-table privilege';
  end if;

  if exists (
    select 1
    from storage.buckets
    where id in ('vehicle-photos', 'vehicle-documents')
      and public
  ) then
    raise exception 'RLS test failed: a customer file bucket is public';
  end if;
end;
$$;

insert into auth.users (
  id,
  aud,
  role,
  email,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values
  (
    '11111111-1111-4111-8111-111111111111',
    'authenticated',
    'authenticated',
    'rls-customer-a@example.invalid',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'authenticated',
    'authenticated',
    'rls-customer-b@example.invalid',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    'authenticated',
    'authenticated',
    'rls-staff@example.invalid',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","email":"rls-customer-a@example.invalid","role":"authenticated","aal":"aal1"}',
  true
);
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

insert into public.customer_vehicles (
  id,
  customer_id,
  registration,
  year,
  make,
  model,
  is_primary,
  created_by
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  'RLSA01',
  2026,
  'PSI test',
  'Customer A',
  true,
  '11111111-1111-4111-8111-111111111111'
);

insert into public.booking_requests (
  id,
  customer_id,
  vehicle_id,
  booking_type,
  preferred_date,
  request_notes,
  state,
  currency,
  created_by
) values (
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'service',
  current_date,
  'Synthetic service completion acceptance fixture.',
  'pending_staff_review',
  'AUD',
  '11111111-1111-4111-8111-111111111111'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","email":"rls-customer-b@example.invalid","role":"authenticated","aal":"aal1"}',
  true
);
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);

insert into public.customer_vehicles (
  id,
  customer_id,
  registration,
  year,
  make,
  model,
  is_primary,
  created_by
) values (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '22222222-2222-4222-8222-222222222222',
  'RLSB02',
  2026,
  'PSI test',
  'Customer B',
  true,
  '22222222-2222-4222-8222-222222222222'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","email":"rls-customer-a@example.invalid","role":"authenticated","aal":"aal1"}',
  true
);
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

do $$
declare
  affected_rows integer;
  own_dyno_id uuid;
begin
  if (select count(*) from public.customer_profiles) <> 1 then
    raise exception 'RLS test failed: customer A can see another profile';
  end if;

  if (select count(*) from public.customer_profiles where user_id = '11111111-1111-4111-8111-111111111111') <> 1 then
    raise exception 'RLS test failed: customer A cannot see their profile';
  end if;

  if (select count(*) from public.customer_vehicles) <> 1 then
    raise exception 'RLS test failed: customer A can see another vehicle';
  end if;

  if (select count(*) from public.customer_vehicles where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') <> 0 then
    raise exception 'RLS test failed: customer A can select customer B vehicle';
  end if;

  if (select count(*) from public.staff_members) <> 0 then
    raise exception 'RLS test failed: customer A can see PSI staff records';
  end if;

  update public.customer_vehicles
  set nickname = 'cross-account edit'
  where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then
    raise exception 'RLS test failed: customer A updated customer B vehicle';
  end if;

  begin
    insert into public.customer_vehicles (
      customer_id, registration, year, make, model, created_by
    ) values (
      '22222222-2222-4222-8222-222222222222',
      'CROSS01',
      2026,
      'PSI test',
      'Forbidden cross-account vehicle',
      '11111111-1111-4111-8111-111111111111'
    );
    raise exception 'RLS test failed: cross-account vehicle insert succeeded';
  exception
    when insufficient_privilege then null;
  end;

  insert into public.dyno_records (
    customer_id,
    vehicle_id,
    record_source,
    tested_at,
    power_kw_at_hubs,
    torque_nm_at_hubs,
    created_by
  ) values (
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'customer_entry',
    now(),
    250,
    500,
    '11111111-1111-4111-8111-111111111111'
  ) returning id into own_dyno_id;

  insert into public.vehicle_files (
    customer_id,
    vehicle_id,
    file_kind,
    record_source,
    bucket_id,
    object_path,
    mime_type,
    file_size_bytes,
    created_by
  ) values (
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'vehicle_photo',
    'customer_entry',
    'vehicle-photos',
    '11111111-1111-4111-8111-111111111111/vehicles/rls-customer-a.jpg',
    'image/jpeg',
    1024,
    '11111111-1111-4111-8111-111111111111'
  );

  begin
    insert into public.vehicle_files (
      customer_id,
      vehicle_id,
      file_kind,
      record_source,
      bucket_id,
      object_path,
      mime_type,
      file_size_bytes,
      created_by
    ) values (
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'vehicle_photo',
      'customer_entry',
      'vehicle-photos',
      '22222222-2222-4222-8222-222222222222/vehicles/forbidden.jpg',
      'image/jpeg',
      1024,
      '11111111-1111-4111-8111-111111111111'
    );
    raise exception 'RLS test failed: customer created file metadata outside own folder';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.dyno_records
    set record_source = 'psi_verified'
    where id = own_dyno_id;
    raise exception 'RLS test failed: customer promoted dyno entry to PSI verified';
  exception
    when insufficient_privilege then null;
  end;

  begin
    insert into public.repair_records (
      customer_id,
      vehicle_id,
      record_source,
      title,
      repair_date,
      notes,
      created_by
    ) values (
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'psi_record',
      'Forbidden PSI repair record',
      current_date,
      'This must never be accepted from a customer session.',
      '11111111-1111-4111-8111-111111111111'
    );
    raise exception 'RLS test failed: customer created a PSI repair record';
  exception
    when insufficient_privilege then null;
  end;

  begin
    insert into public.invoices (
      customer_id,
      vehicle_id,
      invoice_number,
      invoice_date,
      summary,
      amount_cents,
      currency,
      created_by
    ) values (
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'FORBIDDEN-RLS-INVOICE',
      current_date,
      'Customer sessions cannot create PSI invoices.',
      10000,
      'AUD',
      '11111111-1111-4111-8111-111111111111'
    );
    raise exception 'RLS test failed: customer created an invoice';
  exception
    when insufficient_privilege then null;
  end;

  begin
    insert into public.odometer_readings (
      customer_id,
      vehicle_id,
      reading_km,
      record_source,
      service_completion_id,
      created_by
    ) values (
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      50000,
      'psi_record',
      null,
      '11111111-1111-4111-8111-111111111111'
    );
    raise exception 'RLS test failed: customer created a PSI odometer record';
  exception
    when insufficient_privilege or check_violation then null;
  end;

  begin
    insert into public.service_completions (
      booking_request_id, customer_id, vehicle_id, summary, created_by
    ) values (
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Forbidden customer service completion',
      '11111111-1111-4111-8111-111111111111'
    );
    raise exception 'RLS test failed: customer completed a PSI service';
  exception
    when others then
      if sqlerrm not like '%Only active PSI staff%' and sqlstate <> '42501' then
        raise;
      end if;
  end;
end;
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","email":"rls-customer-b@example.invalid","role":"authenticated","aal":"aal1"}',
  true
);
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);

do $$
begin
  if (select count(*) from public.customer_profiles) <> 1 then
    raise exception 'RLS test failed: customer B can see another profile';
  end if;

  if (select count(*) from public.customer_vehicles) <> 1 then
    raise exception 'RLS test failed: customer B can see another vehicle';
  end if;

  if (select count(*) from public.dyno_records) <> 0 then
    raise exception 'RLS test failed: customer B can see customer A dyno data';
  end if;

  if (select count(*) from public.vehicle_files) <> 0 then
    raise exception 'RLS test failed: customer B can see customer A private file metadata';
  end if;

  if (select count(*) from public.audit_events where customer_id = '11111111-1111-4111-8111-111111111111') <> 0 then
    raise exception 'RLS test failed: customer B can see customer A audit history';
  end if;
end;
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-4333-8333-333333333333","email":"rls-staff@example.invalid","role":"authenticated","aal":"aal1"}',
  true
);
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);

do $$
begin
  if (select private.is_active_staff()) then
    raise exception 'RLS test failed: AAL1 staff received workshop access';
  end if;

  if (select count(*) from public.customer_profiles) <> 0 then
    raise exception 'RLS test failed: AAL1 staff can view customer profiles';
  end if;

  begin
    insert into public.repair_records (
      customer_id, vehicle_id, record_source, title, repair_date, created_by
    ) values (
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'psi_record',
      'Forbidden AAL1 repair',
      current_date,
      '33333333-3333-4333-8333-333333333333'
    );
    raise exception 'RLS test failed: AAL1 staff published a PSI record';
  exception
    when insufficient_privilege then null;
  end;

  begin
    insert into public.service_completions (
      booking_request_id, customer_id, vehicle_id, summary, created_by
    ) values (
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Forbidden AAL1 service completion',
      '33333333-3333-4333-8333-333333333333'
    );
    raise exception 'RLS test failed: AAL1 staff completed a PSI service';
  exception
    when others then
      if sqlerrm not like '%Only active PSI staff%' and sqlstate <> '42501' then
        raise;
      end if;
  end;
end;
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-4333-8333-333333333333","email":"rls-staff@example.invalid","role":"authenticated","aal":"aal2"}',
  true
);
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);

do $$
begin
  if not (select private.is_active_staff()) then
    raise exception 'RLS test failed: active AAL2 staff cannot access workshop records';
  end if;

  insert into public.repair_records (
    id, customer_id, vehicle_id, record_source, title, repair_date, created_by
  ) values (
    '44444444-4444-4444-8444-444444444444',
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'psi_record',
    'Synthetic PSI repair',
    current_date,
    '33333333-3333-4333-8333-333333333333'
  );

  insert into public.recommended_work (
    id, customer_id, vehicle_id, record_source, title, status, created_by
  ) values (
    '55555555-5555-4555-8555-555555555555',
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'psi_record',
    'Synthetic PSI recommendation',
    'monitor',
    '33333333-3333-4333-8333-333333333333'
  );

  insert into public.dyno_records (
    id, customer_id, vehicle_id, record_source, tested_at,
    power_kw_at_hubs, torque_nm_at_hubs, created_by
  ) values (
    '66666666-6666-4666-8666-666666666666',
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'psi_verified',
    now(),
    300,
    600,
    '33333333-3333-4333-8333-333333333333'
  );

  insert into public.invoices (
    id, customer_id, vehicle_id, invoice_number, invoice_date,
    summary, amount_cents, currency, created_by
  ) values (
    '77777777-7777-4777-8777-777777777777',
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'RLS-STAFF-INVOICE',
    current_date,
    'Synthetic PSI invoice',
    42350,
    'AUD',
    '33333333-3333-4333-8333-333333333333'
  );

  insert into public.vehicle_files (
    customer_id, vehicle_id, invoice_id, file_kind, record_source,
    bucket_id, object_path, mime_type, file_size_bytes, created_by
  ) values (
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '77777777-7777-4777-8777-777777777777',
    'invoice',
    'psi_record',
    'vehicle-documents',
    '11111111-1111-4111-8111-111111111111/vehicles/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/invoices/test.jpg',
    'image/jpeg',
    1024,
    '33333333-3333-4333-8333-333333333333'
  );

  update public.booking_requests
  set state = 'confirmed'
  where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  insert into public.service_completions (
    id,
    booking_request_id,
    customer_id,
    vehicle_id,
    completed_at,
    odometer_km,
    summary,
    next_check_in_date,
    next_check_in_odometer_km,
    created_by
  ) values (
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    now(),
    84210,
    'Synthetic completed PSI service and workshop inspection.',
    current_date + 180,
    94210,
    '33333333-3333-4333-8333-333333333333'
  );

  if (select state from public.booking_requests where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc') <> 'completed' then
    raise exception 'RLS test failed: service completion did not close the booking';
  end if;
  if (select count(*) from public.repair_records where service_completion_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' and record_source = 'psi_record' and record_kind = 'service') <> 1 then
    raise exception 'RLS test failed: service completion did not project official repair history';
  end if;
  if (select count(*) from public.odometer_readings where service_completion_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' and reading_km = 84210 and record_source = 'psi_record') <> 1 then
    raise exception 'RLS test failed: service completion did not project official odometer history';
  end if;
  if (select count(*) from public.vehicle_service_summary where vehicle_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and latest_psi_odometer_km = 84210 and next_psi_check_in_odometer_km = 94210) <> 1 then
    raise exception 'RLS test failed: service summary did not expose protected PSI history';
  end if;

  begin
    update public.repair_records
    set notes = 'Forbidden rewrite of projected service history'
    where service_completion_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    raise exception 'RLS test failed: projected service history was mutable';
  exception
    when others then
      if sqlerrm not like '%Linked PSI service records are immutable%' then
        raise;
      end if;
  end;

  begin
    insert into public.repair_records (
      customer_id, vehicle_id, record_source, title, repair_date, created_by
    ) values (
      '11111111-1111-4111-8111-111111111111',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'psi_record',
      'Forbidden customer and vehicle mismatch',
      current_date,
      '33333333-3333-4333-8333-333333333333'
    );
    raise exception 'RLS test failed: staff paired a PSI record with another customer vehicle';
  exception
    when insufficient_privilege then null;
  end;

  begin
    insert into public.vehicle_files (
      customer_id, vehicle_id, invoice_id, file_kind, record_source,
      bucket_id, object_path, mime_type, file_size_bytes, created_by
    ) values (
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '77777777-7777-4777-8777-777777777777',
      'invoice',
      'psi_record',
      'vehicle-documents',
      '22222222-2222-4222-8222-222222222222/vehicles/forbidden.jpg',
      'image/jpeg',
      1024,
      '33333333-3333-4333-8333-333333333333'
    );
    raise exception 'RLS test failed: staff published file metadata under another customer path';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","email":"rls-customer-a@example.invalid","role":"authenticated","aal":"aal1"}',
  true
);
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

do $$
begin
  if (select count(*) from public.repair_records where id = '44444444-4444-4444-8444-444444444444') <> 1 then
    raise exception 'RLS test failed: customer A cannot read its PSI repair record';
  end if;
  if (select count(*) from public.recommended_work where id = '55555555-5555-4555-8555-555555555555') <> 1 then
    raise exception 'RLS test failed: customer A cannot read its PSI recommendation';
  end if;
  if (select count(*) from public.dyno_records where id = '66666666-6666-4666-8666-666666666666' and record_source = 'psi_verified') <> 1 then
    raise exception 'RLS test failed: customer A cannot read its PSI verified dyno result';
  end if;
  if (select count(*) from public.invoices where id = '77777777-7777-4777-8777-777777777777') <> 1 then
    raise exception 'RLS test failed: customer A cannot read its PSI invoice';
  end if;
  if (select count(*) from public.vehicle_files where invoice_id = '77777777-7777-4777-8777-777777777777') <> 1 then
    raise exception 'RLS test failed: customer A cannot read its private invoice metadata';
  end if;
  if (select count(*) from public.service_completions where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd') <> 1 then
    raise exception 'RLS test failed: customer A cannot read its service completion';
  end if;
  if (select count(*) from public.repair_records where service_completion_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd') <> 1 then
    raise exception 'RLS test failed: customer A cannot read projected service history';
  end if;
  if (select count(*) from public.odometer_readings where service_completion_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd') <> 1 then
    raise exception 'RLS test failed: customer A cannot read projected PSI odometer history';
  end if;
end;
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","email":"rls-customer-b@example.invalid","role":"authenticated","aal":"aal1"}',
  true
);
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);

do $$
begin
  if (select count(*) from public.repair_records where id = '44444444-4444-4444-8444-444444444444') <> 0
    or (select count(*) from public.recommended_work where id = '55555555-5555-4555-8555-555555555555') <> 0
    or (select count(*) from public.dyno_records where id = '66666666-6666-4666-8666-666666666666') <> 0
    or (select count(*) from public.invoices where id = '77777777-7777-4777-8777-777777777777') <> 0
    or (select count(*) from public.vehicle_files where invoice_id = '77777777-7777-4777-8777-777777777777') <> 0
    or (select count(*) from public.service_completions where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd') <> 0
    or (select count(*) from public.repair_records where service_completion_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd') <> 0
    or (select count(*) from public.odometer_readings where service_completion_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd') <> 0 then
    raise exception 'RLS test failed: customer B can read customer A PSI records';
  end if;
end;
$$;

reset role;
rollback;
