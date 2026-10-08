-- Complete the historical import entitlement boundary and keep the public RPC
-- as a security invoker wrapper around the private AAL2 protected operation.

drop policy if exists "invoice subscription requirement" on public.invoices;
create policy "invoice subscription requirement"
on public.invoices as restrictive for select to authenticated
using (
  (record_source = 'customer_entry' and customer_id = (select auth.uid()))
  or (select private.has_performance_plus())
  or private.has_completed_historical_import(vehicle_id)
  or (select private.is_active_staff())
);

create index historical_import_vehicle_customer_idx
  on public.historical_import_requests (vehicle_id, customer_id);
create index historical_import_assigned_idx
  on public.historical_import_requests (assigned_to)
  where assigned_to is not null;

alter function public.review_historical_import_request(uuid, text, text, integer)
  set schema private;

create function public.review_historical_import_request(
  p_request_id uuid,
  p_status text,
  p_staff_note text default null,
  p_imported_item_count integer default 0
)
returns public.historical_import_requests
language sql
security invoker
set search_path = ''
as $$
  select private.review_historical_import_request(
    p_request_id,
    p_status,
    p_staff_note,
    p_imported_item_count
  )
$$;

revoke all on function private.review_historical_import_request(uuid, text, text, integer)
from public, anon;
grant execute on function private.review_historical_import_request(uuid, text, text, integer)
to authenticated;
revoke all on function public.review_historical_import_request(uuid, text, text, integer)
from public, anon;
grant execute on function public.review_historical_import_request(uuid, text, text, integer)
to authenticated;
