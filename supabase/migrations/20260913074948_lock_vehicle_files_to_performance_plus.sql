-- Keep the everyday PSI account useful while reserving the permanent file
-- archive for Performance+. Vehicle profile photos remain part of PSI Free;
-- every document, invoice image, dyno graph and repair attachment requires a
-- current entitlement. PSI staff keep their existing operational access.

drop policy if exists "invoice file subscription requirement" on public.vehicle_files;
drop policy if exists "performance plus vehicle file reads" on public.vehicle_files;
create policy "performance plus vehicle file reads"
on public.vehicle_files as restrictive for select to authenticated
using (
  file_kind = 'vehicle_photo'
  or (select private.has_performance_plus())
  or (select private.is_active_staff())
);

drop policy if exists "performance plus vehicle document uploads" on public.vehicle_files;
create policy "performance plus vehicle document uploads"
on public.vehicle_files as restrictive for insert to authenticated
with check (
  file_kind = 'vehicle_photo'
  or (select private.has_performance_plus())
  or (select private.is_active_staff())
);

-- Storage stays private. These restrictive policies sit alongside the
-- existing ownership policies, so a subscription never grants access to
-- another customer's path.
drop policy if exists "performance plus document object reads" on storage.objects;
create policy "performance plus document object reads"
on storage.objects as restrictive for select to authenticated
using (
  bucket_id <> 'vehicle-documents'
  or (select private.has_performance_plus())
  or (select private.is_active_staff())
);

drop policy if exists "performance plus document object uploads" on storage.objects;
create policy "performance plus document object uploads"
on storage.objects as restrictive for insert to authenticated
with check (
  bucket_id <> 'vehicle-documents'
  or (select private.has_performance_plus())
  or (select private.is_active_staff())
);
