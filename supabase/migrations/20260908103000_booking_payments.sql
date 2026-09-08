-- Approval-first deposits for the signed mobile app. Provider secrets remain
-- in Edge Function secrets; customers can only read their own payment state.

create table public.booking_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  booking_request_id uuid not null references public.booking_requests(id) on delete restrict,
  customer_id uuid not null references public.customer_profiles(user_id) on delete restrict,
  payment_method text not null check (payment_method in ('stripe', 'bank_transfer')),
  provider text not null check (provider in ('stripe', 'manual_bank_transfer')),
  state text not null check (state in (
    'creating', 'awaiting_payment', 'bank_transfer_pending', 'processing',
    'paid', 'failed', 'expired', 'cancelled'
  )),
  amount_cents integer not null check (amount_cents in (10000, 30000)),
  currency text not null default 'AUD' check (currency = 'AUD'),
  bank_reference text,
  provider_checkout_id text,
  provider_checkout_url text,
  provider_payment_id text,
  provider_receipt_url text,
  expires_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_payment_attempts_bank_reference_check check (
    bank_reference is null or bank_reference ~ '^PSI-[A-Z0-9-]{6,40}$'
  ),
  constraint booking_payment_attempts_provider_checkout_id_size_check check (
    provider_checkout_id is null or octet_length(provider_checkout_id) between 8 and 255
  ),
  constraint booking_payment_attempts_provider_checkout_url_check check (
    provider_checkout_url is null or provider_checkout_url ~ '^https://checkout\.stripe\.com/'
  )
);

create unique index booking_payment_attempts_active_booking_idx
  on public.booking_payment_attempts (booking_request_id)
  where state in ('creating', 'awaiting_payment', 'bank_transfer_pending', 'processing');
create unique index booking_payment_attempts_provider_checkout_idx
  on public.booking_payment_attempts (provider, provider_checkout_id)
  where provider_checkout_id is not null;
create unique index booking_payment_attempts_bank_reference_idx
  on public.booking_payment_attempts (bank_reference)
  where bank_reference is not null;
create index booking_payment_attempts_customer_created_idx
  on public.booking_payment_attempts (customer_id, created_at desc);

create table public.booking_payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_attempt_id uuid not null references public.booking_payment_attempts(id) on delete restrict,
  booking_request_id uuid not null references public.booking_requests(id) on delete restrict,
  customer_id uuid not null references public.customer_profiles(user_id) on delete restrict,
  provider text not null check (provider in ('stripe', 'manual_bank_transfer')),
  provider_event_id text not null,
  event_type text not null check (event_type in (
    'payment_succeeded', 'payment_failed', 'checkout_expired', 'bank_transfer_verified'
  )),
  amount_cents integer,
  currency text check (currency is null or currency = 'AUD'),
  payload_hash text,
  created_at timestamptz not null default now(),
  constraint booking_payment_events_provider_event_size_check
    check (octet_length(provider_event_id) between 8 and 255),
  constraint booking_payment_events_payload_hash_check
    check (payload_hash is null or payload_hash ~ '^[a-f0-9]{64}$')
);

create unique index booking_payment_events_provider_event_idx
  on public.booking_payment_events (provider, provider_event_id);
create index booking_payment_events_booking_created_idx
  on public.booking_payment_events (booking_request_id, created_at desc);

create trigger booking_payment_attempts_set_updated_at
before update on public.booking_payment_attempts
for each row execute function private.set_updated_at();
create trigger audit_booking_payment_attempts
after insert or update or delete on public.booking_payment_attempts
for each row execute function private.record_audit_event();
create trigger audit_booking_payment_events
after insert or update or delete on public.booking_payment_events
for each row execute function private.record_audit_event();

alter table public.booking_payment_attempts enable row level security;
alter table public.booking_payment_events enable row level security;

create policy "customers can read own payment attempts"
on public.booking_payment_attempts for select to authenticated
using (customer_id = (select auth.uid()));
create policy "staff can read payment attempts"
on public.booking_payment_attempts for select to authenticated
using ((select private.is_active_staff()));
create policy "customers can read own payment events"
on public.booking_payment_events for select to authenticated
using (customer_id = (select auth.uid()));
create policy "staff can read payment events"
on public.booking_payment_events for select to authenticated
using ((select private.is_active_staff()));

revoke all on public.booking_payment_attempts from public, anon, authenticated;
revoke all on public.booking_payment_events from public, anon, authenticated;
grant select on public.booking_payment_attempts to authenticated;
grant select on public.booking_payment_events to authenticated;
grant select, insert, update on public.booking_payment_attempts to service_role;
grant select, insert, update on public.booking_payment_events to service_role;

create or replace function public.confirm_booking_payment(
  p_payment_attempt_id uuid,
  p_provider text,
  p_provider_event_id text,
  p_provider_payment_id text,
  p_amount_cents integer,
  p_currency text,
  p_paid_at timestamptz,
  p_provider_receipt_url text default null,
  p_payload_hash text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt public.booking_payment_attempts%rowtype;
  booking public.booking_requests%rowtype;
  expected_amount integer;
begin
  select * into attempt
  from public.booking_payment_attempts
  where id = p_payment_attempt_id
  for update;
  if not found then raise exception 'Payment attempt not found'; end if;

  select * into booking
  from public.booking_requests
  where id = attempt.booking_request_id
  for update;
  if not found then raise exception 'Booking not found'; end if;

  expected_amount := case booking.booking_type when 'service' then 10000 when 'dyno' then 30000 end;
  if attempt.provider <> p_provider
    or attempt.customer_id <> booking.customer_id
    or attempt.amount_cents <> expected_amount
    or p_amount_cents <> expected_amount
    or attempt.currency <> 'AUD'
    or upper(p_currency) <> 'AUD'
    or booking.deposit_amount_cents <> expected_amount
    or booking.currency <> 'AUD' then
    raise exception 'Payment does not match approved booking';
  end if;

  if attempt.state = 'paid' and booking.state in ('confirmed', 'completed') then
    return booking.id;
  end if;
  if attempt.state not in ('awaiting_payment', 'bank_transfer_pending', 'processing')
    or booking.state <> 'date_approved' then
    raise exception 'Payment transition is not permitted';
  end if;

  insert into public.booking_payment_events (
    payment_attempt_id, booking_request_id, customer_id, provider,
    provider_event_id, event_type, amount_cents, currency, payload_hash
  ) values (
    attempt.id, booking.id, booking.customer_id, p_provider,
    p_provider_event_id,
    case when p_provider = 'manual_bank_transfer' then 'bank_transfer_verified' else 'payment_succeeded' end,
    p_amount_cents, 'AUD', p_payload_hash
  ) on conflict (provider, provider_event_id) do nothing;

  update public.booking_payment_attempts
  set state = 'paid', provider_payment_id = p_provider_payment_id,
      provider_receipt_url = p_provider_receipt_url, paid_at = p_paid_at
  where id = attempt.id;

  update public.booking_requests
  set state = 'confirmed'
  where id = booking.id and state = 'date_approved';
  if not found then raise exception 'Booking confirmation failed'; end if;

  return booking.id;
end
$$;

revoke all on function public.confirm_booking_payment(uuid, text, text, text, integer, text, timestamptz, text, text)
from public, anon, authenticated;
grant execute on function public.confirm_booking_payment(uuid, text, text, text, integer, text, timestamptz, text, text)
to service_role;
