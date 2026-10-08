-- Paid one-time import of verified older PSI vehicle history.

alter table public.customer_vehicles
  add constraint customer_vehicles_id_customer_unique unique (id, customer_id);

create table public.historical_import_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customer_profiles(user_id) on delete restrict,
  vehicle_id uuid not null references public.customer_vehicles(id) on delete restrict,
  status text not null default 'awaiting_payment' check (status in (
    'awaiting_payment', 'paid', 'in_progress', 'needs_information', 'completed', 'cancelled'
  )),
  payment_status text not null default 'creating' check (payment_status in (
    'creating', 'awaiting_payment', 'paid', 'failed', 'expired', 'refunded'
  )),
  amount_cents integer not null default 19900 check (amount_cents = 19900),
  currency text not null default 'AUD' check (currency = 'AUD'),
  previous_details text check (previous_details is null or length(previous_details) <= 1000),
  consent_at timestamptz not null,
  provider text not null default 'stripe' check (provider = 'stripe'),
  provider_checkout_id text,
  provider_checkout_url text,
  provider_payment_id text,
  provider_event_id text,
  checkout_attempt integer not null default 1 check (checkout_attempt between 1 and 100),
  checkout_expires_at timestamptz,
  paid_at timestamptz,
  assigned_to uuid references public.staff_members(user_id) on delete set null,
  staff_note text check (staff_note is null or length(staff_note) <= 2000),
  imported_item_count integer not null default 0 check (imported_item_count >= 0),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint historical_import_customer_vehicle_fk
    foreign key (vehicle_id, customer_id)
    references public.customer_vehicles(id, customer_id) on delete restrict,
  constraint historical_import_checkout_id_check
    check (provider_checkout_id is null or octet_length(provider_checkout_id) between 8 and 255),
  constraint historical_import_checkout_url_check
    check (provider_checkout_url is null or provider_checkout_url ~ '^https://checkout\.stripe\.com/'),
  constraint historical_import_payment_id_check
    check (provider_payment_id is null or octet_length(provider_payment_id) between 3 and 255),
  constraint historical_import_event_id_check
    check (provider_event_id is null or octet_length(provider_event_id) between 3 and 255),
  constraint historical_import_completion_check
    check ((status = 'completed') = (completed_at is not null))
);

create unique index historical_import_one_per_vehicle_idx
  on public.historical_import_requests (vehicle_id)
  where status <> 'cancelled';
create unique index historical_import_checkout_idx
  on public.historical_import_requests (provider, provider_checkout_id)
  where provider_checkout_id is not null;
create index historical_import_customer_created_idx
  on public.historical_import_requests (customer_id, created_at desc);
create index historical_import_status_created_idx
  on public.historical_import_requests (status, created_at asc);

create trigger historical_import_requests_set_updated_at
before update on public.historical_import_requests
for each row execute function private.set_updated_at();

create trigger audit_historical_import_requests
after insert or update or delete on public.historical_import_requests
for each row execute function private.record_audit_event();

alter table public.historical_import_requests enable row level security;
revoke all on table public.historical_import_requests from public, anon, authenticated;
grant select on table public.historical_import_requests to authenticated;
grant select, insert, update on table public.historical_import_requests to service_role;

create policy "customers read own historical imports"
on public.historical_import_requests for select to authenticated
using (
  customer_id = (select auth.uid())
  and (select private.customer_identity_access_allowed())
);

create policy "staff read historical imports"
on public.historical_import_requests for select to authenticated
using ((select private.is_active_staff()));

create or replace function public.review_historical_import_request(
  p_request_id uuid,
  p_status text,
  p_staff_note text default null,
  p_imported_item_count integer default 0
)
returns public.historical_import_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  staff_id uuid := (select auth.uid());
  result public.historical_import_requests;
begin
  if staff_id is null
    or coalesce((select auth.jwt() ->> 'aal'), '') <> 'aal2'
    or not (select private.is_active_staff())
  then
    raise exception 'staff_aal2_required' using errcode = '42501';
  end if;

  if p_status not in ('in_progress', 'needs_information', 'completed') then
    raise exception 'historical_import_status_invalid' using errcode = '22023';
  end if;
  if p_imported_item_count < 0 then
    raise exception 'historical_import_count_invalid' using errcode = '22023';
  end if;
  if p_status = 'needs_information' and nullif(btrim(coalesce(p_staff_note, '')), '') is null then
    raise exception 'historical_import_information_note_required' using errcode = '22023';
  end if;

  update public.historical_import_requests
  set status = p_status,
      assigned_to = staff_id,
      staff_note = nullif(left(btrim(coalesce(p_staff_note, '')), 2000), ''),
      imported_item_count = case when p_status = 'completed' then p_imported_item_count else imported_item_count end,
      completed_at = case when p_status = 'completed' then now() else null end
  where id = p_request_id
    and payment_status = 'paid'
    and status in ('paid', 'in_progress', 'needs_information')
  returning * into result;

  if result.id is null then
    raise exception 'historical_import_transition_not_permitted' using errcode = 'P0001';
  end if;
  return result;
end
$$;

revoke all on function public.review_historical_import_request(uuid, text, text, integer)
from public, anon, authenticated;
grant execute on function public.review_historical_import_request(uuid, text, text, integer)
to authenticated;

create or replace function public.confirm_historical_import_payment(
  p_request_id uuid,
  p_checkout_id text,
  p_provider_event_id text,
  p_provider_payment_id text,
  p_amount_cents integer,
  p_currency text,
  p_paid_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.historical_import_requests;
begin
  select * into request_row
  from public.historical_import_requests
  where id = p_request_id
  for update;
  if not found then raise exception 'historical_import_not_found'; end if;

  if request_row.payment_status = 'paid' then return request_row.id; end if;
  if request_row.provider <> 'stripe'
    or request_row.provider_checkout_id <> p_checkout_id
    or request_row.amount_cents <> 19900
    or p_amount_cents <> 19900
    or request_row.currency <> 'AUD'
    or upper(p_currency) <> 'AUD'
    or request_row.payment_status <> 'awaiting_payment'
  then
    raise exception 'historical_import_payment_mismatch';
  end if;

  update public.historical_import_requests
  set payment_status = 'paid',
      status = 'paid',
      provider_payment_id = p_provider_payment_id,
      provider_event_id = p_provider_event_id,
      paid_at = p_paid_at
  where id = request_row.id;

  return request_row.id;
end
$$;

revoke all on function public.confirm_historical_import_payment(uuid, text, text, text, integer, text, timestamptz)
from public, anon, authenticated;
grant execute on function public.confirm_historical_import_payment(uuid, text, text, text, integer, text, timestamptz)
to service_role;

alter table public.notification_events
  drop constraint if exists notification_events_kind_check;
alter table public.notification_events
  add constraint notification_events_kind_check check (kind in (
    'booking_request_received', 'new_booking_request', 'booking_date_proposed',
    'booking_date_approved', 'booking_cancelled', 'booking_confirmed',
    'booking_completed', 'psi_event_published', 'psi_event_updated',
    'psi_event_cancelled', 'service_reminder', 'xero_invoice_review',
    'car_sale_published', 'performance_subscription_started', 'performance_trial_ended',
    'customer_message_received', 'staff_message_received',
    'historical_import_received', 'historical_import_needs_information',
    'historical_import_completed'
  ));

alter table public.notification_events
  drop constraint if exists notification_events_deep_link_check;
alter table public.notification_events
  add constraint notification_events_deep_link_check check (deep_link in (
    '/booking', '/bookings', '/staff', '/events', '/customer-cars-for-sale',
    '/messages', '/performance-plus', '/history-import'
  ));

create or replace function private.queue_historical_import_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient_id uuid;
  created_event_id uuid;
  vehicle_label text;
begin
  select concat_ws(' ', year::text, make, model) into vehicle_label
  from public.customer_vehicles where id = new.vehicle_id;

  if new.payment_status = 'paid' and old.payment_status <> 'paid' then
    select id into recipient_id from auth.users
    where lower(email) = 'matt@psiperformance.com.au' limit 1;
    if recipient_id is not null then
      created_event_id := null;
      insert into public.notification_events (
        recipient_user_id, kind, title, body, deep_link, source_event_key
      ) values (
        recipient_id, 'historical_import_received', 'AUD $199 history import received',
        coalesce(vehicle_label, 'A customer vehicle') || ' is ready for PSI review.',
        '/staff', 'historical_import_received:' || new.id::text
      ) on conflict (source_event_key) do nothing returning id into created_event_id;
      if created_event_id is not null then
        insert into public.push_notification_jobs (event_id, recipient_user_id)
        values (created_event_id, recipient_id);
      end if;
    end if;
  end if;

  if new.status = 'needs_information' and old.status <> 'needs_information' then
    created_event_id := null;
    insert into public.notification_events (
      recipient_user_id, kind, title, body, deep_link, source_event_key
    ) values (
      new.customer_id, 'historical_import_needs_information', 'PSI needs one more detail',
      'Open your history import request for ' || coalesce(vehicle_label, 'your vehicle') || '.',
      '/history-import', 'historical_import_needs_information:' || new.id::text
    ) on conflict (source_event_key) do nothing returning id into created_event_id;
    if created_event_id is not null then
      insert into public.push_notification_jobs (event_id, recipient_user_id)
      values (created_event_id, new.customer_id);
    end if;
  end if;

  if new.status = 'completed' and old.status <> 'completed' then
    created_event_id := null;
    insert into public.notification_events (
      recipient_user_id, kind, title, body, deep_link, source_event_key
    ) values (
      new.customer_id, 'historical_import_completed', 'Your PSI history is ready',
      'Verified older records for ' || coalesce(vehicle_label, 'your vehicle') || ' are now available.',
      '/history-import', 'historical_import_completed:' || new.id::text
    ) on conflict (source_event_key) do nothing returning id into created_event_id;
    if created_event_id is not null then
      insert into public.push_notification_jobs (event_id, recipient_user_id)
      values (created_event_id, new.customer_id);
    end if;
  end if;
  return new;
end
$$;

revoke all on function private.queue_historical_import_notifications()
from public, anon, authenticated, service_role;

create trigger queue_historical_import_notifications
after update of payment_status, status on public.historical_import_requests
for each row execute function private.queue_historical_import_notifications();

create or replace function private.has_completed_historical_import(p_vehicle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.historical_import_requests request
    where request.vehicle_id = p_vehicle_id
      and request.customer_id = (select auth.uid())
      and request.payment_status = 'paid'
      and request.status = 'completed'
  )
$$;

revoke all on function private.has_completed_historical_import(uuid) from public, anon;
grant execute on function private.has_completed_historical_import(uuid) to authenticated;

drop policy if exists "report subscription requirement" on public.dyno_records;
create policy "report subscription requirement" on public.dyno_records
as restrictive for select to authenticated
using ((select private.has_performance_plus()) or private.has_completed_historical_import(vehicle_id) or (select private.is_active_staff()));

drop policy if exists "report subscription requirement" on public.repair_records;
create policy "report subscription requirement" on public.repair_records
as restrictive for select to authenticated
using ((select private.has_performance_plus()) or private.has_completed_historical_import(vehicle_id) or (select private.is_active_staff()));

drop policy if exists "report subscription requirement" on public.recommended_work;
create policy "report subscription requirement" on public.recommended_work
as restrictive for select to authenticated
using ((select private.has_performance_plus()) or private.has_completed_historical_import(vehicle_id) or (select private.is_active_staff()));

drop policy if exists "report subscription requirement" on public.invoices;
create policy "report subscription requirement" on public.invoices
as restrictive for select to authenticated
using ((select private.has_performance_plus()) or private.has_completed_historical_import(vehicle_id) or (select private.is_active_staff()));

drop policy if exists "report subscription requirement" on public.service_completions;
create policy "report subscription requirement" on public.service_completions
as restrictive for select to authenticated
using ((select private.has_performance_plus()) or private.has_completed_historical_import(vehicle_id) or (select private.is_active_staff()));

drop policy if exists "invoice file subscription requirement" on public.vehicle_files;
create policy "invoice file subscription requirement" on public.vehicle_files
as restrictive for select to authenticated
using (
  file_kind <> 'invoice'
  or (select private.has_performance_plus())
  or private.has_completed_historical_import(vehicle_id)
  or (select private.is_active_staff())
);

drop policy if exists "subscribers read own published vault" on public.vault_records;
create policy "subscribers read own published vault" on public.vault_records
for select to authenticated
using (
  customer_id = (select auth.uid())
  and published_at is not null
  and ((select private.has_performance_plus()) or private.has_completed_historical_import(vehicle_id))
);

create or replace function private.is_legacy_invoice_path(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.vehicle_files file
    where file.bucket_id = 'vehicle-documents'
      and file.object_path = p_path
      and file.file_kind = 'invoice'
      and not private.has_completed_historical_import(file.vehicle_id)
  )
$$;

create or replace function private.performance_vault_overview(p_vehicle_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path = ''
as $$
declare
  counts jsonb;
  subscribed boolean;
  imported_access boolean;
  permanent_access boolean;
  access_expires_at timestamptz;
  trial_access boolean;
  other_access boolean;
begin
  if (select auth.uid()) is null or not private.customer_identity_access_allowed()
    or not exists (
      select 1 from public.customer_vehicles v
      where v.id = p_vehicle_id and v.customer_id = (select auth.uid()) and v.archived_at is null
    )
  then raise exception 'vehicle_access_denied' using errcode = '42501'; end if;

  subscribed := private.has_performance_plus();
  imported_access := private.has_completed_historical_import(p_vehicle_id);

  select coalesce(jsonb_object_agg(kind,total),'{}'::jsonb) into counts from (
    select kind,count(*) total from (
      select r.kind from public.vault_records r where r.customer_id=(select auth.uid()) and r.vehicle_id=p_vehicle_id and r.published_at is not null
      union all select 'invoice' from public.invoices i where i.customer_id=(select auth.uid()) and i.vehicle_id=p_vehicle_id and i.archived_at is null
      union all select 'dyno' from public.dyno_records d where d.customer_id=(select auth.uid()) and d.vehicle_id=p_vehicle_id and d.archived_at is null
      union all select 'service' from public.repair_records r where r.customer_id=(select auth.uid()) and r.vehicle_id=p_vehicle_id and r.archived_at is null
      union all select 'recommendation' from public.recommended_work w where w.customer_id=(select auth.uid()) and w.vehicle_id=p_vehicle_id and w.archived_at is null
      union all select 'document' from public.vehicle_files f where f.customer_id=(select auth.uid()) and f.vehicle_id=p_vehicle_id and f.file_kind='repair_document' and f.archived_at is null
    ) records group by kind
  ) c;

  select
    coalesce(bool_or(s.is_permanent),false),
    max(s.expires_at) filter (where not s.is_permanent),
    coalesce(bool_or(
      s.provider = 'complimentary'
      and s.provider_reference = 'trial:' || (select auth.uid())::text
      and s.expires_at > now()
    ), false),
    coalesce(bool_or(not (
      s.provider = 'complimentary'
      and s.provider_reference = 'trial:' || (select auth.uid())::text
    )), false)
  into permanent_access, access_expires_at, trial_access, other_access
  from public.performance_subscriptions s
  where s.customer_id=(select auth.uid())
    and s.status in ('active','grace_period')
    and (s.is_permanent or s.expires_at>now())
    and (s.environment='production' or (select allow_sandbox from private.performance_settings where singleton));

  return jsonb_build_object(
    'plan', case when subscribed then 'performance_plus' when imported_access then 'history_import' else 'free' end,
    'counts', counts,
    'expires_at', case when permanent_access or imported_access then null else access_expires_at end,
    'is_permanent', permanent_access or imported_access,
    'is_trial', trial_access and not other_access and not imported_access,
    'trial_days', 14
  );
end
$$;
