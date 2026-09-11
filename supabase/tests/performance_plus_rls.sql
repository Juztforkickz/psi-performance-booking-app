begin;
insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('a4100000-0000-4000-8000-000000000001','authenticated','authenticated','vault-a@example.invalid',now(),'{}','{}',now(),now()),
('a4100000-0000-4000-8000-000000000002','authenticated','authenticated','vault-b@example.invalid',now(),'{}','{}',now(),now());
insert into public.customer_vehicles(id,customer_id,registration,year,make,model,created_by)
values('a4200000-0000-4000-8000-000000000001','a4100000-0000-4000-8000-000000000001','VAULTA',2026,'Test','A','a4100000-0000-4000-8000-000000000001'),('a4200000-0000-4000-8000-000000000002','a4100000-0000-4000-8000-000000000002','VAULTB',2026,'Test','B','a4100000-0000-4000-8000-000000000002');
insert into public.workshop_jobs(id,customer_id,vehicle_id,reference,title,job_date) values('a4300000-0000-4000-8000-000000000001','a4100000-0000-4000-8000-000000000001','a4200000-0000-4000-8000-000000000001','VAULT-TEST','Test job',current_date);
insert into public.vault_records(id,job_id,customer_id,vehicle_id,kind,title,occurred_on,published_at)
values('a4400000-0000-4000-8000-000000000001','a4300000-0000-4000-8000-000000000001','a4100000-0000-4000-8000-000000000001','a4200000-0000-4000-8000-000000000001','invoice','Private invoice',current_date,now());
insert into public.vault_assets(id,record_id,customer_id,vehicle_id,object_path,mime_type,size_bytes,sha256,ready)
values('a4500000-0000-4000-8000-000000000001','a4400000-0000-4000-8000-000000000001','a4100000-0000-4000-8000-000000000001','a4200000-0000-4000-8000-000000000001','a4100000-0000-4000-8000-000000000001/a4200000-0000-4000-8000-000000000001/a4400000-0000-4000-8000-000000000001/a4500000-0000-4000-8000-000000000001/original.pdf','application/pdf',10,repeat('a',64),true);
insert into storage.objects(bucket_id,name) values('performance-vault','a4100000-0000-4000-8000-000000000001/a4200000-0000-4000-8000-000000000001/a4400000-0000-4000-8000-000000000001/a4500000-0000-4000-8000-000000000001/original.pdf');
insert into public.invoices(id,customer_id,vehicle_id,invoice_number,invoice_date,summary,created_by)
values('a4600000-0000-4000-8000-000000000001','a4100000-0000-4000-8000-000000000001','a4200000-0000-4000-8000-000000000001','VAULT-LEGACY-TEST',current_date,'Private historical invoice','a4100000-0000-4000-8000-000000000001');
insert into public.vehicle_files(id,customer_id,vehicle_id,invoice_id,file_kind,record_source,bucket_id,object_path,mime_type,file_size_bytes,created_by)
values('a4700000-0000-4000-8000-000000000001','a4100000-0000-4000-8000-000000000001','a4200000-0000-4000-8000-000000000001','a4600000-0000-4000-8000-000000000001','invoice','psi_record','vehicle-documents','a4100000-0000-4000-8000-000000000001/vehicles/a4200000-0000-4000-8000-000000000001/invoices/test.pdf','application/pdf',10,'a4100000-0000-4000-8000-000000000001');
insert into storage.objects(bucket_id,name) values('vehicle-documents','a4100000-0000-4000-8000-000000000001/vehicles/a4200000-0000-4000-8000-000000000001/invoices/test.pdf');
do $$ begin
 if exists(select 1 from storage.buckets where id='performance-vault' and public) then raise exception 'public vault bucket'; end if;
 if has_table_privilege('anon','public.vault_records','select') then raise exception 'anon table grant'; end if;
 begin
 insert into public.vault_records(job_id,customer_id,vehicle_id,kind,title,occurred_on)
 values('a4300000-0000-4000-8000-000000000001','a4100000-0000-4000-8000-000000000002','a4200000-0000-4000-8000-000000000002','invoice','Wrong account',current_date);
 raise exception 'cross customer job accepted';
 exception when foreign_key_violation then null; end;
end $$;
set local role authenticated; select set_config('request.jwt.claim.sub','a4100000-0000-4000-8000-000000000001',true); select set_config('request.jwt.claims','{"sub":"a4100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
do $$ declare overview jsonb; begin
 if exists(select 1 from public.vault_records) or exists(select 1 from public.vault_assets) then raise exception 'free vault content exposed'; end if;
 overview:=public.performance_vault_overview('a4200000-0000-4000-8000-000000000001');
 if overview->>'plan'<>'free' or overview->'counts'->>'invoice'<>'2' then raise exception 'free counts incorrect'; end if;
 if exists(select 1 from public.invoices where id='a4600000-0000-4000-8000-000000000001') or exists(select 1 from public.vehicle_files where id='a4700000-0000-4000-8000-000000000001') then raise exception 'free legacy invoice exposed'; end if;
 if overview::text like '%Private invoice%' or overview::text like '%original.pdf%' then raise exception 'premium metadata leaked'; end if;
 begin
 insert into public.performance_subscriptions(customer_id,provider,provider_reference,environment,status,expires_at)
 values('a4100000-0000-4000-8000-000000000001','complimentary','forged','production','active',now()+interval '1 year');
 raise exception 'customer self grant accepted'; exception when insufficient_privilege then null; end;
 begin
 perform public.grant_performance_beta('a4100000-0000-4000-8000-000000000001',30);
 raise exception 'customer beta grant accepted'; exception when insufficient_privilege then null; end;
 begin
 perform public.performance_vault_overview('a4200000-0000-4000-8000-000000000002');
 raise exception 'foreign overview exposed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into public.performance_subscriptions(customer_id,provider,provider_reference,environment,status,expires_at,auto_renews)
 values('a4100000-0000-4000-8000-000000000001','complimentary','test-active','production','active',now()+interval '1 day',false);
set local role authenticated; select set_config('request.jwt.claim.sub','a4100000-0000-4000-8000-000000000001',true); select set_config('request.jwt.claims','{"sub":"a4100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
do $$ begin
 if (select count(*) from public.vault_records where id='a4400000-0000-4000-8000-000000000001')<>1 then raise exception 'paid record missing'; end if;
 if (select count(*) from public.vault_assets where id='a4500000-0000-4000-8000-000000000001')<>1 then raise exception 'paid asset missing'; end if;
 if exists(select 1 from storage.objects where bucket_id='performance-vault') then raise exception 'customer can mint arbitrary storage links'; end if;
 if (select count(*) from public.invoices where id='a4600000-0000-4000-8000-000000000001')<>1 then raise exception 'paid legacy invoice missing'; end if;
 if (select count(*) from public.vehicle_files where id='a4700000-0000-4000-8000-000000000001')<>1 then raise exception 'paid legacy file missing'; end if;
 if exists(select 1 from storage.objects where name like '%/invoices/test.pdf') then raise exception 'legacy invoice arbitrary URL allowed'; end if;
 update public.vault_records set title='Forged by customer' where id='a4400000-0000-4000-8000-000000000001';
 if found then raise exception 'customer modified workshop record'; end if;
 begin
 perform public.record_verified_performance_subscription('a4100000-0000-4000-8000-000000000001','production','active',now()+interval '1 year',true,now());
 raise exception 'customer called server verification RPC'; exception when insufficient_privilege then null; end;
 if public.performance_vault_overview('a4200000-0000-4000-8000-000000000001')->>'plan'<>'performance_plus' then raise exception 'cancelled auto renewal prematurely locked'; end if;
end $$;
set local role authenticated; select set_config('request.jwt.claim.sub','a4100000-0000-4000-8000-000000000002',true); select set_config('request.jwt.claims','{"sub":"a4100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
do $$ begin
 if exists(select 1 from public.vault_records where id='a4400000-0000-4000-8000-000000000001') or exists(select 1 from public.vault_assets where id='a4500000-0000-4000-8000-000000000001') then raise exception 'cross account premium exposed'; end if;
end $$;
reset role;
update public.performance_subscriptions set expires_at=now()-interval '1 second' where customer_id='a4100000-0000-4000-8000-000000000001' and provider_reference='test-active';
do $$ begin
 begin
  insert into public.performance_subscriptions(customer_id,provider,provider_reference,environment,status,expires_at,auto_renews,is_permanent)
  values('a4100000-0000-4000-8000-000000000001','apple','permanent:a4100000-0000-4000-8000-000000000001','production','active',null,false,true);
  raise exception 'apple permanent access accepted'; exception when check_violation then null; end;
 begin
  insert into public.performance_subscriptions(customer_id,provider,provider_reference,environment,status,expires_at,auto_renews,is_permanent)
  values('a4100000-0000-4000-8000-000000000001','complimentary','wrong-reference','production','active',null,false,true);
  raise exception 'unbound permanent access accepted'; exception when check_violation then null; end;
 begin
  insert into public.performance_subscriptions(customer_id,provider,provider_reference,environment,status,expires_at,auto_renews,is_permanent)
  values('a4100000-0000-4000-8000-000000000001','complimentary','permanent:a4100000-0000-4000-8000-000000000001','sandbox','active',null,false,true);
  raise exception 'sandbox permanent access accepted'; exception when check_violation then null; end;
 begin
  insert into public.performance_subscriptions(customer_id,provider,provider_reference,environment,status,expires_at,auto_renews,is_permanent)
  values('a4100000-0000-4000-8000-000000000001','complimentary','permanent:a4100000-0000-4000-8000-000000000001','production','active',null,true,true);
  raise exception 'renewing permanent access accepted'; exception when check_violation then null; end;
end $$;
insert into public.performance_subscriptions(customer_id,provider,provider_reference,environment,status,expires_at,auto_renews,is_permanent)
values('a4100000-0000-4000-8000-000000000001','complimentary','permanent:a4100000-0000-4000-8000-000000000001','production','active',null,false,true);
set local role authenticated; select set_config('request.jwt.claim.sub','a4100000-0000-4000-8000-000000000001',true); select set_config('request.jwt.claims','{"sub":"a4100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
do $$ declare overview jsonb; begin
 overview:=public.performance_vault_overview('a4200000-0000-4000-8000-000000000001');
 if overview->>'plan'<>'performance_plus' or (overview->>'is_permanent')::boolean is not true or overview->>'expires_at' is not null then raise exception 'permanent overview incorrect'; end if;
 if not exists(select 1 from public.vault_records where id='a4400000-0000-4000-8000-000000000001') then raise exception 'permanent subscriber cannot read'; end if;
end $$;
reset role;
update public.performance_subscriptions set status='revoked' where customer_id='a4100000-0000-4000-8000-000000000001' and is_permanent;
set local role authenticated; select set_config('request.jwt.claim.sub','a4100000-0000-4000-8000-000000000001',true); select set_config('request.jwt.claims','{"sub":"a4100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
do $$ begin
 if exists(select 1 from public.vault_records where id='a4400000-0000-4000-8000-000000000001') then raise exception 'expired subscriber or revoked permanent grant still reads'; end if;
end $$;
reset role;
update public.performance_subscriptions set expires_at=now()+interval '1 day',environment='sandbox' where customer_id='a4100000-0000-4000-8000-000000000001' and provider_reference='test-active';
set local role authenticated; select set_config('request.jwt.claim.sub','a4100000-0000-4000-8000-000000000001',true); select set_config('request.jwt.claims','{"sub":"a4100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
do $$ begin if private.has_performance_plus() then raise exception 'sandbox activated production'; end if; end $$;
reset role;
update public.performance_subscriptions set environment='production' where customer_id='a4100000-0000-4000-8000-000000000001' and provider_reference='test-active';
update public.performance_subscriptions set status='active' where customer_id='a4100000-0000-4000-8000-000000000001' and is_permanent;
insert into private.deleted_customer_identities(user_id,deletion_requested_at,completed_by) values('a4100000-0000-4000-8000-000000000001',now(),'a4100000-0000-4000-8000-000000000002');
set local role authenticated; select set_config('request.jwt.claim.sub','a4100000-0000-4000-8000-000000000001',true); select set_config('request.jwt.claims','{"sub":"a4100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
do $$ begin if private.has_performance_plus() or exists(select 1 from public.vault_assets where id='a4500000-0000-4000-8000-000000000001') then raise exception 'deleted identity stale JWT read'; end if; end $$;
reset role;
select public.record_verified_performance_subscription('a4100000-0000-4000-8000-000000000001','production','revoked',now()-interval '1 day',false,now());
select public.record_verified_performance_subscription('a4100000-0000-4000-8000-000000000001','production','active',now()+interval '1 year',true,now()-interval '1 hour');
do $$ begin
 if not exists(select 1 from public.performance_subscriptions where customer_id='a4100000-0000-4000-8000-000000000001' and provider='revenuecat' and status='revoked' and not auto_renews) then
 raise exception 'stale provider response restored revoked access'; end if;
end $$;
select 'PASS: free counts, entitlement forgery, paid/permanent access, cross-account denial, cancellation, expiry/revocation, sandbox, private storage, deleted identity' as result;
rollback;
