-- Preserve invoice provenance for verified historical workshop readings.
-- Browser insert policies remain source-bound to service completions.
alter table public.odometer_readings
  add column xero_tenant_id uuid,
  add column xero_invoice_id uuid,
  add column xero_invoice_number text,
  add column xero_date_basis text,
  drop constraint odometer_readings_source_link_check,
  add constraint odometer_readings_source_link_check check (
    (
      xero_tenant_id is null and xero_invoice_id is null
      and xero_invoice_number is null and xero_date_basis is null
      and (
        (record_source = 'psi_record' and service_completion_id is not null)
        or (record_source = 'customer_entry' and service_completion_id is null)
      )
    )
    or (
      record_source = 'psi_record' and service_completion_id is null
      and xero_tenant_id is not null and xero_invoice_id is not null
      and xero_invoice_number is not null and length(btrim(xero_invoice_number)) > 0
      and xero_date_basis is not null and xero_date_basis in ('invoice_date', 'workshop_job_date')
    )
  );

-- One source invoice can only supply one verified vehicle reading.
create unique index odometer_readings_xero_invoice_unique_idx
  on public.odometer_readings (xero_tenant_id, xero_invoice_id)
  where xero_invoice_id is not null;

comment on column public.odometer_readings.xero_date_basis is
  'Historical source date: verified workshop job date where available, otherwise the invoice issue date. Not the import date.';
