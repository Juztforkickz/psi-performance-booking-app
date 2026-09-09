-- Run in the isolated sandbox only. Uses an existing owner without altering it.
-- Every temporary state/connection change is rolled back.
begin;
do $$ begin
 perform set_config('psi.test_owner',coalesce((select user_id::text from public.staff_members where role='owner' and status='active' limit 1),''),true);
 perform set_config('psi.test_session',coalesce((select id::text from auth.sessions where user_id=current_setting('psi.test_owner')::uuid limit 1),''),true);
end $$;
do $$ begin
 if current_setting('psi.test_owner')='' then raise exception 'test_requires_existing_owner'; end if;
 if has_table_privilege('authenticated','private.xero_connections','SELECT') then raise exception 'customer_tokens_exposed'; end if;
 if has_function_privilege('authenticated','public.save_xero_connection(uuid,uuid,text)','EXECUTE') then raise exception 'customer_token_write_exposed'; end if;
 if has_function_privilege('authenticated','public.consume_xero_oauth(text)','EXECUTE') then raise exception 'customer_state_consumption_exposed'; end if;
 if has_function_privilege('anon','public.begin_xero_oauth(text)','EXECUTE') then raise exception 'anonymous_start_exposed'; end if;
end $$;
set local role authenticated;
do $$ begin
 perform set_config('request.jwt.claim.sub',current_setting('psi.test_owner'),true);
 perform set_config('request.jwt.claims',json_build_object('sub',current_setting('psi.test_owner'),'role','authenticated','aal','aal1','iss','https://jwikoldibbpxyhbdrsow.supabase.co/auth/v1','session_id',current_setting('psi.test_session'))::text,true);
end $$;
do $$ begin
 begin perform public.begin_xero_oauth(repeat('a',64)); raise exception 'owner_without_mfa_allowed'; exception when insufficient_privilege then null; end;
 begin perform public.xero_connection_status(); raise exception 'status_without_mfa_allowed'; exception when insufficient_privilege then null; end;
end $$;
do $$ begin
 perform set_config('request.jwt.claims',json_build_object('sub',current_setting('psi.test_owner'),'role','authenticated','aal','aal2','iss','https://jwikoldibbpxyhbdrsow.supabase.co/auth/v1','session_id',current_setting('psi.test_session'))::text,true);
end $$;
select public.begin_xero_oauth(repeat('a',64));
select public.xero_connection_status();
reset role;
set local role service_role;
do $$ declare first_owner uuid; second_owner uuid; begin
 first_owner:=public.consume_xero_oauth(repeat('a',64));
 second_owner:=public.consume_xero_oauth(repeat('a',64));
 if first_owner::text is distinct from current_setting('psi.test_owner') or second_owner is not null then raise exception 'state_not_single_use'; end if;
end $$;
reset role;
insert into private.xero_oauth_states(state_hash,owner_id,expires_at) values(repeat('b',64),current_setting('psi.test_owner')::uuid,now()-interval '1 minute');
set local role service_role;
do $$ begin
 if public.consume_xero_oauth(repeat('b',64)) is not null then raise exception 'expired_state_accepted'; end if;
end $$;
reset role;
set local role service_role;
select public.stage_xero_connection('10000000-0000-4000-8000-000000000001','PSI TEST ONLY',current_setting('psi.test_owner')::uuid,repeat('encrypted-test-only-',4));
reset role;
set local role authenticated;
do $$ declare candidates jsonb; begin
 candidates:=public.xero_connection_candidates();
 if candidates::text like '%encrypted-test-only%' then raise exception 'candidate_tokens_exposed'; end if;
 if jsonb_array_length(candidates)<>1 then raise exception 'candidate_missing'; end if;
 perform public.confirm_xero_organisation('10000000-0000-4000-8000-000000000001');
 if jsonb_array_length(public.xero_connection_candidates())<>0 then raise exception 'confirmed_candidate_not_consumed'; end if;
 if jsonb_array_length(public.xero_connection_status())<>1 then raise exception 'confirmed_connection_missing'; end if;
end $$;
reset role;
select 'Xero owner MFA, token access, state expiry and replay checks passed' as result;
rollback;
