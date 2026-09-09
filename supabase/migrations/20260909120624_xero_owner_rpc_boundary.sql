-- Keep privileged owner checks out of the exposed schema; the public RPCs
-- execute with caller privileges and delegate to explicit MFA-checked helpers.
alter function public.begin_xero_oauth(text) set schema private;
alter function public.xero_connection_status() set schema private;
create function public.begin_xero_oauth(p_state_hash text)
returns void language sql security invoker set search_path='' as $$
 select private.begin_xero_oauth(p_state_hash)
$$;
create function public.xero_connection_status()
returns jsonb language sql stable security invoker set search_path='' as $$
 select private.xero_connection_status()
$$;
revoke all on function public.begin_xero_oauth(text) from public,anon,authenticated;
revoke all on function public.xero_connection_status() from public,anon,authenticated;
grant execute on function public.begin_xero_oauth(text) to authenticated;
grant execute on function public.xero_connection_status() to authenticated;
create index xero_oauth_states_owner_idx on private.xero_oauth_states(owner_id);
create index xero_connections_owner_idx on private.xero_connections(owner_id);
