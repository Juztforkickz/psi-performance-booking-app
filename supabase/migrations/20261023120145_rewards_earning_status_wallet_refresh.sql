-- Local implementation pending explicit deployment approval.
-- Read verified paid evidence only when the separately approved earning policy is
-- installed AND enabled. This migration neither installs nor enables double earning.
create or replace function public.rewards_earning_status(p_customer_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  chosen public.performance_subscriptions%rowtype;
  subscription_status text := 'free';
  ended boolean;
  bonus_enabled boolean := false;
  paid jsonb;
begin
  if not exists(select 1 from public.customer_profiles
    where user_id=p_customer_id and account_state='active') then
    raise exception 'rewards_account_unavailable' using errcode='42501';
  end if;
  select * into chosen from public.performance_subscriptions s
  where s.customer_id=p_customer_id and s.environment='production'
    and s.status in ('active','grace_period')
    and (s.is_permanent or s.expires_at>now())
  order by s.is_permanent desc,(s.provider<>'complimentary') desc,s.expires_at desc nulls first limit 1;
  ended := exists(select 1 from public.performance_subscriptions s
    where s.customer_id=p_customer_id and not s.is_permanent
      and s.environment='production' and s.expires_at<=now());
  subscription_status := case when chosen.is_permanent then 'permanent'
    when chosen.provider='complimentary' and chosen.provider_reference='trial:'||p_customer_id::text then 'trial'
    when chosen.id is not null then 'active' when ended then 'expired' else 'free' end;

  -- The reviewed financial schema is optional. Missing/unready evidence fails to 1x.
  -- Dynamic SQL avoids binding a migration to unapplied proposal tables.
  if to_regclass('private.rewards_bonus_policy') is not null
    and to_regclass('private.performance_paid_periods') is not null
    and to_regclass('private.performance_rewards_events') is not null
    and to_regclass('private.performance_paid_period_invalidations') is not null then
    begin
      execute 'select coalesce(bool_or(enabled and activated_at<=now()),false)
        from private.rewards_bonus_policy where singleton' into bonus_enabled;
      if bonus_enabled and subscription_status='active' and chosen.provider='revenuecat'
        and chosen.verified_at is not null and not chosen.is_permanent then
        execute $paid$
          select jsonb_build_object('store',p.store,'product_id',p.product_id,
            'valid_until',least(p.ends_at,$2),'verified_at',p.verified_at)
          from private.performance_paid_periods p
          join private.performance_rewards_events e on e.id=p.source_event_id
            and e.customer_id=p.customer_id and e.verification_state='verified'
          where p.customer_id=$1 and p.environment='production' and p.ownership_type='PURCHASED'
            and p.paid_amount>0 and p.period_type in ('NORMAL','INTRO','PREPAID','PROMOTIONAL')
            and p.starts_at<=now() and p.ends_at>now() and p.verified_at<=now()
            and not exists(select 1 from private.performance_paid_period_invalidations i
              where i.period_id=p.id and i.effective_at<=now())
          order by p.ends_at desc limit 1
        $paid$ into paid using p_customer_id,chosen.expires_at;
      end if;
    exception when undefined_table or undefined_column then
      bonus_enabled := false; paid := null;
    end;
  end if;
  return jsonb_build_object('customer_id',p_customer_id,'subscription_status',subscription_status,
    'subscription_expires_at',chosen.expires_at,'bonus_enabled',bonus_enabled,
    'multiplier',case when paid is not null then 2 else 1 end,
    'paid_period_verified',paid is not null,'environment','production',
    'store',paid->>'store','product_id',paid->>'product_id','valid_until',paid->>'valid_until',
    'verified_at',coalesce(paid->>'verified_at',chosen.verified_at::text),'server_time',now());
end $$;
revoke all on function public.rewards_earning_status(uuid) from public,anon,authenticated;
grant execute on function public.rewards_earning_status(uuid) to service_role;

alter table public.rewards_wallet_members
  add column if not exists earning_fingerprint text,
  add column if not exists earning_expires_at timestamptz,
  add column if not exists earning_checked_at timestamptz;

-- Only the existing authenticated backend calls this with its verified status.
-- Account balance and history never change. Returning the locked account snapshot
-- keeps a concurrent financial update from being acknowledged with an old balance.
create or replace function public.refresh_rewards_wallet_membership(
  p_customer_id uuid,p_fingerprint text,p_expires_at timestamptz
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare account public.rewards_accounts%rowtype; member public.rewards_wallet_members%rowtype;
begin
  if p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$'
    or not exists(select 1 from public.customer_profiles where user_id=p_customer_id and account_state='active') then
    raise exception 'rewards_membership_invalid';
  end if;
  select * into account from public.rewards_accounts where customer_id=p_customer_id for update;
  if not found then raise exception 'rewards_account_unavailable'; end if;
  select * into member from public.rewards_wallet_members where customer_id=p_customer_id for update;
  if found then
    if member.earning_fingerprint is distinct from p_fingerprint then
      update public.rewards_accounts set revision=revision+1,updated_at=now()
        where customer_id=p_customer_id returning * into account;
    end if;
    update public.rewards_wallet_members set earning_fingerprint=p_fingerprint,
      earning_expires_at=p_expires_at,earning_checked_at=now() where customer_id=p_customer_id;
  end if;
  return jsonb_build_object('customer_id',account.customer_id,'card_id',account.card_id,
    'revision',account.revision,'updated_at',account.updated_at,'points_balance',account.points_balance);
end $$;
revoke all on function public.refresh_rewards_wallet_membership(uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.refresh_rewards_wallet_membership(uuid,text,timestamptz) to service_role;

create or replace function public.rewards_dirty_wallets(p_limit integer default 10) returns setof uuid
language sql security invoker set search_path='' as $$
  select a.customer_id from public.rewards_accounts a join public.rewards_wallet_members w using(customer_id)
  where (w.google_object_id is not null or exists(select 1 from public.rewards_wallet_devices d where d.customer_id=a.customer_id))
    and ((w.google_object_id is not null and w.google_synced_revision<a.revision)
      or (w.apple_synced_revision<a.revision and exists(select 1 from public.rewards_wallet_devices d where d.customer_id=a.customer_id))
      or w.earning_checked_at is null or w.earning_checked_at<=now()-interval '5 minutes'
      or (w.earning_expires_at<=now() and w.earning_checked_at<w.earning_expires_at)
      or exists(select 1 from public.performance_subscriptions s where s.customer_id=a.customer_id and s.verified_at>w.earning_checked_at))
  order by ((w.google_object_id is not null and w.google_synced_revision<a.revision)
    or w.apple_synced_revision<a.revision) desc, w.updated_at
  limit greatest(1,least(20,p_limit))
$$;
revoke all on function public.rewards_dirty_wallets(integer) from public,anon,authenticated;
grant execute on function public.rewards_dirty_wallets(integer) to service_role;

-- Reuse the same scheduler, credentials, rate and update endpoint. No new cron job.
create or replace function private.dispatch_rewards_wallet_updates() returns bigint
language plpgsql security invoker set search_path='' as $$
declare project_url text; anon_jwt text; cron_token text;
begin
  if not exists(select 1 from public.rewards_dirty_wallets(1)) then return null; end if;
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
