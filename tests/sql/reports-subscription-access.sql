-- Only run against the isolated Apple review project. All changes roll back.
update public.performance_subscriptions set status='revoked' where customer_id='060ecb89-838d-4034-b408-3ee7782a6a89';
select set_config('request.jwt.claims','{"sub":"060ecb89-838d-4034-b408-3ee7782a6a89","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
do $test$
declare overview jsonb;
begin
 if exists(select 1 from public.dyno_records) or exists(select 1 from public.repair_records)
 or exists(select 1 from public.recommended_work) or exists(select 1 from public.invoices)
 or exists(select 1 from public.service_completions) or exists(select 1 from public.vault_records)
 then raise exception 'FREE_CONTENT_LEAK'; end if;
 overview:=public.performance_vault_overview('81acc98c-8d30-446d-82e5-c66478ca9da8');
 if overview->>'plan'<>'free' or (overview->'counts'->>'dyno')::int<>1 then raise exception 'FREE_COUNTS_WRONG'; end if;
 if overview::text like '%310%' or overview::text like '%470%' then raise exception 'COUNT_RPC_LEAK'; end if;
 if not exists(select 1 from public.vehicle_service_summary where latest_psi_service_at is not null)
 then raise exception 'FREE_SERVICE_DATES_MISSING'; end if;
 begin
  perform public.performance_vault_overview('d81b7987-1ca4-41ec-8bbd-205f1444f1b8');
  raise exception 'OTHER_VEHICLE_OVERVIEW_EXPOSED';
 exception when insufficient_privilege then null; end;
 insert into public.customer_vehicle_notes(customer_id,vehicle_id,body)
 values ('060ecb89-838d-4034-b408-3ee7782a6a89','81acc98c-8d30-446d-82e5-c66478ca9da8','RLS TEST ONLY - rolled back');
 if not exists(select 1 from public.customer_vehicle_notes where body='RLS TEST ONLY - rolled back') then raise exception 'OWN_NOTE_NOT_SAVED'; end if;
 begin
  insert into public.customer_vehicle_notes(customer_id,vehicle_id,body)
  values ('060ecb89-838d-4034-b408-3ee7782a6a89','d81b7987-1ca4-41ec-8bbd-205f1444f1b8','must fail');
  raise exception 'NOTE_WRONG_VEHICLE_ALLOWED';
 exception when insufficient_privilege then null; end;
 begin
  update public.customer_vehicle_notes set body='altered' where body='RLS TEST ONLY - rolled back';
  raise exception 'NOTE_UPDATE_ALLOWED';
 exception when insufficient_privilege then null; end;
end $test$;
reset role;
insert into public.performance_subscriptions(customer_id,provider,provider_reference,environment,status,expires_at)
values ('060ecb89-838d-4034-b408-3ee7782a6a89','complimentary','reports-transactional-test','production','active',now()+interval '1 day');
set local role authenticated;
do $test$
begin
 if not exists(select 1 from public.dyno_records) or not exists(select 1 from public.repair_records)
 or not exists(select 1 from public.recommended_work) then raise exception 'PAID_ACCESS_MISSING'; end if;
 if exists(select 1 from public.dyno_records where customer_id<>auth.uid()) then raise exception 'PAID_CROSS_CUSTOMER_LEAK'; end if;
 if (public.performance_vault_overview('81acc98c-8d30-446d-82e5-c66478ca9da8')->>'plan')<>'performance_plus'
 then raise exception 'PAID_OVERVIEW_WRONG'; end if;
end $test$;
reset role;
update public.performance_subscriptions set expires_at=now()-interval '1 second'
where provider_reference='reports-transactional-test';
set local role authenticated;
do $test$ begin
 if exists(select 1 from public.dyno_records) then raise exception 'EXPIRED_CONTENT_LEAK'; end if;
 if not exists(select 1 from public.customer_vehicle_notes) then raise exception 'EXPIRY_HID_NOTES'; end if;
end $test$;
reset role;
select set_config('request.jwt.claims','{"sub":"6dcb01a5-6bdf-4477-b646-6a720c86c401","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
do $test$ begin
 if exists(select 1 from public.customer_vehicle_notes where body='RLS TEST ONLY - rolled back') then raise exception 'NOTE_CROSS_CUSTOMER_LEAK'; end if;
 if exists(select 1 from public.vehicle_service_summary where customer_id<>auth.uid()) then raise exception 'SERVICE_DATE_CROSS_CUSTOMER_LEAK'; end if;
end $test$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub','88f9d90b-0452-4478-940d-5cb96a298184','role','authenticated','aal','aal2','iss','https://jwikoldibbpxyhbdrsow.supabase.co/auth/v1','session_id',(select id from auth.sessions where user_id='88f9d90b-0452-4478-940d-5cb96a298184' limit 1))::text,true);
set local role authenticated;
do $test$ begin
 if not exists(select 1 from public.dyno_records where customer_id='060ecb89-838d-4034-b408-3ee7782a6a89') then raise exception 'STAFF_DYNO_MISSING'; end if;
 if not exists(select 1 from public.customer_vehicle_notes where body='RLS TEST ONLY - rolled back') then raise exception 'STAFF_NOTE_MISSING'; end if;
end $test$;
reset role;
select 'PASS: free, paid, expired, staff, cross-customer, notes and free dates' as result;
