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
insert into public.dyno_records(id,customer_id,vehicle_id,tested_at,power_kw_at_hubs,torque_nm_at_hubs,record_source,created_by)
values('a4800000-0000-4000-8000-000000000001','a4100000-0000-4000-8000-000000000001','a4200000-0000-4000-8000-000000000001',now(),300,650,'customer_entry','a4100000-0000-4000-8000-000000000001');
insert into public.vehicle_files(id,customer_id,vehicle_id,dyno_record_id,file_kind,record_source,bucket_id,object_path,mime_type,file_size_bytes,created_by)
values('a4900000-0000-4000-8000-000000000001','a4100000-0000-4000-8000-000000000001','a4200000-0000-4000-8000-000000000001','a4800000-0000-4000-8000-000000000001','dyno_graph','customer_entry','vehicle-documents','a4100000-0000-4000-8000-000000000001/vehicles/a4200000-0000-4000-8000-000000000001/dyno/test.png','image/png',10,'a4100000-0000-4000-8000-000000000001'),
('a4900000-0000-4000-8000-000000000002','a4100000-0000-4000-8000-000000000001','a4200000-0000-4000-8000-000000000001',null,'vehicle_photo','customer_entry','vehicle-photos','a4100000-0000-4000-8000-000000000001/vehicles/a4200000-0000-4000-8000-000000000001/photos/profile.png','image/png',10,'a4100000-0000-4000-8000-000000000001');
insert into storage.objects(bucket_id,name) values
('vehicle-documents','a4100000-0000-4000-8000-000000000001/vehicles/a4200000-0000-4000-8000-000000000001/dyno/test.png'),
('vehicle-photos','a4100000-0000-4000-8000-000000000001/vehicles/a4200000-0000-4000-8000-000000000001/photos/profile.png');

insert into public.vehicle_files(id,customer_id,vehicle_id,file_kind,record_source,bucket_id,object_path,mime_type,file_size_bytes,created_by)
values('a4900000-0000-4000-8000-000000000003','a4100000-0000-4000-8000-000000000001','a4200000-0000-4000-8000-000000000001','vehicle_photo','psi_record','vehicle-photos','a4100000-0000-4000-8000-000000000001/vehicles/a4200000-0000-4000-8000-000000000001/photos/workshop.png','image/png',10,'a4100000-0000-4000-8000-000000000001');
insert into storage.objects(bucket_id,name) values('vehicle-photos','a4100000-0000-4000-8000-000000000001/vehicles/a4200000-0000-4000-8000-000000000001/photos/workshop.png');
create function pg_temp.assert_performance(expected text, entitled boolean, imported boolean default false)
returns void language plpgsql as $$
declare snapshot jsonb; allowed jsonb;
begin
 snapshot:=public.performance_account_status();
 if snapshot->>'status'<>expected then raise exception 'status %, expected %',snapshot,expected; end if;
 if private.has_performance_plus()<>entitled then raise exception 'incorrect entitlement %',expected; end if;
 if exists(select 1 from public.vault_records where id='a4400000-0000-4000-8000-000000000001')<>(entitled or imported)
   or exists(select 1 from public.vault_assets where id='a4500000-0000-4000-8000-000000000001')<>(entitled or imported)
   or exists(select 1 from public.invoices where id='a4600000-0000-4000-8000-000000000001')<>(entitled or imported)
   or exists(select 1 from public.vehicle_files where id='a4700000-0000-4000-8000-000000000001')<>(entitled or imported)
   or exists(select 1 from public.dyno_records where id='a4800000-0000-4000-8000-000000000001')<>(entitled or imported)
   or exists(select 1 from public.vehicle_files where id='a4900000-0000-4000-8000-000000000003')<>(entitled or imported)
 then raise exception 'premium RLS incorrect %',expected; end if;
 if not exists(select 1 from public.customer_vehicles where id='a4200000-0000-4000-8000-000000000001')
   or not exists(select 1 from public.customer_profiles where user_id='a4100000-0000-4000-8000-000000000001')
   or not exists(select 1 from public.vehicle_files where id='a4900000-0000-4000-8000-000000000002')
 then raise exception 'PSI Free vehicle/account/photo denied %',expected; end if;
 insert into public.customer_vehicle_notes(customer_id,vehicle_id,body)
 values('a4100000-0000-4000-8000-000000000001','a4200000-0000-4000-8000-000000000001','Expiry fixture note, rolled back');
 if not exists(select 1 from public.customer_vehicle_notes where body='Expiry fixture note, rolled back') then
   raise exception 'free customer notes denied'; end if;
 if exists(select 1 from storage.objects where bucket_id='vehicle-photos' and name like '%/workshop.png') then
   raise exception 'workshop photo bypasses server link gate'; end if;
 if exists(select 1 from storage.objects where bucket_id in ('vehicle-documents','performance-vault'))
 then raise exception 'customer can mint arbitrary premium links %',expected; end if;
 if not entitled and not imported then
   begin
     perform public.performance_file_access('a4200000-0000-4000-8000-000000000001');
     raise exception 'expired file access allowed';
   exception when insufficient_privilege then null; end;
 else
   allowed:=public.performance_file_access('a4200000-0000-4000-8000-000000000001');
   if imported and coalesce((allowed->>'unlimited')::boolean,false) is not true then raise exception 'import file access lost'; end if;
 end if;
 begin
   perform public.performance_vault_overview('a4200000-0000-4000-8000-000000000002');
   raise exception 'cross customer overview allowed';
 exception when insufficient_privilege then null; end;
 begin
   perform public.record_verified_performance_subscription('a4100000-0000-4000-8000-000000000001','production','active',now()+interval '1 year',true,clock_timestamp());
   raise exception 'self granted subscription';
 exception when insufficient_privilege then null; end;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','a4100000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"a4100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select pg_temp.assert_performance('free',false,false);
reset role;
insert into public.performance_subscriptions(customer_id,provider,provider_reference,environment,status,expires_at,auto_renews)
values('a4100000-0000-4000-8000-000000000001','complimentary','trial:a4100000-0000-4000-8000-000000000001','production','active',now()+interval '14 days',false);
set local role authenticated;
select set_config('request.jwt.claim.sub','a4100000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"a4100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select pg_temp.assert_performance('trial',true,false);
reset role;
update public.performance_subscriptions set expires_at=now()-interval '1 second' where customer_id='a4100000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','a4100000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"a4100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select pg_temp.assert_performance('expired',false,false);
reset role;
select public.record_verified_performance_subscription('a4100000-0000-4000-8000-000000000001','production','active',now()+interval '1 month',true,clock_timestamp());
set local role authenticated;
select set_config('request.jwt.claim.sub','a4100000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"a4100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select pg_temp.assert_performance('active',true,false);
reset role;
select public.record_verified_performance_subscription('a4100000-0000-4000-8000-000000000001','production','active',now()+interval '1 month',false,clock_timestamp());
set local role authenticated;
select set_config('request.jwt.claim.sub','a4100000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"a4100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select pg_temp.assert_performance('active',true,false);
reset role;
select public.record_verified_performance_subscription('a4100000-0000-4000-8000-000000000001','production','grace_period',now()+interval '3 days',false,clock_timestamp());
set local role authenticated;
select set_config('request.jwt.claim.sub','a4100000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"a4100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select pg_temp.assert_performance('active',true,false);
reset role;
select public.record_verified_performance_subscription('a4100000-0000-4000-8000-000000000001','production','expired',now()-interval '1 second',false,clock_timestamp());
set local role authenticated;
select set_config('request.jwt.claim.sub','a4100000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"a4100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select pg_temp.assert_performance('expired',false,false);
reset role;
select public.record_verified_performance_subscription('a4100000-0000-4000-8000-000000000001','production','active',now()+interval '1 month',true,clock_timestamp());
set local role authenticated;
select set_config('request.jwt.claim.sub','a4100000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"a4100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select pg_temp.assert_performance('active',true,false);
reset role;
select public.record_verified_performance_subscription('a4100000-0000-4000-8000-000000000001','production','expired',now()-interval '1 second',false,clock_timestamp()-interval '1 hour');
set local role authenticated;
select set_config('request.jwt.claim.sub','a4100000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"a4100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select pg_temp.assert_performance('active',true,false);
reset role;
select public.record_verified_performance_subscription('a4100000-0000-4000-8000-000000000001','production','revoked',now()-interval '1 second',false,clock_timestamp());
set local role authenticated;
select set_config('request.jwt.claim.sub','a4100000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"a4100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select pg_temp.assert_performance('expired',false,false);
reset role;
insert into public.performance_subscriptions(customer_id,provider,provider_reference,environment,status,expires_at,auto_renews,is_permanent)
values('a4100000-0000-4000-8000-000000000001','complimentary','permanent:a4100000-0000-4000-8000-000000000001','production','active',null,false,true);
set local role authenticated;
select set_config('request.jwt.claim.sub','a4100000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"a4100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select pg_temp.assert_performance('permanent',true,false);
reset role;
update public.performance_subscriptions set status='revoked' where customer_id='a4100000-0000-4000-8000-000000000001' and is_permanent;
insert into public.historical_import_requests(id,customer_id,vehicle_id,status,payment_status,consent_at,provider_checkout_id,provider_payment_id,provider_event_id,paid_at,imported_item_count,completed_at)
values('a4990000-0000-4000-8000-000000000001','a4100000-0000-4000-8000-000000000001','a4200000-0000-4000-8000-000000000001','completed','paid',now(),'cs_expiry_fixture','pi_expiry_fixture','evt_expiry_fixture',now(),1,now());
set local role authenticated;
select set_config('request.jwt.claim.sub','a4100000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"a4100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select pg_temp.assert_performance('expired',false,true);
reset role;

do $$ begin
 if private.reconcile_performance_expiry()<>0 or private.reconcile_performance_expiry()<>0 then raise exception 'reconciliation not idempotent'; end if;
 if exists(select 1 from public.performance_subscriptions where customer_id='a4100000-0000-4000-8000-000000000001' and not is_permanent and status in ('active','grace_period') and expires_at<=now()) then raise exception 'stale active subscription'; end if;
end $$;
rollback;
select 'PASS: free, trial, expired trial, paid, cancellation, grace, failed renewal, reactivation, stale provider response, refund, permanent, historical import, premium RLS, server file denial, cross customer, self grant, free vehicle/profile/photo, reconciliation idempotency. All fixtures rolled back.' result;
