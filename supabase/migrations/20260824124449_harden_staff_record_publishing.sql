-- Keep AAL2 staff publishing internally consistent. These checks prevent an
-- authorised workshop user from accidentally pairing one customer's record,
-- vehicle or private attachment with another customer's account.

drop policy if exists "staff can create dyno records" on public.dyno_records;
create policy "staff can create dyno records"
on public.dyno_records for insert to authenticated
with check (
  (select private.is_active_staff())
  and (select auth.uid()) = created_by
  and record_source = 'psi_verified'
  and exists (
    select 1
    from public.customer_vehicles vehicle
    where vehicle.id = dyno_records.vehicle_id
      and vehicle.customer_id = dyno_records.customer_id
      and vehicle.archived_at is null
  )
);

drop policy if exists "staff creators or owner can update dyno records" on public.dyno_records;
create policy "staff creators or owner can update dyno records"
on public.dyno_records for update to authenticated
using (
  (select private.is_active_staff())
  and ((select auth.uid()) = created_by or (select private.is_owner_staff()))
  and record_source = 'psi_verified'
)
with check (
  (select private.is_active_staff())
  and ((select auth.uid()) = created_by or (select private.is_owner_staff()))
  and record_source = 'psi_verified'
  and exists (
    select 1
    from public.customer_vehicles vehicle
    where vehicle.id = dyno_records.vehicle_id
      and vehicle.customer_id = dyno_records.customer_id
      and vehicle.archived_at is null
  )
);

drop policy if exists "staff can create repair records" on public.repair_records;
create policy "staff can create repair records"
on public.repair_records for insert to authenticated
with check (
  (select private.is_active_staff())
  and (select auth.uid()) = created_by
  and record_source = 'psi_record'
  and exists (
    select 1
    from public.customer_vehicles vehicle
    where vehicle.id = repair_records.vehicle_id
      and vehicle.customer_id = repair_records.customer_id
      and vehicle.archived_at is null
  )
);

drop policy if exists "staff creators or owner can update repair records" on public.repair_records;
create policy "staff creators or owner can update repair records"
on public.repair_records for update to authenticated
using (
  (select private.is_active_staff())
  and ((select auth.uid()) = created_by or (select private.is_owner_staff()))
  and record_source = 'psi_record'
)
with check (
  (select private.is_active_staff())
  and ((select auth.uid()) = created_by or (select private.is_owner_staff()))
  and record_source = 'psi_record'
  and exists (
    select 1
    from public.customer_vehicles vehicle
    where vehicle.id = repair_records.vehicle_id
      and vehicle.customer_id = repair_records.customer_id
      and vehicle.archived_at is null
  )
);

drop policy if exists "staff can create recommended work" on public.recommended_work;
create policy "staff can create recommended work"
on public.recommended_work for insert to authenticated
with check (
  (select private.is_active_staff())
  and (select auth.uid()) = created_by
  and record_source = 'psi_record'
  and exists (
    select 1
    from public.customer_vehicles vehicle
    where vehicle.id = recommended_work.vehicle_id
      and vehicle.customer_id = recommended_work.customer_id
      and vehicle.archived_at is null
  )
);

drop policy if exists "staff creators or owner can update recommended work" on public.recommended_work;
create policy "staff creators or owner can update recommended work"
on public.recommended_work for update to authenticated
using (
  (select private.is_active_staff())
  and ((select auth.uid()) = created_by or (select private.is_owner_staff()))
  and record_source = 'psi_record'
)
with check (
  (select private.is_active_staff())
  and ((select auth.uid()) = created_by or (select private.is_owner_staff()))
  and record_source = 'psi_record'
  and exists (
    select 1
    from public.customer_vehicles vehicle
    where vehicle.id = recommended_work.vehicle_id
      and vehicle.customer_id = recommended_work.customer_id
      and vehicle.archived_at is null
  )
);

drop policy if exists "staff can create invoices" on public.invoices;
create policy "staff can create invoices"
on public.invoices for insert to authenticated
with check (
  (select private.is_active_staff())
  and (select auth.uid()) = created_by
  and currency = 'AUD'
  and exists (
    select 1
    from public.customer_vehicles vehicle
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
)
with check (
  (select private.is_active_staff())
  and ((select auth.uid()) = created_by or (select private.is_owner_staff()))
  and currency = 'AUD'
  and exists (
    select 1
    from public.customer_vehicles vehicle
    where vehicle.id = invoices.vehicle_id
      and vehicle.customer_id = invoices.customer_id
      and vehicle.archived_at is null
  )
);

drop policy if exists "staff can create vehicle file metadata" on public.vehicle_files;
create policy "staff can create vehicle file metadata"
on public.vehicle_files for insert to authenticated
with check (
  (select private.is_active_staff())
  and (select auth.uid()) = created_by
  and record_source = 'psi_record'
  and split_part(object_path, '/', 1) = vehicle_files.customer_id::text
  and exists (
    select 1
    from public.customer_vehicles vehicle
    where vehicle.id = vehicle_files.vehicle_id
      and vehicle.customer_id = vehicle_files.customer_id
      and vehicle.archived_at is null
  )
  and (
    (
      file_kind = 'invoice'
      and bucket_id = 'vehicle-documents'
      and exists (
        select 1
        from public.invoices invoice
        where invoice.id = vehicle_files.invoice_id
          and invoice.customer_id = vehicle_files.customer_id
          and invoice.vehicle_id = vehicle_files.vehicle_id
          and invoice.archived_at is null
      )
    )
    or (
      file_kind = 'dyno_graph'
      and bucket_id = 'vehicle-documents'
      and exists (
        select 1
        from public.dyno_records dyno
        where dyno.id = vehicle_files.dyno_record_id
          and dyno.customer_id = vehicle_files.customer_id
          and dyno.vehicle_id = vehicle_files.vehicle_id
          and dyno.record_source = 'psi_verified'
          and dyno.archived_at is null
      )
    )
    or (file_kind = 'vehicle_photo' and bucket_id = 'vehicle-photos')
    or (file_kind = 'repair_document' and bucket_id = 'vehicle-documents')
  )
);

drop policy if exists "staff creators or owner can update vehicle file metadata" on public.vehicle_files;
create policy "staff creators or owner can update vehicle file metadata"
on public.vehicle_files for update to authenticated
using (
  (select private.is_active_staff())
  and ((select auth.uid()) = created_by or (select private.is_owner_staff()))
  and record_source = 'psi_record'
)
with check (
  (select private.is_active_staff())
  and ((select auth.uid()) = created_by or (select private.is_owner_staff()))
  and record_source = 'psi_record'
  and split_part(object_path, '/', 1) = vehicle_files.customer_id::text
  and exists (
    select 1
    from public.customer_vehicles vehicle
    where vehicle.id = vehicle_files.vehicle_id
      and vehicle.customer_id = vehicle_files.customer_id
      and vehicle.archived_at is null
  )
  and (
    (
      file_kind = 'invoice'
      and bucket_id = 'vehicle-documents'
      and exists (
        select 1
        from public.invoices invoice
        where invoice.id = vehicle_files.invoice_id
          and invoice.customer_id = vehicle_files.customer_id
          and invoice.vehicle_id = vehicle_files.vehicle_id
          and invoice.archived_at is null
      )
    )
    or (
      file_kind = 'dyno_graph'
      and bucket_id = 'vehicle-documents'
      and exists (
        select 1
        from public.dyno_records dyno
        where dyno.id = vehicle_files.dyno_record_id
          and dyno.customer_id = vehicle_files.customer_id
          and dyno.vehicle_id = vehicle_files.vehicle_id
          and dyno.record_source = 'psi_verified'
          and dyno.archived_at is null
      )
    )
    or (file_kind = 'vehicle_photo' and bucket_id = 'vehicle-photos')
    or (file_kind = 'repair_document' and bucket_id = 'vehicle-documents')
  )
);

drop policy if exists "staff can upload customer private files" on storage.objects;
create policy "staff can upload customer private files"
on storage.objects for insert to authenticated
with check (
  bucket_id in ('vehicle-photos', 'vehicle-documents')
  and (select private.is_active_staff())
  and exists (
    select 1
    from public.customer_profiles customer
    where customer.user_id::text = (storage.foldername(name))[1]
      and customer.account_state = 'active'
  )
);
