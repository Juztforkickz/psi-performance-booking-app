-- Customers can read only the markers for their own bookings so all customer
-- screens can exclude test entries already removed from the workshop inbox.
create policy "customers can see own held booking markers"
on public.booking_portal_holding for select to authenticated
using (
  exists (
    select 1 from public.booking_requests booking
    where booking.id = booking_request_id
      and booking.customer_id = (select auth.uid())
  )
);
