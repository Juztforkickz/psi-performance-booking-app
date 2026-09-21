-- A customer can choose any of their active vehicles, including a PSI-created
-- vehicle, without gaining permission to edit PSI-verified vehicle details.
create or replace function public.customer_set_primary_vehicle(p_vehicle_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid := (select auth.uid());
begin
  if v_customer_id is null then raise exception 'Sign in to manage your garage.'; end if;
  perform 1 from public.customer_profiles
   where user_id = v_customer_id and account_state = 'active' for update;
  if not found then raise exception 'Customer account is unavailable.'; end if;
  perform 1 from public.customer_vehicles
   where id = p_vehicle_id and customer_id = v_customer_id and archived_at is null;
  if not found then raise exception 'Vehicle is not in your garage.'; end if;
  update public.customer_vehicles set is_primary = false
   where customer_id = v_customer_id and is_primary and archived_at is null
     and id <> p_vehicle_id;
  update public.customer_vehicles set is_primary = true
   where id = p_vehicle_id and customer_id = v_customer_id and archived_at is null;
end;
$$;

-- Only a customer-created secondary vehicle with no booking or PSI history can
-- be hidden. This preserves workshop records and keeps the operation reversible.
create or replace function public.customer_archive_vehicle(p_vehicle_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid := (select auth.uid());
  v_vehicle public.customer_vehicles%rowtype;
  v_reference record;
  v_exists boolean;
begin
  if v_customer_id is null then raise exception 'Sign in to manage your garage.'; end if;
  perform 1 from public.customer_profiles
   where user_id = v_customer_id and account_state = 'active' for update;
  if not found then raise exception 'Customer account is unavailable.'; end if;
  select * into v_vehicle from public.customer_vehicles
   where id = p_vehicle_id and customer_id = v_customer_id and archived_at is null for update;
  if not found then raise exception 'Vehicle is not in your garage.'; end if;
  if v_vehicle.is_primary then raise exception 'Choose another primary vehicle first.'; end if;
  if v_vehicle.created_by <> v_customer_id then
    raise exception 'PSI-created vehicles can only be removed by PSI.';
  end if;

  -- Look for all direct references, including future workshop tables. Personal
  -- vehicle photos and illustration choices do not block an archive.
  for v_reference in
    select n.nspname as schema_name, c.relname as table_name, a.attname as column_name
      from pg_catalog.pg_constraint fk
      join pg_catalog.pg_class c on c.oid = fk.conrelid
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      join pg_catalog.pg_attribute a on a.attrelid = fk.conrelid and a.attnum = fk.conkey[1]
     where fk.contype = 'f' and fk.confrelid = 'public.customer_vehicles'::regclass
       and cardinality(fk.conkey) = 1
       and n.nspname = 'public'
       and c.relname not in ('vehicle_display_preferences', 'vehicle_files')
  loop
    execute format('select exists(select 1 from %I.%I where %I = $1)',
      v_reference.schema_name, v_reference.table_name, v_reference.column_name)
      into v_exists using p_vehicle_id;
    if v_exists then raise exception 'This vehicle has saved activity or PSI records. Ask PSI to remove it safely.'; end if;
  end loop;

  -- A customer photo is also an attachment. Keep its metadata and object for
  -- possible recovery; do not delete any private storage content here.
  if exists (select 1 from public.vehicle_files
    where vehicle_id = p_vehicle_id and archived_at is null
      and not (record_source = 'customer_entry' and file_kind = 'vehicle_photo')) then
    raise exception 'This vehicle has saved files. Ask PSI to remove it safely.';
  end if;
  update public.customer_vehicles set archived_at = now(), is_primary = false
    where id = p_vehicle_id and customer_id = v_customer_id;
end;
$$;

revoke all on function public.customer_set_primary_vehicle(uuid) from public, anon;
revoke all on function public.customer_archive_vehicle(uuid) from public, anon;
grant execute on function public.customer_set_primary_vehicle(uuid) to authenticated;
grant execute on function public.customer_archive_vehicle(uuid) to authenticated;
