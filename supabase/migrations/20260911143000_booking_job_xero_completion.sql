-- Tie each confirmed app booking to one durable PSI workshop job. Xero may
-- suggest completion details after a verified invoice import, but only an
-- authenticated PSI staff member can create the permanent service completion.

alter table public.workshop_jobs
  add column booking_request_id uuid unique
  references public.booking_requests(id) on delete set null;

create index workshop_jobs_booking_idx
  on public.workshop_jobs(booking_request_id)
  where booking_request_id is not null;

create or replace function private.ensure_workshop_job_for_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  vehicle_registration text;
begin
  if new.state not in ('confirmed', 'completed') then
    return new;
  end if;

  select upper(btrim(vehicle.registration))
  into vehicle_registration
  from public.customer_vehicles vehicle
  where vehicle.id = new.vehicle_id
    and vehicle.customer_id = new.customer_id
    and vehicle.archived_at is null;

  if vehicle_registration is null then
    raise exception 'Confirmed booking vehicle is unavailable';
  end if;

  insert into public.workshop_jobs(
    booking_request_id,
    customer_id,
    vehicle_id,
    reference,
    title,
    job_date,
    created_by
  ) values (
    new.id,
    new.customer_id,
    new.vehicle_id,
    'PSI-' || upper(replace(new.id::text, '-', '')),
    case new.booking_type
      when 'dyno' then 'Dyno tuning · ' || vehicle_registration
      else 'Service · ' || vehicle_registration
    end,
    new.approved_date,
    new.reviewed_by
  )
  on conflict (booking_request_id) do nothing;

  return new;
end
$$;

revoke all on function private.ensure_workshop_job_for_booking()
from public, anon, authenticated, service_role;

create trigger ensure_workshop_job_for_booking
after insert or update of state on public.booking_requests
for each row execute function private.ensure_workshop_job_for_booking();

-- Create jobs for any beta bookings that were already confirmed before this
-- migration. The deterministic reference is safe to copy into Xero verbatim.
insert into public.workshop_jobs(
  booking_request_id,
  customer_id,
  vehicle_id,
  reference,
  title,
  job_date,
  created_by
)
select
  booking.id,
  booking.customer_id,
  booking.vehicle_id,
  'PSI-' || upper(replace(booking.id::text, '-', '')),
  case booking.booking_type
    when 'dyno' then 'Dyno tuning · ' || upper(btrim(vehicle.registration))
    else 'Service · ' || upper(btrim(vehicle.registration))
  end,
  booking.approved_date,
  booking.reviewed_by
from public.booking_requests booking
join public.customer_vehicles vehicle
  on vehicle.id = booking.vehicle_id
 and vehicle.customer_id = booking.customer_id
 and vehicle.archived_at is null
where booking.state in ('confirmed', 'completed')
  and booking.approved_date is not null
  and not exists (
    select 1 from public.workshop_jobs job
    where job.booking_request_id = booking.id
  )
on conflict do nothing;

create table public.service_completion_candidates (
  id uuid primary key default gen_random_uuid(),
  booking_request_id uuid not null unique
    references public.booking_requests(id) on delete cascade,
  job_id uuid not null references public.workshop_jobs(id) on delete cascade,
  customer_id uuid not null references public.customer_profiles(user_id) on delete cascade,
  vehicle_id uuid not null references public.customer_vehicles(id) on delete cascade,
  source_record_id uuid unique references public.vault_records(id) on delete set null,
  invoice_number text not null check (octet_length(btrim(invoice_number)) between 1 and 120),
  invoice_status text not null check (invoice_status in ('AUTHORISED', 'PAID')),
  suggested_completed_date date not null,
  suggested_summary text not null check (octet_length(btrim(suggested_summary)) between 1 and 2000),
  state text not null default 'pending' check (state in ('pending', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(job_id, customer_id, vehicle_id)
    references public.workshop_jobs(id, customer_id, vehicle_id) on delete cascade
);

create index service_completion_candidates_customer_idx
  on public.service_completion_candidates(customer_id, created_at desc);
create index service_completion_candidates_vehicle_idx
  on public.service_completion_candidates(vehicle_id, created_at desc);

create trigger service_completion_candidates_set_updated_at
before update on public.service_completion_candidates
for each row execute function private.set_updated_at();

alter table public.service_completion_candidates enable row level security;
revoke all on public.service_completion_candidates from public, anon, authenticated;
grant select on public.service_completion_candidates to authenticated;
grant all on public.service_completion_candidates to service_role;

create policy "staff read Xero completion candidates"
on public.service_completion_candidates for select to authenticated
using ((select private.is_active_staff()));

create policy "completion candidate identity lock"
on public.service_completion_candidates as restrictive for all to authenticated
using ((select private.customer_identity_access_allowed()));

create or replace function private.complete_xero_candidate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.service_completion_candidates
  set state = 'completed'
  where booking_request_id = new.booking_request_id
    and customer_id = new.customer_id
    and vehicle_id = new.vehicle_id;
  return new;
end
$$;

revoke all on function private.complete_xero_candidate()
from public, anon, authenticated, service_role;

create trigger complete_xero_candidate
after insert on public.service_completions
for each row execute function private.complete_xero_candidate();

create or replace function public.ignore_xero_import(p_queue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_owner_staff() then
    raise exception 'owner_aal2_required' using errcode = '42501';
  end if;

  update public.vault_import_queue
  set status = 'ignored',
      reason = 'Kept in Xero only: no matching PSI app customer.',
      completed_at = now(),
      last_error_code = null
  where id = p_queue_id
    and source = 'xero'
    and status in ('needs_review', 'failed');

  if not found then
    raise exception 'xero_import_not_reviewable';
  end if;
end
$$;

revoke all on function public.ignore_xero_import(uuid)
from public, anon, authenticated;
grant execute on function public.ignore_xero_import(uuid) to authenticated;
