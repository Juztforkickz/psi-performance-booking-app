# PSI customer accounts

Status: the existing Cloudflare/D1 web account endpoints remain provider-neutral
and fail-closed. The separate mobile-app foundation uses Supabase for controlled
signed builds. Matt can approve individual customer emails from the AAL2 staff
portal, while public registration remains disabled. See
`SUPABASE-APP-FOUNDATION.md` for the app-specific model.

## Approved account model

- Sign-in is passwordless by email using a short-lived, single-use link.
- Registration remains disabled during owner review and becomes invite-only for
  the first controlled test group.
- Customers can continue booking without an account.
- PSI never stores a password, password hash or email-link token. Access and
  refresh tokens must never enter D1, application logs, browser local storage
  or native AsyncStorage; a native provider session may use OS secure storage.
- The identity provider owns email verification, authentication, account
  recovery and session security.
- D1 stores PSI business data: contact profile, vehicles, booking history,
  verified deposit records and reminder preferences.

The provider's verified, stable subject is linked to
`customer_profiles.account_user_id` as a namespaced value such as
`provider:subject`. A profile or historic booking must never be claimed merely
because an email address, registration or VIN matches.

## Account details

The initial profile contains first name, last name, verified email and mobile.
A customer may then keep one or more vehicles with registration, year, make,
model and optional VIN. Booking, payment and reminder records stay in their
existing purpose-specific tables.

## Invite-only onboarding

Matt approves one normalized email at a time from the protected staff portal.
The server-only `invite-customer` function rechecks Matt's owner identity and
AAL2 authenticator claim before creating the Auth identity. Its service-role key
never enters the app. The customer then requests their own six-digit code and
completes their own contact and vehicle profile under the existing ownership
policies. An owner-only invitation audit row records whether profile setup is
pending or complete; customers cannot read or change that audit table.

For iPhone testing, Apple TestFlight access is a separate step. Matt adds the
same approved email in App Store Connect, and Apple prompts that person to
install TestFlight and PSI. A TestFlight invitation does not itself grant PSI
account access, and a PSI account approval does not bypass Apple's tester list.

## Shared API boundary

Web and native clients will share the account status, profile, vehicle and
history API contracts. They will not share session storage:

- web sessions must use secure, HttpOnly, same-site cookies; and
- native authentication must use an authorization-code flow with PKCE, verified
  app links/deep links and operating-system secure token storage.

`GET /api/v1/account/status` reports the non-personal capability state.
`GET /api/v1/account/me` and `PATCH /api/v1/account/me` fail with
`503 CUSTOMER_ACCOUNTS_DISABLED` until a reviewed provider adapter is present.
Activation is a code-reviewed change, not an environment-only switch.

## Activation gates

Before an invite can be sent or any profile can be claimed, all of the
following must be complete:

1. Select a provider that supports passwordless email on web and React Native.
2. Verify token signature, issuer, audience, expiry and verified-email claim on
   the server for every account request.
3. Enforce invite-only registration at the identity provider.
4. Add normalized-email uniqueness and verified identity-link migrations.
5. Add strict server-side ownership checks and cross-account isolation tests.
6. Test email delivery, expired/replayed links, logout, recovery, account
   disablement and deletion/retention behavior.
7. Store native secrets only in OS secure storage and exclude them from device
   backups where supported.
8. Obtain PSI privacy/retention approval before any real customer is invited.

Netlify project visibility is only a preview-access boundary. It is not the
customer identity system. The current Netlify and OpenAI Sites demos are
public-by-link with booking submissions disabled; Shopify remains separate
unless PSI approves a future integration.
