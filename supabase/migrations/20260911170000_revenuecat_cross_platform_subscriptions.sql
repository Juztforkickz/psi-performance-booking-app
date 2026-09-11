-- Store one authoritative RevenueCat entitlement per PSI customer, regardless
-- of whether the verified purchase originated in the App Store or Google Play.
alter table public.performance_subscriptions
  drop constraint if exists performance_subscriptions_provider_check;

alter table public.performance_subscriptions
  add constraint performance_subscriptions_provider_check
  check (provider in ('apple','google_play','revenuecat','stripe','complimentary'));

update public.performance_subscriptions
set provider = 'revenuecat'
where provider = 'apple'
  and provider_reference = 'revenuecat:' || customer_id::text;

create or replace function public.record_verified_performance_subscription(
 p_customer_id uuid,p_environment text,p_status text,p_expires_at timestamptz,p_auto_renews boolean,p_verified_at timestamptz
) returns void language sql security invoker set search_path='' as $$
 insert into public.performance_subscriptions(customer_id,provider,provider_reference,environment,status,expires_at,auto_renews,verified_at)
 values(p_customer_id,'revenuecat','revenuecat:'||p_customer_id::text,p_environment,p_status,p_expires_at,p_auto_renews,p_verified_at)
 on conflict(provider,provider_reference,environment) do update set
 status=excluded.status,expires_at=excluded.expires_at,auto_renews=excluded.auto_renews,verified_at=excluded.verified_at
 where public.performance_subscriptions.verified_at<excluded.verified_at
$$;

revoke all on function public.record_verified_performance_subscription(uuid,text,text,timestamptz,boolean,timestamptz) from public,anon,authenticated;
grant execute on function public.record_verified_performance_subscription(uuid,text,text,timestamptz,boolean,timestamptz) to service_role;
