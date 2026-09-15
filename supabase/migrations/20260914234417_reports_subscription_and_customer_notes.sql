-- Additive, reversible access changes. Existing records and files are preserved.
-- Ownership and identity policies still apply alongside these restrictive gates.

create policy "report subscription requirement" on public.dyno_records
as restrictive for select to authenticated
using ((select private.has_performance_plus()) or (select private.is_active_staff()));

create policy "report subscription requirement" on public.repair_records
as restrictive for select to authenticated
using ((select private.has_performance_plus()) or (select private.is_active_staff()));

create policy "report subscription requirement" on public.recommended_work
as restrictive for select to authenticated
using ((select private.has_performance_plus()) or (select private.is_active_staff()));

create policy "report subscription requirement" on public.invoices
as restrictive for select to authenticated
using ((select private.has_performance_plus()) or (select private.is_active_staff()));

create policy "report subscription requirement" on public.service_completions
as restrictive for select to authenticated
using ((select private.has_performance_plus()) or (select private.is_active_staff()));

create policy "report creation reserved for staff" on public.dyno_records
as restrictive for insert to authenticated
with check ((select private.is_active_staff()));

create policy "report creation reserved for staff" on public.repair_records
as restrictive for insert to authenticated
with check ((select private.is_active_staff()));

create policy "report creation reserved for staff" on public.recommended_work
as restrictive for insert to authenticated
with check ((select private.is_active_staff()));

create policy "report creation reserved for staff" on public.invoices
as restrictive for insert to authenticated
with check ((select private.is_active_staff()));

-- Free overview returns dates and kilometres only, with an explicit ownership
-- boundary inside the definer. It cannot expose summaries from service_completions.
create function private.free_vehicle_service_summary()
returns table (
 vehicle_id uuid, customer_id uuid, latest_psi_service_at timestamptz,
 latest_psi_odometer_km integer, next_psi_check_in_date date,
 next_psi_check_in_odometer_km integer, latest_customer_odometer_km integer,
 latest_customer_odometer_recorded_at timestamptz
)
language sql stable security definer set search_path=''
as $body$
 SELECT vehicle.id AS vehicle_id,
    vehicle.customer_id,
    latest_service.completed_at AS latest_psi_service_at,
    latest_service.odometer_km AS latest_psi_odometer_km,
    latest_service.next_check_in_date AS next_psi_check_in_date,
    latest_service.next_check_in_odometer_km AS next_psi_check_in_odometer_km,
    latest_reading.reading_km AS latest_customer_odometer_km,
    latest_reading.recorded_at AS latest_customer_odometer_recorded_at
   FROM ((public.customer_vehicles vehicle
     LEFT JOIN LATERAL ( SELECT completion.completed_at,
            completion.odometer_km,
            completion.next_check_in_date,
            completion.next_check_in_odometer_km
           FROM public.service_completions completion
          WHERE (completion.vehicle_id = vehicle.id)
          ORDER BY completion.completed_at DESC, completion.created_at DESC
         LIMIT 1) latest_service ON (true))
     LEFT JOIN LATERAL ( SELECT reading.reading_km,
            reading.recorded_at
           FROM public.odometer_readings reading
          WHERE ((reading.vehicle_id = vehicle.id) AND (reading.record_source = 'customer_entry'::text))
          ORDER BY reading.recorded_at DESC, reading.created_at DESC
         LIMIT 1) latest_reading ON (true))
  WHERE vehicle.archived_at IS NULL
 AND (select auth.uid()) IS NOT NULL
 AND (select private.customer_identity_access_allowed())
 AND (vehicle.customer_id=(select auth.uid()) OR (select private.is_active_staff()));
$body$;
revoke all on function private.free_vehicle_service_summary() from public, anon;
grant execute on function private.free_vehicle_service_summary() to authenticated;
create or replace view public.vehicle_service_summary with (security_invoker=true)
as select * from private.free_vehicle_service_summary();

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
 (select kind,count(*) total from (select r.kind from public.vault_records r where r.customer_id=(select auth.uid()) and r.vehicle_id=p_vehicle_id and r.published_at is not null union all select 'invoice' from public.invoices i where i.customer_id=(select auth.uid()) and i.vehicle_id=p_vehicle_id and i.archived_at is null
 union all select 'dyno' from public.dyno_records d where d.customer_id=(select auth.uid()) and d.vehicle_id=p_vehicle_id and d.archived_at is null
 union all select 'service' from public.repair_records r where r.customer_id=(select auth.uid()) and r.vehicle_id=p_vehicle_id and r.archived_at is null
 union all select 'recommendation' from public.recommended_work w where w.customer_id=(select auth.uid()) and w.vehicle_id=p_vehicle_id and w.archived_at is null) records group by kind) c;

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


create table public.customer_vehicle_notes (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references public.customer_profiles(user_id) on delete cascade,
 vehicle_id uuid not null references public.customer_vehicles(id) on delete cascade,
 body text not null check (length(btrim(body)) between 1 and 4000),
 created_at timestamptz not null default now()
);
comment on table public.customer_vehicle_notes is
 'Free customer-supplied, unverified notes visible to the vehicle owner and authorised PSI staff. Append-only.';
create index customer_vehicle_notes_vehicle_created_idx
 on public.customer_vehicle_notes(vehicle_id, created_at desc);
create index customer_vehicle_notes_customer_idx on public.customer_vehicle_notes(customer_id);
alter table public.customer_vehicle_notes enable row level security;
revoke all on public.customer_vehicle_notes from anon, authenticated;
grant select on public.customer_vehicle_notes to authenticated;
grant insert (customer_id, vehicle_id, body) on public.customer_vehicle_notes to authenticated;
create policy "owners or staff read customer notes" on public.customer_vehicle_notes
for select to authenticated
using ((customer_id=(select auth.uid()) and private.owns_vehicle(vehicle_id))
 or (select private.is_active_staff()));
create policy "owners add customer notes" on public.customer_vehicle_notes
for insert to authenticated
with check (customer_id=(select auth.uid()) and private.owns_vehicle(vehicle_id));
create policy "active identities only for customer notes" on public.customer_vehicle_notes
as restrictive for all to authenticated
using ((select private.customer_identity_access_allowed()))
with check ((select private.customer_identity_access_allowed()));
