-- Signed-in customers can keep clearly labelled, unverified vehicle-history
-- entries. PSI-published records retain their separate staff-only boundary.
alter table public.invoices
  add column if not exists record_source text not null default 'psi_record'
  check (record_source in ('psi_record', 'customer_entry'));

-- Customer history is append-only after it is saved. Corrections are added as
-- a new record so the original audit trail cannot be silently rewritten.
drop policy if exists "customers can update own unverified dyno records" on public.dyno_records;
drop policy if exists "customers can update own repair entries" on public.repair_records;
drop policy if exists "customers can update own recommendation notes" on public.recommended_work;

drop policy if exists "invoice subscription requirement" on public.invoices;
create policy "invoice subscription requirement"
on public.invoices as restrictive for select to authenticated
using (
  (record_source = 'customer_entry' and customer_id = (select auth.uid()))
  or (select private.has_performance_plus())
  or (select private.is_active_staff())
);

drop policy if exists "customers can create own invoice records" on public.invoices;
create policy "customers can create own invoice records"
on public.invoices for insert to authenticated
with check (
  customer_id = (select auth.uid())
  and created_by = (select auth.uid())
  and record_source = 'customer_entry'
  and currency = 'AUD'
  and (select private.owns_vehicle(vehicle_id))
);

drop policy if exists "staff can create invoices" on public.invoices;
create policy "staff can create invoices"
on public.invoices for insert to authenticated
with check (
  (select private.is_active_staff())
  and created_by = (select auth.uid())
  and record_source = 'psi_record'
  and currency = 'AUD'
  and exists (
    select 1 from public.customer_vehicles vehicle
    where vehicle.id = invoices.vehicle_id
      and vehicle.customer_id = invoices.customer_id
      and vehicle.archived_at is null
  )
);

drop policy if exists "staff creators or owner can update invoices" on public.invoices;
create policy "staff creators or owner can update invoices"
on public.invoices for update to authenticated
using (
  (select private.is_active_staff())
  and ((select auth.uid()) = created_by or (select private.is_owner_staff()))
  and record_source = 'psi_record'
)
with check (
  (select private.is_active_staff())
  and ((select auth.uid()) = created_by or (select private.is_owner_staff()))
  and record_source = 'psi_record'
  and currency = 'AUD'
  and exists (
    select 1 from public.customer_vehicles vehicle
    where vehicle.id = invoices.vehicle_id
      and vehicle.customer_id = invoices.customer_id
      and vehicle.archived_at is null
  )
);

drop policy if exists "invoice file subscription requirement" on public.vehicle_files;
create policy "invoice file subscription requirement"
on public.vehicle_files as restrictive for select to authenticated
using (
  file_kind <> 'invoice'
  or (record_source = 'customer_entry' and customer_id = (select auth.uid()))
  or (select private.has_performance_plus())
  or (select private.is_active_staff())
);

drop policy if exists "customers can create local file metadata" on public.vehicle_files;
create policy "customers can create local file metadata"
on public.vehicle_files for insert to authenticated
with check (
  customer_id = (select auth.uid())
  and created_by = (select auth.uid())
  and record_source = 'customer_entry'
  and split_part(object_path, '/', 1) = (select auth.uid())::text
  and (select private.owns_vehicle(vehicle_id))
  and (
    (file_kind = 'vehicle_photo' and bucket_id = 'vehicle-photos' and invoice_id is null and dyno_record_id is null)
    or (
      file_kind = 'dyno_graph'
      and bucket_id = 'vehicle-documents'
      and invoice_id is null
      and exists (
        select 1 from public.dyno_records dyno
        where dyno.id = vehicle_files.dyno_record_id
          and dyno.customer_id = vehicle_files.customer_id
          and dyno.vehicle_id = vehicle_files.vehicle_id
          and dyno.created_by = (select auth.uid())
          and dyno.record_source = 'customer_entry'
          and dyno.archived_at is null
      )
    )
    or (
      file_kind = 'invoice'
      and bucket_id = 'vehicle-documents'
      and dyno_record_id is null
      and exists (
        select 1 from public.invoices invoice
        where invoice.id = vehicle_files.invoice_id
          and invoice.customer_id = vehicle_files.customer_id
          and invoice.vehicle_id = vehicle_files.vehicle_id
          and invoice.created_by = (select auth.uid())
          and invoice.record_source = 'customer_entry'
          and invoice.archived_at is null
      )
    )
    or (file_kind = 'repair_document' and bucket_id = 'vehicle-documents' and invoice_id is null and dyno_record_id is null)
  )
);

-- Saved report attachments are append-only. Vehicle profile photos retain the
-- existing replacement/archive path used by My Garage.
drop policy if exists "customers can update own file metadata" on public.vehicle_files;
create policy "customers can update own vehicle photo metadata"
on public.vehicle_files for update to authenticated
using (
  customer_id = (select auth.uid())
  and created_by = (select auth.uid())
  and record_source = 'customer_entry'
  and file_kind = 'vehicle_photo'
  and bucket_id = 'vehicle-photos'
)
with check (
  customer_id = (select auth.uid())
  and created_by = (select auth.uid())
  and record_source = 'customer_entry'
  and file_kind = 'vehicle_photo'
  and bucket_id = 'vehicle-photos'
  and invoice_id is null
  and dyno_record_id is null
  and split_part(object_path, '/', 1) = (select auth.uid())::text
  and (select private.owns_vehicle(vehicle_id))
);

-- Customers may still clean up an upload that failed before metadata was
-- created. Once a document is linked to a report record, only PSI can alter
-- the stored object. Vehicle profile photos retain their existing controls.
drop policy if exists "customers can replace own private files" on storage.objects;
create policy "customers can replace own private files"
on storage.objects for update to authenticated
using (
  bucket_id = 'vehicle-photos'
  and owner_id = (select auth.uid())::text
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'vehicle-photos'
  and owner_id = (select auth.uid())::text
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "customers can remove own private files" on storage.objects;
create policy "customers can remove own private files"
on storage.objects for delete to authenticated
using (
  owner_id = (select auth.uid())::text
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (
    bucket_id = 'vehicle-photos'
    or (
      bucket_id = 'vehicle-documents'
      and not exists (
        select 1 from public.vehicle_files file
        where file.bucket_id = storage.objects.bucket_id
          and file.object_path = storage.objects.name
          and file.archived_at is null
      )
    )
  )
);
