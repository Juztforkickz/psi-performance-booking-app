create table public.customer_car_listings (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 100),
  registration text not null check (registration = upper(btrim(registration)) and char_length(registration) between 1 and 16),
  asking_price_cents integer not null check (asking_price_cents between 1 and 2000000000),
  kilometres integer not null check (kilometres between 0 and 3000000),
  transmission text not null check (char_length(btrim(transmission)) between 1 and 40),
  summary text not null check (char_length(btrim(summary)) between 1 and 1000),
  highlights text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published', 'under_offer', 'sold', 'withdrawn')),
  created_by uuid not null references auth.users(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_car_listings_highlights_check check (
    cardinality(highlights) between 1 and 6
    and array_position(highlights, null) is null
  ),
  constraint customer_car_listings_publish_state_check check (
    (status = 'draft' and published_at is null)
    or (status <> 'draft' and published_at is not null)
  )
);

create index customer_car_listings_customer_feed_idx
on public.customer_car_listings (published_at desc, created_at desc)
where status in ('published', 'under_offer');

create index customer_car_listings_staff_idx
on public.customer_car_listings (status, updated_at desc);

alter table public.customer_car_listings enable row level security;

create policy "authenticated users can view available car listings"
on public.customer_car_listings for select to authenticated
using (status in ('published', 'under_offer') or (select private.is_active_staff()));

create policy "staff can create car listings"
on public.customer_car_listings for insert to authenticated
with check (
  (select private.is_active_staff())
  and created_by = (select auth.uid())
);

create policy "staff can update car listings"
on public.customer_car_listings for update to authenticated
using ((select private.is_active_staff()))
with check ((select private.is_active_staff()));

revoke all on public.customer_car_listings from anon, authenticated;
grant select on public.customer_car_listings to authenticated;
grant insert (title, registration, asking_price_cents, kilometres, transmission, summary, highlights, status, created_by, published_at)
on public.customer_car_listings to authenticated;
grant update (title, registration, asking_price_cents, kilometres, transmission, summary, highlights, status, published_at)
on public.customer_car_listings to authenticated;

create trigger customer_car_listings_set_updated_at
before update on public.customer_car_listings
for each row execute function private.set_updated_at();

create trigger audit_customer_car_listings
after insert or update on public.customer_car_listings
for each row execute function private.record_audit_event();

alter table public.notification_preferences
  add column car_sale_alerts_enabled boolean not null default true,
  add column car_sale_emails_enabled boolean not null default false;

grant update (car_sale_alerts_enabled, car_sale_emails_enabled)
on public.notification_preferences to authenticated;

alter table public.notification_events
  add column car_sale_listing_id uuid references public.customer_car_listings(id) on delete set null;

alter table public.notification_events
  drop constraint notification_events_kind_check;

alter table public.notification_events
  add constraint notification_events_kind_check check (kind in (
    'booking_request_received',
    'new_booking_request',
    'booking_date_proposed',
    'booking_date_approved',
    'booking_cancelled',
    'booking_confirmed',
    'booking_completed',
    'psi_event_published',
    'psi_event_updated',
    'psi_event_cancelled',
    'service_reminder',
    'xero_invoice_review',
    'car_sale_published'
  ));

alter table public.notification_events
  drop constraint notification_events_deep_link_check;

alter table public.notification_events
  add constraint notification_events_deep_link_check
    check (deep_link in ('/booking', '/bookings', '/staff', '/events', '/customer-cars-for-sale'));

create index notification_events_car_sale_listing_idx
on public.notification_events (car_sale_listing_id);

create table public.car_sale_email_jobs (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.customer_car_listings(id) on delete restrict,
  recipient_user_id uuid not null references public.customer_profiles(user_id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'processing', 'blocked_configuration', 'succeeded', 'failed', 'cancelled')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 20),
  available_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  completed_at timestamptz,
  provider_reference text,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, recipient_user_id),
  constraint car_sale_email_jobs_provider_reference_size_check
    check (provider_reference is null or octet_length(provider_reference) <= 500),
  constraint car_sale_email_jobs_error_code_size_check
    check (last_error_code is null or octet_length(last_error_code) <= 160)
);

create index car_sale_email_jobs_ready_idx
on public.car_sale_email_jobs (status, available_at, created_at)
where status in ('pending', 'failed', 'blocked_configuration');

create index car_sale_email_jobs_listing_idx
on public.car_sale_email_jobs (listing_id, created_at desc);

alter table public.car_sale_email_jobs enable row level security;

create policy "staff can view car sale email jobs"
on public.car_sale_email_jobs for select to authenticated
using ((select private.is_active_staff()));

revoke all on public.car_sale_email_jobs from public, anon, authenticated;
grant select on public.car_sale_email_jobs to authenticated;
grant select, insert, update, delete on public.car_sale_email_jobs to service_role;

create trigger car_sale_email_jobs_set_updated_at
before update on public.car_sale_email_jobs
for each row execute function private.set_updated_at();

create trigger audit_car_sale_email_jobs
after insert or update on public.car_sale_email_jobs
for each row execute function private.record_audit_event();

create or replace function private.queue_car_sale_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  customer_user_id uuid;
  created_notification_id uuid;
  notification_body text;
begin
  if not (
    (tg_op = 'INSERT' and new.status = 'published')
    or (tg_op = 'UPDATE' and old.status <> 'published' and new.status = 'published')
  ) then
    return new;
  end if;

  notification_body := left(new.title || ' is now available for ' ||
    to_char(new.asking_price_cents::numeric / 100, 'FM$999,999,999,990') || ' AUD.', 240);

  for customer_user_id in
    select profile.user_id
    from public.customer_profiles as profile
    where profile.account_state = 'active'
  loop
    insert into public.notification_events (
      recipient_user_id,
      car_sale_listing_id,
      kind,
      title,
      body,
      deep_link,
      source_event_key
    ) values (
      customer_user_id,
      new.id,
      'car_sale_published',
      'New customer car for sale',
      notification_body,
      '/customer-cars-for-sale',
      'car_sale:' || new.id::text || ':published:' || customer_user_id::text
    )
    on conflict (source_event_key) do nothing
    returning id into created_notification_id;

    if created_notification_id is not null then
      insert into public.push_notification_jobs (event_id, recipient_user_id)
      values (created_notification_id, customer_user_id);
    end if;

    if exists (
      select 1
      from public.notification_preferences as preference
      where preference.user_id = customer_user_id
        and preference.car_sale_emails_enabled = true
    ) then
      insert into public.car_sale_email_jobs (listing_id, recipient_user_id)
      values (new.id, customer_user_id)
      on conflict (listing_id, recipient_user_id) do nothing;
    end if;

    created_notification_id := null;
  end loop;

  return new;
end;
$$;

revoke all on function private.queue_car_sale_notifications()
from public, anon, authenticated;

create trigger queue_car_sale_notifications
after insert or update of status on public.customer_car_listings
for each row execute function private.queue_car_sale_notifications();
