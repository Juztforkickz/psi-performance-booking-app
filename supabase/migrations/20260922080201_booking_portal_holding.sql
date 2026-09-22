-- The workshop inbox is a workspace view. Moving a booking out of it must not
-- change the customer's booking, send cancellation notifications, or remove
-- payment, invoice, calendar, and service records.
create table public.booking_portal_holding (
  booking_request_id uuid primary key references public.booking_requests(id) on delete cascade,
  queued_at timestamptz not null default now(),
  source text not null check (source in ('cancelled', 'owner_removed')),
  queued_by uuid references auth.users(id) on delete set null
);

create index booking_portal_holding_queued_at_idx
  on public.booking_portal_holding (queued_at desc);

alter table public.booking_portal_holding enable row level security;

create policy "staff can view booking holding folder"
  on public.booking_portal_holding for select to authenticated
  using ((select private.is_active_staff()));

create policy "owner can move finished bookings to holding folder"
  on public.booking_portal_holding for insert to authenticated
  with check (
    (select private.is_owner_staff())
    and queued_by = (select auth.uid())
    and exists (
      select 1 from public.booking_requests booking
      where booking.id = booking_request_id
        and booking.state in ('cancelled', 'completed')
    )
  );

grant select, insert on public.booking_portal_holding to authenticated;

create function private.queue_cancelled_booking_for_portal_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.state = 'cancelled' and old.state is distinct from new.state then
    insert into public.booking_portal_holding (booking_request_id, source, queued_by)
    values (new.id, 'cancelled', auth.uid())
    on conflict (booking_request_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function private.queue_cancelled_booking_for_portal_removal() from public, anon, authenticated;

create trigger queue_cancelled_booking_for_portal_removal
after update of state on public.booking_requests
for each row execute function private.queue_cancelled_booking_for_portal_removal();
