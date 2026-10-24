-- Explicitly approved complimentary double Rewards. No balances, paid evidence,
-- subscriptions, historical transactions or activation boundary are changed.
begin;
create table if not exists private.rewards_complimentary_grants (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references public.customer_profiles(user_id),
 starts_at timestamptz not null default now(),
 ends_at timestamptz,
 approved_at timestamptz not null default now(),
 approval_reference text not null unique check(length(approval_reference)>=10),
 check(ends_at is null or ends_at>starts_at)
);
create index if not exists rewards_complimentary_grants_customer on private.rewards_complimentary_grants(customer_id,starts_at);
alter table private.rewards_complimentary_grants enable row level security;
revoke all on private.rewards_complimentary_grants from public,anon,authenticated,service_role;
grant select on private.rewards_complimentary_grants to service_role;
alter table private.rewards_bonus_calculations add column if not exists complimentary_grant_ids uuid[] not null default '{}';

-- Keep provider verification intact and distinguish an expressly authorised grant
-- from paid access. The original protected account check still runs first.
do $$ begin
 if to_regprocedure('private.rewards_subscription_earning_status(uuid)') is null then
   alter function public.rewards_earning_status(uuid) set schema private;
   alter function private.rewards_earning_status(uuid) rename to rewards_subscription_earning_status;
 end if;
end $$;
revoke all on function private.rewards_subscription_earning_status(uuid) from public,anon,authenticated;
grant execute on function private.rewards_subscription_earning_status(uuid) to service_role;
create or replace function public.rewards_earning_status(p_customer_id uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb; approved private.rewards_complimentary_grants%rowtype;
begin
 result:=private.rewards_subscription_earning_status(p_customer_id);
 if (result->>'bonus_enabled')::boolean and result->>'subscription_status'='permanent' then
   select * into approved from private.rewards_complimentary_grants where customer_id=p_customer_id
     and starts_at<=now() and (ends_at is null or ends_at>now()) order by starts_at desc,id limit 1;
   if found then
     result:=result||jsonb_build_object('multiplier',2,'complimentary_double_verified',true,
       'earning_source','complimentary','valid_until',approved.ends_at,'verified_at',approved.approved_at);
   end if;
 end if;
 return result;
end $$;
revoke all on function public.rewards_earning_status(uuid) from public,anon,authenticated;
grant execute on function public.rewards_earning_status(uuid) to service_role;

-- The same atomic financial coordinator consumes trusted paid windows or approved
-- complimentary windows. A receipt covered by both still earns only one bonus.
create or replace function private.rewards_earning_windows(p_customer uuid,p_activation timestamptz,p_stop timestamptz)
returns table(id uuid,starts_at timestamptz,ends_at timestamptz,kind text)
language sql stable security invoker set search_path='' as $$
 select p.id,greatest(p.starts_at,p_activation),least(p.ends_at,coalesce(p_stop,p.ends_at),
   coalesce((select min(i.effective_at) from private.performance_paid_period_invalidations i where i.period_id=p.id),p.ends_at)),'paid'::text
 from private.performance_paid_periods p join private.performance_rewards_events e on e.id=p.source_event_id
 where p.customer_id=p_customer and e.customer_id=p_customer and e.verification_state='verified'
   and p.environment='production' and p.ownership_type='PURCHASED' and p.paid_amount>0
   and not exists(select 1 from public.performance_subscriptions s where s.customer_id=p_customer and s.is_permanent and s.status='active')
 union all
 select g.id,greatest(g.starts_at,p_activation),least(coalesce(g.ends_at,'infinity'::timestamptz),coalesce(p_stop,'infinity'::timestamptz)),'complimentary'::text
 from private.rewards_complimentary_grants g where g.customer_id=p_customer
   and exists(select 1 from public.performance_subscriptions s where s.customer_id=p_customer and s.is_permanent and s.status='active')
$$;
revoke all on function private.rewards_earning_windows(uuid,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function private.rewards_earning_windows(uuid,timestamptz,timestamptz) to service_role;
create or replace function public.apply_rewards_invoice_v2(
 p_tenant_id uuid,p_invoice_id uuid,p_contact_id uuid,p_invoice_number text,p_provider_updated_at timestamptz,
 p_paid_on date,p_eligible_cents bigint,p_redeemed_points bigint,p_facts jsonb,p_evidence_error text default null
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare customer uuid; policy private.rewards_bonus_policy%rowtype; previous private.rewards_bonus_invoice_states%rowtype;
 standard public.rewards_invoice_states%rowtype; base jsonb; f jsonb; allocated record; fact_ids uuid[]:='{}'; period_ids uuid[]:='{}'; invalidation_ids uuid[]:='{}';
 grant_ids uuid[]:='{}'; period_id uuid; fact_id uuid; period_start timestamptz; period_end timestamptz; capacity bigint; used bigint;
 q bigint:=0; target bigint:=0; prior bigint:=0; delta bigint; pending text:=p_evidence_error; calculation uuid;
 lo timestamptz; hi timestamptz; candidate boolean; basis text; old_balance bigint; evidence jsonb; receipt_total bigint;
begin
 if jsonb_typeof(p_facts)<>'array' or jsonb_array_length(p_facts)>500 or p_evidence_error !~ '^[a-z0-9_]{1,100}$' then raise exception 'rewards_payment_facts_review'; end if;
 select * into policy from private.rewards_bonus_policy where singleton for share;
 perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text||':'||p_invoice_id::text,0));
 select l.customer_id into customer from private.xero_customer_links l join public.customer_profiles c on c.user_id=l.customer_id
 where l.tenant_id=p_tenant_id and l.contact_id=p_contact_id and l.verified_at is not null and l.verified_by is not null and c.account_state='active';
 if customer is null then raise exception 'verified_rewards_customer_required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('rewards_evidence:'||customer::text,0));
 insert into public.rewards_accounts(customer_id) values(customer) on conflict do nothing;
 select points_balance into old_balance from public.rewards_accounts where customer_id=customer for update;
 select * into standard from public.rewards_invoice_states where tenant_id=p_tenant_id and invoice_id=p_invoice_id for update;
 if found and standard.provider_updated_at>p_provider_updated_at then return jsonb_build_object('changed',false,'stale',true); end if;
 if standard.customer_id is not null and (standard.customer_id<>customer or standard.contact_id<>p_contact_id) then raise exception 'rewards_invoice_identity_changed'; end if;
 if standard.provider_updated_at=p_provider_updated_at and (standard.eligible_cents<>p_eligible_cents or standard.paid_on is distinct from p_paid_on
   or standard.redeemed_points<>p_redeemed_points) then raise exception 'rewards_version_conflict'; end if;
 select * into previous from private.rewards_bonus_invoice_states where tenant_id=p_tenant_id and invoice_id=p_invoice_id for update;
 if found then prior:=previous.bonus_points; end if;
 -- Canonical sort means shuffled facts cannot make duplicate calculations.
 select coalesce(jsonb_agg(value order by value->>'original_receipt_id'),'[]') into p_facts from jsonb_array_elements(p_facts);
 if (select count(*)<>count(distinct value->>'original_receipt_id') from jsonb_array_elements(p_facts)) then raise exception 'rewards_payment_facts_review'; end if;
 receipt_total:=0;
 for f in select value from jsonb_array_elements(p_facts) loop
   if f->>'source_kind' not in ('payment','prepayment','overpayment') or f->>'source_id' is null or f->>'original_receipt_id' is null
     or f->>'allocation_id'<>p_invoice_id::text or (f->>'amount_cents')::bigint not between 1 and 2147483647
     or (f->>'capacity_cents')::bigint not between (f->>'amount_cents')::bigint and 2147483647
     or f->>'date_precision' not in ('date','timestamp') or (f->>'accounting_date')::date>(now() at time zone 'Australia/Melbourne')::date
     or (f->>'date_precision'='timestamp' and ((f->>'occurred_at')::timestamptz is null or (f->>'occurred_at')::timestamptz>now())) then raise exception 'rewards_payment_facts_review'; end if;
   receipt_total:=receipt_total+(f->>'amount_cents')::bigint;
   -- Fixed ordering across invoices avoids cross receipt deadlocks.
   perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text||':receipt:'||(f->>'original_receipt_id'),0));
   if exists(select 1 from private.rewards_payment_facts old where old.tenant_id=p_tenant_id and old.original_receipt_id=f->>'original_receipt_id'
     and (old.customer_id<>customer or old.accounting_date<>(f->>'accounting_date')::date or old.occurred_at is distinct from (f->>'occurred_at')::timestamptz)) then
     pending:='rewards_original_receipt_changed_review';
   end if;
   select coalesce(sum((item->>'amount_cents')::bigint),0) into used from private.rewards_bonus_invoice_states s,
     lateral jsonb_array_elements(s.receipt_allocations) item where s.tenant_id=p_tenant_id and s.invoice_id<>p_invoice_id
     and item->>'original_receipt_id'=f->>'original_receipt_id';
   capacity:=(f->>'capacity_cents')::bigint;
   if used+(f->>'amount_cents')::bigint>capacity then pending:='rewards_receipt_capacity_review'; end if;
   insert into private.rewards_payment_facts(tenant_id,invoice_id,contact_id,customer_id,invoice_updated_at,source_kind,source_id,allocation_id,
     amount_cents,currency,original_receipt_id,accounting_date,occurred_at,date_precision,source_sha256,capacity_cents)
   values(p_tenant_id,p_invoice_id,p_contact_id,customer,p_provider_updated_at,f->>'source_kind',f->>'source_id',f->>'allocation_id',
     (f->>'amount_cents')::bigint,'AUD',f->>'original_receipt_id',(f->>'accounting_date')::date,(f->>'occurred_at')::timestamptz,
     f->>'date_precision',encode(sha256(convert_to((p_provider_updated_at::text||f::text),'UTF8')),'hex'),capacity) on conflict do nothing;
   select id into fact_id from private.rewards_payment_facts where tenant_id=p_tenant_id and invoice_id=p_invoice_id and source_kind=f->>'source_kind'
     and source_id=f->>'source_id' and allocation_id=f->>'allocation_id' and source_sha256=encode(sha256(convert_to((p_provider_updated_at::text||f::text),'UTF8')),'hex');
   fact_ids:=array_append(fact_ids,fact_id);
 end loop;
 if p_eligible_cents>receipt_total then pending:='rewards_payment_totals_review'; end if;
 -- Permanent complimentary access never qualifies merely because other paid
 -- evidence exists. Trial overlap with independently paid access is permitted.
 if policy.activated_at is not null and p_eligible_cents>0 and pending is null then
   for allocated in select * from private.rewards_allocated_receipts(p_facts,p_eligible_cents) loop
     f:=allocated.fact;
     if f->>'date_precision'='timestamp' then
       lo:=(f->>'occurred_at')::timestamptz; hi:=lo;
     else
       lo:=(f->>'accounting_date')::date::timestamp at time zone 'Australia/Melbourne';
       hi:=((f->>'accounting_date')::date+1)::timestamp at time zone 'Australia/Melbourne';
     end if;
     candidate:=false; period_id:=null;
     -- A union of adjacent/overlapping paid periods can cover the whole date.
     select min(p.starts_at),max(p.ends_at) into period_start,period_end from private.performance_paid_periods p
     join private.performance_rewards_events e on e.id=p.source_event_id and e.customer_id=p.customer_id and e.verification_state='verified'
     where p.customer_id=customer and p.starts_at<=lo and p.ends_at>lo;
     for evidence in select jsonb_build_object('id',w.id,'start',w.starts_at,'end',w.ends_at,'kind',w.kind)
       from private.rewards_earning_windows(customer,policy.activated_at,policy.earning_stopped_at) w
       order by w.starts_at,w.ends_at,w.id loop
       if (evidence->>'start')::timestamptz<=lo and (evidence->>'end')::timestamptz>lo then
         period_end:=case when period_id is null then (evidence->>'end')::timestamptz else greatest(period_end,(evidence->>'end')::timestamptz) end;
         period_id:=(evidence->>'id')::uuid;
       elsif period_id is not null and (evidence->>'start')::timestamptz<=period_end then
         period_end:=greatest(period_end,(evidence->>'end')::timestamptz);
       end if;
       if (evidence->>'start')::timestamptz<hi and (evidence->>'end')::timestamptz>lo then candidate:=true; end if;
       if period_id is not null then
         if evidence->>'kind'='complimentary' then grant_ids:=array_append(grant_ids,(evidence->>'id')::uuid);
         else period_ids:=array_append(period_ids,(evidence->>'id')::uuid); end if;
       end if;
     end loop;
     if period_id is not null and (hi=lo or period_end>=hi) then q:=q+allocated.eligible_cents;
     elsif candidate then pending:=coalesce(pending,'rewards_date_boundary_review'); end if;
   end loop;
 end if;
 if p_eligible_cents=0 or policy.activated_at is null then pending:=null; end if;
 target:=q/100;
 -- Ambiguous new proof cannot claw back a previously earned bonus. An explicit
 -- invoice reduction still caps it to the new standard target while held.
 if pending is not null then target:=least(p_eligible_cents/100,greatest(prior,target)); end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'hash',p.evidence_sha256) order by p.id),'[]') into evidence
   from private.performance_paid_periods p where p.customer_id=customer;
 select coalesce(array_agg(i.id order by i.id),'{}') into invalidation_ids from private.performance_paid_period_invalidations i
   join private.performance_paid_periods p on p.id=i.period_id where p.customer_id=customer;
 basis:=encode(sha256(convert_to(jsonb_build_object('version',p_provider_updated_at,'eligible',p_eligible_cents,'redeemed',p_redeemed_points,
   'paid_on',p_paid_on,'facts',p_facts,'policy',to_jsonb(policy),'periods',evidence,'complimentary_grants',(select coalesce(jsonb_agg(to_jsonb(g) order by g.id),'[]') from private.rewards_complimentary_grants g where g.customer_id=customer),'pending',pending,'target',target)::text||
   coalesce((select jsonb_agg(to_jsonb(i) order by i.id)::text from private.performance_paid_period_invalidations i
     join private.performance_paid_periods p on p.id=i.period_id where p.customer_id=customer),'[]'),'UTF8')),'hex');
 if previous.basis_sha256=basis then return jsonb_build_object('changed',false,'bonus_points',prior,'pending',pending); end if;
 -- Existing base writer validates date/rate, identity, stale revisions and credit
 -- balance before this invoice's new earnings. Its writes roll back with ours.
 base:=private.apply_rewards_standard_snapshot(p_tenant_id,p_invoice_id,p_contact_id,p_invoice_number,p_provider_updated_at,
   p_paid_on,p_eligible_cents,p_eligible_cents/100,p_redeemed_points);
 delta:=target-prior;
 insert into private.rewards_bonus_calculations(tenant_id,invoice_id,invoice_number,contact_id,customer_id,invoice_updated_at,
   policy_revision,policy_sha256,basis_sha256,payment_fact_ids,paid_period_ids,complimentary_grant_ids,invalidation_ids,eligible_cents,qualifying_cents,standard_target_points,
   prior_bonus_points,bonus_target_points,bonus_delta,calculation_state,pending_reason)
 values(p_tenant_id,p_invoice_id,p_invoice_number,p_contact_id,customer,p_provider_updated_at,policy.policy_revision,
   coalesce(policy.policy_sha256,repeat('0',64)),basis,fact_ids,period_ids,grant_ids,invalidation_ids,p_eligible_cents,q,p_eligible_cents/100,prior,target,delta,
   case when pending is not null then 'pending' when delta=0 then 'unchanged' else 'applied' end,pending)
 on conflict(tenant_id,invoice_id,basis_sha256) do nothing returning id into calculation;
 if calculation is null then
   select id into calculation from private.rewards_bonus_calculations where tenant_id=p_tenant_id and invoice_id=p_invoice_id and basis_sha256=basis;
   if delta<>0 then raise exception 'rewards_bonus_evidence_conflict'; end if;
 end if;
 if delta<>0 then
   insert into public.rewards_bonus_ledger(calculation_id,customer_id,tenant_id,invoice_id,invoice_number,points_change,kind)
   values(calculation,customer,p_tenant_id,p_invoice_id,p_invoice_number,delta,case when delta>0 then 'bonus_earned' else 'bonus_adjustment' end);
   update public.rewards_accounts set points_balance=points_balance+delta,revision=revision+1,updated_at=now() where customer_id=customer;
 end if;
 insert into private.rewards_bonus_invoice_states(tenant_id,invoice_id,customer_id,contact_id,bonus_points,calculation_id,evidence_error,
   receipt_allocations,source_version,basis_sha256)
 values(p_tenant_id,p_invoice_id,customer,p_contact_id,target,calculation,pending,case when pending is null then p_facts else coalesce(previous.receipt_allocations,'[]') end,p_provider_updated_at,basis)
 on conflict(tenant_id,invoice_id) do update set bonus_points=excluded.bonus_points,calculation_id=excluded.calculation_id,
   evidence_error=excluded.evidence_error,receipt_allocations=excluded.receipt_allocations,source_version=excluded.source_version,basis_sha256=excluded.basis_sha256,updated_at=now();
 return jsonb_build_object('changed',coalesce((base->>'changed')::boolean,false) or delta<>0,'customer_id',customer,
   'standard_points',p_eligible_cents/100,'bonus_points',target,'total_points',p_eligible_cents/100+target,'pending',pending);
end $$;

revoke all on function public.apply_rewards_invoice_v2(uuid,uuid,uuid,text,timestamptz,date,bigint,bigint,jsonb,text) from public,anon,authenticated;
grant execute on function public.apply_rewards_invoice_v2(uuid,uuid,uuid,text,timestamptz,date,bigint,bigint,jsonb,text) to service_role;
-- Version 1's schema fingerprint intentionally no longer matches after the new
-- audit column. This prevents the older migration from overwriting grant support.
insert into private.rewards_bonus_schema_version(version,fingerprint,contract_sha256)
values(2,'psi_complimentary_double_20261024',private.rewards_bonus_schema_contract()) on conflict do nothing;
commit;
