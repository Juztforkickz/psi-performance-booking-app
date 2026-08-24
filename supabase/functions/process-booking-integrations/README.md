# Booking integration worker

`process-booking-integrations` is a JWT-protected Supabase Edge Function for the
private PSI staff portal. It processes durable `booking_integration_jobs` rows
with provider idempotency and never accepts customer-supplied recipients,
Calendar IDs or message bodies.

The function performs all of these checks before using the service role:

1. a valid Supabase user session;
2. Authenticator Assurance Level 2 from the validated access-token claims; and
3. an active `staff_members` row visible through the current RLS policy.

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

Email calls use the queue dedupe key as Resend's idempotency key. Calendar
events are all-day internal workshop records, use a deterministic event ID, do
not invite the customer and are inserted only for a booking already moved to
`confirmed` by the future trusted payment integration. Payment processing is
not implemented by this function.

## Provider activation

On 25 August 2026 the required provider values were installed as encrypted
Supabase Edge Function secrets. Resend uses a sending-only key restricted to
`psiperformance.com.au`. Google Calendar uses the PSI-owned Cloud project,
Matt's OAuth consent and only the `calendar.events.owned` scope. The durable
refresh token has no testing-mode seven-day expiry field.

This does not make Calendar data customer-visible. The customer client has no
Google credential or Calendar-read endpoint. The worker creates no event for a
pending or date-approved request and never adds the customer as an attendee.
A controlled AAL2 queue-delivery acceptance run is still required before real
customer onboarding.
