-- Approved implementation, UNPUBLISHED. Policy remains disabled until separate release approval.
-- Apply atomically; no backfill, balance update, notification, cron or activation.
begin;

do $$ begin
 if to_regclass('private.rewards_bonus_policy') is not null and to_regclass('private.rewards_bonus_schema_version') is null then
   raise exception 'rewards_bonus_existing_schema_requires_review';
 end if;
end $$;
create table if not exists private.rewards_bonus_schema_version(version integer primary key, fingerprint text not null,contract_sha256 text);
do $$ declare recorded text; actual text; begin
 if exists(select 1 from private.rewards_bonus_schema_version where version=1) then
   select contract_sha256 into recorded from private.rewards_bonus_schema_version where version=1;
   if to_regprocedure('private.rewards_bonus_schema_contract()') is null then raise exception 'rewards_bonus_schema_mismatch'; end if;
   execute 'select private.rewards_bonus_schema_contract()' into actual;
   if recorded is null or recorded<>actual then raise exception 'rewards_bonus_schema_mismatch'; end if;
 end if;
end $$;
create table if not exists private.rewards_bonus_policy (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  policy_revision integer not null default 1 check (policy_revision > 0),
  activated_at timestamptz,
  instalment_rule text not null default 'each_receipt'
    check (instalment_rule in ('pending','each_receipt','final_payment')),
  grace_rule text not null default 'standard_until_verified_renewal'
    check (grace_rule in ('pending','standard_until_verified_renewal','verified_grace')),
  date_boundary_rule text not null default 'whole_day_or_precise_evidence'
    check (date_boundary_rule in ('pending','whole_day_or_precise_evidence')),
  unallocated_credit_rule text not null default 'proportionate_original_receipts'
    check (unallocated_credit_rule in ('pending','proportionate_original_receipts')),
  membership_refund_rule text not null default 'preserve_legitimate_prior_rewards'
    check (membership_refund_rule in ('pending','preserve_legitimate_prior_rewards')),
  approved_at timestamptz,
  approval_reference text,
  policy_sha256 text check (policy_sha256 ~ '^[a-f0-9]{64}$'),
  check (not enabled or (
    activated_at is not null and approved_at is not null
    and approval_reference is not null and length(approval_reference) > 0
    and policy_sha256 is not null
    and instalment_rule <> 'pending' and grace_rule <> 'pending'
    and date_boundary_rule <> 'pending' and unallocated_credit_rule <> 'pending'
    and membership_refund_rule <> 'pending'
  ))
);
insert into private.rewards_bonus_policy(singleton) values (true)
on conflict (singleton) do nothing;

-- Minimal authenticated provider inbox. This is provenance, not authority by itself.
-- A trusted verifier must re-fetch provider truth and record qualifying periods.
create table if not exists private.performance_rewards_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null unique,
  customer_id uuid references public.customer_profiles(user_id),
  event_at timestamptz not null,
  received_at timestamptz not null default now(),
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  verification_state text not null default 'pending'
    check (verification_state in ('pending','verified','excluded','review')),
  verified_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  last_error_code text check (last_error_code ~ '^[a-z0-9_]{1,100}$')
);
create index if not exists performance_rewards_events_due_idx
  on private.performance_rewards_events(next_attempt_at)
  where verification_state = 'pending';
create index if not exists performance_rewards_events_customer_idx
  on private.performance_rewards_events(customer_id, event_at);

-- Immutable verified service intervals. Do not use verified_at as starts_at.
-- Multiple evidence revisions of one store transaction remain auditable.
-- No complimentary, sandbox or zero-priced interval can be inserted here.
create table if not exists private.performance_paid_periods (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customer_profiles(user_id),
  source_event_id uuid not null references private.performance_rewards_events(id),
  store text not null check (store in ('app_store','play_store')),
  product_id text not null,
  transaction_id text not null,
  original_transaction_id text,
  environment text not null check (environment = 'production'),
  ownership_type text not null check (ownership_type = 'PURCHASED'),
  period_type text not null check (period_type in ('NORMAL','INTRO','PREPAID','PROMOTIONAL')),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  grace_ends_at timestamptz check (grace_ends_at >= ends_at),
  paid_amount numeric(18,6) not null check (paid_amount > 0),
  paid_currency text not null check (paid_currency ~ '^[A-Z]{3}$'),
  verified_at timestamptz not null,
  evidence_sha256 text not null check (evidence_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  unique (store, transaction_id, evidence_sha256)
);
create index if not exists performance_paid_periods_customer_time_idx
  on private.performance_paid_periods(customer_id, starts_at, ends_at);

-- An ordinary expiry or renewal cancellation is NOT an invalidation.
-- A later approved writer must apply the chosen refund policy using effective time.
create table if not exists private.performance_paid_period_invalidations (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references private.performance_paid_periods(id),
  source_event_id uuid not null references private.performance_rewards_events(id),
  effective_at timestamptz not null,
  reason text not null check (reason in ('refunded','revoked','period_corrected','identity_review')),
  verified_at timestamptz not null,
  evidence_sha256 text not null check (evidence_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  unique (period_id, evidence_sha256)
);
create index if not exists performance_paid_invalidations_period_idx
  on private.performance_paid_period_invalidations(period_id, effective_at);

-- Immutable Xero source revisions, retrieved by trusted server code.
-- The writer must reconcile all contributions, original receipts, allocations,
-- refunds and reused receipts across invoices before accepting a calculation.
create table if not exists private.rewards_payment_facts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  invoice_id uuid not null,
  contact_id uuid not null,
  customer_id uuid not null references public.customer_profiles(user_id),
  invoice_updated_at timestamptz not null,
  source_kind text not null check (source_kind in ('payment','prepayment','overpayment','credit_note','reversal')),
  source_id text not null,
  allocation_id text not null,
  amount_cents bigint not null check (amount_cents <> 0 and abs(amount_cents) <= 2147483647),
  currency text not null check (currency = 'AUD'),
  original_receipt_id text,
  accounting_date date not null,
  occurred_at timestamptz,
  date_precision text not null check (date_precision in ('date','timestamp')),
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  fetched_at timestamptz not null default now(),
  check ((date_precision = 'timestamp' and occurred_at is not null)
      or (date_precision = 'date' and occurred_at is null)),
  unique (tenant_id, invoice_id, source_kind, source_id, allocation_id, source_sha256)
);
create index if not exists rewards_payment_facts_invoice_idx
  on private.rewards_payment_facts(tenant_id, invoice_id, invoice_updated_at);
create index if not exists rewards_payment_facts_receipt_idx
  on private.rewards_payment_facts(tenant_id, original_receipt_id)
  where original_receipt_id is not null;
create index if not exists rewards_payment_facts_customer_date_idx
  on private.rewards_payment_facts(customer_id, accounting_date);

-- Immutable calculation audit; a zero delta is valid evidence but not a ledger entry.
-- Arrays contain only references to private facts. Writer must validate ownership,
-- exact source version, eligible cents, period union and activation boundaries.
create table if not exists private.rewards_bonus_calculations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  invoice_id uuid not null,
  invoice_number text not null,
  contact_id uuid not null,
  customer_id uuid not null references public.customer_profiles(user_id),
  invoice_updated_at timestamptz not null,
  policy_revision integer not null check (policy_revision > 0),
  policy_sha256 text not null check (policy_sha256 ~ '^[a-f0-9]{64}$'),
  basis_sha256 text not null check (basis_sha256 ~ '^[a-f0-9]{64}$'),
  payment_fact_ids uuid[] not null default '{}',
  paid_period_ids uuid[] not null default '{}',
  invalidation_ids uuid[] not null default '{}',
  eligible_cents bigint not null check (eligible_cents between 0 and 2147483647),
  qualifying_cents bigint not null check (qualifying_cents >= 0 and qualifying_cents <= eligible_cents),
  standard_target_points bigint not null check (standard_target_points = eligible_cents / 100),
  prior_bonus_points bigint not null check (prior_bonus_points >= 0),
  bonus_target_points bigint not null check (bonus_target_points >= 0 and bonus_target_points <= standard_target_points),
  bonus_delta bigint not null check (bonus_delta = bonus_target_points - prior_bonus_points),
  calculation_state text not null check (calculation_state in ('applied','pending','unchanged')),
  pending_reason text check (pending_reason ~ '^[a-z0-9_]{1,100}$'),
  calculated_at timestamptz not null default now(),
  check (calculation_state <> 'pending' or pending_reason is not null),
  check (calculation_state = 'pending' or bonus_target_points = qualifying_cents / 100),
  unique (tenant_id, invoice_id, basis_sha256),
  unique (id, customer_id, tenant_id, invoice_id)
);
create index if not exists rewards_bonus_calculations_customer_date_idx
  on private.rewards_bonus_calculations(customer_id, calculated_at desc);
create index if not exists rewards_bonus_calculations_pending_idx
  on private.rewards_bonus_calculations(calculated_at)
  where calculation_state = 'pending';

create table if not exists private.rewards_bonus_invoice_states (
  tenant_id uuid not null,
  invoice_id uuid not null,
  customer_id uuid not null references public.customer_profiles(user_id),
  contact_id uuid not null,
  bonus_points bigint not null default 0 check (bonus_points >= 0),
  calculation_id uuid not null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, invoice_id),
  foreign key (calculation_id, customer_id, tenant_id, invoice_id)
    references private.rewards_bonus_calculations(id, customer_id, tenant_id, invoice_id)
);
create index if not exists rewards_bonus_invoice_states_customer_idx
  on private.rewards_bonus_invoice_states(customer_id);

-- Distinct from the existing base ledger's Xero-version uniqueness.
-- Late paid-period proof can add exactly one bonus delta without a new invoice version.
-- One credit pool is retained in existing rewards_accounts; the future writer must
-- update its balance/revision in the SAME transaction as both ledgers and states.
create table if not exists public.rewards_bonus_ledger (
  id uuid primary key default gen_random_uuid(),
  calculation_id uuid not null unique,
  customer_id uuid not null references public.customer_profiles(user_id),
  tenant_id uuid not null,
  invoice_id uuid not null,
  invoice_number text not null,
  points_change bigint not null check (points_change <> 0),
  kind text not null check (kind in ('bonus_earned','bonus_adjustment')),
  created_at timestamptz not null default now(),
  check ((points_change > 0 and kind = 'bonus_earned')
      or (points_change < 0 and kind = 'bonus_adjustment')),
  foreign key (calculation_id, customer_id, tenant_id, invoice_id)
    references private.rewards_bonus_calculations(id, customer_id, tenant_id, invoice_id)
);
create index if not exists rewards_bonus_ledger_customer_date_idx
  on public.rewards_bonus_ledger(customer_id, created_at desc);

-- Record preexisting opening balance separately from issued credit. This audit
-- adds rows only; it never changes an account or assumes balances began at zero.
create table if not exists private.rewards_opening_balance_audit (
 customer_id uuid primary key references public.customer_profiles(user_id),
 points_balance bigint not null, ledger_net bigint not null, opening_points bigint not null,
 recorded_at timestamptz not null default now(), check(opening_points=points_balance-ledger_net)
);
insert into private.rewards_opening_balance_audit(customer_id,points_balance,ledger_net,opening_points)
select a.customer_id,a.points_balance,coalesce(l.net,0)+coalesce(b.net,0),a.points_balance-coalesce(l.net,0)-coalesce(b.net,0)
from public.rewards_accounts a
left join (select customer_id,sum(points_change) net from public.rewards_ledger group by customer_id) l using(customer_id)
left join (select customer_id,sum(points_change) net from public.rewards_bonus_ledger group by customer_id) b using(customer_id)
on conflict(customer_id) do nothing;
alter table private.rewards_opening_balance_audit enable row level security;
revoke all on private.rewards_opening_balance_audit from public,anon,authenticated,service_role;
grant select on private.rewards_opening_balance_audit to service_role;


do $permissions$
declare relation_name text;
begin
  foreach relation_name in array array[
    'rewards_bonus_policy', 'performance_rewards_events', 'performance_paid_periods',
    'performance_paid_period_invalidations', 'rewards_payment_facts',
    'rewards_bonus_calculations', 'rewards_bonus_invoice_states'
  ] loop
    execute format('alter table private.%I enable row level security', relation_name);
    execute format('revoke all on table private.%I from public, anon, authenticated, service_role', relation_name);
  end loop;
end
$permissions$;

-- These schema grants alone cannot grant a customer paid status or points.
-- The private schema remains unexposed; service-only RPCs mediate trusted writes.
grant select on private.rewards_bonus_policy to service_role;
grant select, insert, update on private.performance_rewards_events to service_role;
grant select, insert on private.performance_paid_periods,
  private.performance_paid_period_invalidations, private.rewards_payment_facts,
  private.rewards_bonus_calculations to service_role;
grant select, insert, update on private.rewards_bonus_invoice_states to service_role;

alter table public.rewards_bonus_ledger enable row level security;
revoke all on public.rewards_bonus_ledger from public, anon, authenticated, service_role;
grant select on public.rewards_bonus_ledger to authenticated;
grant select, insert on public.rewards_bonus_ledger to service_role;
do $own_history_policy$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
    and tablename = 'rewards_bonus_ledger' and policyname = 'rewards_bonus_ledger_owner_read') then
    create policy rewards_bonus_ledger_owner_read on public.rewards_bonus_ledger
      for select to authenticated using (customer_id = (select auth.uid()));
  end if;
end
$own_history_policy$;

alter table private.rewards_bonus_policy add column if not exists earning_stopped_at timestamptz;
alter table private.performance_rewards_events add column if not exists event jsonb not null default '{}';
alter table private.rewards_payment_facts add column if not exists capacity_cents bigint not null default 0;
alter table private.rewards_bonus_invoice_states add column if not exists evidence_error text;
alter table private.rewards_bonus_invoice_states add column if not exists receipt_allocations jsonb not null default '[]';
alter table private.rewards_bonus_invoice_states add column if not exists source_version timestamptz;
alter table private.rewards_bonus_invoice_states add column if not exists basis_sha256 text;
revoke all on private.rewards_bonus_schema_version from public,anon,authenticated,service_role;
alter table private.rewards_bonus_schema_version enable row level security;
grant usage on schema private to service_role;

-- Replay checks the immutable implementation marker and required shape. A partial
-- or unrelated table is not silently accepted by IF NOT EXISTS.
do $$ begin
 if exists(select 1 from private.rewards_bonus_schema_version where version=1 and fingerprint<>'psi_paid_rewards_v1_20261024')
   or (select count(*) from information_schema.columns where table_schema='private' and table_name='rewards_bonus_invoice_states'
     and column_name in ('bonus_points','receipt_allocations','source_version','basis_sha256'))<>4 then
   raise exception 'rewards_bonus_schema_mismatch';
 end if;
end $$;

create or replace function public.ingest_rewards_provider_event(p_customer_id uuid,p_event jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare event_id text:=p_event->>'id'; fingerprint text:=encode(sha256(convert_to(p_event::text,'UTF8')),'hex'); existing private.performance_rewards_events%rowtype;
begin
 if event_id is null or length(event_id) not between 1 and 200 or p_event->>'app_user_id'<>p_customer_id::text
   or not exists(select 1 from public.customer_profiles where user_id=p_customer_id and account_state='active') then
   raise exception 'invalid_rewards_provider_event';
 end if;
 insert into private.performance_rewards_events(provider_event_id,customer_id,event_at,source_sha256,event)
 values(event_id,p_customer_id,to_timestamp((p_event->>'event_timestamp_ms')::numeric/1000),fingerprint,p_event)
 on conflict(provider_event_id) do nothing;
 select * into existing from private.performance_rewards_events where provider_event_id=event_id;
 if existing.customer_id<>p_customer_id or existing.source_sha256<>fingerprint then raise exception 'rewards_provider_event_conflict'; end if;
end $$;

create or replace function public.rewards_pending_provider_events(p_customer_id uuid) returns table(id uuid,event jsonb)
language sql security invoker set search_path='' as $$
 select e.id,e.event from private.performance_rewards_events e
 where e.customer_id=p_customer_id and e.verification_state='pending' and e.next_attempt_at<=now() and e.attempts<30
 order by (e.event->>'type'='REFUND_REVERSED'),e.event_at desc,e.id limit 50
$$;

create or replace function public.rewards_paid_lineages(p_customer_id uuid) returns jsonb
language sql security invoker set search_path='' as $$
 select coalesce(jsonb_agg(distinct jsonb_build_object('store',p.store,'product_id',p.product_id,'original_transaction_id',p.original_transaction_id)),'[]')
 from private.performance_paid_periods p join private.performance_rewards_events e on e.id=p.source_event_id
 where p.customer_id=p_customer_id and e.customer_id=p_customer_id and e.verification_state='verified'
$$;
revoke all on function public.rewards_paid_lineages(uuid) from public,anon,authenticated;
grant execute on function public.rewards_paid_lineages(uuid) to service_role;

create or replace function private.requeue_rewards_customer(p_customer_id uuid) returns void
language sql security invoker set search_path='' as $$
 insert into public.rewards_invoice_queue(tenant_id,invoice_id)
 select s.tenant_id,s.invoice_id from public.rewards_invoice_states s
 join private.rewards_bonus_policy p on p.singleton
 where s.customer_id=p_customer_id and p.activated_at is not null
   and s.paid_on>=(p.activated_at at time zone 'Australia/Melbourne')::date
 on conflict(tenant_id,invoice_id) do update set revision=rewards_invoice_queue.revision+1,available_at=now(),attempts=0
$$;
grant execute on function private.requeue_rewards_customer(uuid) to service_role;
revoke all on function private.requeue_rewards_customer(uuid) from public,anon,authenticated;

create or replace function public.record_rewards_paid_evidence(p_customer_id uuid,p_event_id uuid,p_state text,p_period jsonb,p_reason text)
returns void language plpgsql security invoker set search_path='' as $$
declare e private.performance_rewards_events%rowtype; fingerprint text;
begin
 perform pg_advisory_xact_lock(hashtextextended('rewards_evidence:'||p_customer_id::text,0));
 select * into e from private.performance_rewards_events where id=p_event_id for update;
 if not found or e.customer_id<>p_customer_id or p_state not in ('pending','verified','excluded','review') then raise exception 'rewards_paid_evidence_invalid'; end if;
 if e.verification_state<>'pending' then return; end if;
 if p_state='verified' then
   if p_period is null or p_period->>'transaction_id'<>e.event->>'transaction_id'
     or p_period->>'product_id'<>e.event->>'product_id'
     or (p_period->>'paid_amount')::numeric<> (e.event->>'price_in_purchased_currency')::numeric
     or p_period->>'paid_currency'<>e.event->>'currency'
     or (p_period->>'starts_at')::timestamptz<>to_timestamp((e.event->>'purchased_at_ms')::numeric/1000)
     or (p_period->>'ends_at')::timestamptz<>to_timestamp((e.event->>'expiration_at_ms')::numeric/1000)
     or e.event->>'environment'<>'PRODUCTION' or e.event->>'type' not in ('INITIAL_PURCHASE','RENEWAL')
     or not (e.event->'entitlement_ids' ? 'performance_plus') then raise exception 'rewards_paid_evidence_invalid'; end if;
   -- Never associate one store transaction with a second customer.
   perform pg_advisory_xact_lock(hashtextextended('paid:'||(p_period->>'store')||':'||(p_period->>'transaction_id'),0));
   if exists(select 1 from private.performance_paid_periods where store=p_period->>'store'
     and transaction_id=p_period->>'transaction_id' and customer_id<>p_customer_id) then raise exception 'rewards_paid_identity_review'; end if;
   fingerprint:=encode(sha256(convert_to(p_period::text,'UTF8')),'hex');
   insert into private.performance_paid_periods(customer_id,source_event_id,store,product_id,transaction_id,original_transaction_id,
     environment,ownership_type,period_type,starts_at,ends_at,paid_amount,paid_currency,verified_at,evidence_sha256)
   values(p_customer_id,e.id,p_period->>'store',p_period->>'product_id',p_period->>'transaction_id',p_period->>'original_transaction_id',
     'production','PURCHASED',p_period->>'period_type',(p_period->>'starts_at')::timestamptz,(p_period->>'ends_at')::timestamptz,
     (p_period->>'paid_amount')::numeric,p_period->>'paid_currency',now(),fingerprint) on conflict do nothing;
 end if;
 update private.performance_rewards_events set verification_state=p_state,verified_at=case when p_state='verified' then now() else null end,
   attempts=attempts+1,next_attempt_at=now()+interval '5 minutes',last_error_code=p_reason where id=e.id;
 if p_state='verified' then perform private.requeue_rewards_customer(p_customer_id); end if;
end $$;

create or replace function public.record_rewards_paid_revocations(p_customer_id uuid,p_revocations jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare r jsonb; e uuid; changed integer:=0; n integer; fingerprint text;
begin
 perform pg_advisory_xact_lock(hashtextextended('rewards_evidence:'||p_customer_id::text,0));
 if jsonb_typeof(p_revocations)<>'array' or jsonb_array_length(p_revocations)>10 then raise exception 'rewards_paid_evidence_invalid'; end if;
 for r in select value from jsonb_array_elements(p_revocations) loop
   if r->>'reason' not in ('refunded','period_corrected','identity_review') or (r->>'effective_at') is null
     or (r->>'reason'<>'period_corrected' and (r->>'effective_at')::timestamptz>now()) then raise exception 'rewards_paid_evidence_invalid'; end if;
   if not exists(select 1 from private.performance_paid_periods p where p.customer_id=p_customer_id and p.product_id=r->>'product_id'
     and p.store=r->>'store' and p.ends_at>(r->>'effective_at')::timestamptz
     and (case when r->>'transaction_id' is not null then p.transaction_id=r->>'transaction_id' else p.starts_at<=(r->>'effective_at')::timestamptz end)
     and not exists(select 1 from private.performance_paid_period_invalidations i where i.period_id=p.id and i.effective_at<=(r->>'effective_at')::timestamptz)) then continue; end if;
   fingerprint:=encode(sha256(convert_to((p_customer_id::text||r::text),'UTF8')),'hex');
   insert into private.performance_rewards_events(provider_event_id,customer_id,event_at,source_sha256,verification_state,verified_at,event)
   values('snapshot:'||fingerprint,p_customer_id,(r->>'effective_at')::timestamptz,fingerprint,'verified',now(),r)
   on conflict(provider_event_id) do nothing;
   select id into e from private.performance_rewards_events where provider_event_id='snapshot:'||fingerprint;
   insert into private.performance_paid_period_invalidations(period_id,source_event_id,effective_at,reason,verified_at,evidence_sha256)
   select id,e,(r->>'effective_at')::timestamptz,r->>'reason',now(),fingerprint from private.performance_paid_periods
   where customer_id=p_customer_id and product_id=r->>'product_id' and store=r->>'store'
     and ends_at>(r->>'effective_at')::timestamptz
     and (case when r->>'transaction_id' is not null then transaction_id=r->>'transaction_id' else starts_at<=(r->>'effective_at')::timestamptz end)
   on conflict do nothing;
   get diagnostics n=row_count; changed:=changed+n;
 end loop;
 if changed>0 then perform private.requeue_rewards_customer(p_customer_id); end if;
end $$;

-- A verified refund reversal restores only future earning. Clone the original
-- positive paid proof as a new immutable segment; keep the refunded gap and all
-- previous evidence. No price is invented from a reversal event without a price.
create or replace function public.restore_rewards_paid_evidence(p_customer_id uuid,p_event_id uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare e private.performance_rewards_events%rowtype; original private.performance_paid_periods%rowtype; fingerprint text;
begin
 perform pg_advisory_xact_lock(hashtextextended('rewards_evidence:'||p_customer_id::text,0));
 select * into e from private.performance_rewards_events where id=p_event_id for update;
 if not found or e.customer_id<>p_customer_id or e.event->>'type'<>'REFUND_REVERSED' or e.event->>'environment'<>'PRODUCTION' then raise exception 'rewards_paid_evidence_invalid'; end if;
 if e.verification_state='verified' then return; end if;
 select p.* into original from private.performance_paid_periods p join private.performance_rewards_events proof on proof.id=p.source_event_id
 where p.customer_id=p_customer_id and p.transaction_id=e.event->>'transaction_id' and p.product_id=e.event->>'product_id'
   and p.store=case e.event->>'store' when 'APP_STORE' then 'app_store' when 'PLAY_STORE' then 'play_store' else '' end
   and p.paid_amount>0 and proof.verification_state='verified' and proof.customer_id=p_customer_id
   and p.ends_at>e.event_at and not exists(select 1 from private.performance_paid_period_invalidations i where i.period_id=p.id and i.reason='identity_review')
 order by p.starts_at,p.id limit 1;
 if not found then raise exception 'rewards_paid_restoration_requires_review'; end if;
 fingerprint:=encode(sha256(convert_to(e.source_sha256||original.evidence_sha256,'UTF8')),'hex');
 insert into private.performance_paid_periods(customer_id,source_event_id,store,product_id,transaction_id,original_transaction_id,
   environment,ownership_type,period_type,starts_at,ends_at,paid_amount,paid_currency,verified_at,evidence_sha256)
 values(p_customer_id,e.id,original.store,original.product_id,original.transaction_id,original.original_transaction_id,
   'production','PURCHASED',original.period_type,greatest(original.starts_at,e.event_at),original.ends_at,original.paid_amount,original.paid_currency,now(),fingerprint)
 on conflict do nothing;
 update private.performance_rewards_events set verification_state='verified',verified_at=now(),last_error_code=null where id=e.id;
 perform private.requeue_rewards_customer(p_customer_id);
end $$;
revoke all on function public.restore_rewards_paid_evidence(uuid,uuid) from public,anon,authenticated;
grant execute on function public.restore_rewards_paid_evidence(uuid,uuid) to service_role;

-- Preserve the proven standard writer, move it to the unexposed schema, and fence
-- old workers after activation. The v2 coordinator calls it in the same transaction.
do $$ begin
 if to_regprocedure('private.apply_rewards_standard_snapshot(uuid,uuid,uuid,text,timestamptz,date,bigint,bigint,bigint)') is null then
   alter function public.apply_rewards_invoice_snapshot(uuid,uuid,uuid,text,timestamptz,date,bigint,bigint,bigint) set schema private;
   alter function private.apply_rewards_invoice_snapshot(uuid,uuid,uuid,text,timestamptz,date,bigint,bigint,bigint) rename to apply_rewards_standard_snapshot;
 end if;
end $$;
revoke all on function private.apply_rewards_standard_snapshot(uuid,uuid,uuid,text,timestamptz,date,bigint,bigint,bigint) from public,anon,authenticated;
grant execute on function private.apply_rewards_standard_snapshot(uuid,uuid,uuid,text,timestamptz,date,bigint,bigint,bigint) to service_role;

create or replace function public.apply_rewards_invoice_snapshot(
 p_tenant_id uuid,p_invoice_id uuid,p_contact_id uuid,p_invoice_number text,p_provider_updated_at timestamptz,
 p_paid_on date,p_eligible_cents bigint,p_earned_points bigint,p_redeemed_points bigint
) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from private.rewards_bonus_policy where singleton and activated_at is not null) then raise exception 'rewards_v2_worker_required'; end if;
 return private.apply_rewards_standard_snapshot(p_tenant_id,p_invoice_id,p_contact_id,p_invoice_number,p_provider_updated_at,
   p_paid_on,p_eligible_cents,p_earned_points,p_redeemed_points);
end $$;

-- Canonical allocator. Uses integer cents and largest remainders with receipt ID
-- tie breaking. Unallocated workshop credits proportionately reduce original cash
-- contributions; a refund's later date cannot switch the original earning rate.
create or replace function private.rewards_allocated_receipts(p_facts jsonb,p_eligible bigint)
returns table(fact jsonb,eligible_cents bigint) language sql immutable security invoker set search_path='' as $$
 with raw as (select value as fact,(value->>'amount_cents')::bigint amount from jsonb_array_elements(p_facts)),
 total as (select sum(amount) total from raw),
 shares as (select fact,div(amount::numeric*p_eligible,total)::bigint amount,
   mod(amount::numeric*p_eligible,total) remainder from raw cross join total where total>0),
 ranked as (select *,row_number() over(order by remainder desc,fact->>'original_receipt_id') rank,
   p_eligible-sum(amount) over() extra from shares)
 select fact,amount+case when rank<=extra then 1 else 0 end from ranked
$$;
revoke all on function private.rewards_allocated_receipts(jsonb,bigint) from public,anon,authenticated;
grant execute on function private.rewards_allocated_receipts(jsonb,bigint) to service_role;

create or replace function public.apply_rewards_invoice_v2(
 p_tenant_id uuid,p_invoice_id uuid,p_contact_id uuid,p_invoice_number text,p_provider_updated_at timestamptz,
 p_paid_on date,p_eligible_cents bigint,p_redeemed_points bigint,p_facts jsonb,p_evidence_error text default null
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare customer uuid; policy private.rewards_bonus_policy%rowtype; previous private.rewards_bonus_invoice_states%rowtype;
 standard public.rewards_invoice_states%rowtype; base jsonb; f jsonb; allocated record; fact_ids uuid[]:='{}'; period_ids uuid[]:='{}'; invalidation_ids uuid[]:='{}';
 period_id uuid; fact_id uuid; period_start timestamptz; period_end timestamptz; capacity bigint; used bigint;
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
 if policy.activated_at is not null and p_eligible_cents>0 and pending is null and not exists(select 1 from public.performance_subscriptions
   where customer_id=customer and is_permanent and status='active') then
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
     for evidence in select jsonb_build_object('id',p.id,'start',greatest(p.starts_at,policy.activated_at),
       'end',least(p.ends_at,coalesce(policy.earning_stopped_at,p.ends_at),coalesce((select min(i.effective_at)
          from private.performance_paid_period_invalidations i where i.period_id=p.id),p.ends_at)))
       from private.performance_paid_periods p join private.performance_rewards_events e on e.id=p.source_event_id
       where p.customer_id=customer and e.customer_id=customer and e.verification_state='verified'
         and p.environment='production' and p.ownership_type='PURCHASED' and p.paid_amount>0
       order by p.starts_at,p.ends_at,p.id loop
       if (evidence->>'start')::timestamptz<=lo and (evidence->>'end')::timestamptz>lo then
         period_end:=case when period_id is null then (evidence->>'end')::timestamptz else greatest(period_end,(evidence->>'end')::timestamptz) end;
         period_id:=(evidence->>'id')::uuid;
       elsif period_id is not null and (evidence->>'start')::timestamptz<=period_end then
         period_end:=greatest(period_end,(evidence->>'end')::timestamptz);
       end if;
       if (evidence->>'start')::timestamptz<hi and (evidence->>'end')::timestamptz>lo then candidate:=true; end if;
       if period_id is not null then period_ids:=array_append(period_ids,(evidence->>'id')::uuid); end if;
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
   'paid_on',p_paid_on,'facts',p_facts,'policy',to_jsonb(policy),'periods',evidence,'pending',pending,'target',target)::text||
   coalesce((select jsonb_agg(to_jsonb(i) order by i.id)::text from private.performance_paid_period_invalidations i
     join private.performance_paid_periods p on p.id=i.period_id where p.customer_id=customer),'[]'),'UTF8')),'hex');
 if previous.basis_sha256=basis then return jsonb_build_object('changed',false,'bonus_points',prior,'pending',pending); end if;
 -- Existing base writer validates date/rate, identity, stale revisions and credit
 -- balance before this invoice's new earnings. Its writes roll back with ours.
 base:=private.apply_rewards_standard_snapshot(p_tenant_id,p_invoice_id,p_contact_id,p_invoice_number,p_provider_updated_at,
   p_paid_on,p_eligible_cents,p_eligible_cents/100,p_redeemed_points);
 delta:=target-prior;
 insert into private.rewards_bonus_calculations(tenant_id,invoice_id,invoice_number,contact_id,customer_id,invoice_updated_at,
   policy_revision,policy_sha256,basis_sha256,payment_fact_ids,paid_period_ids,invalidation_ids,eligible_cents,qualifying_cents,standard_target_points,
   prior_bonus_points,bonus_target_points,bonus_delta,calculation_state,pending_reason)
 values(p_tenant_id,p_invoice_id,p_invoice_number,p_contact_id,customer,p_provider_updated_at,policy.policy_revision,
   coalesce(policy.policy_sha256,repeat('0',64)),basis,fact_ids,period_ids,invalidation_ids,p_eligible_cents,q,p_eligible_cents/100,prior,target,delta,
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

create or replace function private.rewards_bonus_pause_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if old.enabled and not new.enabled and old.activated_at is not null then new.earning_stopped_at:=coalesce(old.earning_stopped_at,now()); end if;
 if new.enabled and new.earning_stopped_at is not null then raise exception 'rewards_resume_requires_reviewed_policy'; end if;
 return new;
end $$;
drop trigger if exists rewards_bonus_pause_guard on private.rewards_bonus_policy;
create trigger rewards_bonus_pause_guard before update on private.rewards_bonus_policy for each row execute function private.rewards_bonus_pause_guard();
revoke all on function private.rewards_bonus_pause_guard() from public,anon,authenticated,service_role;

create or replace function public.rewards_provider_retry_customers() returns setof uuid
language sql security invoker set search_path='' as $$
 select distinct customer_id from private.performance_rewards_events
 where verification_state='pending' and next_attempt_at<=now() and attempts<30 order by customer_id limit 5
$$;
revoke all on function public.rewards_provider_retry_customers() from public,anon,authenticated;
grant execute on function public.rewards_provider_retry_customers() to service_role;

create or replace function public.defer_rewards_provider_events(p_customer_id uuid) returns void
language sql security invoker set search_path='' as $$
 update private.performance_rewards_events set attempts=attempts+1,next_attempt_at=now()+interval '5 minutes',
 last_error_code='rewards_provider_fetch_retry' where customer_id=p_customer_id and verification_state='pending' and next_attempt_at<=now()
$$;
revoke all on function public.defer_rewards_provider_events(uuid) from public,anon,authenticated;
grant execute on function public.defer_rewards_provider_events(uuid) to service_role;

create or replace function public.record_rewards_identity_review(p_customer_id uuid,p_event_id text,p_event_at timestamptz) returns void
language plpgsql security invoker set search_path='' as $$
declare e uuid; fingerprint text;
begin
 if p_event_id is null or length(p_event_id) not between 1 and 200 or p_event_at is null or p_event_at>now()+interval '1 minute' then raise exception 'rewards_paid_evidence_invalid'; end if;
 perform pg_advisory_xact_lock(hashtextextended('rewards_evidence:'||p_customer_id::text,0));
 fingerprint:=encode(sha256(convert_to(p_customer_id::text||p_event_id||p_event_at::text,'UTF8')),'hex');
 insert into private.performance_rewards_events(provider_event_id,customer_id,event_at,source_sha256,verification_state,verified_at)
 values('transfer:'||fingerprint,p_customer_id,p_event_at,fingerprint,'verified',now()) on conflict do nothing;
 select id into e from private.performance_rewards_events where provider_event_id='transfer:'||fingerprint;
 insert into private.performance_paid_period_invalidations(period_id,source_event_id,effective_at,reason,verified_at,evidence_sha256)
 select id,e,p_event_at,'identity_review',now(),fingerprint from private.performance_paid_periods where customer_id=p_customer_id on conflict do nothing;
 perform private.requeue_rewards_customer(p_customer_id);
end $$;
revoke all on function public.record_rewards_identity_review(uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.record_rewards_identity_review(uuid,text,timestamptz) to service_role;

create or replace function public.rewards_bonus_runtime_config() returns jsonb
language sql security invoker set search_path='' as $$
 select jsonb_build_object('implemented',true,'enabled',enabled and activated_at<=now(),
   'has_activated',activated_at is not null,'activated_at',activated_at,'policy_revision',policy_revision)
 from private.rewards_bonus_policy where singleton
$$;
revoke all on function public.rewards_bonus_runtime_config() from public,anon,authenticated;
grant execute on function public.rewards_bonus_runtime_config() to service_role;

-- Reuse the existing five minute invoice scheduler, including provider retries
-- when there is no newly changed Xero invoice. No new schedule or credentials.
create or replace function private.dispatch_rewards_invoices() returns bigint
language plpgsql security invoker set search_path='' as $$
declare project_url text; anon_jwt text; cron_token text;
begin
 if not exists(select 1 from public.rewards_config where enabled) then return null; end if;
 if not exists(select 1 from public.rewards_invoice_queue where revision>processed_revision and available_at<=now() and attempts<30
   and (lease_until is null or lease_until<now())) and not exists(select 1 from public.rewards_provider_retry_customers()) then return null; end if;
 select decrypted_secret into project_url from vault.decrypted_secrets where name='psi_service_reminder_project_url';
 select decrypted_secret into anon_jwt from vault.decrypted_secrets where name='psi_service_reminder_anon_jwt';
 select decrypted_secret into cron_token from vault.decrypted_secrets where name='psi_service_reminder_cron_token';
 if project_url is null or anon_jwt is null or cron_token is null then raise exception 'rewards_scheduler_not_configured'; end if;
 return net.http_post(url:=rtrim(project_url,'/')||'/functions/v1/process-rewards-invoices',
 headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||anon_jwt,'apikey',anon_jwt),
 body:=jsonb_build_object('cronToken',cron_token),timeout_milliseconds:=30000);
end $$;

create or replace function public.rewards_invoice_earnings(p_customer_id uuid) returns jsonb
language sql security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('invoiceId',s.invoice_id,'invoiceNumber',s.invoice_number,'paidOn',s.paid_on,
   'standardPoints',s.earned_points,'bonusPoints',coalesce(b.bonus_points,0),'totalPoints',s.earned_points+coalesce(b.bonus_points,0),
   'bonusPending',b.evidence_error is not null) order by s.paid_on desc nulls last,s.invoice_id),'[]')
 from public.rewards_invoice_states s left join private.rewards_bonus_invoice_states b using(tenant_id,invoice_id)
 where s.customer_id=p_customer_id
$$;
revoke all on function public.rewards_invoice_earnings(uuid) from public,anon,authenticated;
grant execute on function public.rewards_invoice_earnings(uuid) to service_role;

create or replace function public.rewards_history_page(p_customer_id uuid,p_before_at timestamptz default null,p_before_id uuid default null,p_limit integer default 30)
returns jsonb language sql security invoker set search_path='' as $$
 with history as (
   select id,invoice_number,points_change,kind,created_at from public.rewards_ledger where customer_id=p_customer_id
   union all select id,invoice_number,points_change,kind,created_at from public.rewards_bonus_ledger where customer_id=p_customer_id
 ), page as (
   select * from history where (p_before_at is null and p_before_id is null) or (created_at,id)<(p_before_at,p_before_id)
   order by created_at desc,id desc limit greatest(1,least(100,p_limit))+1
 ), visible as (select * from page order by created_at desc,id desc limit greatest(1,least(100,p_limit)))
 select jsonb_build_object('entries',coalesce((select jsonb_agg(to_jsonb(v) order by created_at desc,id desc) from visible v),'[]'),
   'hasMore',(select count(*) from page)>greatest(1,least(100,p_limit)),
   'cursor',(select jsonb_build_object('at',created_at,'id',id) from visible order by created_at,id limit 1))
$$;
revoke all on function public.rewards_history_page(uuid,timestamptz,uuid,integer) from public,anon,authenticated;
grant execute on function public.rewards_history_page(uuid,timestamptz,uuid,integer) to service_role;

create or replace function public.rewards_bonus_financial_report() returns jsonb
language sql security invoker set search_path='' as $$
 select jsonb_build_object('standardNetPoints',(select coalesce(sum(points_change),0) from public.rewards_ledger where kind in ('earned','adjustment')),
 'bonusIssuedPoints',(select coalesce(sum(points_change),0) from public.rewards_bonus_ledger where points_change>0),
 'bonusReversedPoints',(select -coalesce(sum(points_change),0) from public.rewards_bonus_ledger where points_change<0),
 'creditUsedNetPoints',(select -coalesce(sum(points_change),0) from public.rewards_ledger where kind in ('redeemed','credit_restored')),
 'combinedBalancePoints',(select coalesce(sum(points_balance),0) from public.rewards_accounts),
 'openingPoints',(select coalesce(sum(opening_points),0) from private.rewards_opening_balance_audit),
 'pendingInvoiceCount',(select count(*) from private.rewards_bonus_invoice_states where evidence_error is not null),
 'pendingMaximumBonusPoints',(select coalesce(sum(greatest(s.earned_points-b.bonus_points,0)),0) from private.rewards_bonus_invoice_states b
   join public.rewards_invoice_states s using(tenant_id,invoice_id) where b.evidence_error is not null))
$$;
revoke all on function public.rewards_bonus_financial_report() from public,anon,authenticated;
grant execute on function public.rewards_bonus_financial_report() to service_role;

-- Nothing calls this on installation. Activation requires a reviewed future time
-- and explicit release reference, and refuses to race an existing leased worker.
create or replace function private.set_rewards_bonus_activation(p_at timestamptz,p_release_reference text) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if p_at<now() or p_at is null or length(coalesce(p_release_reference,''))<10 then raise exception 'rewards_release_approval_required'; end if;
 lock table public.rewards_invoice_queue in share row exclusive mode;
 if exists(select 1 from public.rewards_invoice_queue where lease_until>now()) then raise exception 'rewards_worker_leases_active'; end if;
 if exists(select 1 from private.rewards_bonus_policy where activated_at is not null) then raise exception 'rewards_activation_already_recorded'; end if;
 update private.rewards_bonus_policy set enabled=true,activated_at=p_at,approved_at=now(),approval_reference=p_release_reference,
   policy_sha256=encode(sha256(convert_to('each_receipt|standard_until_verified_renewal|whole_day_or_precise_evidence|proportionate_original_receipts|preserve_legitimate_prior_rewards','UTF8')),'hex') where singleton;
end $$;
revoke all on function private.set_rewards_bonus_activation(timestamptz,text) from public,anon,authenticated,service_role;
grant execute on function private.set_rewards_bonus_activation(timestamptz,text) to postgres;

-- Keep active worker unchanged until release. New workers use v2 even while the
-- gate is disabled, retaining precisely the old standard calculation and balance.
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname in ('ingest_rewards_provider_event','rewards_pending_provider_events',
     'record_rewards_paid_evidence','record_rewards_paid_revocations','apply_rewards_invoice_v2','apply_rewards_invoice_snapshot') loop
   execute format('revoke all on function %s from public,anon,authenticated',f.signature);
   execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
-- Contract fingerprint covers all new table columns, checks, indexes, permissions
-- and RLS policies. A replay refuses unexpected drift before replacing anything.
create or replace function private.rewards_bonus_schema_contract() returns text
language sql stable security invoker set search_path='' as $$
 with relations as (
   select c.oid,n.nspname,c.relname,c.relrowsecurity,c.relacl from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where (n.nspname='private' and c.relname in ('rewards_bonus_policy','performance_rewards_events','performance_paid_periods',
     'performance_paid_period_invalidations','rewards_payment_facts','rewards_bonus_calculations','rewards_bonus_invoice_states','rewards_opening_balance_audit'))
     or (n.nspname='public' and c.relname='rewards_bonus_ledger')
 ), contract as (
   select jsonb_build_object('schema',r.nspname,'table',r.relname,'rls',r.relrowsecurity,'grants',r.relacl,
     'columns',(select jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,
       pg_get_expr(d.adbin,d.adrelid)) order by a.attnum) from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
       where a.attrelid=r.oid and a.attnum>0 and not a.attisdropped),
     'constraints',(select jsonb_agg(pg_get_constraintdef(c.oid) order by c.conname) from pg_constraint c where c.conrelid=r.oid),
     'indexes',(select jsonb_agg(indexdef order by indexname) from pg_indexes where schemaname=r.nspname and tablename=r.relname),
     'policies',(select jsonb_agg(to_jsonb(p) order by p.policyname) from pg_policies p where p.schemaname=r.nspname and p.tablename=r.relname)
   ) value from relations r
 ) select encode(sha256(convert_to(jsonb_agg(value order by value->>'schema',value->>'table')::text,'UTF8')),'hex') from contract
$$;
revoke all on function private.rewards_bonus_schema_contract() from public,anon,authenticated,service_role;
insert into private.rewards_bonus_schema_version(version,fingerprint,contract_sha256)
values(1,'psi_paid_rewards_v1_20261024',private.rewards_bonus_schema_contract()) on conflict do nothing;
commit;
