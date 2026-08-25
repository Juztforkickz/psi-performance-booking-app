# PSI app release readiness

Status: controlled QA, 25 August 2026. Payments remain deliberately deferred.

## Verified foundation

- The Sydney Supabase project supplies passwordless email authentication, customer-owned records, private file buckets and row-level security.
- New customer registration remains closed. The approved synthetic customer can sign in; Matt is the only active PSI staff identity and workshop-wide access requires authenticator assurance level AAL2.
- A customer-owned vehicle can create an idempotent `pending_staff_review` request. PSI staff review, official service history and Vehicle Reports remain separately protected.
- Resend transactional email is active through encrypted Edge Function secrets. Google Calendar credentials are server-only and the customer cannot list or read PSI calendar contents.
- Public GitHub Pages remains a submission-disabled synthetic demo. The EAS QA build is protected by Expo authentication and uses a separate Auth-enabled environment.
- Native push infrastructure supports opt-in permission, sounds, badge counts and safe deep links. Remote iPhone acceptance still requires an Apple-signed build.
- Customers can initiate or cancel their own deletion request. Matt can review the queue only after AAL2 verification; completion remains a controlled owner procedure and is never represented as automatic.
- Customer-facing privacy, support and conservative approval-first booking terms are available inside the app.

## Live synthetic acceptance evidence

On 25 August 2026, the approved synthetic `QATEST1` customer flow created request `PSI-9F52116C` in `pending_staff_review` state. Both the customer request-received email and PSI request notification completed successfully through the deployed booking worker. Customer and staff in-app notification events were also created; their remote-push jobs remain pending because no signed native test device is registered yet. The booking had no approved date, no deposit amount and no Google Calendar event. This proves request intake and its two initial email paths; it does not prove native push, payment or booking confirmation.

The protected browser QA build is maintained at:

`https://psi-performance-qa--qa-current.expo.app/`

Hosting exports must use the cache-safe process documented in `../mobile/README.md` so public and authenticated bundles cannot share a stale asset filename.

The signed internal Android QA APK build `be1e5a7d-96f1-4fe3-8a44-0bbe400fd4ab` completed successfully on 25 August 2026 from source checkpoint `7dd0b75331bc5bda31407daf485dd0ef8f05c44d`. It uses package `com.psiperformance.booking`, the protected `qa` profile and PSI's Expo-managed Android keystore. Its Expo installation page is restricted to authorised project access and the build expires on 8 September 2026. Real-device installation and notification acceptance remain outstanding; build completion alone does not prove native push delivery.

## Remaining before an external pilot

1. Run the native QA profile on one current iPhone and one supported Android device. Record build IDs, device models, operating-system versions and test identities.
2. On both devices, verify email-code cooldown, invalid/expired/replayed codes, session restoration, sign-out, private vehicle photo access and private Vehicle Reports attachments.
3. Verify notification opt-in, foreground/background sound, app-icon badge changes and Booking/Staff deep links on signed native builds.
4. Run controlled two-customer isolation and staff AAL1/AAL2 regression checks after every Auth, RLS or policy change.
5. Exercise date proposal, date approval and cancellation emails, including duplicate-worker and Melbourne-time boundary checks. Do not move any request to paid or confirmed state.
6. Acceptance-test the documented account-deletion completion procedure with a synthetic identity, approve the retention schedule and decide on Supabase backup/capacity before real customer records are invited.
7. Reconfirm every Trusted Partner listing and logo with that business, and approve app-store privacy disclosures, screenshots and customer-facing terms.
8. Obtain PSI-owned Apple Developer and Google Play Console memberships before signed store testing and release.

The exact owner deletion procedure is in `ACCOUNT-DELETION.md`. The consolidated launch gates are in `FINAL-RELEASE-CHECKLIST.md`.

The rollback-only QATEST1 database deletion acceptance, Free Plan capacity and
recovery review, guarded backup script, external deletion route and store
disclosure draft were completed on 25 August 2026. Signed-native deletion with a
private Storage object, a restored backup rehearsal and final store-owner/legal
approval remain outstanding. See `SUPABASE-BACKUP-RECOVERY.md` and
`STORE-RELEASE-PACKAGE.md`.

On 26 August 2026, the expanded rollback-only database acceptance passed for
two-customer isolation, private file metadata, staff AAL1/AAL2 separation,
date proposal, approval, cancellation and integration-job deduplication. The
test also found that PostgreSQL's UTC `current_date` can trail PSI's Melbourne
calendar date after local midnight. A migration and permanent regression test
now use an explicit `Australia/Melbourne` boundary and passed together inside a
single rolled-back transaction. Migration
`20260825222326_use_melbourne_booking_date_boundary` was then explicitly
approved, applied to the connected Sydney Supabase project and re-tested
successfully. No synthetic fixtures remained after the test.

## Deliberately last

Select the deposit provider, confirm PSI legal/GST/refund wording, implement and verify its signed webhook, and only then test the trusted payment-confirmed transition that creates the internal Google Calendar event. No manual client or staff action may mark a deposit paid.
