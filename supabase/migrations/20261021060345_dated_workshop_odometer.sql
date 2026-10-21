-- Add dated, staff-recorded kilometres without changing customer-entered readings,
-- service intervals, existing invoices or workshop folder ownership.
alter table public.invoices
  add column odometer_km integer,
  add column odometer_recorded_on date,
  add constraint invoices_dated_odometer_check check (
    (odometer_km is null and odometer_recorded_on is null)
    or (odometer_km is not null and odometer_km between 0 and 9999999 and odometer_recorded_on is not null)
  );
alter table public.vault_records
  add column odometer_km integer,
  add column odometer_recorded_on date,
  add constraint vault_records_dated_odometer_check check (
    (odometer_km is null and odometer_recorded_on is null)
    or (odometer_km is not null and odometer_km between 0 and 9999999 and odometer_recorded_on is not null)
  );

create index repair_records_workshop_odometer_idx
  on public.repair_records (vehicle_id, customer_id, repair_date desc, created_at desc)
  where record_source = 'psi_record' and archived_at is null and odometer_km is not null;
create index invoices_workshop_odometer_idx
  on public.invoices (vehicle_id, customer_id, odometer_recorded_on desc, created_at desc)
  where record_source = 'psi_record' and archived_at is null and odometer_km is not null;
create index vault_records_workshop_odometer_idx
  on public.vault_records (vehicle_id, customer_id, odometer_recorded_on desc, created_at desc)
  where published_at is not null and odometer_km is not null;

-- The existing free overview already exposes workshop dates and kilometres.
-- This private, explicitly scoped definer permits only those summary values,
-- while full documents and notes retain their existing subscription and RLS gates.
create function private.free_vehicle_odometer_summary()
returns table (vehicle_id uuid, customer_id uuid, latest_psi_odometer_km integer, latest_psi_odometer_recorded_on date)
language sql stable security definer set search_path = '' as $body$
  select vehicle.id, vehicle.customer_id, latest.reading_km, latest.recorded_on
  from public.customer_vehicles vehicle
  left join lateral (
    select candidates.reading_km, candidates.recorded_on
    from (
      select completion.odometer_km as reading_km,
        (completion.completed_at at time zone 'Australia/Melbourne')::date as recorded_on,
        completion.created_at, 'completion:' || completion.id::text as source_id
      from public.service_completions completion
      where completion.vehicle_id = vehicle.id and completion.customer_id = vehicle.customer_id
        and completion.odometer_km is not null
      union all
      select repair.odometer_km, repair.repair_date, repair.created_at, 'repair:' || repair.id::text
      from public.repair_records repair
      where repair.vehicle_id = vehicle.id and repair.customer_id = vehicle.customer_id
        and repair.record_source = 'psi_record' and repair.archived_at is null and repair.odometer_km is not null
      union all
      select reading.reading_km, (reading.recorded_at at time zone 'Australia/Melbourne')::date,
        reading.created_at, 'reading:' || reading.id::text
      from public.odometer_readings reading
      where reading.vehicle_id = vehicle.id and reading.customer_id = vehicle.customer_id
        and reading.record_source = 'psi_record' and reading.service_completion_id is null
      union all
      select invoice.odometer_km, invoice.odometer_recorded_on, invoice.created_at, 'invoice:' || invoice.id::text
      from public.invoices invoice
      where invoice.vehicle_id = vehicle.id and invoice.customer_id = vehicle.customer_id
        and invoice.record_source = 'psi_record' and invoice.archived_at is null and invoice.odometer_km is not null
      union all
      select record.odometer_km, record.odometer_recorded_on, record.created_at, 'vault:' || record.id::text
      from public.vault_records record
      join public.workshop_jobs job on job.id = record.job_id
        and job.vehicle_id = record.vehicle_id and job.customer_id = record.customer_id
      where record.vehicle_id = vehicle.id and record.customer_id = vehicle.customer_id
        and record.source <> 'customer_entry' and record.published_at is not null and record.odometer_km is not null
    ) candidates
    where candidates.reading_km >= 0
      and candidates.recorded_on <= (now() at time zone 'Australia/Melbourne')::date
    order by candidates.recorded_on desc, candidates.created_at desc, candidates.source_id desc
    limit 1
  ) latest on true
  where vehicle.archived_at is null
    and (select auth.uid()) is not null
    and (select private.customer_identity_access_allowed())
    and (vehicle.customer_id = (select auth.uid()) or (select private.is_active_staff()));
$body$;
revoke all on function private.free_vehicle_odometer_summary() from public, anon;
grant execute on function private.free_vehicle_odometer_summary() to authenticated;

-- Preserve existing column names, order and access grants for older phone builds.
create or replace view public.vehicle_service_summary with (security_invoker = true) as
select service.vehicle_id, service.customer_id, service.latest_psi_service_at,
  odometer.latest_psi_odometer_km, service.next_psi_check_in_date,
  service.next_psi_check_in_odometer_km, service.latest_customer_odometer_km,
  service.latest_customer_odometer_recorded_at, odometer.latest_psi_odometer_recorded_on
from private.free_vehicle_service_summary() service
left join private.free_vehicle_odometer_summary() odometer
  on odometer.vehicle_id = service.vehicle_id and odometer.customer_id = service.customer_id;
