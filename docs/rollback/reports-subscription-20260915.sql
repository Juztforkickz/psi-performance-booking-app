-- Data-preserving rollback. Keep customer_vehicle_notes and its existing rows.
BEGIN;
drop policy if exists "report subscription requirement" on public.dyno_records;
drop policy if exists "report subscription requirement" on public.repair_records;
drop policy if exists "report subscription requirement" on public.recommended_work;
drop policy if exists "report subscription requirement" on public.invoices;
drop policy if exists "report subscription requirement" on public.service_completions;
drop policy if exists "report creation reserved for staff" on public.dyno_records;
drop policy if exists "report creation reserved for staff" on public.repair_records;
drop policy if exists "report creation reserved for staff" on public.recommended_work;
drop policy if exists "report creation reserved for staff" on public.invoices;
create or replace view public.vehicle_service_summary with (security_invoker=true) as
 SELECT vehicle.id AS vehicle_id,
    vehicle.customer_id,
    latest_service.completed_at AS latest_psi_service_at,
    latest_service.odometer_km AS latest_psi_odometer_km,
    latest_service.next_check_in_date AS next_psi_check_in_date,
    latest_service.next_check_in_odometer_km AS next_psi_check_in_odometer_km,
    latest_reading.reading_km AS latest_customer_odometer_km,
    latest_reading.recorded_at AS latest_customer_odometer_recorded_at
   FROM ((customer_vehicles vehicle
     LEFT JOIN LATERAL ( SELECT completion.completed_at,
            completion.odometer_km,
            completion.next_check_in_date,
            completion.next_check_in_odometer_km
           FROM service_completions completion
          WHERE (completion.vehicle_id = vehicle.id)
          ORDER BY completion.completed_at DESC, completion.created_at DESC
         LIMIT 1) latest_service ON (true))
     LEFT JOIN LATERAL ( SELECT reading.reading_km,
            reading.recorded_at
           FROM odometer_readings reading
          WHERE ((reading.vehicle_id = vehicle.id) AND (reading.record_source = 'customer_entry'::text))
          ORDER BY reading.recorded_at DESC, reading.created_at DESC
         LIMIT 1) latest_reading ON (true))
  WHERE (vehicle.archived_at IS NULL);
drop function private.free_vehicle_service_summary();
CREATE OR REPLACE FUNCTION private.performance_vault_overview(p_vehicle_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 counts jsonb;
 entitled boolean;
 permanent_access boolean;
 access_expires_at timestamptz;
begin
 if (select auth.uid()) is null or not private.customer_identity_access_allowed()
 or not exists(select 1 from public.customer_vehicles v where v.id=p_vehicle_id and v.customer_id=(select auth.uid()) and v.archived_at is null)
 then raise exception 'vehicle_access_denied' using errcode='42501'; end if;

 entitled:=private.has_performance_plus();
 select coalesce(jsonb_object_agg(kind,total),'{}'::jsonb) into counts from
 (select kind,count(*) total from (select r.kind from public.vault_records r where r.customer_id=(select auth.uid()) and r.vehicle_id=p_vehicle_id and r.published_at is not null union all select 'invoice' from public.invoices i where i.customer_id=(select auth.uid()) and i.vehicle_id=p_vehicle_id and i.archived_at is null) records group by kind) c;

 select coalesce(bool_or(s.is_permanent),false),
 max(s.expires_at) filter (where not s.is_permanent)
 into permanent_access,access_expires_at
 from public.performance_subscriptions s
 where s.customer_id=(select auth.uid())
 and s.status in ('active','grace_period')
 and (s.is_permanent or s.expires_at>now())
 and (s.environment='production' or (select allow_sandbox from private.performance_settings where singleton));

 return jsonb_build_object(
   'plan',case when entitled then 'performance_plus' else 'free' end,
   'counts',counts,
   'expires_at',case when permanent_access then null else access_expires_at end,
   'is_permanent',permanent_access
 );
end $function$;

COMMIT;
