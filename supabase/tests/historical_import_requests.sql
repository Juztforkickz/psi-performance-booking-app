-- Paid historical vehicle import acceptance test.
-- Fixtures use reserved .invalid addresses and are rolled back.

begin;

insert into auth.users (
  id, aud, role, email, email_confirmed_at, raw_app_meta_data,
  raw_user_meta_data, created_at, updated_at
) values
  (
    '81111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated',
    'history-import-a@example.invalid', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '82222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated',
    'history-import-b@example.invalid', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.customer_vehicles (
  id, customer_id, registration, year, make, model, is_primary, created_by
) values
  (
    '8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '81111111-1111-4111-8111-111111111111',
    'HIST01', 2020, 'PSI test', 'History A', true,
    '81111111-1111-4111-8111-111111111111'
  ),
  (
    '8bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '82222222-2222-4222-8222-222222222222',
    'HIST02', 2021, 'PSI test', 'History B', true,
    '82222222-2222-4222-8222-222222222222'
  );

insert into public.historical_import_requests (
  id, customer_id, vehicle_id, status, payment_status, consent_at,
  provider_checkout_id, provider_payment_id, provider_event_id,
  paid_at, imported_item_count, completed_at
) values (
  '8ccccccc-cccc-4ccc-8ccc-cccccccccccc',
  '81111111-1111-4111-8111-111111111111',
  '8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'completed', 'paid', now(), 'cs_test_history_import',
  'pi_test_history_import', 'evt_test_history_import', now(), 1, now()
);

insert into public.invoices (
  id, customer_id, vehicle_id, invoice_number, invoice_date, summary,
  currency, record_source, created_by
) values (
  '8ddddddd-dddd-4ddd-8ddd-dddddddddddd',
  '81111111-1111-4111-8111-111111111111',
  '8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'HISTORY-IMPORT-TEST', current_date, 'Imported PSI history fixture',
  'AUD', 'psi_record', '81111111-1111-4111-8111-111111111111'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"81111111-1111-4111-8111-111111111111","email":"history-import-a@example.invalid","role":"authenticated","aal":"aal1"}',
  true
);
select set_config('request.jwt.claim.sub', '81111111-1111-4111-8111-111111111111', true);

do $$
declare
  overview jsonb;
begin
  if (select count(*) from public.historical_import_requests where id = '8ccccccc-cccc-4ccc-8ccc-cccccccccccc') <> 1 then
    raise exception 'historical import acceptance failed: customer cannot read own request';
  end if;
  if (select count(*) from public.invoices where id = '8ddddddd-dddd-4ddd-8ddd-dddddddddddd') <> 1 then
    raise exception 'historical import acceptance failed: completed import did not unlock matched invoice';
  end if;

  overview := public.performance_vault_overview('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  if overview ->> 'plan' <> 'history_import'
    or coalesce((overview ->> 'is_permanent')::boolean, false) is not true
    or coalesce((overview ->> 'is_trial')::boolean, false) is true
  then
    raise exception 'historical import acceptance failed: permanent overview is incorrect';
  end if;

  begin
    insert into public.historical_import_requests (
      customer_id, vehicle_id, consent_at
    ) values (
      '81111111-1111-4111-8111-111111111111',
      '8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', now()
    );
    raise exception 'historical import acceptance failed: customer inserted a payment request directly';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"82222222-2222-4222-8222-222222222222","email":"history-import-b@example.invalid","role":"authenticated","aal":"aal1"}',
  true
);
select set_config('request.jwt.claim.sub', '82222222-2222-4222-8222-222222222222', true);

do $$
begin
  if (select count(*) from public.historical_import_requests where id = '8ccccccc-cccc-4ccc-8ccc-cccccccccccc') <> 0 then
    raise exception 'historical import acceptance failed: another customer read the request';
  end if;
  if (select count(*) from public.invoices where id = '8ddddddd-dddd-4ddd-8ddd-dddddddddddd') <> 0 then
    raise exception 'historical import acceptance failed: another customer read the imported invoice';
  end if;
end;
$$;

rollback;
