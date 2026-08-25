-- PSI operates in Melbourne. PostgreSQL remains on UTC, so current_date can be
-- one calendar day behind the workshop between local midnight and 10/11am.
-- Keep the database timezone unchanged and make the booking boundary explicit.

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
  melbourne_today date := (now() at time zone 'Australia/Melbourne')::date;
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
    if new.state in ('date_proposed', 'date_approved') and new.approved_date < melbourne_today then
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

revoke all on function private.validate_booking_workflow()
from public, anon, authenticated, service_role;
