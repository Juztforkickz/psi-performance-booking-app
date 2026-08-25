# PSI app release readiness

Status: controlled QA, 25 August 2026. Payments remain deliberately deferred.

## Verified foundation

- The Sydney Supabase project supplies passwordless email authentication, customer-owned records, private file buckets and row-level security.
- New customer registration remains closed. The approved synthetic customer can sign in; Matt is the only active PSI staff identity and workshop-wide access requires authenticator assurance level AAL2.
- A customer-owned vehicle can create an idempotent `pending_staff_review` request. PSI staff review, official service history and Vehicle Reports remain separately protected.
- Resend transactional email is active through encrypted Edge Function secrets. Google Calendar credentials are server-only and the customer cannot list or read PSI calendar contents.
- Public GitHub Pages remains a submission-disabled synthetic demo. The EAS QA build is protected by Expo authentication and uses a separate Auth-enabled environment.
- Native push infrastructure supports opt-in permission, sounds, badge counts and safe deep links. Remote iPhone acceptance still requires an Apple-signed build.

## Live synthetic acceptance evidence

On 25 August 2026, the approved synthetic `QATEST1` customer flow created request `PSI-9F52116C` in `pending_staff_review` state. Both the customer request-received email and PSI request notification completed successfully through the deployed booking worker. Customer and staff in-app notification events were also created; their remote-push jobs remain pending because no signed native test device is registered yet. The booking had no approved date, no deposit amount and no Google Calendar event. This proves request intake and its two initial email paths; it does not prove native push, payment or booking confirmation.

The protected browser QA build is maintained at:

`https://psi-performance-qa--qa-current.expo.app/`

Hosting exports must use the cache-safe process documented in `../mobile/README.md` so public and authenticated bundles cannot share a stale asset filename.

## Remaining before an external pilot

1. Run the native QA profile on one current iPhone and one supported Android device. Record build IDs, device models, operating-system versions and test identities.
2. On both devices, verify email-code cooldown, invalid/expired/replayed codes, session restoration, sign-out, private vehicle photo access and private Vehicle Reports attachments.
3. Verify notification opt-in, foreground/background sound, app-icon badge changes and Booking/Staff deep links on signed native builds.
4. Run controlled two-customer isolation and staff AAL1/AAL2 regression checks after every Auth, RLS or policy change.
5. Exercise date proposal, date approval and cancellation emails, including duplicate-worker and Melbourne-time boundary checks. Do not move any request to paid or confirmed state.
6. Approve privacy, retention, deletion, support and incident-recovery procedures. Decide on Supabase backup/capacity before real customer records are invited.
7. Reconfirm every Trusted Partner listing and logo with that business, and approve app-store privacy disclosures, screenshots and customer-facing terms.
8. Obtain PSI-owned Apple Developer and Google Play Console memberships before signed store testing and release.

## Deliberately last

Select the deposit provider, confirm PSI legal/GST/refund wording, implement and verify its signed webhook, and only then test the trusted payment-confirmed transition that creates the internal Google Calendar event. No manual client or staff action may mark a deposit paid.
