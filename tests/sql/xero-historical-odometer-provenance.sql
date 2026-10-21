-- Read-only fixtures evaluate the actual installed source constraint.
-- No customer records, session claims or permissions are changed.
do $test$
declare expression text; failed_count integer;
begin
  select pg_get_expr(conbin,conrelid) into expression from pg_constraint
  where conrelid='public.odometer_readings'::regclass
    and conname='odometer_readings_source_link_check';
  if expression is null then raise exception 'Odometer source constraint is missing'; end if;
  execute format(
    'select count(*) from (
      select coalesce((%s),false)=fixtures.expected as passed
      from jsonb_to_recordset($1) as fixtures(label text,payload jsonb,expected boolean)
      cross join lateral jsonb_populate_record(null::public.odometer_readings,fixtures.payload) reading
    ) checks where not passed',expression)
  into failed_count using '[{"label":"customer","payload":{"record_source":"customer_entry"},"expected":true},{"label":"completion","payload":{"record_source":"psi_record","service_completion_id":"00000000-0000-4000-8000-000000000001"},"expected":true},{"label":"date invoice_date","payload":{"record_source":"psi_record","xero_tenant_id":"00000000-0000-4000-8000-000000000001","xero_invoice_id":"00000000-0000-4000-8000-000000000002","xero_invoice_number":"INV-FICTIONAL","xero_date_basis":"invoice_date"},"expected":true},{"label":"date workshop_job_date","payload":{"record_source":"psi_record","xero_tenant_id":"00000000-0000-4000-8000-000000000001","xero_invoice_id":"00000000-0000-4000-8000-000000000002","xero_invoice_number":"INV-FICTIONAL","xero_date_basis":"workshop_job_date"},"expected":true},{"label":"date null","payload":{"record_source":"psi_record","xero_tenant_id":"00000000-0000-4000-8000-000000000001","xero_invoice_id":"00000000-0000-4000-8000-000000000002","xero_invoice_number":"INV-FICTIONAL","xero_date_basis":null},"expected":false},{"label":"date upload_date","payload":{"record_source":"psi_record","xero_tenant_id":"00000000-0000-4000-8000-000000000001","xero_invoice_id":"00000000-0000-4000-8000-000000000002","xero_invoice_number":"INV-FICTIONAL","xero_date_basis":"upload_date"},"expected":false},{"label":"unbound workshop","payload":{"record_source":"psi_record"},"expected":false},{"label":"partial source","payload":{"record_source":"psi_record","xero_invoice_id":"00000000-0000-4000-8000-000000000002"},"expected":false},{"label":"customer source forgery","payload":{"record_source":"customer_entry","xero_tenant_id":"00000000-0000-4000-8000-000000000001","xero_invoice_id":"00000000-0000-4000-8000-000000000002","xero_invoice_number":"INV-FICTIONAL","xero_date_basis":"invoice_date"},"expected":false}]'::jsonb;
  if failed_count<>0 then raise exception '% source constraint fixtures failed',failed_count; end if;
  if not exists (
    select 1 from pg_index
    where indexrelid='public.odometer_readings_xero_invoice_unique_idx'::regclass
      and indisunique and indisvalid
  ) then raise exception 'Unique source invoice index is missing or invalid'; end if;
end
$test$;
