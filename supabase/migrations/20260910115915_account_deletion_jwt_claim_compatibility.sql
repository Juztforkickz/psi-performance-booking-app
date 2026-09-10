-- Modern PostgREST supplies JSON JWT claims. The original deletion procedures
-- read a legacy per-claim setting, rejecting genuine service-role API requests.
-- Replace only that check so each installation retains its approved owner and
-- cleanup rules (the isolated Apple review project has a different owner).
do $$
declare
  target regprocedure;
  definition text;
  legacy_guard constant text := 'coalesce(current_setting(''request.jwt.claim.role'', true), '''')';
  supported_guard constant text := 'coalesce(auth.jwt() ->> ''role'', '''')';
begin
  foreach target in array array[
    'public.begin_customer_account_deletion(uuid,uuid,text)'::regprocedure,
    'public.complete_customer_account_data(uuid,uuid)'::regprocedure,
    'public.finish_customer_account_deletion(uuid,uuid)'::regprocedure
  ] loop
    -- Assert the existing boundary; this repair must never change privileges.
    if has_function_privilege('anon', target, 'EXECUTE')
      or has_function_privilege('authenticated', target, 'EXECUTE')
      or not has_function_privilege('service_role', target, 'EXECUTE') then
      raise exception 'Unexpected deletion execution privileges: %', target;
    end if;
    definition := pg_get_functiondef(target);
    if strpos(definition, legacy_guard) > 0 then
      execute replace(definition, legacy_guard, supported_guard);
    elsif strpos(definition, supported_guard) = 0 then
      raise exception 'Unexpected deletion authorization definition: %', target;
    end if;
  end loop;
end
$$;
