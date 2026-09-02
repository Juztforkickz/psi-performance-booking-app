-- PSI invite-only onboarding acceptance test.
-- Reserved .invalid identities are created inside one transaction and rolled back.

begin;

insert into public.staff_members (email, role, status)
values ('invite-owner@example.invalid', 'owner', 'pending');

insert into auth.users (
  id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '74444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated',
    'invite-owner@example.invalid', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '75555555-5555-4555-8555-555555555555', 'authenticated', 'authenticated',
    'invite-customer@example.invalid', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.customer_invitations (email, auth_user_id, invited_by)
values (
  'invite-customer@example.invalid',
  '75555555-5555-4555-8555-555555555555',
  '74444444-4444-4444-8444-444444444444'
);

do $$
begin
  if has_table_privilege('anon', 'public.customer_invitations', 'select') then
    raise exception 'Invitation RLS test failed: anon can select invitations';
  end if;
  if has_table_privilege('authenticated', 'public.customer_invitations', 'insert')
    or has_table_privilege('authenticated', 'public.customer_invitations', 'update')
    or has_table_privilege('authenticated', 'public.customer_invitations', 'delete') then
    raise exception 'Invitation RLS test failed: authenticated clients can mutate invitations';
  end if;
end
$$;

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"75555555-5555-4555-8555-555555555555","email":"invite-customer@example.invalid","role":"authenticated","aal":"aal1"}',
  true
);
select set_config('request.jwt.claim.sub', '75555555-5555-4555-8555-555555555555', true);

do $$
begin
  if (select count(*) from public.customer_invitations) <> 0 then
    raise exception 'Invitation RLS test failed: customer can view invitation audit rows';
  end if;
end
$$;

update public.customer_profiles
set first_name = 'Invite', last_name = 'Customer', mobile = '0400000000'
where user_id = '75555555-5555-4555-8555-555555555555';

select set_config(
  'request.jwt.claims',
  '{"sub":"74444444-4444-4444-8444-444444444444","email":"invite-owner@example.invalid","role":"authenticated","aal":"aal1"}',
  true
);
select set_config('request.jwt.claim.sub', '74444444-4444-4444-8444-444444444444', true);

do $$
begin
  if (select count(*) from public.customer_invitations) <> 0 then
    raise exception 'Invitation RLS test failed: owner can view invitations at AAL1';
  end if;
end
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"74444444-4444-4444-8444-444444444444","email":"invite-owner@example.invalid","role":"authenticated","aal":"aal2"}',
  true
);

do $$
begin
  if (select count(*) from public.customer_invitations) <> 1 then
    raise exception 'Invitation RLS test failed: owner cannot view invitations at AAL2';
  end if;
  if not exists (
    select 1 from public.customer_invitations
    where email = 'invite-customer@example.invalid'
      and status = 'profile_complete'
      and accepted_at is not null
  ) then
    raise exception 'Invitation RLS test failed: customer profile completion was not recorded';
  end if;
end
$$;

rollback;
