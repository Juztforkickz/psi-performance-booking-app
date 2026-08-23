-- PSI Performance App: authenticated customer/workshop foundation.
-- All public tables use RLS. No anonymous table or storage access is granted.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.staff_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  email text not null,
  role text not null check (role in ('owner', 'staff')),
  status text not null default 'pending' check (status in ('pending', 'active', 'disabled')),
  invited_at timestamptz not null default now(),
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_members_email_normalized check (email = lower(btrim(email))),
  constraint staff_members_activation_check check (
    (status = 'active' and user_id is not null and activated_at is not null)
    or status in ('pending', 'disabled')
  )
);

create unique index staff_members_email_unique_idx on public.staff_members (lower(email));
create index staff_members_user_status_idx on public.staff_members (user_id, status);

create table public.customer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  first_name text,
  last_name text,
  mobile text,
  account_state text not null default 'active' check (account_state in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_profiles_email_normalized check (email = lower(btrim(email)))
);

create unique index customer_profiles_email_unique_idx on public.customer_profiles (lower(email));

create table public.customer_vehicles (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customer_profiles(user_id) on delete restrict,
  registration text not null,
  year smallint not null check (year between 1900 and 2200),
  make text not null,
  model text not null,
  nickname text,
  vin_last_four text check (vin_last_four is null or vin_last_four ~ '^[A-Z0-9]{4}$'),
  odometer_km integer check (odometer_km is null or odometer_km >= 0),
  is_primary boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint customer_vehicles_registration_normalized check (registration = upper(btrim(registration))),
  constraint customer_vehicles_make_not_blank check (length(btrim(make)) > 0),
  constraint customer_vehicles_model_not_blank check (length(btrim(model)) > 0)
);

create unique index customer_vehicles_registration_unique_idx
  on public.customer_vehicles (customer_id, lower(registration))
  where archived_at is null;
create unique index customer_vehicles_primary_unique_idx
  on public.customer_vehicles (customer_id)
  where is_primary and archived_at is null;
create index customer_vehicles_customer_updated_idx
  on public.customer_vehicles (customer_id, updated_at desc);
create index customer_vehicles_created_by_idx on public.customer_vehicles (created_by);

create table public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customer_profiles(user_id) on delete restrict,
  vehicle_id uuid not null references public.customer_vehicles(id) on delete restrict,
  booking_type text not null check (booking_type in ('service', 'dyno')),
  preferred_date date,
  request_notes text,
  state text not null default 'pending_staff_review' check (
    state in ('pending_staff_review', 'date_proposed', 'date_approved', 'confirmed', 'completed', 'cancelled')
  ),
  deposit_amount_cents integer check (deposit_amount_cents is null or deposit_amount_cents >= 0),
  currency text not null default 'AUD' check (currency = 'AUD'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index booking_requests_customer_created_idx on public.booking_requests (customer_id, created_at desc);
create index booking_requests_vehicle_created_idx on public.booking_requests (vehicle_id, created_at desc);
create index booking_requests_state_created_idx on public.booking_requests (state, created_at);
create index booking_requests_created_by_idx on public.booking_requests (created_by);

create table public.dyno_records (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customer_profiles(user_id) on delete restrict,
  vehicle_id uuid not null references public.customer_vehicles(id) on delete restrict,
  record_source text not null check (record_source in ('psi_verified', 'customer_entry')),
  tested_at timestamptz not null,
  power_kw_at_hubs numeric(8,2) not null check (power_kw_at_hubs > 0),
  torque_nm_at_hubs numeric(8,2) check (torque_nm_at_hubs is null or torque_nm_at_hubs > 0),
  fuel text,
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index dyno_records_customer_tested_idx on public.dyno_records (customer_id, tested_at desc);
create index dyno_records_vehicle_tested_idx on public.dyno_records (vehicle_id, tested_at desc);
create index dyno_records_created_by_idx on public.dyno_records (created_by);

create table public.repair_records (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customer_profiles(user_id) on delete restrict,
  vehicle_id uuid not null references public.customer_vehicles(id) on delete restrict,
  record_source text not null check (record_source in ('psi_record', 'customer_entry')),
  title text not null,
  repair_date date not null,
  odometer_km integer check (odometer_km is null or odometer_km >= 0),
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint repair_records_title_not_blank check (length(btrim(title)) > 0)
);

create index repair_records_customer_date_idx on public.repair_records (customer_id, repair_date desc);
create index repair_records_vehicle_date_idx on public.repair_records (vehicle_id, repair_date desc);
create index repair_records_created_by_idx on public.repair_records (created_by);

create table public.recommended_work (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customer_profiles(user_id) on delete restrict,
  vehicle_id uuid not null references public.customer_vehicles(id) on delete restrict,
  record_source text not null check (record_source in ('psi_record', 'customer_entry')),
  title text not null,
  timing text,
  notes text,
  status text not null check (status in ('monitor', 'recommended', 'due_soon', 'priority')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint recommended_work_title_not_blank check (length(btrim(title)) > 0)
);

create index recommended_work_customer_status_idx on public.recommended_work (customer_id, status, created_at desc);
create index recommended_work_vehicle_status_idx on public.recommended_work (vehicle_id, status, created_at desc);
create index recommended_work_created_by_idx on public.recommended_work (created_by);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customer_profiles(user_id) on delete restrict,
  vehicle_id uuid not null references public.customer_vehicles(id) on delete restrict,
  invoice_number text not null,
  invoice_date date not null,
  summary text not null,
  amount_cents integer check (amount_cents is null or amount_cents >= 0),
  currency text not null default 'AUD' check (currency = 'AUD'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint invoices_number_not_blank check (length(btrim(invoice_number)) > 0),
  constraint invoices_summary_not_blank check (length(btrim(summary)) > 0)
);

create unique index invoices_number_unique_idx on public.invoices (lower(invoice_number));
create index invoices_customer_date_idx on public.invoices (customer_id, invoice_date desc);
create index invoices_vehicle_date_idx on public.invoices (vehicle_id, invoice_date desc);
create index invoices_created_by_idx on public.invoices (created_by);

create table public.vehicle_files (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customer_profiles(user_id) on delete restrict,
  vehicle_id uuid not null references public.customer_vehicles(id) on delete restrict,
  invoice_id uuid references public.invoices(id) on delete restrict,
  dyno_record_id uuid references public.dyno_records(id) on delete restrict,
  file_kind text not null check (file_kind in ('vehicle_photo', 'invoice', 'dyno_graph', 'repair_document')),
  record_source text not null check (record_source in ('psi_record', 'customer_entry')),
  bucket_id text not null check (bucket_id in ('vehicle-photos', 'vehicle-documents')),
  object_path text not null,
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 20971520),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint vehicle_files_attachment_check check (
    (file_kind = 'invoice' and invoice_id is not null and dyno_record_id is null)
    or (file_kind = 'dyno_graph' and dyno_record_id is not null and invoice_id is null)
    or (file_kind in ('vehicle_photo', 'repair_document') and invoice_id is null and dyno_record_id is null)
  )
);

create unique index vehicle_files_object_unique_idx on public.vehicle_files (bucket_id, object_path);
create index vehicle_files_customer_created_idx on public.vehicle_files (customer_id, created_at desc);
create index vehicle_files_vehicle_kind_idx on public.vehicle_files (vehicle_id, file_kind, created_at desc);
create index vehicle_files_invoice_idx on public.vehicle_files (invoice_id) where invoice_id is not null;
create index vehicle_files_dyno_idx on public.vehicle_files (dyno_record_id) where dyno_record_id is not null;
create index vehicle_files_created_by_idx on public.vehicle_files (created_by);

create table public.booking_calendar_events (
  id uuid primary key default gen_random_uuid(),
  booking_request_id uuid not null unique references public.booking_requests(id) on delete restrict,
  google_calendar_id text not null,
  google_event_id text,
  sync_state text not null default 'pending' check (sync_state in ('pending', 'synced', 'error', 'removed')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index booking_calendar_events_sync_idx on public.booking_calendar_events (sync_state, updated_at);

create table public.audit_events (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id uuid not null,
  customer_id uuid,
  action text not null check (action in ('insert', 'update', 'delete')),
  actor_user_id uuid,
  actor_kind text not null check (actor_kind in ('customer', 'staff', 'system')),
  occurred_at timestamptz not null default now()
);

create index audit_events_customer_time_idx on public.audit_events (customer_id, occurred_at desc);
create index audit_events_actor_time_idx on public.audit_events (actor_user_id, occurred_at desc);
create index audit_events_record_idx on public.audit_events (table_name, record_id, occurred_at desc);

create or replace function private.current_staff_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select sm.role
  from public.staff_members sm
  where sm.user_id = (select auth.uid())
    and sm.status = 'active'
    and (select auth.jwt() ->> 'aal') = 'aal2'
  limit 1
$$;

create or replace function private.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select private.current_staff_role()) in ('owner', 'staff'), false)
$$;

create or replace function private.is_owner_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select private.current_staff_role()) = 'owner', false)
$$;

create or replace function private.owns_vehicle(target_vehicle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.customer_vehicles vehicle
    where vehicle.id = target_vehicle_id
      and vehicle.customer_id = (select auth.uid())
      and vehicle.archived_at is null
  )
$$;

revoke all on function private.current_staff_role() from public, anon;
revoke all on function private.is_active_staff() from public, anon;
revoke all on function private.is_owner_staff() from public, anon;
revoke all on function private.owns_vehicle(uuid) from public, anon;
grant execute on function private.current_staff_role() to authenticated;
grant execute on function private.is_active_staff() to authenticated;
grant execute on function private.is_owner_staff() to authenticated;
grant execute on function private.owns_vehicle(uuid) to authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

create or replace function private.sync_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text;
  is_staff_email boolean;
begin
  normalized_email := lower(btrim(coalesce(new.email, '')));
  if normalized_email = '' then
    return new;
  end if;

  update public.staff_members
  set user_id = null, status = 'pending', activated_at = null, updated_at = now()
  where user_id = new.id and email <> normalized_email;

  update public.staff_members
  set user_id = new.id, status = 'active', activated_at = coalesce(activated_at, now()), updated_at = now()
  where email = normalized_email and status <> 'disabled';

  select exists (
    select 1 from public.staff_members where user_id = new.id and status = 'active'
  ) into is_staff_email;

  if not is_staff_email then
    insert into public.customer_profiles (user_id, email)
    values (new.id, normalized_email)
    on conflict (user_id) do update set email = excluded.email, updated_at = now();
  end if;

  return new;
end
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.sync_auth_user() from public, anon, authenticated;

create or replace function private.record_audit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  payload jsonb;
  event_record_id uuid;
  event_customer_id uuid;
  actor_id uuid;
  event_actor_kind text;
begin
  payload := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  event_record_id := coalesce((payload ->> 'id')::uuid, (payload ->> 'user_id')::uuid);
  event_customer_id := coalesce((payload ->> 'customer_id')::uuid, (payload ->> 'user_id')::uuid);
  actor_id := auth.uid();
  event_actor_kind := case
    when actor_id is null then 'system'
    when (select private.is_active_staff()) then 'staff'
    else 'customer'
  end;

  insert into public.audit_events (
    table_name, record_id, customer_id, action, actor_user_id, actor_kind
  ) values (
    tg_table_name, event_record_id, event_customer_id, lower(tg_op), actor_id, event_actor_kind
  );

  return case when tg_op = 'DELETE' then old else new end;
end
$$;

revoke all on function private.record_audit_event() from public, anon, authenticated;

create trigger staff_members_set_updated_at before update on public.staff_members
for each row execute function private.set_updated_at();
create trigger customer_profiles_set_updated_at before update on public.customer_profiles
for each row execute function private.set_updated_at();
create trigger customer_vehicles_set_updated_at before update on public.customer_vehicles
for each row execute function private.set_updated_at();
create trigger booking_requests_set_updated_at before update on public.booking_requests
for each row execute function private.set_updated_at();
create trigger dyno_records_set_updated_at before update on public.dyno_records
for each row execute function private.set_updated_at();
create trigger repair_records_set_updated_at before update on public.repair_records
for each row execute function private.set_updated_at();
create trigger recommended_work_set_updated_at before update on public.recommended_work
for each row execute function private.set_updated_at();
create trigger invoices_set_updated_at before update on public.invoices
for each row execute function private.set_updated_at();
create trigger vehicle_files_set_updated_at before update on public.vehicle_files
for each row execute function private.set_updated_at();
create trigger booking_calendar_events_set_updated_at before update on public.booking_calendar_events
for each row execute function private.set_updated_at();

create trigger sync_psi_auth_user
after insert or update of email on auth.users
for each row execute function private.sync_auth_user();

create trigger audit_customer_profiles after insert or update or delete on public.customer_profiles
for each row execute function private.record_audit_event();
create trigger audit_customer_vehicles after insert or update or delete on public.customer_vehicles
for each row execute function private.record_audit_event();
create trigger audit_booking_requests after insert or update or delete on public.booking_requests
for each row execute function private.record_audit_event();
create trigger audit_dyno_records after insert or update or delete on public.dyno_records
for each row execute function private.record_audit_event();
create trigger audit_repair_records after insert or update or delete on public.repair_records
for each row execute function private.record_audit_event();
create trigger audit_recommended_work after insert or update or delete on public.recommended_work
for each row execute function private.record_audit_event();
create trigger audit_invoices after insert or update or delete on public.invoices
for each row execute function private.record_audit_event();
create trigger audit_vehicle_files after insert or update or delete on public.vehicle_files
for each row execute function private.record_audit_event();

alter table public.staff_members enable row level security;
alter table public.customer_profiles enable row level security;
alter table public.customer_vehicles enable row level security;
alter table public.booking_requests enable row level security;
alter table public.dyno_records enable row level security;
alter table public.repair_records enable row level security;
alter table public.recommended_work enable row level security;
alter table public.invoices enable row level security;
alter table public.vehicle_files enable row level security;
alter table public.booking_calendar_events enable row level security;
alter table public.audit_events enable row level security;

create policy "staff can view their own access record"
on public.staff_members for select to authenticated
using ((select auth.uid()) = user_id);
create policy "owners can view staff access"
on public.staff_members for select to authenticated
using ((select private.is_owner_staff()));

create policy "customers can view own profile"
on public.customer_profiles for select to authenticated
using ((select auth.uid()) = user_id);
create policy "staff can view customer profiles"
on public.customer_profiles for select to authenticated
using ((select private.is_active_staff()));
create policy "customers can create own profile"
on public.customer_profiles for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
);
create policy "customers can update own profile"
on public.customer_profiles for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
);
create policy "staff can update customer profiles"
on public.customer_profiles for update to authenticated
using ((select private.is_active_staff()))
with check ((select private.is_active_staff()));

create policy "customers can view own vehicles"
on public.customer_vehicles for select to authenticated
using ((select auth.uid()) = customer_id);
create policy "staff can view customer vehicles"
on public.customer_vehicles for select to authenticated
using ((select private.is_active_staff()));
create policy "customers can create own vehicles"
on public.customer_vehicles for insert to authenticated
with check ((select auth.uid()) = customer_id and (select auth.uid()) = created_by);
create policy "staff can create customer vehicles"
on public.customer_vehicles for insert to authenticated
with check ((select private.is_active_staff()) and (select auth.uid()) = created_by);
create policy "record creators can update customer vehicles"
on public.customer_vehicles for update to authenticated
using ((select auth.uid()) = customer_id and (select auth.uid()) = created_by)
with check ((select auth.uid()) = customer_id and (select auth.uid()) = created_by);
create policy "staff can update customer vehicles"
on public.customer_vehicles for update to authenticated
using ((select private.is_active_staff()))
with check ((select private.is_active_staff()));

create policy "customers can view own booking requests"
on public.booking_requests for select to authenticated
using ((select auth.uid()) = customer_id);
create policy "staff can view booking requests"
on public.booking_requests for select to authenticated
using ((select private.is_active_staff()));
create policy "customers can create own booking requests"
on public.booking_requests for insert to authenticated
with check (
  (select auth.uid()) = customer_id
  and (select auth.uid()) = created_by
  and (select private.owns_vehicle(vehicle_id))
  and state = 'pending_staff_review'
  and currency = 'AUD'
);
create policy "staff can update booking requests"
on public.booking_requests for update to authenticated
using ((select private.is_active_staff()))
with check ((select private.is_active_staff()) and currency = 'AUD');

create policy "customers can view own dyno records"
on public.dyno_records for select to authenticated
using ((select auth.uid()) = customer_id);
create policy "staff can view dyno records"
on public.dyno_records for select to authenticated
using ((select private.is_active_staff()));
create policy "customers can create unverified dyno records"
on public.dyno_records for insert to authenticated
with check (
  (select auth.uid()) = customer_id
  and (select auth.uid()) = created_by
  and (select private.owns_vehicle(vehicle_id))
  and record_source = 'customer_entry'
);
create policy "staff can create dyno records"
on public.dyno_records for insert to authenticated
with check ((select private.is_active_staff()) and (select auth.uid()) = created_by);
create policy "customers can update own unverified dyno records"
on public.dyno_records for update to authenticated
using ((select auth.uid()) = customer_id and (select auth.uid()) = created_by and record_source = 'customer_entry')
with check (
  (select auth.uid()) = customer_id
  and (select auth.uid()) = created_by
  and (select private.owns_vehicle(vehicle_id))
  and record_source = 'customer_entry'
);
create policy "staff can update dyno records"
on public.dyno_records for update to authenticated
using ((select private.is_active_staff()))
with check ((select private.is_active_staff()));

create policy "customers can view own repair records"
on public.repair_records for select to authenticated
using ((select auth.uid()) = customer_id);
create policy "staff can view repair records"
on public.repair_records for select to authenticated
using ((select private.is_active_staff()));
create policy "customers can create repair entries"
on public.repair_records for insert to authenticated
with check (
  (select auth.uid()) = customer_id
  and (select auth.uid()) = created_by
  and (select private.owns_vehicle(vehicle_id))
  and record_source = 'customer_entry'
);
create policy "staff can create repair records"
on public.repair_records for insert to authenticated
with check ((select private.is_active_staff()) and (select auth.uid()) = created_by);
create policy "customers can update own repair entries"
on public.repair_records for update to authenticated
using ((select auth.uid()) = customer_id and (select auth.uid()) = created_by and record_source = 'customer_entry')
with check (
  (select auth.uid()) = customer_id
  and (select auth.uid()) = created_by
  and (select private.owns_vehicle(vehicle_id))
  and record_source = 'customer_entry'
);
create policy "staff can update repair records"
on public.repair_records for update to authenticated
using ((select private.is_active_staff()))
with check ((select private.is_active_staff()));

create policy "customers can view own recommended work"
on public.recommended_work for select to authenticated
using ((select auth.uid()) = customer_id);
create policy "staff can view recommended work"
on public.recommended_work for select to authenticated
using ((select private.is_active_staff()));
create policy "customers can create recommendation notes"
on public.recommended_work for insert to authenticated
with check (
  (select auth.uid()) = customer_id
  and (select auth.uid()) = created_by
  and (select private.owns_vehicle(vehicle_id))
  and record_source = 'customer_entry'
);
create policy "staff can create recommended work"
on public.recommended_work for insert to authenticated
with check ((select private.is_active_staff()) and (select auth.uid()) = created_by);
create policy "customers can update own recommendation notes"
on public.recommended_work for update to authenticated
using ((select auth.uid()) = customer_id and (select auth.uid()) = created_by and record_source = 'customer_entry')
with check (
  (select auth.uid()) = customer_id
  and (select auth.uid()) = created_by
  and (select private.owns_vehicle(vehicle_id))
  and record_source = 'customer_entry'
);
create policy "staff can update recommended work"
on public.recommended_work for update to authenticated
using ((select private.is_active_staff()))
with check ((select private.is_active_staff()));

create policy "customers can view own invoices"
on public.invoices for select to authenticated
using ((select auth.uid()) = customer_id);
create policy "staff can view invoices"
on public.invoices for select to authenticated
using ((select private.is_active_staff()));
create policy "staff can create invoices"
on public.invoices for insert to authenticated
with check ((select private.is_active_staff()) and (select auth.uid()) = created_by and currency = 'AUD');
create policy "staff can update invoices"
on public.invoices for update to authenticated
using ((select private.is_active_staff()))
with check ((select private.is_active_staff()) and currency = 'AUD');

create policy "customers can view own vehicle file metadata"
on public.vehicle_files for select to authenticated
using ((select auth.uid()) = customer_id);
create policy "staff can view vehicle file metadata"
on public.vehicle_files for select to authenticated
using ((select private.is_active_staff()));
create policy "customers can create local file metadata"
on public.vehicle_files for insert to authenticated
with check (
  (select auth.uid()) = customer_id
  and (select auth.uid()) = created_by
  and (select private.owns_vehicle(vehicle_id))
  and record_source = 'customer_entry'
  and file_kind in ('vehicle_photo', 'dyno_graph', 'repair_document')
  and split_part(object_path, '/', 1) = (select auth.uid())::text
);
create policy "staff can create vehicle file metadata"
on public.vehicle_files for insert to authenticated
with check ((select private.is_active_staff()) and (select auth.uid()) = created_by);
create policy "customers can update own file metadata"
on public.vehicle_files for update to authenticated
using ((select auth.uid()) = customer_id and (select auth.uid()) = created_by and record_source = 'customer_entry')
with check (
  (select auth.uid()) = customer_id
  and (select auth.uid()) = created_by
  and (select private.owns_vehicle(vehicle_id))
  and record_source = 'customer_entry'
  and split_part(object_path, '/', 1) = (select auth.uid())::text
);
create policy "staff can update vehicle file metadata"
on public.vehicle_files for update to authenticated
using ((select private.is_active_staff()))
with check ((select private.is_active_staff()));

create policy "staff can view calendar sync records"
on public.booking_calendar_events for select to authenticated
using ((select private.is_active_staff()));
create policy "staff can create calendar sync records"
on public.booking_calendar_events for insert to authenticated
with check ((select private.is_active_staff()));
create policy "staff can update calendar sync records"
on public.booking_calendar_events for update to authenticated
using ((select private.is_active_staff()))
with check ((select private.is_active_staff()));

create policy "customers can view own audit history"
on public.audit_events for select to authenticated
using ((select auth.uid()) = customer_id);
create policy "staff can view audit history"
on public.audit_events for select to authenticated
using ((select private.is_active_staff()));

grant usage on schema public to authenticated;
grant select on public.staff_members to authenticated;
grant select, insert, update on public.customer_profiles to authenticated;
grant select, insert, update on public.customer_vehicles to authenticated;
grant select, insert, update on public.booking_requests to authenticated;
grant select, insert, update on public.dyno_records to authenticated;
grant select, insert, update on public.repair_records to authenticated;
grant select, insert, update on public.recommended_work to authenticated;
grant select, insert, update on public.invoices to authenticated;
grant select, insert, update on public.vehicle_files to authenticated;
grant select, insert, update on public.booking_calendar_events to authenticated;
grant select on public.audit_events to authenticated;

insert into public.staff_members (email, role, status)
values
  ('matt@psiperformance.com.au', 'owner', 'pending'),
  ('dale@psiperformance.com.au', 'staff', 'pending'),
  ('jamie@psiperformance.com.au', 'staff', 'pending')
on conflict (lower(email)) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'vehicle-photos',
    'vehicle-photos',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'vehicle-documents',
    'vehicle-documents',
    false,
    20971520,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  )
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "customers can view own private files"
on storage.objects for select to authenticated
using (
  bucket_id in ('vehicle-photos', 'vehicle-documents')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy "staff can view customer private files"
on storage.objects for select to authenticated
using (
  bucket_id in ('vehicle-photos', 'vehicle-documents')
  and (select private.is_active_staff())
);
create policy "customers can upload own private files"
on storage.objects for insert to authenticated
with check (
  bucket_id in ('vehicle-photos', 'vehicle-documents')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy "staff can upload customer private files"
on storage.objects for insert to authenticated
with check (
  bucket_id in ('vehicle-photos', 'vehicle-documents')
  and (select private.is_active_staff())
);
create policy "customers can replace own private files"
on storage.objects for update to authenticated
using (
  bucket_id in ('vehicle-photos', 'vehicle-documents')
  and owner_id = (select auth.uid())::text
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id in ('vehicle-photos', 'vehicle-documents')
  and owner_id = (select auth.uid())::text
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy "customers can remove own private files"
on storage.objects for delete to authenticated
using (
  bucket_id in ('vehicle-photos', 'vehicle-documents')
  and owner_id = (select auth.uid())::text
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy "staff can replace customer private files"
on storage.objects for update to authenticated
using (
  bucket_id in ('vehicle-photos', 'vehicle-documents')
  and (select private.is_active_staff())
)
with check (
  bucket_id in ('vehicle-photos', 'vehicle-documents')
  and (select private.is_active_staff())
);
create policy "staff can remove customer private files"
on storage.objects for delete to authenticated
using (
  bucket_id in ('vehicle-photos', 'vehicle-documents')
  and (select private.is_active_staff())
);
