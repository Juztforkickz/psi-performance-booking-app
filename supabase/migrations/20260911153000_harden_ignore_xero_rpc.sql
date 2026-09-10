-- Keep the owner-checked mutating implementation outside the exposed schema.
alter function public.ignore_xero_import(uuid) set schema private;

revoke all on function private.ignore_xero_import(uuid)
from public, anon, authenticated;
grant execute on function private.ignore_xero_import(uuid) to authenticated;

create function public.ignore_xero_import(p_queue_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.ignore_xero_import(p_queue_id)
$$;

revoke all on function public.ignore_xero_import(uuid)
from public, anon, authenticated;
grant execute on function public.ignore_xero_import(uuid) to authenticated;
