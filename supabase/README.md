# PSI Performance App Supabase

The linked Supabase project is the Sydney-region account and private-record
foundation for the future PSI Performance customer app and PSI workshop portal.
The public GitHub Pages demo does not activate this connection.

## Current Auth boundary

- Passwordless email codes are the only planned customer sign-in method.
- Customer self-registration is disabled until PSI deliberately opens customer
  onboarding.
- Both the **Confirm sign up** and **Magic link or OTP** email templates present
  `{{ .Token }}` as a six-digit code. They do not require customers to follow a
  localhost confirmation link.
- The Auth Site URL is
  `https://juztforkickz.github.io/psi-performance-booking-app/`, providing a
  safe public-preview fallback instead of `localhost`.
- `matt@psiperformance.com.au` remains the PSI owner identity.
- Matt is currently the only allowlisted staff identity. The unused pending
  Dale and Jamie rows were removed and may be re-added later through the
  reviewed staff invitation process.
- `info@psiperformance.com.au` is the confirmed controlled customer pilot used
  to verify email delivery, code verification and customer-session RLS.
- The GitHub Pages workflow explicitly keeps
  `EXPO_PUBLIC_SUPABASE_AUTH_ENABLED=false`, so public-preview visitors cannot
  request codes or create accounts.

The email-code and RLS acceptance run on 24 August 2026 verified that the pilot
customer can see its own profile but cannot see PSI staff or unrelated records.
The test session was signed out after verification and registration was checked
closed again.

## Private files and booking integrations

- Customer vehicle photos now use the private `vehicle-photos` bucket in the
  Auth-enabled QA build. The object path begins with the authenticated customer
  UUID, matching metadata is RLS-scoped, and the app displays a short-lived
  signed URL rather than a public object URL.
- PSI invoice and dyno images remain in the private `vehicle-documents` bucket
  and are published only from the AAL2 staff workspace.
- Booking changes create durable, deduplicated rows in
  `booking_integration_jobs`. Customers and anonymous clients cannot read or
  change this queue; AAL2 staff receive read-only status and the service role is
  the only writer.
- `process-booking-integrations` is deployed with JWT verification. A customer
  may dispatch only request-received email jobs for a booking it owns; all
  booking status work and the full retry queue require another active-staff/AAL2
  check. The Resend sending credential and Google
  Calendar OAuth values are configured only as encrypted Edge Function secrets;
  no provider credential is present in this repository or any Expo/public
  variable. Google Calendar work is queued only for the future trusted
  `confirmed` transition. Payment remains intentionally unimplemented.
- The Google OAuth app is in production mode with Matt as its only authorised
  PSI user. Its sole scope is `calendar.events.owned`. Customers receive no
  Google token, Calendar list or event feed, and the worker never invites a
  customer to PSI's workshop event. Event visibility inherits the workshop
  calendar's sharing settings so authorised staff can see the full booking.
- Booking inserts and trusted status changes also create protected rows in
  `notification_events` and `push_notification_jobs`. The customer owns the
  in-app event view; the delivery queue remains private and service-role
  controlled. `process-push-notifications` is JWT-protected, validates booking
  ownership or active AAL2 staff access before dispatch, and sends only generic
  booking messages through Expo's push service. Device tokens are private,
  revocable and automatically disabled when Expo reports an unregistered
  device. Native push requires explicit permission; email remains independent.
- A completed service with explicit reminder consent creates two protected,
  deduplicated integration jobs. They are based on the actual completed-service
  date and become due one calendar month before the six- and twelve-month
  service dates. The daily Supabase Cron call processes only those due reminder
  jobs, sends the email, creates the private customer alert and queues its push
  delivery. Free accounts receive these reminders; the Performance+ archive is
  a separate entitlement.
- The reminder worker runs daily at `00:05 UTC` (`10:05 AEST` or `11:05 AEDT`).
  Its project URL and service-role credential are stored in Supabase Vault as
  `psi_service_reminder_project_url` and
  `psi_service_reminder_service_role`; neither value belongs in source control.

## Database acceptance test

Run `tests/customer_account_rls.sql` with a privileged database test connection.
It switches to the real `authenticated` role and checks anonymous denial,
cross-account isolation, customer/PSI record separation and private file-bucket
configuration. Every fixture uses a reserved `.invalid` identity and is removed
by the script's final transaction rollback.

Do not remove that rollback or convert the test identities into real email
addresses.

## Still activation-gated

Before customer onboarding is made generally available, PSI still needs to
approve the production app release, complete real-device private-file QA, run a
controlled end-to-end booking-specific email and AAL2 retry test, verify the
future payment-confirmed Google Calendar path after payments exist,
decide whether the owner-only Google OAuth connection needs formal verification,
complete the deposit/payment webhook last, and approve the operational support
process.
Database policies, private buckets, the MFA-gated portal and the fail-closed
worker are present, but the public demo must not be treated as the production
account portal.
