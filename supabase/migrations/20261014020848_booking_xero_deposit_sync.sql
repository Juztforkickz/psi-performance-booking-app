-- Financial writes remain disabled until the owner grants Xero scopes and enables.
create table public.booking_xero_deposit_config (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false,
  tenant_id uuid,
  bank_account_id uuid,
  fee_account_code text,
  stripe_contact_id uuid,
  updated_at timestamptz not null default now()
);
alter table public.booking_xero_deposit_config enable row level security;
revoke all on public.booking_xero_deposit_config from public,anon,authenticated;
grant select,update,insert on public.booking_xero_deposit_config to service_role;
insert into public.booking_xero_deposit_config(singleton) values(true);

create table public.booking_xero_deposit_sync (
  payment_attempt_id uuid primary key references public.booking_payment_attempts(id),
  status text not null default 'pending' check(status in ('pending','waiting_invoice','synced','needs_review','failed')),
  payment_id uuid,
  fee_transaction_id uuid,
  invoice_id uuid,
  fee_cents integer check(fee_cents>=0),
  net_cents integer,
  write_intents jsonb not null default '{}'::jsonb,
  available_at timestamptz not null default now(),
  lease_token uuid,
  lease_until timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);
alter table public.booking_xero_deposit_sync enable row level security;
revoke all on public.booking_xero_deposit_sync from public,anon,authenticated;
grant select,insert,update on public.booking_xero_deposit_sync to service_role;
create index booking_xero_deposit_due_idx on public.booking_xero_deposit_sync(available_at)
where status in ('pending','waiting_invoice','failed');

create function private.enqueue_booking_xero_deposit() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.state='paid' and new.provider='stripe' and new.currency='AUD' then
    insert into public.booking_xero_deposit_sync(payment_attempt_id) values(new.id) on conflict do nothing;
  end if;
  return new;
end $$;
revoke all on function private.enqueue_booking_xero_deposit() from public,anon,authenticated,service_role;
create trigger enqueue_booking_xero_deposit after insert or update of state on public.booking_payment_attempts
for each row execute function private.enqueue_booking_xero_deposit();
-- Historical deposits may have been entered manually without a provider reference.
-- They require a separate reconciliation, rather than automatic backfill writes.
insert into public.booking_xero_deposit_sync(payment_attempt_id,status,last_error)
select id,'needs_review','historical_deposit_requires_review' from public.booking_payment_attempts where state='paid' and provider='stripe' and currency='AUD'
on conflict do nothing;

-- Atomic leases prevent two workers from posting the same deposit concurrently.
create function public.claim_booking_xero_deposit(p_id uuid) returns jsonb
language sql security invoker set search_path='' as $$
  update public.booking_xero_deposit_sync set lease_token=gen_random_uuid(),lease_until=now()+interval '3 minutes'
  where payment_attempt_id=p_id and status in ('pending','waiting_invoice','failed')
  and available_at<=now() and (lease_until is null or lease_until<now())
  returning to_jsonb(booking_xero_deposit_sync.*)
$$;
revoke all on function public.claim_booking_xero_deposit(uuid) from public,anon,authenticated;
grant execute on function public.claim_booking_xero_deposit(uuid) to service_role;

create function private.dispatch_booking_xero_deposits() returns bigint
language plpgsql security definer set search_path='' as $$
declare project_url text; anon_jwt text; cron_token text;
begin
 if not exists(select 1 from public.booking_xero_deposit_config where enabled)
 or not exists(select 1 from public.booking_xero_deposit_sync where status in ('pending','waiting_invoice','failed') and available_at<=now()) then return null; end if;
 select decrypted_secret into project_url from vault.decrypted_secrets where name='psi_service_reminder_project_url';
 select decrypted_secret into anon_jwt from vault.decrypted_secrets where name='psi_service_reminder_anon_jwt';
 select decrypted_secret into cron_token from vault.decrypted_secrets where name='psi_service_reminder_cron_token';
 if project_url is null or anon_jwt is null or cron_token is null then raise exception 'deposit_scheduler_not_configured'; end if;
 return net.http_post(url:=rtrim(project_url,'/')||'/functions/v1/process-booking-xero-deposits',
 headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||anon_jwt,'apikey',anon_jwt),
 body:=jsonb_build_object('action','process_queue','cronToken',cron_token),timeout_milliseconds:=30000);
end $$;
revoke all on function private.dispatch_booking_xero_deposits() from public,anon,authenticated,service_role;
select cron.schedule('psi-booking-xero-deposits','*/5 * * * *','select private.dispatch_booking_xero_deposits();');
