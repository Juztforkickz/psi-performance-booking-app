# Booking integration worker

`process-booking-integrations` is a JWT-protected Supabase Edge Function for the
private PSI app and staff portal. It processes durable `booking_integration_jobs` rows
with provider idempotency and never accepts customer-supplied recipients,
Calendar IDs or message bodies.

For a booking-scoped customer request, the function verifies a valid Supabase
session and confirms through RLS that the booking belongs to that customer. It
then permits only `notify_psi_request_received` and
`notify_customer_request_received`. A customer cannot select recipients,
message content, other bookings or other job kinds.

Full queue access and staff-side booking status work perform all of these checks
before using the service role:

1. a valid Supabase user session;
2. Authenticator Assurance Level 2 from the validated access-token claims; and
3. an active `staff_members` row visible through the current RLS policy.

The signed Stripe webhook may also invoke this worker internally with the
server-only service credential and a required booking ID. This narrowly scoped
path starts the already-queued confirmation email and Calendar jobs immediately
after Stripe confirms the deposit; it cannot process the unscoped queue.

The scheduled reminder runner invokes this same worker with the server-only
credential and `action: process_due_service_reminders`. That unscoped internal
mode is restricted to due `notify_customer_service_due` jobs; it cannot process
booking decisions, owner email or Calendar work. A completed, consented service
creates six- and twelve-month jobs from its actual completion date. Each job is
available at 9:00 am Melbourne time one calendar month before the due date. The
worker sends the customer email, records the private in-app alert and hands its
push job to the push worker using the same required booking ID.

The function is safe to deploy without provider credentials. Affected jobs move
to `blocked_configuration`; no success is claimed and no customer data is sent.
Configure values only as encrypted Supabase Edge Function secrets—never as
`EXPO_PUBLIC_*` variables, repository files, GitHub Pages variables or mobile
app configuration:

- `RESEND_API_KEY`
- `PSI_TRANSACTIONAL_FROM_EMAIL`
- `PSI_OWNER_NOTIFICATION_EMAIL`
- `GOOGLE_CALENDAR_CLIENT_ID`
- `GOOGLE_CALENDAR_CLIENT_SECRET`
- `GOOGLE_CALENDAR_REFRESH_TOKEN`
- `PSI_GOOGLE_CALENDAR_ID`

The Supabase Cron schedule calls the function daily at `00:05 UTC` (`10:05
AEST` or `11:05 AEDT`). Keep the project URL in Vault as
`psi_service_reminder_project_url` and the service-role credential as
`psi_service_reminder_service_role`; never put either value in a migration,
repository file, mobile variable or GitHub Pages setting. The
schedule is considered active only after a controlled due-job acceptance run
shows the email job as succeeded and the paired in-app/push job as delivered or
explicitly cancelled because the customer has no registered device.

Email calls use the queue dedupe key as Resend's idempotency key. Calendar
events are all-day workshop records, use a deterministic event ID, inherit the
selected PSI Calendar's default visibility, and never invite the customer. They
are inserted only after a trusted payment flow moves a booking to `confirmed`.
Payment processing is not implemented by this function.

## Provider activation

On 25 August 2026 the required provider values were installed as encrypted
Supabase Edge Function secrets. Resend uses a sending-only key restricted to
`psiperformance.com.au`. Google Calendar uses the PSI-owned Cloud project,
Matt's OAuth consent and only the `calendar.events.owned` scope. The durable
refresh token has no testing-mode seven-day expiry field.

This does not make Calendar data customer-visible. The customer client has no
Google credential or Calendar-read endpoint. The worker creates no event for a
pending or date-approved request and never adds the customer as an attendee.
The portal's AAL2-gated queue check also performs a read-only live Calendar
health request. A real event acceptance check still waits for a legitimately
confirmed booking.
