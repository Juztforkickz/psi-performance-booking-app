-- Preserve record authorship and limit normal staff edits to records they
-- created. The PSI owner retains an explicit operational/privacy override.

create or replace function private.prevent_created_by_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'created_by cannot be changed';
  end if;
  return new;
end;
$$;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'customer_vehicles',
    'booking_requests',
    'dyno_records',
    'repair_records',
    'recommended_work',
    'invoices',
    'vehicle_files'
  ] loop
    execute format('drop trigger if exists preserve_created_by on public.%I', target_table);
    execute format(
      'create trigger preserve_created_by before update on public.%I for each row execute function private.prevent_created_by_change()',
      target_table
    );
  end loop;
end;
$$;

drop policy if exists "staff can update customer profiles" on public.customer_profiles;
create policy "owner can update customer profiles"
on public.customer_profiles for update to authenticated
using ((select private.is_owner_staff()))
with check ((select private.is_owner_staff()));

drop policy if exists "staff can update customer vehicles" on public.customer_vehicles;
create policy "staff creators or owner can update customer vehicles"
on public.customer_vehicles for update to authenticated
using (
  (select private.is_active_staff())
  and ((select auth.uid()) = created_by or (select private.is_owner_staff()))
)
with check (
  (select private.is_active_staff())
  and ((select auth.uid()) = created_by or (select private.is_owner_staff()))
);

drop policy if exists "staff can update dyno records" on public.dyno_records;
create policy "staff creators or owner can update dyno records"
on public.dyno_records for update to authenticated
using (
  (select private.is_active_staff())
  and ((select auth.uid()) = created_by or (select private.is_owner_staff()))
)
with check (
  (select private.is_active_staff())
  and ((select auth.uid()) = created_by or (select private.is_owner_staff()))
);

drop policy if exists "staff can update repair records" on public.repair_records;
create policy "staff creators or owner can update repair records"
on public.repair_records for update to authenticated
using (
  (select private.is_active_staff())
  and ((select auth.uid()) = created_by or (select private.is_owner_staff()))
)
with check (
  (select private.is_active_staff())
  and ((select auth.uid()) = created_by or (select private.is_owner_staff()))
);

drop policy if exists "staff can update recommended work" on public.recommended_work;
create policy "staff creators or owner can update recommended work"
on public.recommended_work for update to authenticated
using (
  (select private.is_active_staff())
  and ((select auth.uid()) = created_by or (select private.is_owner_staff()))
)
with check (
  (select private.is_active_staff())
  and ((select auth.uid()) = created_by or (select private.is_owner_staff()))
);

drop policy if exists "staff can update invoices" on public.invoices;
create policy "staff creators or owner can update invoices"
on public.invoices for update to authenticated
using (
  (select private.is_active_staff())
  and ((select auth.uid()) = created_by or (select private.is_owner_staff()))
)
with check (
  (select private.is_active_staff())
  and ((select auth.uid()) = created_by or (select private.is_owner_staff()))
  and currency = 'AUD'
);

drop policy if exists "staff can update vehicle file metadata" on public.vehicle_files;
create policy "staff creators or owner can update vehicle file metadata"
on public.vehicle_files for update to authenticated
using (
  (select private.is_active_staff())
  and ((select auth.uid()) = created_by or (select private.is_owner_staff()))
)
with check (
  (select private.is_active_staff())
  and ((select auth.uid()) = created_by or (select private.is_owner_staff()))
);

drop policy if exists "staff can replace customer private files" on storage.objects;
create policy "staff uploaders or owner can replace private files"
on storage.objects for update to authenticated
using (
  bucket_id in ('vehicle-photos', 'vehicle-documents')
  and (select private.is_active_staff())
  and (owner_id = (select auth.uid())::text or (select private.is_owner_staff()))
)
with check (
  bucket_id in ('vehicle-photos', 'vehicle-documents')
  and (select private.is_active_staff())
  and (owner_id = (select auth.uid())::text or (select private.is_owner_staff()))
);

drop policy if exists "staff can remove customer private files" on storage.objects;
create policy "staff uploaders or owner can remove private files"
on storage.objects for delete to authenticated
using (
  bucket_id in ('vehicle-photos', 'vehicle-documents')
  and (select private.is_active_staff())
  and (owner_id = (select auth.uid())::text or (select private.is_owner_staff()))
);
