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
approve the production app release, staff MFA/AAL2 workflow, private file
storage UI, workshop portal, Google Calendar service and operational support
process. Database policies and private buckets are present, but the public demo
must not be treated as the production account portal.
