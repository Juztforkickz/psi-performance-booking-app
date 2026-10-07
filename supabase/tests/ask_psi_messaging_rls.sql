-- Ask PSI private messaging acceptance test.
-- Reserved identities are used and the transaction always rolls back.

begin;

insert into public.staff_members (email, role, status)
values ('ask-psi-staff@example.invalid', 'staff', 'pending');

insert into auth.users (
  id, aud, role, email, email_confirmed_at, raw_app_meta_data,
  raw_user_meta_data, created_at, updated_at
) values
  (
    'a1111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated',
    'ask-psi-customer-a@example.invalid', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'a2222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated',
    'ask-psi-customer-b@example.invalid', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'a3333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated',
    'ask-psi-staff@example.invalid', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.customer_vehicles (
  id, customer_id, registration, year, make, model, is_primary, created_by
) values (
  'a4444444-4444-4444-8444-444444444444',
  'a1111111-1111-4111-8111-111111111111',
  'ASKPSI', 2026, 'PSI test', 'Messaging vehicle', true,
  'a1111111-1111-4111-8111-111111111111'
);

create temporary table ask_psi_test_ids (
  conversation_id uuid not null,
  message_id uuid not null
) on commit drop;

grant select, insert on ask_psi_test_ids to authenticated;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a1111111-1111-4111-8111-111111111111","email":"ask-psi-customer-a@example.invalid","role":"authenticated","aal":"aal1"}',
  true
);

insert into ask_psi_test_ids
select *
from public.open_ask_psi_conversation(
  'a4444444-4444-4444-8444-444444444444',
  null,
  'vehicle_fault',
  'Please check a noise from the front suspension.',
  'a5555555-5555-4555-8555-555555555555'
);

do $$
begin
  if (select count(*) from public.ask_psi_conversations) <> 1 then
    raise exception 'Ask PSI acceptance failed: customer cannot read own conversation';
  end if;
  if (select count(*) from public.ask_psi_messages) <> 1 then
    raise exception 'Ask PSI acceptance failed: first message was not saved';
  end if;
end;
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"a2222222-2222-4222-8222-222222222222","email":"ask-psi-customer-b@example.invalid","role":"authenticated","aal":"aal1"}',
  true
);

do $$
begin
  if (select count(*) from public.ask_psi_conversations) <> 0
    or (select count(*) from public.ask_psi_messages) <> 0
    or (select count(*) from public.ask_psi_attachments) <> 0 then
    raise exception 'Ask PSI acceptance failed: another customer can read the conversation';
  end if;

  begin
    perform public.send_ask_psi_message(
      (select conversation_id from ask_psi_test_ids),
      'This must be denied.',
      'a6666666-6666-4666-8666-666666666666',
      'text'
    );
    raise exception 'Ask PSI acceptance failed: another customer sent a message';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"a3333333-3333-4333-8333-333333333333","email":"ask-psi-staff@example.invalid","role":"authenticated","aal":"aal1"}',
  true
);

do $$
begin
  if (select count(*) from public.ask_psi_conversations) <> 0 then
    raise exception 'Ask PSI acceptance failed: AAL1 staff can read messages';
  end if;
end;
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"a3333333-3333-4333-8333-333333333333","email":"ask-psi-staff@example.invalid","role":"authenticated","aal":"aal2"}',
  true
);

select public.mark_ask_psi_conversation_read(
  (select conversation_id from ask_psi_test_ids),
  (select message_id from ask_psi_test_ids)
);

select public.send_ask_psi_message(
  (select conversation_id from ask_psi_test_ids),
  'Thanks. PSI has received your message.',
  'a7777777-7777-4777-8777-777777777777',
  'text'
);

do $$
begin
  if (select count(*) from public.ask_psi_conversations) <> 1
    or (select count(*) from public.ask_psi_messages) <> 2 then
    raise exception 'Ask PSI acceptance failed: AAL2 staff cannot use the conversation';
  end if;
  if not exists (
    select 1
    from public.ask_psi_conversations
    where id = (select conversation_id from ask_psi_test_ids)
      and staff_last_read_at is not null
      and status = 'awaiting_customer'
  ) then
    raise exception 'Ask PSI acceptance failed: staff read or reply state was not recorded';
  end if;
  if exists (
    select 1
    from public.ask_psi_email_jobs
    where conversation_id = (select conversation_id from ask_psi_test_ids)
      and status <> 'cancelled'
  ) then
    raise exception 'Ask PSI acceptance failed: read email fallback was not cancelled';
  end if;
end;
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"a1111111-1111-4111-8111-111111111111","email":"ask-psi-customer-a@example.invalid","role":"authenticated","aal":"aal1"}',
  true
);

select public.mark_ask_psi_conversation_read(
  (select conversation_id from ask_psi_test_ids),
  (select id from public.ask_psi_messages where client_nonce = 'a7777777-7777-4777-8777-777777777777')
);

do $$
begin
  if not exists (
    select 1
    from public.ask_psi_conversations
    where id = (select conversation_id from ask_psi_test_ids)
      and customer_last_read_at is not null
  ) then
    raise exception 'Ask PSI acceptance failed: customer read time was not recorded';
  end if;

  begin
    update public.ask_psi_messages
    set body = 'Messages must remain immutable.'
    where conversation_id = (select conversation_id from ask_psi_test_ids);
    raise exception 'Ask PSI acceptance failed: a customer edited message history';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;

do $$
begin
  if exists (
    select 1 from storage.buckets where id = 'ask-psi-media' and public
  ) then
    raise exception 'Ask PSI acceptance failed: media bucket is public';
  end if;
  if has_table_privilege('anon', 'public.ask_psi_conversations', 'select')
    or has_table_privilege('anon', 'public.ask_psi_messages', 'select')
    or has_table_privilege('anon', 'public.ask_psi_attachments', 'select')
    or has_table_privilege('anon', 'public.ask_psi_email_jobs', 'select') then
    raise exception 'Ask PSI acceptance failed: anon has messaging access';
  end if;
end;
$$;

rollback;
