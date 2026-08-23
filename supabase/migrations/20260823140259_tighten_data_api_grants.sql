-- Make Data API exposure explicit and least-privileged.
-- RLS remains the row-level boundary; these grants are the independent
-- object-level boundary. Anonymous clients receive no business-table access.

revoke all privileges on all tables in schema public from anon, authenticated;
revoke all privileges on all sequences in schema public from anon, authenticated;
revoke all privileges on all functions in schema public from anon, authenticated;

revoke all privileges on schema public from anon;
revoke create on schema public from authenticated;
grant usage on schema public to authenticated;

grant select on public.staff_members to authenticated;
grant select, insert, update on public.customer_profiles to authenticated;
grant select, insert, update on public.customer_vehicles to authenticated;
grant select, insert, update on public.booking_requests to authenticated;
grant select, insert, update on public.dyno_records to authenticated;
grant select, insert, update on public.repair_records to authenticated;
grant select, insert, update on public.recommended_work to authenticated;
grant select, insert, update on public.invoices to authenticated;
grant select, insert, update on public.vehicle_files to authenticated;
grant select, insert, update on public.booking_calendar_events to authenticated;
grant select on public.audit_events to authenticated;
grant select, insert on public.service_completions to authenticated;
grant select, insert on public.odometer_readings to authenticated;
grant select on public.vehicle_service_summary to authenticated;

-- New public objects must opt in to the Data API deliberately in the migration
-- that creates them. This prevents a future table from inheriting broad access.
alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all privileges on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all privileges on functions from anon, authenticated;
