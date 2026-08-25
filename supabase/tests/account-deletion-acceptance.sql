-- Destructive-path acceptance test for the synthetic QATEST1 identity.
-- Every operation is enclosed in one transaction and rolled back.
-- Never remove the final ROLLBACK or replace QATEST1 with a real registration.

begin;

create temp table deletion_acceptance_target (
  user_id uuid primary key,
  customer_id uuid not null,
  vehicle_id uuid not null
) on commit drop;

insert into deletion_acceptance_target (user_id, customer_id, vehicle_id)
select cp.user_id, cp.user_id, cv.id
from public.customer_profiles cp
join public.customer_vehicles cv on cv.customer_id = cp.user_id
where cv.registration = 'QATEST1'
  and not exists (
    select 1 from public.staff_members sm
    where sm.user_id = cp.user_id and sm.status = 'active'
  );

do $$
begin
  if (select count(*) from deletion_acceptance_target) <> 1 then
    raise exception 'Expected exactly one non-staff QATEST1 synthetic identity';
  end if;
end
$$;

insert into public.account_deletion_requests (user_id)
select user_id from deletion_acceptance_target
on conflict (user_id) do update
set status = 'requested', completed_at = null, staff_note = null;

update public.account_deletion_requests
set status = 'in_review', staff_note = 'Synthetic rollback-only deletion acceptance'
where user_id = (select user_id from deletion_acceptance_target);

delete from public.push_notification_jobs
where recipient_user_id = (select user_id from deletion_acceptance_target)
   or booking_request_id in (
     select id from public.booking_requests
     where customer_id = (select customer_id from deletion_acceptance_target)
   );

delete from public.notification_events
where recipient_user_id = (select user_id from deletion_acceptance_target)
   or booking_request_id in (
     select id from public.booking_requests
     where customer_id = (select customer_id from deletion_acceptance_target)
   );

delete from public.booking_calendar_events
where booking_request_id in (
  select id from public.booking_requests
  where customer_id = (select customer_id from deletion_acceptance_target)
);

delete from public.booking_integration_jobs
where customer_id = (select customer_id from deletion_acceptance_target);

delete from public.service_completions
where customer_id = (select customer_id from deletion_acceptance_target);

delete from public.vehicle_files
where customer_id = (select customer_id from deletion_acceptance_target);

delete from public.invoices
where customer_id = (select customer_id from deletion_acceptance_target);

delete from public.recommended_work
where customer_id = (select customer_id from deletion_acceptance_target);

delete from public.repair_records
where customer_id = (select customer_id from deletion_acceptance_target);

delete from public.dyno_records
where customer_id = (select customer_id from deletion_acceptance_target);

delete from public.odometer_readings
where customer_id = (select customer_id from deletion_acceptance_target);

delete from public.booking_requests
where customer_id = (select customer_id from deletion_acceptance_target);

delete from public.customer_vehicles
where customer_id = (select customer_id from deletion_acceptance_target);

delete from public.customer_profiles
where user_id = (select user_id from deletion_acceptance_target);

delete from auth.users
where id = (select user_id from deletion_acceptance_target);

delete from public.audit_events
where actor_user_id = (select user_id from deletion_acceptance_target)
   or customer_id = (select customer_id from deletion_acceptance_target)
   or record_id in (
     (select user_id from deletion_acceptance_target),
     (select customer_id from deletion_acceptance_target),
     (select vehicle_id from deletion_acceptance_target)
   );

do $$
declare
  target uuid := (select user_id from deletion_acceptance_target);
  candidate record;
  remaining bigint;
begin
  if exists (select 1 from auth.users where id = target) then
    raise exception 'Auth identity remained after synthetic deletion';
  end if;

  for candidate in
    select table_schema, table_name, column_name
    from information_schema.columns
    where table_schema = 'public' and udt_name = 'uuid'
  loop
    execute format(
      'select count(*) from %I.%I where %I = $1',
      candidate.table_schema,
      candidate.table_name,
      candidate.column_name
    ) into remaining using target;
    if remaining > 0 then
      raise exception 'Synthetic identity remained in %.% column %',
        candidate.table_schema, candidate.table_name, candidate.column_name;
    end if;
  end loop;
end
$$;

rollback;
