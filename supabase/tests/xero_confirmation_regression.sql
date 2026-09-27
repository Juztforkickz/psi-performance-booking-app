-- Isolated Apple sandbox only. All fixture rows and matching are rolled back.
begin;
-- Older review sandbox schema lacks the worker metadata fields. These temporary
-- compatibility columns are also rolled back. Run through the migration tool.
alter table public.vault_import_queue
  add column if not exists available_at timestamptz,
  add column if not exists last_error_code text,
  add column if not exists completed_at timestamptz;
do $$
declare
  owner_id uuid;
  session_id uuid;
  customer_id uuid := gen_random_uuid();
  vehicle_id uuid := gen_random_uuid();
  job_id uuid := gen_random_uuid();
  queue_id uuid := gen_random_uuid();
  tenant_id uuid := gen_random_uuid();
  contact_id uuid := gen_random_uuid();
begin
  select s.user_id, a.id into owner_id, session_id
  from public.staff_members s join auth.sessions a on a.user_id=s.user_id
  where s.role='owner' and s.status='active' limit 1;
  if owner_id is null then raise exception 'sandbox_owner_session_required'; end if;
  perform set_config('psi.test_owner',owner_id::text,true);
  perform set_config('psi.test_session',session_id::text,true);
  perform set_config('psi.test_customer',customer_id::text,true);
  perform set_config('psi.test_vehicle',vehicle_id::text,true);
  perform set_config('psi.test_job',job_id::text,true);
  perform set_config('psi.test_queue',queue_id::text,true);
  insert into auth.users(id,email) values(customer_id,'xero-regression-'||customer_id||'@example.invalid');
  insert into public.customer_profiles(user_id,email) values(customer_id,'xero-regression-'||customer_id||'@example.invalid') on conflict(user_id) do nothing;
  insert into public.customer_vehicles(id,customer_id,make,model,year,registration,created_by)
  values(vehicle_id,customer_id,'Holden','VF SSV Ute',2013,'1TX4SZ',customer_id);
  insert into public.workshop_jobs(id,customer_id,vehicle_id,reference,title,job_date,created_by)
  values(job_id,customer_id,vehicle_id,'XERO TEST '||job_id,'Regression invoice',current_date,owner_id);
  insert into public.vault_import_queue(id,source,source_key,status,identifiers)
  values(queue_id,'xero','regression:'||queue_id,'needs_review',jsonb_build_object('tenantId',tenant_id,'contactId',contact_id,'reference','VF UTE 1TX4SZ SERVICE / BRAKES / DIFF'));
end $$;
set local role authenticated;
do $$
declare
  q uuid := current_setting('psi.test_queue')::uuid;
  c uuid := current_setting('psi.test_customer')::uuid;
  j uuid := current_setting('psi.test_job')::uuid;
begin
  perform set_config('request.jwt.claim.sub',c::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',c,'role','authenticated','aal','aal2')::text,true);
  begin
    perform private.confirm_xero_import_match(q,c,j);
    raise exception 'customer_was_allowed_to_confirm';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',current_setting('psi.test_owner'),true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('psi.test_owner'),'role','authenticated','aal','aal2','iss','https://jwikoldibbpxyhbdrsow.supabase.co/auth/v1','session_id',current_setting('psi.test_session'))::text,true);
  begin
    perform private.confirm_xero_import_match(q,gen_random_uuid(),j);
    raise exception 'wrong_customer_was_allowed';
  exception when raise_exception then
    if sqlerrm <> 'xero_customer_vehicle_job_mismatch' then raise; end if;
  end;
  perform private.confirm_xero_import_match(q,c,j);
  if not exists(select 1 from public.vault_import_queue where id=q and status='matched' and job_id=j) then
    raise exception 'valid_match_not_saved';
  end if;
  begin
    perform private.confirm_xero_import_match(q,c,j);
    raise exception 'replay_was_allowed';
  exception when raise_exception then
    if sqlerrm <> 'xero_import_not_reviewable' then raise; end if;
  end;
end $$;
reset role;
update public.vault_import_queue set status='failed' where id=current_setting('psi.test_queue')::uuid;
set local role authenticated;
select private.confirm_xero_import_match(current_setting('psi.test_queue')::uuid,current_setting('psi.test_customer')::uuid,current_setting('psi.test_job')::uuid);
reset role;
do $$ begin
  if (select count(*) from private.xero_customer_links where customer_id=current_setting('psi.test_customer')::uuid) <> 1 then
    raise exception 'duplicate_contact_link';
  end if;
  if exists(select 1 from public.vault_records where customer_id=current_setting('psi.test_customer')::uuid) then
    raise exception 'confirmation_published_unverified_record';
  end if;
end $$;
select 'PASS: new link, existing link retry, punctuation, customer isolation and replay protection' as result;
rollback;

