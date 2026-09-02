# PSI app release readiness

Status: controlled TestFlight acceptance, 1 September 2026. Payments
remain deliberately deferred.

On 29 August 2026, D&B confirmed an active D-U-N-S record for
**PSI PERFORMANCE PTY LTD**. The identifier is intentionally not stored in the
public repository. Apple accepted PSI's organisation enrolment on 29 August
2026; the membership is paid and active under **PSI PERFORMANCE PTY LTD**. The
private enrolment identifier is intentionally not stored here. Expo now has
PSI-owned Apple distribution, ad-hoc provisioning and push credentials for the
registered QA iPhone.

On 31 August 2026, the Expo production build environment was configured for the
existing Sydney Supabase project using only the public project URL and
publishable client key. Customer Auth and the protected account-owned booking
path are enabled for signed TestFlight builds, while new-customer registration
remains closed. No service-role key, provider secret or private credential is
compiled into the app. The production EAS profile remains App Store
distribution on the isolated `production` update channel with automatic iOS
build-number increments.

The first App Store archive was built from checkpoint `ac3dcfb` on 31 August
2026. EAS build `b2ce7e46-c1b7-4653-a062-99d00dd27d75` produced PSI version
`1.0.0` build `5` using App Store distribution credentials and uploaded it
successfully to App Store Connect for TestFlight processing. The App Store
Connect record uses bundle identifier `com.psiperformance.booking`; its numeric
app identifier is recorded only in the EAS submit profile. Expo generated a
least-privilege App Manager submission key and retains it in the managed
credential store; no key material or private identifier was committed. Apple
processing completed successfully. Build `5` is available to the internal
`Team (Expo)` group, the PSI owner account is invited and the TestFlight test
notes are saved. The invitation was accepted and build `5` was installed on the
target iPhone on 1 September 2026. Broader signed-release acceptance remains in
progress.

## Verified foundation

- The Sydney Supabase project supplies passwordless email authentication, customer-owned records, private file buckets and row-level security.
- New customer registration remains closed. The approved synthetic customer can sign in; Matt is the only active PSI staff identity and workshop-wide access requires authenticator assurance level AAL2.
- A customer-owned vehicle can create an idempotent `pending_staff_review` request. PSI staff review, official service history and Vehicle Reports remain separately protected.
- Resend transactional email is active through encrypted Edge Function secrets. Google Calendar credentials are server-only and the customer cannot list or read PSI calendar contents.
- Public GitHub Pages remains a submission-disabled synthetic demo. The EAS QA build is protected by Expo authentication and uses a separate Auth-enabled environment.
- Native push infrastructure supports opt-in permission, sounds, badge counts and safe deep links. The registered iPhone installed the Apple-signed QA build, completed an approved-customer email-code sign-in and received a locked-screen PSI alert with sound and a badge change from one to two. Foreground delivery, deep links, badge clearing and the remaining iPhone acceptance checks are still outstanding.
- PSI Events is centrally managed in Matt's AAL2 staff portal. Customers can read only published events; publish, detail-change and cancellation transitions queue private in-app alerts and native push jobs with a safe Events deep link. The live RLS regression blocks customer writes, permits AAL2 staff writes and verifies the notification fan-out inside a rolled-back transaction.
- Customers can initiate or cancel their own deletion request. Matt can review the queue only after AAL2 verification; completion remains a controlled owner procedure and is never represented as automatic.
- Customer-facing privacy, support and conservative approval-first booking terms are available inside the app.
- Expo SDK 57 dependencies match Expo's current compatible patch versions, peer
  dependency checks pass and the public web export completes successfully.
- The first Apple release is intentionally iPhone-only. iPad support remains
  disabled until a separate native iPad layout, screenshot and acceptance pass.

## Live synthetic acceptance evidence

On 25 August 2026, the approved synthetic `QATEST1` customer flow created request `PSI-9F52116C` in `pending_staff_review` state. Both the customer request-received email and PSI request notification completed successfully through the deployed booking worker. Customer and staff in-app notification events were also created; at that time their remote-push jobs remained pending because no signed native test device had been registered. The booking had no approved date, no deposit amount and no Google Calendar event. This proves request intake and its two initial email paths; it does not prove payment or booking confirmation.

On 29 August 2026, the registered iPhone deliberately enabled device
notifications. Three isolated Expo delivery checks were accepted for that one
enabled device without changing a booking or calendar record. The tester
visually confirmed the PSI lock-screen banner and app icon, a badge change from
one to two and the normal notification sound while the phone was locked. The
private push token and device identifier were not recorded. This proves
background native delivery, sound and badge presentation; it does not yet prove
foreground presentation, safe deep-link routing, badge clearing or unregister
behaviour after sign-out.

The protected browser QA build is maintained at:

`https://psi-performance-qa--qa-current.expo.app/`

Hosting exports must use the cache-safe process documented in `../mobile/README.md` so public and authenticated bundles cannot share a stale asset filename.

On 30 August 2026, migrations `20260830011927_psi_events` and
`20260830013044_index_psi_events_created_by` added the AAL2-managed event feed,
least-privilege grants, event notification fan-out and supporting indexes. Push
worker version 4 recognises `/events` as a workshop alert while retaining its
verified-JWT gate. The live advisor found no PSI Events security warning; its
new indexes are reported only as unused because the event table is intentionally
empty before Matt publishes the first real event.

On 1 September 2026, migration
`20260901005802_add_event_notification_preference` added the customer-owned PSI
Events notification preference with a secure default of enabled. Push worker
version 5 now honours that preference independently of booking and staff
workshop alerts while retaining its verified-JWT gate. The device-registration
failure shown after a successful server registration was traced to an invalid
character in the local SecureStore key; the corrected key is included in the
next production OTA checkpoint.

On 2 September 2026, local migration
`20260902032825_customer_invitation_onboarding` was applied to the protected
project as live migration `20260902033442_customer_invitation_onboarding`.
It adds the owner-only invitation audit table and profile-completion trigger.
Verified-JWT Edge Function `invite-customer` version 1 keeps Auth admin access
server-only and rechecks Matt's active owner identity plus AAL2 before approving
an email. Its rollback-only RLS test passed, an unauthenticated request returned
401, and no customer invitation row was retained or created during validation.

The signed internal Android QA APK build `be1e5a7d-96f1-4fe3-8a44-0bbe400fd4ab` completed successfully on 25 August 2026 from source checkpoint `7dd0b75331bc5bda31407daf485dd0ef8f05c44d`. It uses package `com.psiperformance.booking`, the protected `qa` profile and PSI's Expo-managed Android keystore. Its Expo installation page is restricted to authorised project access and the build expires on 8 September 2026. Real-device installation and notification acceptance remain outstanding; build completion alone does not prove native push delivery.

The replacement signed internal Android QA APK build
`7d3259d3-93f1-4599-b273-23954024b650` completed successfully on 2 September
2026 from source checkpoint `90cff8b3788dd21fcc588aa5b6a306a949c5d888`.
It carries the current customer experience, events, weather, upload,
notification and restored Luxe Trusted Partner work in package
`com.psiperformance.booking`. The directly installable build uses the protected
`qa` channel, closed-registration controls and PSI's existing Expo-managed
Android keystore; it expires on 16 September 2026. Real-device installation,
permissions, private-file, booking, notification and layout acceptance remain
required before creating the Google Play production App Bundle.

The first signed internal iOS QA build
`8a1e5433-1056-45f0-83d2-e470ba57b652` completed successfully on 29 August
2026 from source checkpoint `7748a9529331a38b6563e447cba66e514e720e7a`.
It uses bundle `com.psiperformance.booking`, version `1.0.0` build `1`, the
protected `qa` profile, an active PSI-owned ad-hoc provisioning profile and an
Apple push-notification key. The approved iPhone is included in the profile;
its UDID is intentionally not stored in the repository. The protected build
expires on 12 September 2026. On 29 August 2026, the registered iPhone installed
and opened this build, then an approved customer received and verified a
six-digit email code successfully. The remaining real-device checklist is still
outstanding; this initial result does not prove invalid/replayed-code handling,
session restoration, private-file isolation or native push delivery.

The updated signed internal iOS QA build
`e4301f59-d444-4fb7-8c08-394f0ba4a5bb` completed successfully on 29 August
2026 from source checkpoint `04c6e74744d5a1fb71d6f5482d793ccbfb63ed69`.
It places secure email-code sign-in first on the Account screen and removes
testing-oriented language from the authenticated customer experience. It uses
the same protected `qa` profile, PSI-owned signing credentials, registered
iPhone and closed-registration controls. Installation and acceptance of this
replacement build remain to be completed on the registered device.

The final launcher and notification-review build
`233ee61e-b9a0-41a0-bf20-77b6c410ec2f` completed successfully on 29 August
2026 from source checkpoint `c151ceffc0912df3134f526cfec437570283f755`.
It uses the short installed label `PSI`, the PSI icon with `PERFORMANCE`
centred beneath the mark, one-line theme preference labels and the Home-screen
Bookings artwork for customer booking notifications. It retains the protected
`qa` profile, closed registration and the registered iPhone provisioning.
Real-device visual acceptance of this replacement build remains outstanding.

The standardised Home dashboard build
`acce75be-e92a-4c8c-82d8-efcb800aa9ff` completed successfully on 29 August
2026 from source checkpoint `3406354188baf2f3af44abae8006eb9251d23a73`.
It uses a smaller two-column mobile grid, equal square image areas, consistent
safe insets and matching two-line label bands across all eight dashboard tiles.
It retains the protected `qa` profile, closed registration and registered
iPhone provisioning. Real-device visual acceptance remains outstanding.

The Home tile artwork-fit build
`5c1df258-125e-41ec-a097-4d52b915477d` completed successfully on 29 August
2026 from source checkpoint `05d4e1d5c45b76569ba8f2f7dbb5a3a000926a42`.
It preserves the approved tile dimensions, wording and label typography while
centring every illustration above its label, keeping the full artwork visible
and maintaining a consistent inset from the tile borders. It retains the
protected `qa` profile, closed registration and registered iPhone provisioning.
Real-device visual acceptance remains outstanding.

The selected Home tile alignment build
`1205ab6c-93c1-4417-a0e1-b01b58ffcad6` completed successfully on 29 August
2026 from source checkpoint `d2545c2bcc15db505aeb9b519b2f417c903d9738`.
It moves only My Bookings, Book Ahead, Settings & Notifications, Dyno Tuning
and Vehicle Reports slightly lower within their approved image areas and fills
the artwork side insets with the PSI black background. Approved tile sizes,
labels, typography and the other three illustration positions remain unchanged.
It retains the protected `qa` profile, closed registration and registered
iPhone provisioning. Real-device visual acceptance remains outstanding.

## Remaining before an external pilot

The invite-only onboarding foundation is now active: Matt approves each email
from the AAL2 portal, then sends the Apple TestFlight invitation to that same
email. Public registration remains closed and no tester has been added by this
checkpoint.

1. Run the native QA profile on one current iPhone and one supported Android device. Record build IDs, device models, operating-system versions and test identities.
2. On both devices, verify email-code cooldown, invalid/expired/replayed codes, session restoration, sign-out, private vehicle photo access and private Vehicle Reports attachments.
3. Verify notification opt-in, foreground/background sound, app-icon badge changes and Booking/Staff deep links on signed native builds.
4. Publish one synthetic PSI Event from Matt's AAL2 portal, confirm its customer alert, Events deep link and local reminder on the signed iPhone, then cancel the event and confirm the update. Remove the synthetic event from the launch schedule by leaving it cancelled.
5. Run controlled two-customer isolation and staff AAL1/AAL2 regression checks after every Auth, RLS or policy change.
6. Exercise date proposal, date approval and cancellation emails, including duplicate-worker and Melbourne-time boundary checks. Do not move any request to paid or confirmed state.
7. Acceptance-test the documented account-deletion completion procedure with a synthetic identity, approve the retention schedule and decide on Supabase backup/capacity before real customer records are invited.
8. Reconfirm all retained Trusted Partner contact details immediately before store submission, including the restored Luxe Automotive Interiors listing, and approve final app-store privacy disclosures, signed-build screenshots and customer-facing terms. Listing and logo approval remains complete for the seven retained businesses.
9. Complete the signed-iPhone acceptance checklist and obtain the Google Play
   Console membership before store release. The PSI D-U-N-S record, Apple
   organisation membership and Apple signing access are active.

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

Also on 26 August 2026, the live synthetic `QATEST1` request completed the
non-payment lifecycle through date proposal, date approval and cancellation.
The customer proposal, approval and cancellation emails each completed once;
an immediate worker replay processed zero additional jobs. The request ended
cancelled with five successful integration jobs, five notification events and
five push jobs. No Google Calendar job or event was created, and payments
remained unconfigured. A consumed email code was rejected on replay, sign-out
returned successfully and the signed-out refresh token was rejected.

That acceptance exposed one narrow data-cleanliness issue: cancelling a
date-approved request retained its expected (unpaid) deposit amount. Migration
`20260826001835_clear_cancelled_booking_deposit` and its regression test passed
together inside a rolled-back transaction before the migration was explicitly
approved and applied to the connected Supabase project. Live verification then
confirmed that the cancelled synthetic QATEST1 request has no expected deposit,
no Calendar job and no Calendar event. No payment was taken.

Public-source checks reconfirmed the listed details for Elite Autobody, Race
Wires Auto Electrics, Elite Car Detailing Studio and EyeCandy Motorsports.
On 27 August 2026, the PSI owner confirmed approval from the seven retained
Trusted Partners for their listings and logos. Raceline Motorsport Racewear was
removed because its approval was not available. BNB Autohaus temporarily
replaced Luxe Automotive Interiors, then on 1 September 2026 the owner restored
Luxe Automotive Interiors and removed BNB Autohaus from the active directory.

## Deliberately last

Select the deposit provider, confirm PSI legal/GST/refund wording, implement and verify its signed webhook, and only then test the trusted payment-confirmed transition that creates the internal Google Calendar event. No manual client or staff action may mark a deposit paid.
