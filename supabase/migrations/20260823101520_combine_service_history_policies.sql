-- Combine customer and PSI staff paths so each action evaluates one policy.

drop policy "customers can view own service completions" on public.service_completions;
drop policy "staff can view service completions" on public.service_completions;
create policy "customers or staff can view service completions"
on public.service_completions for select to authenticated
using (
  (select auth.uid()) = customer_id
  or (select private.is_active_staff())
);

drop policy "customers can view own odometer readings" on public.odometer_readings;
drop policy "staff can view odometer readings" on public.odometer_readings;
create policy "customers or staff can view odometer readings"
on public.odometer_readings for select to authenticated
using (
  (select auth.uid()) = customer_id
  or (select private.is_active_staff())
);

drop policy "customers can add own odometer readings" on public.odometer_readings;
drop policy "staff can add PSI odometer readings" on public.odometer_readings;
create policy "customers or staff can add source-bound odometer readings"
on public.odometer_readings for insert to authenticated
with check (
  (
    (select auth.uid()) = customer_id
    and (select auth.uid()) = created_by
    and (select private.owns_vehicle(vehicle_id))
    and record_source = 'customer_entry'
    and service_completion_id is null
  )
  or (
    (select private.is_active_staff())
    and (select auth.uid()) = created_by
    and record_source = 'psi_record'
    and service_completion_id is not null
  )
);
