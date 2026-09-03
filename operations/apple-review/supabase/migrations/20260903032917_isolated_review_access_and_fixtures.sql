-- SANDBOX ONLY: jwikoldibbpxyhbdrsow. Never put this in /supabase/migrations.
-- Preconditions deliberately reject the established live database.
do $$
begin
  if (select count(*) from auth.users) <> 3
    or exists (select 1 from auth.users where email not in (
      'psiappreview@gmail.com', 'psiappreview+staff@gmail.com', 'psiappreview+isolation@gmail.com'
    ) or email_confirmed_at is null)
    or exists (select 1 from public.customer_vehicles)
    or exists (select 1 from public.booking_requests)
    or exists (select 1 from storage.objects)
    or exists (select 1 from public.staff_members where user_id is not null)
  then raise exception 'EMPTY_ISOLATED_REVIEW_PROJECT_REQUIRED'; end if;
end $$;

create table private.apple_review_installation (
  project_ref text primary key check (project_ref = 'jwikoldibbpxyhbdrsow'),
  installed_at timestamptz not null default now()
);
alter table private.apple_review_installation enable row level security;
revoke all on private.apple_review_installation from public, anon, authenticated, service_role;
insert into private.apple_review_installation (project_ref) values ('jwikoldibbpxyhbdrsow');

-- Remove only the copied, unbound bootstrap invite in this empty sandbox.
delete from public.staff_members
where email = 'matt@psiperformance.com.au' and user_id is null and status = 'pending';

insert into public.staff_members (user_id, email, role, status, activated_at)
select id, email, 'owner', 'active', now() from auth.users
where email = 'psiappreview+staff@gmail.com';

-- This replacement exists ONLY in the isolated database. The live definition
-- remains AAL2-only. A client flag can never grant staff access in either DB.
create or replace function private.current_staff_role()
returns text language sql stable security definer set search_path = '' as $$
  select staff.role
  from public.staff_members staff
  where staff.user_id = (select auth.uid())
    and staff.status = 'active'
    and staff.email = 'psiappreview+staff@gmail.com'
    and (select auth.jwt() ->> 'iss') = 'https://jwikoldibbpxyhbdrsow.supabase.co/auth/v1'
    and (select auth.jwt() ->> 'aal') in ('aal1', 'aal2')
    and exists (select 1 from private.apple_review_installation where project_ref = 'jwikoldibbpxyhbdrsow')
    and exists (
      select 1 from auth.sessions session
      where session.id::text = (select auth.jwt() ->> 'session_id')
        and session.user_id = (select auth.uid())
    )
  limit 1
$$;
revoke all on function private.current_staff_role() from public, anon;
grant execute on function private.current_staff_role() to authenticated;

-- No real people, contact numbers, vehicles, invoices or appointments.
update public.customer_profiles
set first_name = case email when 'psiappreview+staff@gmail.com' then 'Demo' else 'Review' end,
    last_name = case email when 'psiappreview+staff@gmail.com' then 'Workshop' when 'psiappreview+isolation@gmail.com' then 'Isolation' else 'Customer' end,
    mobile = '0400 000 000'
where email in ('psiappreview@gmail.com', 'psiappreview+staff@gmail.com', 'psiappreview+isolation@gmail.com');

insert into public.customer_vehicles (customer_id, registration, year, make, model, nickname, odometer_km, is_primary, created_by)
select user_id, 'DEMO001', 2003, 'Holden', 'Commodore VY SS', 'Fictional review vehicle', 120000, true, user_id
from public.customer_profiles where email = 'psiappreview@gmail.com';
insert into public.customer_vehicles (customer_id, registration, year, make, model, nickname, odometer_km, is_primary, created_by)
select user_id, 'DEMO002', 2018, 'Ford', 'Mustang GT', 'Second fictional review vehicle', 45000, false, user_id
from public.customer_profiles where email = 'psiappreview@gmail.com';
insert into public.customer_vehicles (customer_id, registration, year, make, model, nickname, odometer_km, is_primary, created_by)
select user_id, 'DEMOISO', 2020, 'Toyota', '86', 'Private isolation test only', 10000, true, user_id
from public.customer_profiles where email = 'psiappreview+isolation@gmail.com';

insert into public.repair_records (customer_id, vehicle_id, record_source, record_kind, title, repair_date, odometer_km, notes, created_by)
select vehicle.customer_id, vehicle.id, 'psi_record', 'inspection', 'DEMO Workshop inspection', current_date,
  120000, 'Fictional sample only. No vehicle was inspected and no real work was performed.', staff.user_id
from public.customer_vehicles vehicle cross join public.staff_members staff
where vehicle.registration = 'DEMO001' and staff.email = 'psiappreview+staff@gmail.com';

insert into public.dyno_records (customer_id, vehicle_id, record_source, tested_at, power_kw_at_hubs, torque_nm_at_hubs, fuel, notes, created_by)
select vehicle.customer_id, vehicle.id, 'psi_verified', now(), 231.17, 470, 'DEMO 98 RON',
  'Synthetic 310 HP graph for app review. Not a measured result.', staff.user_id
from public.customer_vehicles vehicle cross join public.staff_members staff
where vehicle.registration = 'DEMO001' and staff.email = 'psiappreview+staff@gmail.com';

insert into public.invoices (customer_id, vehicle_id, invoice_number, invoice_date, summary, amount_cents, currency, created_by)
select vehicle.customer_id, vehicle.id, 'DEMO-INV-001', current_date,
  'Fictional review document. Not a tax invoice. Nothing is payable.', 0, 'AUD', staff.user_id
from public.customer_vehicles vehicle cross join public.staff_members staff
where vehicle.registration = 'DEMO001' and staff.email = 'psiappreview+staff@gmail.com';

insert into public.booking_requests (customer_id, vehicle_id, booking_type, preferred_date, request_notes, created_by)
select vehicle.customer_id, vehicle.id, 'service', (date_trunc('week', now()) + interval '2 weeks')::date,
  'DEMO ONLY: fictional service request for review. No real workshop appointment.', vehicle.customer_id
from public.customer_vehicles vehicle where vehicle.registration = 'DEMO001';

insert into public.psi_events (title, description, location, starts_at, status, published_at, created_by)
select 'DEMO PSI review event', 'Fictional event for reviewing the app. Do not attend or travel.',
  'Demo location only', now() + interval '14 days', 'published', now(), user_id
from public.staff_members where email = 'psiappreview+staff@gmail.com';
