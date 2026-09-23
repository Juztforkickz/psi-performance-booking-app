-- Keep the owner-only SECURITY DEFINER implementation outside the exposed
-- public API schema. The public RPC is an invoker wrapper, matching the other
-- privileged PSI portal functions.

alter function public.start_customer_performance_trial(uuid) set schema private;

revoke all on function private.start_customer_performance_trial(uuid) from public, anon;
grant execute on function private.start_customer_performance_trial(uuid) to authenticated;

create function public.start_customer_performance_trial(p_customer_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.start_customer_performance_trial(p_customer_id)
$function$;

revoke all on function public.start_customer_performance_trial(uuid) from public, anon;
grant execute on function public.start_customer_performance_trial(uuid) to authenticated;
