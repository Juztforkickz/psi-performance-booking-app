-- Consolidate payment read policies and cover payment-event foreign keys found
-- by the production database advisor after the initial deployment.

create index booking_payment_events_payment_attempt_idx
  on public.booking_payment_events (payment_attempt_id);

create index booking_payment_events_customer_created_idx
  on public.booking_payment_events (customer_id, created_at desc);

drop policy "customers can read own payment attempts"
  on public.booking_payment_attempts;
drop policy "staff can read payment attempts"
  on public.booking_payment_attempts;
create policy "customers or staff can read payment attempts"
on public.booking_payment_attempts for select to authenticated
using (
  customer_id = (select auth.uid())
  or (select private.is_active_staff())
);

drop policy "customers can read own payment events"
  on public.booking_payment_events;
drop policy "staff can read payment events"
  on public.booking_payment_events;
create policy "customers or staff can read payment events"
on public.booking_payment_events for select to authenticated
using (
  customer_id = (select auth.uid())
  or (select private.is_active_staff())
);
