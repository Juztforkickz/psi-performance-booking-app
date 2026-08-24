-- Connect authenticated customer booking requests to the protected PSI staff
-- review queue. Public demo builds remain disabled at the client gate. The
-- database is the authority for immutable ownership, idempotency, permitted
-- staff transitions, AUD deposits and approved workshop dates.

alter table public.booking_requests
  add column client_request_id uuid not null default gen_random_uuid(),
  add column approved_date date,
  add column staff_note text,
  add column reviewed_by uuid references auth.users(id) on delete restrict,
  add column reviewed_at timestamptz,
  add column request_context jsonb not null default '{}'::jsonb,
  add constraint booking_requests_request_context_object_check
    check (jsonb_typeof(request_context) = 'object'),
  add constraint booking_requests_request_context_size_check
    check (octet_length(request_context::text) <= 20000),
  add constraint booking_requests_request_notes_size_check
    check (request_notes is null or octet_length(request_notes) <= 5000),
  add constraint booking_requests_staff_note_size_check
    check (staff_note is null or octet_length(staff_note) <= 2000),
  add constraint booking_requests_review_metadata_check
    check (
      (reviewed_by is null and reviewed_at is null)
      or (reviewed_by is not null and reviewed_at is not null)
    ),
  add constraint booking_requests_approved_date_state_check
    check (
      state in ('pending_staff_review', 'cancelled')
      or approved_date is not null
    );

create unique index booking_requests_customer_client_request_unique_idx
  on public.booking_requests (customer_id, client_request_id);
create index booking_requests_customer_approved_date_idx
  on public.booking_requests (customer_id, approved_date desc)
  where approved_date is not null;

create or replace function private.validate_booking_workflow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_is_staff boolean := false;
  actor_is_service boolean := coalesce(auth.jwt() ->> 'role', '') = 'service_role';
begin
  if actor_id is not null then
    actor_is_staff := (select private.is_active_staff());
  end if;

  if tg_op = 'INSERT' then
    if not actor_is_staff and not actor_is_service then
      new.state := 'pending_staff_review';
      new.approved_date := null;
      new.deposit_amount_cents := null;
      new.staff_note := null;
      new.reviewed_by := null;
      new.reviewed_at := null;
      new.currency := 'AUD';
    end if;
  else
    if not actor_is_staff and not actor_is_service then
      raise exception 'Only active AAL2 PSI staff or a trusted server integration can review bookings';
    end if;

    if new.customer_id is distinct from old.customer_id
      or new.vehicle_id is distinct from old.vehicle_id
      or new.booking_type is distinct from old.booking_type
      or new.created_by is distinct from old.created_by
      or new.client_request_id is distinct from old.client_request_id
      or new.request_notes is distinct from old.request_notes
      or new.request_context is distinct from old.request_context then
      raise exception 'Customer booking request details and ownership are immutable';
    end if;

    if new.state is distinct from old.state then
      if actor_is_staff and (
        (old.state = 'pending_staff_review' and new.state in ('date_proposed', 'date_approved', 'cancelled'))
        or (old.state = 'date_proposed' and new.state in ('date_proposed', 'date_approved', 'cancelled'))
        or (old.state = 'date_approved' and new.state in ('date_proposed', 'date_approved', 'cancelled'))
        or (
          old.state = 'confirmed'
          and new.state = 'completed'
          and exists (
            select 1
            from public.service_completions
            where booking_request_id = old.id
          )
        )
      ) then
        null;
      elsif actor_is_service and old.state = 'date_approved' and new.state = 'confirmed' then
        null;
      else
        raise exception 'Booking state transition is not permitted';
      end if;
    end if;

    if actor_is_staff then
      new.reviewed_by := actor_id;
      new.reviewed_at := now();
    end if;
  end if;

  new.staff_note := nullif(btrim(new.staff_note), '');
  if new.state in ('date_proposed', 'date_approved', 'confirmed', 'completed') then
    if new.approved_date is null then
      raise exception 'A proposed or approved booking needs a workshop date';
    end if;
    if new.state in ('date_proposed', 'date_approved') and new.approved_date < current_date then
      raise exception 'A workshop booking date cannot be in the past';
    end if;
    if new.booking_type = 'service' and extract(isodow from new.approved_date) not between 1 and 5 then
      raise exception 'Service workshop dates must be Monday to Friday';
    end if;
    if new.booking_type = 'dyno' and extract(isodow from new.approved_date) not in (1, 3, 4) then
      raise exception 'Dyno workshop dates must be Monday, Wednesday or Thursday';
    end if;
  end if;

  if new.state in ('date_approved', 'confirmed', 'completed') then
    new.deposit_amount_cents := case new.booking_type
      when 'service' then 10000
      when 'dyno' then 30000
    end;
  elsif new.state in ('pending_staff_review', 'date_proposed') then
    new.deposit_amount_cents := null;
  end if;
  new.currency := 'AUD';
  return new;
end;
$$;

revoke all on function private.validate_booking_workflow() from public, anon, authenticated, service_role;

create trigger validate_booking_workflow
before insert or update on public.booking_requests
for each row execute function private.validate_booking_workflow();
