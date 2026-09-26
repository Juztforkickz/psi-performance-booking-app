-- Xero exceptions are owner workshop alerts, separate from customer booking events.
alter table public.notification_events
  drop constraint if exists notification_events_kind_check;

alter table public.notification_events
  add constraint notification_events_kind_check
  check (kind in (
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
    'xero_invoice_review'
  ));
