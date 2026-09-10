-- Keep the privileged Xero match implementation out of the exposed schema.
-- The public RPC remains a caller-privilege wrapper and the private function
-- continues to enforce active owner access and AAL2 before changing a match.
alter function public.confirm_xero_import_match(uuid, uuid, uuid) set schema private;

revoke all on function private.confirm_xero_import_match(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.confirm_xero_import_match(uuid, uuid, uuid)
  to authenticated;

create function public.confirm_xero_import_match(
  p_queue_id uuid,
  p_customer_id uuid,
  p_job_id uuid
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.confirm_xero_import_match(p_queue_id, p_customer_id, p_job_id)
$$;

revoke all on function public.confirm_xero_import_match(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.confirm_xero_import_match(uuid, uuid, uuid)
  to authenticated;

-- Cover both sides of the existing composite foreign keys so parent updates
-- and deletes do not require sequential scans as the vault grows.
create index if not exists vault_assets_record_customer_vehicle_idx
  on public.vault_assets(record_id, customer_id, vehicle_id);

create index if not exists vault_records_job_customer_vehicle_idx
  on public.vault_records(job_id, customer_id, vehicle_id);
