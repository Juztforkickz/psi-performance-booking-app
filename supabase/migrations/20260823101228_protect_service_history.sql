-- Protected PSI service history and append-only odometer readings.
-- A completed PSI service is created from a confirmed booking and becomes the
-- authoritative source for the last PSI visit and next PSI check-in. Customer
-- maintenance entries remain separate and can never become PSI records.

create table public.service_completions (
  id uuid primary key default gen_random_uuid(),
  booking_request_id uuid not null unique references public.booking_requests(id) on delete restrict,
  customer_id uuid not null references public.customer_profiles(user_id) on delete restrict,
  vehicle_id uuid not null references public.customer_vehicles(id) on delete restrict,
  completed_at timestamptz not null default now(),
  odometer_km integer check (odometer_km is null or odometer_km >= 0),
  summary text not null,
  next_check_in_date date,
  next_check_in_odometer_km integer check (
    next_check_in_odometer_km is null or next_check_in_odometer_km >= 0
  ),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint service_completions_summary_not_blank check (length(btrim(summary)) > 0),
  constraint service_completions_next_odometer_check check (
    next_check_in_odometer_km is null
    or odometer_km is null
    or next_check_in_odometer_km >= odometer_km
  )
);

create index service_completions_customer_completed_idx
  on public.service_completions (customer_id, completed_at desc);
create index service_completions_vehicle_completed_idx
  on public.service_completions (vehicle_id, completed_at desc);
create index service_completions_created_by_idx
  on public.service_completions (created_by);

create table public.odometer_readings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customer_profiles(user_id) on delete restrict,
  vehicle_id uuid not null references public.customer_vehicles(id) on delete restrict,
  reading_km integer not null check (reading_km >= 0),
  recorded_at timestamptz not null default now(),
  record_source text not null check (record_source in ('customer_entry', 'psi_record')),
  service_completion_id uuid references public.service_completions(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint odometer_readings_source_link_check check (
    (record_source = 'psi_record' and service_completion_id is not null)
    or (record_source = 'customer_entry' and service_completion_id is null)
  )
);

create index odometer_readings_customer_recorded_idx
  on public.odometer_readings (customer_id, recorded_at desc);
create index odometer_readings_vehicle_recorded_idx
  on public.odometer_readings (vehicle_id, recorded_at desc);
create index odometer_readings_created_by_idx
  on public.odometer_readings (created_by);
create unique index odometer_readings_service_completion_unique_idx
  on public.odometer_readings (service_completion_id)
  where service_completion_id is not null;

alter table public.repair_records
  add column service_completion_id uuid references public.service_completions(id) on delete restrict,
  add column record_kind text not null default 'repair'
    check (record_kind in ('inspection', 'repair', 'service'));

create unique index repair_records_service_completion_unique_idx
  on public.repair_records (service_completion_id)
  where service_completion_id is not null;

create or replace function private.validate_service_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking_customer_id uuid;
  booking_vehicle_id uuid;
  booking_type_value text;
  booking_state_value text;
  actor_id uuid;
begin
  actor_id := auth.uid();
  if actor_id is null or not (select private.is_active_staff()) then
    raise exception 'Only active PSI staff can complete a service';
  end if;

  select customer_id, vehicle_id, booking_type, state
  into booking_customer_id, booking_vehicle_id, booking_type_value, booking_state_value
  from public.booking_requests
  where id = new.booking_request_id
  for update;

  if not found then
    raise exception 'Booking request not found';
  end if;
  if booking_type_value <> 'service' then
    raise exception 'Only service bookings can create service completions';
  end if;
  if booking_state_value <> 'confirmed' then
    raise exception 'A service booking must be confirmed before completion';
  end if;
  if new.completed_at > now() + interval '5 minutes' then
    raise exception 'Service completion cannot be dated in the future';
  end if;
  if new.next_check_in_date is not null
    and new.next_check_in_date < (new.completed_at at time zone 'Australia/Melbourne')::date then
    raise exception 'Next check-in cannot be before the completed service';
  end if;

  new.customer_id := booking_customer_id;
  new.vehicle_id := booking_vehicle_id;
  new.created_by := actor_id;
  return new;
end;
$$;

revoke all on function private.validate_service_completion() from public, anon, authenticated, service_role;

create trigger validate_service_completion
before insert on public.service_completions
for each row execute function private.validate_service_completion();

create or replace function private.project_service_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.repair_records (
    customer_id,
    vehicle_id,
    service_completion_id,
    record_source,
    record_kind,
    title,
    repair_date,
    odometer_km,
    notes,
    created_by
  ) values (
    new.customer_id,
    new.vehicle_id,
    new.id,
    'psi_record',
    'service',
    'Service & workshop visit',
    (new.completed_at at time zone 'Australia/Melbourne')::date,
    new.odometer_km,
    new.summary,
    new.created_by
  );

  if new.odometer_km is not null then
    insert into public.odometer_readings (
      customer_id,
      vehicle_id,
      reading_km,
      recorded_at,
      record_source,
      service_completion_id,
      created_by
    ) values (
      new.customer_id,
      new.vehicle_id,
      new.odometer_km,
      new.completed_at,
      'psi_record',
      new.id,
      new.created_by
    );
  end if;

  update public.booking_requests
  set state = 'completed'
  where id = new.booking_request_id;

  return new;
end;
$$;

revoke all on function private.project_service_completion() from public, anon, authenticated, service_role;

create trigger project_service_completion
after insert on public.service_completions
for each row execute function private.project_service_completion();

create or replace function private.enforce_service_completion_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.booking_type = 'service'
    and new.state = 'completed'
    and old.state is distinct from 'completed'
    and not exists (
      select 1
      from public.service_completions
      where booking_request_id = new.id
    ) then
    raise exception 'Complete the linked PSI service record before closing this booking';
  end if;

  if old.booking_type = 'service'
    and old.state = 'completed'
    and new.state is distinct from 'completed' then
    raise exception 'A completed PSI service booking cannot be reopened directly';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_service_completion_state() from public, anon, authenticated, service_role;

create trigger enforce_service_completion_state
before update on public.booking_requests
for each row execute function private.enforce_service_completion_state();

create or replace function private.protect_projected_service_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.service_completion_id is not null then
    raise exception 'Linked PSI service records are immutable; create an audited correction instead';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.protect_projected_service_record() from public, anon, authenticated, service_role;

create trigger protect_projected_service_record
before update or delete on public.repair_records
for each row execute function private.protect_projected_service_record();

create trigger audit_service_completions
after insert on public.service_completions
for each row execute function private.record_audit_event();

create trigger audit_odometer_readings
after insert on public.odometer_readings
for each row execute function private.record_audit_event();

alter table public.service_completions enable row level security;
alter table public.odometer_readings enable row level security;

create policy "customers can view own service completions"
on public.service_completions for select to authenticated
using ((select auth.uid()) = customer_id);

create policy "staff can view service completions"
on public.service_completions for select to authenticated
using ((select private.is_active_staff()));

create policy "staff can complete confirmed services"
on public.service_completions for insert to authenticated
with check (
  (select private.is_active_staff())
  and (select auth.uid()) = created_by
);

create policy "customers can view own odometer readings"
on public.odometer_readings for select to authenticated
using ((select auth.uid()) = customer_id);

create policy "staff can view odometer readings"
on public.odometer_readings for select to authenticated
using ((select private.is_active_staff()));

create policy "customers can add own odometer readings"
on public.odometer_readings for insert to authenticated
with check (
  (select auth.uid()) = customer_id
  and (select auth.uid()) = created_by
  and (select private.owns_vehicle(vehicle_id))
  and record_source = 'customer_entry'
  and service_completion_id is null
);

create policy "staff can add PSI odometer readings"
on public.odometer_readings for insert to authenticated
with check (
  (select private.is_active_staff())
  and (select auth.uid()) = created_by
  and record_source = 'psi_record'
  and service_completion_id is not null
);

revoke all on public.service_completions from anon, authenticated;
grant select, insert on public.service_completions to authenticated;
revoke all on public.odometer_readings from anon, authenticated;
grant select, insert on public.odometer_readings to authenticated;

create view public.vehicle_service_summary
with (security_invoker = true)
as
select
  vehicle.id as vehicle_id,
  vehicle.customer_id,
  latest_service.completed_at as latest_psi_service_at,
  latest_service.odometer_km as latest_psi_odometer_km,
  latest_service.next_check_in_date as next_psi_check_in_date,
  latest_service.next_check_in_odometer_km as next_psi_check_in_odometer_km,
  latest_reading.reading_km as latest_customer_odometer_km,
  latest_reading.recorded_at as latest_customer_odometer_recorded_at
from public.customer_vehicles as vehicle
left join lateral (
  select
    completion.completed_at,
    completion.odometer_km,
    completion.next_check_in_date,
    completion.next_check_in_odometer_km
  from public.service_completions as completion
  where completion.vehicle_id = vehicle.id
  order by completion.completed_at desc, completion.created_at desc
  limit 1
) as latest_service on true
left join lateral (
  select reading.reading_km, reading.recorded_at
  from public.odometer_readings as reading
  where reading.vehicle_id = vehicle.id
    and reading.record_source = 'customer_entry'
  order by reading.recorded_at desc, reading.created_at desc
  limit 1
) as latest_reading on true
where vehicle.archived_at is null;

revoke all on public.vehicle_service_summary from anon, authenticated;
grant select on public.vehicle_service_summary to authenticated;
