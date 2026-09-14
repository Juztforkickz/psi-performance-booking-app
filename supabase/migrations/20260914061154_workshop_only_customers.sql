-- Allow phone and walk-in jobs to exist without creating a customer login.
-- These records remain staff-only until an owner explicitly claims them for an
-- existing app customer after reviewing strong identity matches.

create table public.workshop_contacts (
  id uuid primary key default gen_random_uuid(),
  display_name text not null
    check (octet_length(btrim(display_name)) between 1 and 160),
  email text,
  mobile text,
  status text not null default 'active'
    check (status in ('active', 'claimed', 'archived')),
  claimed_customer_id uuid references public.customer_profiles(user_id) on delete restrict,
  claimed_at timestamptz,
  claimed_by uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email is null or (
    email = lower(btrim(email))
    and octet_length(email) between 3 and 160
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  )),
  check (mobile is null or octet_length(btrim(mobile)) between 6 and 40),
  check (email is not null or mobile is not null),
  check (
    (status = 'claimed' and claimed_customer_id is not null and claimed_at is not null and claimed_by is not null)
    or (status <> 'claimed' and claimed_customer_id is null and claimed_at is null and claimed_by is null)
  )
);

create index workshop_contacts_active_email_idx
  on public.workshop_contacts (lower(email))
  where status = 'active' and email is not null;
create index workshop_contacts_claimed_customer_idx
  on public.workshop_contacts (claimed_customer_id)
  where claimed_customer_id is not null;
create index workshop_contacts_created_by_idx on public.workshop_contacts(created_by);

create table public.workshop_vehicles (
  id uuid primary key default gen_random_uuid(),
  workshop_contact_id uuid not null references public.workshop_contacts(id) on delete restrict,
  registration text not null
    check (registration = upper(btrim(registration)) and octet_length(registration) between 1 and 20),
  year smallint not null check (year between 1900 and 2200),
  make text not null check (octet_length(btrim(make)) between 1 and 80),
  model text not null check (octet_length(btrim(model)) between 1 and 100),
  vin_last_four text check (vin_last_four is null or vin_last_four ~ '^[A-Z0-9]{4}$'),
  status text not null default 'active'
    check (status in ('active', 'claimed', 'archived')),
  claimed_vehicle_id uuid references public.customer_vehicles(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workshop_contact_id),
  check (
    (status = 'claimed' and claimed_vehicle_id is not null)
    or (status <> 'claimed' and claimed_vehicle_id is null)
  )
);

create unique index workshop_vehicles_contact_registration_idx
  on public.workshop_vehicles (workshop_contact_id, lower(registration))
  where status = 'active';
create index workshop_vehicles_active_registration_idx
  on public.workshop_vehicles (registration)
  where status = 'active';
create index workshop_vehicles_claimed_vehicle_idx
  on public.workshop_vehicles (claimed_vehicle_id)
  where claimed_vehicle_id is not null;
create index workshop_vehicles_created_by_idx on public.workshop_vehicles(created_by);

create trigger workshop_contacts_set_updated_at
before update on public.workshop_contacts
for each row execute function private.set_updated_at();

create trigger workshop_vehicles_set_updated_at
before update on public.workshop_vehicles
for each row execute function private.set_updated_at();

create trigger audit_workshop_contacts
after insert or update or delete on public.workshop_contacts
for each row execute function private.record_audit_event();

create trigger audit_workshop_vehicles
after insert or update or delete on public.workshop_vehicles
for each row execute function private.record_audit_event();

alter table public.workshop_contacts enable row level security;
alter table public.workshop_vehicles enable row level security;

revoke all on public.workshop_contacts from public, anon, authenticated;
revoke all on public.workshop_vehicles from public, anon, authenticated;
grant select, insert, update on public.workshop_contacts to authenticated;
grant select, insert, update on public.workshop_vehicles to authenticated;
grant all on public.workshop_contacts to service_role;
grant all on public.workshop_vehicles to service_role;

create policy "staff read workshop contacts"
on public.workshop_contacts for select to authenticated
using ((select private.is_active_staff()));

create policy "staff create workshop contacts"
on public.workshop_contacts for insert to authenticated
with check (
  (select private.is_active_staff())
  and created_by = (select auth.uid())
  and status = 'active'
  and claimed_customer_id is null
);

create policy "owner claims workshop contacts"
on public.workshop_contacts for update to authenticated
using ((select private.is_owner_staff()))
with check ((select private.is_owner_staff()));

create policy "staff read workshop vehicles"
on public.workshop_vehicles for select to authenticated
using ((select private.is_active_staff()));

create policy "staff create workshop vehicles"
on public.workshop_vehicles for insert to authenticated
with check (
  (select private.is_active_staff())
  and created_by = (select auth.uid())
  and status = 'active'
  and claimed_vehicle_id is null
  and exists (
    select 1
    from public.workshop_contacts contact
    where contact.id = workshop_contact_id
      and contact.status = 'active'
  )
);

create policy "owner claims workshop vehicles"
on public.workshop_vehicles for update to authenticated
using ((select private.is_owner_staff()))
with check ((select private.is_owner_staff()));

alter table public.workshop_jobs
  alter column customer_id drop not null,
  alter column vehicle_id drop not null,
  add column workshop_contact_id uuid,
  add column workshop_vehicle_id uuid,
  add constraint workshop_jobs_workshop_vehicle_fkey
    foreign key (workshop_vehicle_id, workshop_contact_id)
    references public.workshop_vehicles(id, workshop_contact_id) on delete restrict,
  add constraint workshop_jobs_owner_mode_check check (
    (
      customer_id is not null and vehicle_id is not null
      and workshop_contact_id is null and workshop_vehicle_id is null
    ) or (
      customer_id is null and vehicle_id is null
      and workshop_contact_id is not null and workshop_vehicle_id is not null
    )
  ),
  add unique (id, workshop_contact_id, workshop_vehicle_id);

create index workshop_jobs_workshop_contact_idx
  on public.workshop_jobs (workshop_contact_id, job_date desc)
  where workshop_contact_id is not null;
create index workshop_jobs_workshop_vehicle_idx
  on public.workshop_jobs (workshop_vehicle_id, job_date desc)
  where workshop_vehicle_id is not null;

drop policy "staff create checked jobs" on public.workshop_jobs;
create policy "staff create checked jobs"
on public.workshop_jobs for insert to authenticated
with check (
  (select private.is_active_staff())
  and created_by = (select auth.uid())
  and (
    (
      customer_id is not null
      and vehicle_id is not null
      and workshop_contact_id is null
      and workshop_vehicle_id is null
      and exists (
        select 1
        from public.customer_vehicles vehicle
        where vehicle.id = vehicle_id
          and vehicle.customer_id = workshop_jobs.customer_id
          and vehicle.archived_at is null
      )
    ) or (
      customer_id is null
      and vehicle_id is null
      and workshop_contact_id is not null
      and workshop_vehicle_id is not null
      and exists (
        select 1
        from public.workshop_vehicles vehicle
        join public.workshop_contacts contact
          on contact.id = vehicle.workshop_contact_id
        where vehicle.id = workshop_vehicle_id
          and vehicle.workshop_contact_id = workshop_jobs.workshop_contact_id
          and vehicle.status = 'active'
          and contact.status = 'active'
      )
    )
  )
);

grant update on public.workshop_jobs to authenticated;
create policy "owner claims workshop jobs"
on public.workshop_jobs for update to authenticated
using (
  (select private.is_owner_staff())
  and workshop_contact_id is not null
  and workshop_vehicle_id is not null
)
with check (
  (select private.is_owner_staff())
  and customer_id is not null
  and vehicle_id is not null
  and workshop_contact_id is null
  and workshop_vehicle_id is null
  and exists (
    select 1
    from public.customer_vehicles vehicle
    where vehicle.id = vehicle_id
      and vehicle.customer_id = workshop_jobs.customer_id
      and vehicle.archived_at is null
  )
);

create or replace function public.create_workshop_only_job(
  p_existing_workshop_vehicle_id uuid,
  p_display_name text,
  p_email text,
  p_mobile text,
  p_registration text,
  p_year integer,
  p_make text,
  p_model text,
  p_title text,
  p_job_date date
)
returns setof public.workshop_jobs
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  contact_id uuid;
  workshop_vehicle_id uuid;
  created_job_id uuid;
  normalized_email text := nullif(lower(btrim(p_email)), '');
  normalized_mobile text := nullif(btrim(p_mobile), '');
begin
  if not private.is_active_staff() or actor_id is null then
    raise exception 'staff_aal2_required' using errcode = '42501';
  end if;
  if p_job_date is null or p_job_date < current_date - 30 or p_job_date > current_date + 730 then
    raise exception 'invalid_job_date' using errcode = '22023';
  end if;
  if octet_length(btrim(p_title)) not between 1 and 180 then
    raise exception 'invalid_job_title' using errcode = '22023';
  end if;

  if p_existing_workshop_vehicle_id is not null then
    select vehicle.id, vehicle.workshop_contact_id
    into workshop_vehicle_id, contact_id
    from public.workshop_vehicles vehicle
    join public.workshop_contacts contact on contact.id = vehicle.workshop_contact_id
    where vehicle.id = p_existing_workshop_vehicle_id
      and vehicle.status = 'active'
      and contact.status = 'active'
    for update of vehicle, contact;

    if workshop_vehicle_id is null then
      raise exception 'workshop_vehicle_unavailable' using errcode = '22023';
    end if;
  else
    if octet_length(btrim(p_display_name)) not between 1 and 160
      or (normalized_email is null and normalized_mobile is null)
      or p_year not between 1900 and 2200
      or octet_length(btrim(p_make)) not between 1 and 80
      or octet_length(btrim(p_model)) not between 1 and 100
      or octet_length(upper(regexp_replace(btrim(p_registration), '[[:space:]]+', '', 'g'))) not between 1 and 20
    then
      raise exception 'invalid_workshop_customer_or_vehicle' using errcode = '22023';
    end if;

    insert into public.workshop_contacts(display_name, email, mobile, created_by)
    values (btrim(p_display_name), normalized_email, normalized_mobile, actor_id)
    returning id into contact_id;

    insert into public.workshop_vehicles(
      workshop_contact_id, registration, year, make, model, created_by
    ) values (
      contact_id,
      upper(regexp_replace(btrim(p_registration), '[[:space:]]+', '', 'g')),
      p_year::smallint,
      btrim(p_make),
      btrim(p_model),
      actor_id
    ) returning id into workshop_vehicle_id;
  end if;

  insert into public.workshop_jobs(
    workshop_contact_id,
    workshop_vehicle_id,
    reference,
    title,
    job_date,
    created_by
  ) values (
    contact_id,
    workshop_vehicle_id,
    'PSI-PHONE-' || to_char(p_job_date, 'YYYYMMDD') || '-' || upper(left(replace(gen_random_uuid()::text, '-', ''), 8)),
    btrim(p_title),
    p_job_date,
    actor_id
  ) returning id into created_job_id;

  return query
  select job.* from public.workshop_jobs job where job.id = created_job_id;
end
$$;

revoke all on function public.create_workshop_only_job(uuid, text, text, text, text, integer, text, text, text, date)
from public, anon;
grant execute on function public.create_workshop_only_job(uuid, text, text, text, text, integer, text, text, text, date)
to authenticated;

create or replace function public.claim_workshop_contact(
  p_workshop_contact_id uuid,
  p_customer_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  contact public.workshop_contacts%rowtype;
  customer public.customer_profiles%rowtype;
  source_vehicle public.workshop_vehicles%rowtype;
  target_vehicle_id uuid;
  exact_email boolean;
  exact_name boolean;
  exact_registration boolean;
  moved_jobs integer := 0;
  vehicle_jobs integer;
  mapped_vehicles integer := 0;
begin
  if not private.is_owner_staff() or auth.uid() is null then
    raise exception 'owner_aal2_required' using errcode = '42501';
  end if;

  select * into contact
  from public.workshop_contacts
  where id = p_workshop_contact_id and status = 'active'
  for update;
  if contact.id is null then
    raise exception 'workshop_contact_unavailable' using errcode = '22023';
  end if;

  select * into customer
  from public.customer_profiles
  where user_id = p_customer_id and account_state = 'active'
  for update;
  if customer.user_id is null then
    raise exception 'app_customer_unavailable' using errcode = '22023';
  end if;

  exact_email := contact.email is not null
    and lower(btrim(contact.email)) = lower(btrim(customer.email));
  exact_name := regexp_replace(lower(btrim(contact.display_name)), '[[:space:]]+', ' ', 'g')
    = regexp_replace(lower(btrim(coalesce(customer.first_name, '') || ' ' || coalesce(customer.last_name, ''))), '[[:space:]]+', ' ', 'g');
  exact_registration := exists (
    select 1
    from public.workshop_vehicles workshop_vehicle
    join public.customer_vehicles app_vehicle
      on app_vehicle.customer_id = customer.user_id
     and app_vehicle.archived_at is null
     and upper(btrim(app_vehicle.registration)) = upper(btrim(workshop_vehicle.registration))
    where workshop_vehicle.workshop_contact_id = contact.id
      and workshop_vehicle.status = 'active'
  );

  if not exact_email and not (exact_name and exact_registration) then
    raise exception 'strong_identity_match_required' using errcode = '22023';
  end if;

  for source_vehicle in
    select vehicle.*
    from public.workshop_vehicles vehicle
    where vehicle.workshop_contact_id = contact.id
      and vehicle.status = 'active'
    order by vehicle.id
    for update
  loop
    select vehicle.id into target_vehicle_id
    from public.customer_vehicles vehicle
    where vehicle.customer_id = customer.user_id
      and vehicle.archived_at is null
      and upper(btrim(vehicle.registration)) = upper(btrim(source_vehicle.registration))
    order by vehicle.created_at, vehicle.id
    limit 1;

    if target_vehicle_id is null then
      insert into public.customer_vehicles(
        customer_id, registration, year, make, model, vin_last_four,
        is_primary, created_by
      ) values (
        customer.user_id,
        source_vehicle.registration,
        source_vehicle.year,
        source_vehicle.make,
        source_vehicle.model,
        source_vehicle.vin_last_four,
        not exists (
          select 1 from public.customer_vehicles vehicle
          where vehicle.customer_id = customer.user_id
            and vehicle.archived_at is null
            and vehicle.is_primary
        ),
        auth.uid()
      ) returning id into target_vehicle_id;
    end if;

    update public.workshop_jobs
    set customer_id = customer.user_id,
        vehicle_id = target_vehicle_id,
        workshop_contact_id = null,
        workshop_vehicle_id = null
    where workshop_contact_id = contact.id
      and workshop_vehicle_id = source_vehicle.id;
    get diagnostics vehicle_jobs = row_count;
    moved_jobs := moved_jobs + vehicle_jobs;

    update public.workshop_vehicles
    set status = 'claimed', claimed_vehicle_id = target_vehicle_id
    where id = source_vehicle.id;
    mapped_vehicles := mapped_vehicles + 1;
  end loop;

  if mapped_vehicles = 0 or moved_jobs = 0 then
    raise exception 'workshop_history_unavailable' using errcode = '22023';
  end if;

  update public.workshop_contacts
  set status = 'claimed',
      claimed_customer_id = customer.user_id,
      claimed_at = now(),
      claimed_by = auth.uid()
  where id = contact.id;

  return jsonb_build_object(
    'claimed', true,
    'customer_id', customer.user_id,
    'workshop_contact_id', contact.id,
    'moved_jobs', moved_jobs,
    'mapped_vehicles', mapped_vehicles,
    'matched_by', jsonb_build_object(
      'email', exact_email,
      'name', exact_name,
      'registration', exact_registration
    )
  );
end
$$;

revoke all on function public.claim_workshop_contact(uuid, uuid) from public, anon;
grant execute on function public.claim_workshop_contact(uuid, uuid) to authenticated;
