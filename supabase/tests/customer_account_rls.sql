-- PSI customer/workshop RLS acceptance test.
--
-- This test deliberately uses reserved .invalid email addresses and wraps every
-- fixture in a transaction that is rolled back. It is safe to run against the
-- linked test project: no test user, vehicle, record or audit row is retained.

begin;

do $$
begin
  if has_table_privilege('anon', 'public.customer_profiles', 'select')
    or has_table_privilege('anon', 'public.customer_vehicles', 'select')
    or has_table_privilege('anon', 'public.booking_requests', 'insert')
    or has_table_privilege('anon', 'public.invoices', 'select') then
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

  if (select count(*) from public.audit_events where customer_id = '11111111-1111-4111-8111-111111111111') <> 0 then
    raise exception 'RLS test failed: customer B can see customer A audit history';
  end if;
end;
$$;

reset role;
rollback;
