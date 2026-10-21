-- PSI Rewards: 1 point per whole AUD 1 paid; 1,000 points = AUD 10 credit.
-- No browser/customer can write balances, award points, redeem credit or submit invoice truth.
create table public.rewards_config (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false,
  starts_on date not null default (now() at time zone 'Australia/Melbourne')::date,
  tenant_id uuid not null default 'e0ed54cc-662b-4e45-9fdd-7de6b2d333cf'
);
insert into public.rewards_config(singleton) values(true);
alter table public.rewards_config enable row level security;
revoke all on public.rewards_config from public,anon,authenticated;
grant select,update on public.rewards_config to service_role;

create table public.rewards_accounts (
  customer_id uuid primary key references public.customer_profiles(user_id) on delete cascade,
  card_id uuid not null default gen_random_uuid() unique,
  points_balance bigint not null default 0,
  updated_at timestamptz not null default now(),
  revision bigint not null default 1
);
alter table public.rewards_accounts enable row level security;
revoke all on public.rewards_accounts from public,anon,authenticated;
grant select on public.rewards_accounts to authenticated;
grant select,insert,update,delete on public.rewards_accounts to service_role;
create policy rewards_account_owner_read on public.rewards_accounts for select to authenticated
using(customer_id=(select auth.uid()));

create table public.rewards_invoice_states (
  tenant_id uuid not null,
  invoice_id uuid not null,
  customer_id uuid not null references public.customer_profiles(user_id) on delete cascade,
  contact_id uuid not null,
  invoice_number text not null,
  earned_points bigint not null default 0 check(earned_points>=0),
  redeemed_points bigint not null default 0 check(redeemed_points>=0),
  eligible_cents bigint not null default 0 check(eligible_cents>=0),
  provider_updated_at timestamptz not null,
  paid_on date,
  primary key(tenant_id,invoice_id)
);
alter table public.rewards_invoice_states enable row level security;
revoke all on public.rewards_invoice_states from public,anon,authenticated;
grant select,insert,update,delete on public.rewards_invoice_states to service_role;
create index rewards_invoice_customer_idx on public.rewards_invoice_states(customer_id);

create table public.rewards_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customer_profiles(user_id) on delete cascade,
  tenant_id uuid not null,
  invoice_id uuid not null,
  invoice_number text not null,
  points_change bigint not null check(points_change<>0),
  kind text not null check(kind in ('earned','adjustment','redeemed','credit_restored')),
  provider_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique(tenant_id,invoice_id,provider_updated_at,kind)
);
alter table public.rewards_ledger enable row level security;
revoke all on public.rewards_ledger from public,anon,authenticated;
grant select on public.rewards_ledger to authenticated;
grant select,insert,delete on public.rewards_ledger to service_role;
create policy rewards_ledger_owner_read on public.rewards_ledger for select to authenticated
using(customer_id=(select auth.uid()));
create index rewards_ledger_customer_date_idx on public.rewards_ledger(customer_id,created_at desc);

create table public.rewards_invoice_queue (
  tenant_id uuid not null,
  invoice_id uuid not null,
  revision bigint not null default 1,
  processed_revision bigint not null default 0,
  available_at timestamptz not null default now(),
  lease_token uuid,
  lease_until timestamptz,
  attempts integer not null default 0,
  last_error text,
  primary key(tenant_id,invoice_id)
);
alter table public.rewards_invoice_queue enable row level security;
revoke all on public.rewards_invoice_queue from public,anon,authenticated;
grant select,insert,update,delete on public.rewards_invoice_queue to service_role;
create index rewards_queue_due_idx on public.rewards_invoice_queue(available_at) where revision>processed_revision;

-- Called by the verified Xero webhook. Separate from PDF-import holds and owner decisions.
create function public.enqueue_rewards_invoices(p_events jsonb) returns integer
language plpgsql security invoker set search_path='' as $$
declare item jsonb; changed integer:=0;
begin
  if jsonb_typeof(p_events)<>'array' or jsonb_array_length(p_events)>100 then raise exception 'invalid_events'; end if;
  for item in select value from jsonb_array_elements(p_events) loop
    if not exists(select 1 from public.rewards_config where enabled and tenant_id=(item->>'tenantId')::uuid) then continue; end if;
    if (item->>'invoiceId') is null then raise exception 'invoice_id_required'; end if;
    insert into public.rewards_invoice_queue(tenant_id,invoice_id)
    values((item->>'tenantId')::uuid,(item->>'invoiceId')::uuid)
    on conflict(tenant_id,invoice_id) do update set revision=rewards_invoice_queue.revision+1,available_at=now(),attempts=0;
    changed:=changed+1;
  end loop;
  return changed;
end $$;
revoke all on function public.enqueue_rewards_invoices(jsonb) from public,anon,authenticated;
grant execute on function public.enqueue_rewards_invoices(jsonb) to service_role;

create function public.claim_rewards_invoices(p_limit integer default 5) returns setof public.rewards_invoice_queue
language sql security invoker set search_path='' as $$
  update public.rewards_invoice_queue q set lease_token=gen_random_uuid(),lease_until=now()+interval '3 minutes',attempts=attempts+1
  from(select tenant_id,invoice_id from public.rewards_invoice_queue
    where revision>processed_revision and available_at<=now() and attempts<30
      and (lease_until is null or lease_until<now())
    order by available_at limit greatest(1,least(10,p_limit)) for update skip locked) picked
  where q.tenant_id=picked.tenant_id and q.invoice_id=picked.invoice_id returning q.*
$$;
revoke all on function public.claim_rewards_invoices(integer) from public,anon,authenticated;
grant execute on function public.claim_rewards_invoices(integer) to service_role;

-- Backend-only atomic snapshot application. Lock the account before the invoice,
-- preventing concurrent invoices from spending the same balance. No email/name matching.
create function public.apply_rewards_invoice_snapshot(
 p_tenant_id uuid,p_invoice_id uuid,p_contact_id uuid,p_invoice_number text,
 p_provider_updated_at timestamptz,p_paid_on date,p_eligible_cents bigint,p_earned_points bigint,p_redeemed_points bigint
) returns jsonb language plpgsql security definer set search_path='' as $$
declare customer uuid; account public.rewards_accounts%rowtype; previous public.rewards_invoice_states%rowtype;
 earned_change bigint; redeemed_change bigint; old_earned bigint:=0; old_redeemed bigint:=0;
begin
 if not exists(select 1 from public.rewards_config where enabled and tenant_id=p_tenant_id) then raise exception 'rewards_not_enabled'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text||':'||p_invoice_id::text,0));
 if p_eligible_cents is null or p_eligible_cents<0 or p_eligible_cents>2147483647
   or p_earned_points is null or p_earned_points<>p_eligible_cents/100
   or p_redeemed_points is null or p_redeemed_points<0 or p_redeemed_points>2147483647
   or p_provider_updated_at is null or p_invoice_id is null then raise exception 'invalid_rewards_snapshot'; end if;
 if p_earned_points>0 and (p_paid_on is null or p_paid_on<(select starts_on from public.rewards_config where singleton)
   or p_paid_on>(now() at time zone 'Australia/Melbourne')::date) then raise exception 'invalid_reward_date'; end if;
 select link.customer_id into customer from private.xero_customer_links link
 join public.customer_profiles profile on profile.user_id=link.customer_id and profile.account_state='active'
 where link.tenant_id=p_tenant_id and link.contact_id=p_contact_id and link.verified_by is not null and link.verified_at is not null;
 if customer is null then raise exception 'verified_rewards_customer_required'; end if;
 insert into public.rewards_accounts(customer_id) values(customer) on conflict do nothing;
 select * into account from public.rewards_accounts where customer_id=customer for update;
 select * into previous from public.rewards_invoice_states where tenant_id=p_tenant_id and invoice_id=p_invoice_id for update;
 if found then
   if previous.customer_id<>customer or previous.contact_id<>p_contact_id then raise exception 'rewards_invoice_identity_changed'; end if;
   if previous.provider_updated_at>p_provider_updated_at then return jsonb_build_object('changed',false,'stale',true); end if;
   if previous.provider_updated_at=p_provider_updated_at then
     if previous.earned_points<>p_earned_points or previous.redeemed_points<>p_redeemed_points then raise exception 'rewards_version_conflict'; end if;
     return jsonb_build_object('changed',false);
   end if;
   old_earned:=previous.earned_points; old_redeemed:=previous.redeemed_points;
 end if;
 earned_change:=p_earned_points-old_earned; redeemed_change:=p_redeemed_points-old_redeemed;
 -- This invoice cannot fund its own redemption. Existing earned points may be reversed after a refund.
 if redeemed_change>0 and account.points_balance<redeemed_change then raise exception 'rewards_credit_exceeds_balance'; end if;
 insert into public.rewards_invoice_states(tenant_id,invoice_id,customer_id,contact_id,invoice_number,earned_points,redeemed_points,eligible_cents,provider_updated_at,paid_on)
 values(p_tenant_id,p_invoice_id,customer,p_contact_id,left(coalesce(p_invoice_number,''),120),p_earned_points,p_redeemed_points,p_eligible_cents,p_provider_updated_at,p_paid_on)
 on conflict(tenant_id,invoice_id) do update set invoice_number=excluded.invoice_number,earned_points=excluded.earned_points,
 redeemed_points=excluded.redeemed_points,eligible_cents=excluded.eligible_cents,provider_updated_at=excluded.provider_updated_at,paid_on=excluded.paid_on;
 if earned_change<>0 then
   insert into public.rewards_ledger(customer_id,tenant_id,invoice_id,invoice_number,points_change,kind,provider_updated_at)
   values(customer,p_tenant_id,p_invoice_id,p_invoice_number,earned_change,case when earned_change>0 then 'earned' else 'adjustment' end,p_provider_updated_at);
 end if;
 if redeemed_change<>0 then
   insert into public.rewards_ledger(customer_id,tenant_id,invoice_id,invoice_number,points_change,kind,provider_updated_at)
   values(customer,p_tenant_id,p_invoice_id,p_invoice_number,-redeemed_change,case when redeemed_change>0 then 'redeemed' else 'credit_restored' end,p_provider_updated_at);
 end if;
 if earned_change<>0 or redeemed_change<>0 then
   update public.rewards_accounts set points_balance=points_balance+earned_change-redeemed_change,updated_at=now(),revision=revision+1 where customer_id=customer;
 end if;
 return jsonb_build_object('changed',earned_change<>0 or redeemed_change<>0,'customer_id',customer);
end $$;
revoke all on function public.apply_rewards_invoice_snapshot(uuid,uuid,uuid,text,timestamptz,date,bigint,bigint,bigint) from public,anon,authenticated;
grant execute on function public.apply_rewards_invoice_snapshot(uuid,uuid,uuid,text,timestamptz,date,bigint,bigint,bigint) to service_role;

create function private.dispatch_rewards_invoices() returns bigint
language plpgsql security invoker set search_path='' as $$
declare project_url text; anon_jwt text; cron_token text;
begin
 if not exists(select 1 from public.rewards_config where enabled) then return null; end if;
 if not exists(select 1 from public.rewards_invoice_queue where revision>processed_revision and available_at<=now() and attempts<30
   and (lease_until is null or lease_until<now())) then return null; end if;
 select decrypted_secret into project_url from vault.decrypted_secrets where name='psi_service_reminder_project_url';
 select decrypted_secret into anon_jwt from vault.decrypted_secrets where name='psi_service_reminder_anon_jwt';
 select decrypted_secret into cron_token from vault.decrypted_secrets where name='psi_service_reminder_cron_token';
 if project_url is null or anon_jwt is null or cron_token is null then raise exception 'rewards_scheduler_not_configured'; end if;
 return net.http_post(url:=rtrim(project_url,'/')||'/functions/v1/process-rewards-invoices',
 headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||anon_jwt,'apikey',anon_jwt),
 body:=jsonb_build_object('cronToken',cron_token),timeout_milliseconds:=30000);
end $$;
revoke all on function private.dispatch_rewards_invoices() from public,anon,authenticated,service_role;
grant execute on function private.dispatch_rewards_invoices() to postgres;
select cron.schedule('psi-rewards-invoices','*/5 * * * *','select private.dispatch_rewards_invoices();');

-- Wallet authentication and device push tokens never appear in customer table reads.
create table public.rewards_wallet_members (
 customer_id uuid primary key references public.rewards_accounts(customer_id) on delete cascade,
 apple_auth_token text not null default replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''),
 apple_synced_revision bigint not null default 0,
 google_object_id text,
 google_synced_revision bigint not null default 0,
 last_error text,
 updated_at timestamptz not null default now()
);
alter table public.rewards_wallet_members enable row level security;
revoke all on public.rewards_wallet_members from public,anon,authenticated;
grant select,insert,update,delete on public.rewards_wallet_members to service_role;
create table public.rewards_wallet_devices (
 device_id text not null check(length(device_id) between 8 and 200),
 customer_id uuid not null references public.rewards_accounts(customer_id) on delete cascade,
 push_token text not null check(length(push_token) between 32 and 256),
 primary key(device_id,customer_id)
);
alter table public.rewards_wallet_devices enable row level security;
revoke all on public.rewards_wallet_devices from public,anon,authenticated;
grant select,insert,update,delete on public.rewards_wallet_devices to service_role;
create index rewards_wallet_devices_customer_idx on public.rewards_wallet_devices(customer_id);
create table public.rewards_wallet_downloads (
 token_hash text primary key check(length(token_hash)=64),
 customer_id uuid not null references public.rewards_accounts(customer_id) on delete cascade,
 expires_at timestamptz not null default now()+interval '2 minutes'
);
alter table public.rewards_wallet_downloads enable row level security;
revoke all on public.rewards_wallet_downloads from public,anon,authenticated;
grant select,insert,delete on public.rewards_wallet_downloads to service_role;

create function private.dispatch_rewards_wallet_updates() returns bigint
language plpgsql security invoker set search_path='' as $$
declare project_url text; anon_jwt text; cron_token text;
begin
 if not exists(select 1 from public.rewards_accounts a join public.rewards_wallet_members w using(customer_id)
   where (w.google_object_id is not null and w.google_synced_revision<a.revision)
    or (w.apple_synced_revision<a.revision and exists(select 1 from public.rewards_wallet_devices d where d.customer_id=a.customer_id))) then return null; end if;
 select decrypted_secret into project_url from vault.decrypted_secrets where name='psi_service_reminder_project_url';
 select decrypted_secret into anon_jwt from vault.decrypted_secrets where name='psi_service_reminder_anon_jwt';
 select decrypted_secret into cron_token from vault.decrypted_secrets where name='psi_service_reminder_cron_token';
 if project_url is null or anon_jwt is null or cron_token is null then raise exception 'rewards_scheduler_not_configured'; end if;
 return net.http_post(url:=rtrim(project_url,'/')||'/functions/v1/rewards-wallet',
 headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||anon_jwt,'apikey',anon_jwt),
 body:=jsonb_build_object('action','sync_wallets','cronToken',cron_token),timeout_milliseconds:=30000);
end $$;
revoke all on function private.dispatch_rewards_wallet_updates() from public,anon,authenticated,service_role;
grant execute on function private.dispatch_rewards_wallet_updates() to postgres;
select cron.schedule('psi-rewards-wallet-updates','*/5 * * * *','select private.dispatch_rewards_wallet_updates();');

create function public.rewards_dirty_wallets(p_limit integer default 10) returns setof uuid
language sql security invoker set search_path='' as $$
 select a.customer_id from public.rewards_accounts a join public.rewards_wallet_members w using(customer_id)
 where (w.google_object_id is not null and w.google_synced_revision<a.revision)
   or (w.apple_synced_revision<a.revision and exists(select 1 from public.rewards_wallet_devices d where d.customer_id=a.customer_id))
 order by w.updated_at limit greatest(1,least(20,p_limit))
$$;
revoke all on function public.rewards_dirty_wallets(integer) from public,anon,authenticated;
grant execute on function public.rewards_dirty_wallets(integer) to service_role;
