# PSI Performance mobile app

Native iOS, Android and responsive React Native Web client for PSI Performance Garage. The app uses Expo SDK 57, React Native 0.86 and Expo Router.

The opening route is an illustrated PSI customer dashboard with a persistent five-button navigation bar for **Home**, **My Garage**, **Bookings**, **Vehicle Reports** and **Settings & Notifications**. It supports:

- Responsive automotive tiles for the garage, bookings, booking ahead, alerts, hub-dyno results, vehicle reports, Plan & Build, PSI Events and Trusted Partners.
- Device-local Home shortcut preferences, allowing any dashboard tiles to be shown in the opening shortcut grid without storing customer information.
- Service & Report from $423.50 AUD including GST.
- Dyno Tuning from $649 AUD including GST.
- Direct links to PSI's official parts store and gift-card checkout.
- A five-stage job, vehicle, customer, date and approval-request flow.
- Approval-first deposits: $100 AUD for service and $300 AUD for dyno, requested only after PSI approves a date.
- Provider-ready account and garage screens for customer details, vehicle selections, visit/payment history, the next confirmed booking and PSI-published dyno results.
- Unfinished booking drafts stored only on the device, with a 30-day expiry and visible clear action.

The preferred date is never presented as confirmed. Other customer bookings and PSI's Google Calendar remain private.

The mobile visual system follows PSI's current website direction: carbon black
and graphite foundations, ice blue `#65CFF8`, deep petrol `#155D78` and cool
silver `#DBE3E7`. Active dashboard illustrations use matching blue/silver
accents while red alerts and green success indicators retain their semantic
meaning. The PSI launcher icon and wordmark remain black and white.

Expo Router keeps `/`, `/garage`, `/bookings` and `/alerts` inside the customer tab navigator while one shared root-level bar remains visible across those screens and the stacked `/booking`, `/parts`, `/vehicle-reports`, `/account` and `/account/sign-up` journeys. The Vehicle Reports button opens its dedicated route directly, and the shared bar hides while the software keyboard is open so forms keep their usable screen space. Native deep links use the `psiperformance` scheme from `app.json`; universal HTTPS links should only be enabled after PSI controls the final production domain and publishes the required Apple/Android association files.

Home's **Customise** control can add or remove any available dashboard tile from **Your shortcuts**. This is the only new persistent value in this feature: a versioned list of tile identifiers stored in device-local AsyncStorage. It contains no customer, vehicle, booking or partner-contact data, and at least one shortcut must remain selected. The fixed Workshop tiles remain available even when their matching shortcut is removed.

PSI Events is now available as a shortcut tile. Event entries are currently stored on-device and can be added from the new `/events` screen. In this rollout they support local date/time reminders per item, with a switch to add local device notifications when supported.

The full-screen `/trusted-partners` directory presents public business contact details for independent automotive specialists PSI may recommend. It is a referral directory only: customers contact each business directly and must confirm its current services, availability and pricing. Opening a phone, email, website or Instagram link does not create a PSI booking or transmit customer data through the app. The directory has no account connection, API write, analytics or application storage. On 27 August 2026, the PSI owner confirmed approval from the seven retained listed businesses; Raceline was removed because its approval was not available. On 1 September 2026, the owner restored Luxe Automotive Interiors in place of BNB Autohaus.

The dashboard and public customer tabs currently use clearly labelled synthetic, in-memory examples for the account, vehicles, bookings, alerts, dyno results and build plan. Validated preview account fields and the selected vehicle photo, active vehicle selection, booking prefill and Plan & Build handoff travel only through the root in-memory preview context. In the public preview, My Garage also lets the customer edit a preview odometer plus personal last-service and next-check-in dates; those values are shared with Vehicle Reports during the open session and can never replace the separately displayed PSI service history. In an authenticated QA build, the Garage instead reads protected PSI service/check-in dates, PSI odometer figures and the latest customer odometer from the owned account, adds a new customer odometer as an append-only RLS-scoped record, and stores a customer-selected vehicle photo under that customer's UUID in the private `vehicle-photos` bucket. Photo metadata is ownership-checked, image-only, limited to 8 MB and displayed with a short-lived signed URL; authorised AAL2 PSI staff may view it for workshop use. Personal reminder dates remain session-local. Public-preview values put no personal information in route URLs and perform no upload or persistence; the context clears when the app reloads or closes. This preview context is separate from the explicitly saved 30-day booking-form draft described below. Future dyno figures are intended to be published by PSI after a completed run and remain read-only to the customer; customers must never be able to enter or alter verified power and torque results.

Vehicle Reports has its own full-screen `/vehicle-reports` workspace, separate from My Garage. In the public preview it filters synthetic PSI-style history and locally added preview records by the vehicle selected in the existing root preview context. Its authenticated QA foundation instead loads the signed-in customer's owned vehicles plus RLS-scoped dyno records, previous repairs, recommended work, invoice metadata and active `vehicle_files` metadata; synthetic fixtures are not substituted when that private account is active. PSI and customer account records are labelled separately, verified dyno results and PSI records remain read-only, and invoice amounts remain AUD. An available PSI dyno graph or invoice attachment opens only after Storage authorizes the signed-in user and issues a 60-second private URL; images remain inside the app and PDFs open through the device browser. The URL is held only in screen memory. The four customer Add workflows still use screen-local React state only and clear when the screen reloads or the app closes; they do not write account records. Images selected through those local forms remain temporary references from the system image picker. They are not uploaded, placed in route URLs, written to AsyncStorage or saved to an account. Customer attachment uploads remain disabled.

The Stage 2 account foundation relies on managed authentication, verified ownership and database row-level controls already established for private QA. Customers receive only customer-scoped reads of published records and private invoice/dyno attachments. Customer record publishing, public registration and the public production booking API remain disabled; only the separately gated authenticated QA booking path is active. A separate AAL2-only workshop control now allows an active PSI staff identity to publish PSI repair history, recommended work, verified dyno results and AUD invoice metadata. Optional invoice and dyno images use unique customer-prefixed paths in the private `vehicle-documents` bucket; the client creates no public URL and attempts to remove an unused object when its matching record cannot be created, surfacing a staff warning if cleanup fails. Completing Vehicle Reports still requires private real-device upload/download acceptance tests and approved retention/deletion controls.

The PSI staff portal is available at `/staff` only in an Auth-enabled private QA build. It verifies the signed-in identity against the existing staff allowlist, checks Supabase Auth's authenticator assurance level, and loads no workshop-wide records until the session is AAL2. Opening secure sign-in from `/staff` carries only an allowlisted `/staff` return destination; after the email code succeeds, the account screen returns directly to the protected workspace and rechecks the staff record and assurance level. The shared Auth provider rejects a late initial-session result after a newer Auth event and exposes a session revision, so email verification, token refresh and MFA challenge events immediately trigger a fresh staff-access check even when the signed-in user ID is unchanged. Active staff can enroll a TOTP authenticator in memory, scan its one-time QR code on web or open/copy the manual setup details on native, then verify a six-digit code; existing verified factors can be challenged on later AAL1 sessions. The AAL2-only `/staff-security` workspace lists verified TOTP devices, enrolls a separate backup and permits removal only when another verified factor remains. Removing a factor refreshes the session and may require a new challenge using the remaining device. The final factor cannot be removed in the app; the controlled owner procedure is documented in `../docs/STAFF-MFA-RECOVERY.md`. Supabase promotes a newly verified session to AAL2 and signs out that user's other sessions. An active MFA-verified staff session receives the booking queue, customer/vehicle lookup, protected date review, Complete Service, controlled record publisher, integration-job status and protected audit history. Every write rechecks AAL2 and active staff status. Dyno and invoice images are optional, private, image-only and limited to 6 MB for reliable standard uploads. The queue control invokes an authenticated Edge Function; email and Calendar jobs stay blocked rather than pretending delivery until their server-only provider secrets exist. PDF selection, general record editing/removal, payment and staff-user management remain disabled. The public build fails closed and neither staff route is linked from customer navigation.

Plan & Build also includes a local-only build-brief preview. A customer can choose one or more discussion areas, refine them with category-specific selectors, add optional goals/current setup, and review the generated brief. SMS and email actions open a prefilled external draft; Instagram and Facebook actions open PSI's message thread with the verified profile/page as a fallback, but do not carry the brief. Nothing is sent automatically and no brief is stored by the app. If the customer taps Send in an external app, that becomes a real message to PSI.

Date selection and validation use the `Australia/Melbourne` workshop timezone and cap requests at 18 months. Service requests accept Monday–Friday; dyno requests accept Monday, Wednesday and Thursday. Customers can instead select **I'm flexible**.

## Run locally

Requirements: Node.js 22.13 or newer and a current Expo client that supports SDK 57.

```bash
cd mobile
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm start
```

Set `EXPO_PUBLIC_API_BASE_URL` only for the later public HTTPS booking-request API. Do not include the API path. The controlled authenticated QA path instead requires Auth plus the separate `EXPO_PUBLIC_SUPABASE_BOOKING_ENABLED=true` gate; keep it false in public builds. `EXPO_PUBLIC_*` values are compiled into the client and must never contain secrets.

## Booking-request contract

The later public API sends `POST {EXPO_PUBLIC_API_BASE_URL}/api/v1/booking-requests` with a cryptographically random UUID in the required `Idempotency-Key` header. The same key is reused when retrying unchanged details. In the private QA profile, that UUID is stored as a customer-scoped unique `client_request_id` while the RLS-protected request is inserted directly for an owned account vehicle.

```json
{
  "bookingType": "service",
  "firstName": "Example",
  "lastName": "Customer",
  "email": "customer@example.com",
  "mobile": "0400 000 000",
  "vehicleMake": "Holden",
  "vehicleModel": "VF SS",
  "vehicleYear": 2017,
  "registration": "ABC123",
  "appointmentPreference": {
    "mode": "specific",
    "preferredDate": "2026-09-02"
  },
  "arrivalArrangement": "business_hours",
  "afterHoursCollection": false,
  "notifyEarlierAvailability": true,
  "serviceReminderConsent": false,
  "requestDetails": "Logbook service and investigate a driveline vibration.",
  "source": "mobile",
  "consent": true,
  "bookingTermsAccepted": true,
  "bookingPolicyVersion": "psi-booking-v1",
  "company": ""
}
```

The client never sends a deposit amount or currency; the server owns both. A successful request response confirms only that the request entered PSI's staff-review queue:

```json
{
  "reference": "PSI-ABC123",
  "state": "pending_staff_review",
  "paymentRequiredNow": false,
  "message": "Your booking request has been saved for PSI to review."
}
```

No checkout opens from this request. PSI approves or proposes a date first. Only a later verified payment-provider event may confirm payment, queue the customer and PSI emails, create the internal Google Calendar event and prepare the 7-day/24-hour appointment reminders. The app fails closed if the booking-request provider is unavailable and never claims those actions succeeded.

## Accounts and customer data

The account screens now contain the activation-gated six-digit email-code request/verification flow, secure native session restoration, a visible 60-second resend cooldown, local sign-out, and typed authenticated profile/vehicle reads and writes. One root account provider owns the authenticated RLS-scoped snapshot, removes it from every consumer on sign-out, refreshes it after an approved profile/vehicle, customer-odometer or private-photo save and after Auth session revisions, and supplies the same private vehicle and service-summary data to Account and My Garage. The authenticated account form loads the existing profile and primary vehicle before editing; customer-authored vehicle updates match both the exact vehicle ID and authenticated customer ID so changing a registration does not create a duplicate, while PSI-authored vehicle details remain visibly read-only. In an authenticated QA build, Garage no longer substitutes synthetic vehicles while a private account is loading or empty: it reads official PSI service/check-in dates separately from the latest customer-entered odometer, adds customer odometers as append-only `customer_entry` records, privately uploads customer vehicle photos and prevents the client from presenting customer data as PSI verified. Its booking handoff prefills the selected owned vehicle, while the verified Auth email plus owned profile name/mobile prefill the customer step. Personal service reminder dates remain explicitly session-local. Supabase remains the server-side authority for code expiry, request throttling, replay prevention and record ownership; the client does not treat a code as verified unless Supabase returns a real session. Supabase is the selected app identity/data foundation: a Sydney project has RLS-protected customer/workshop tables, explicit least-privilege Data API grants, a staff allowlist and private file buckets. Its protected service-history model links one immutable PSI completion to a confirmed service booking, projects the official repair/odometer record automatically, prevents a booking being marked completed without that link, and derives the latest PSI service and next PSI check-in separately from append-only customer odometer readings. Resend custom SMTP, both PSI six-digit 10-minute templates, a controlled live login and cross-account isolation tests are complete. Authentication and registration use separate build gates: the internal `qa` profile enables login only for approved existing accounts while registration remains closed. Matt's AAL2 owner portal can approve one customer email through the verified-JWT `invite-customer` function; the function keeps admin credentials server-only, and first-time customers complete their own profile and vehicle after verifying their code. Apple TestFlight invitations remain a separate App Store Connect step using the same email. Signed-in customers can initiate or cancel their own account-deletion request; the request is visible to that customer and Matt's AAL2 staff queue, is audited and never pretends destructive removal has completed automatically. `/privacy`, `/support` and the public `/delete-account` resource provide the customer-facing data, help and external deletion controls required for store preparation, while `../docs/ACCOUNT-DELETION.md` records the owner completion procedure. The public web preview explicitly builds with Auth and registration disabled; web sessions remain memory-only, while native sessions use operating-system protected storage. No password field exists. The protected booking outbox and Edge Function are active: booking-specific request/status email work is attempted automatically, while the full retry queue remains Matt-only behind AAL2. Google Calendar stays server-only and payment-confirmed, and payments remain unimplemented. See `../docs/SUPABASE-APP-FOUNDATION.md` for the exact roles, ownership rules, email and Google Calendar gates; the existing root web account endpoints remain disabled as described in `../docs/CUSTOMER-ACCOUNTS.md`.

The private AAL2 staff portal now exposes Complete Service only on confirmed
service bookings. It locks the selected booking customer and vehicle, requires
an explicit review of the completed date, optional odometer, work summary and
optional next PSI check-in, then relies on the protected database trigger to
close the booking and project immutable PSI service/odometer history. Customers
cannot use that action or overwrite its official record. The integration queue
and authenticated worker are present. Resend email delivery is active in
controlled QA; Calendar delivery remains limited to a future trusted
payment-confirmed booking. Customer registration, payments, staff management,
general record editing and PDF publishing remain disabled.

Authenticated builds now include a protected notification centre for booking
requests and PSI status changes. Database triggers create deduplicated,
customer-scoped events and a private delivery queue. Customers can read and
mark only their own events; Matt's new-request alerts remain behind the active
staff allowlist and AAL2 portal. Email delivery remains a separate fallback.
On an installed native build, a signed-in user must deliberately choose
**Enable device notifications** before the app requests operating-system
permission and registers an Expo push token. Banners, default sound, safe
Booking/Staff deep links and app-icon badge counts are supported. Disabled or
unregistered devices retain the in-app notification centre and email updates.

PSI Events uses the same protected notification foundation. Customers can read
only published events; they cannot create, edit, publish or cancel them. Matt
manages private drafts and published event details from the existing AAL2 staff
portal. Publishing, changing or cancelling a live event creates per-customer
in-app notification records and push jobs with a safe `/events` deep link.
Customers may also schedule the event's 90-minute reminder locally on a signed
native device. Public-demo builds remain signed out and cannot read the event
feed.
The web/PWA preview cannot provide Expo native push alerts, and iPhone remote
push QA/release still requires Apple signing through an Apple Developer Program
membership. No push token, service credential or other secret is compiled into
the public web build.

The internal `qa` profile also enables a separate authenticated booking gate.
An approved signed-in customer can submit one idempotent pending request for an
active vehicle already owned by their RLS-scoped account. Contact and vehicle
details must still match the protected account record. The private Bookings tab
then loads that customer's real request states and approved PSI dates instead
of synthetic appointments. AAL2 staff can approve a valid requested date,
record a proposed alternative or cancel with an audit note. Staff cannot mark a
date-approved request paid or confirmed; payment verification remains
unimplemented. Relevant changes create protected deduplicated email jobs, and
the client immediately invokes a booking-scoped worker. Customers can dispatch
only the two request-received emails for their own booking; AAL2 staff can
dispatch that booking's status emails or use the full manual retry queue. The
later trusted confirmed transition creates email plus Calendar jobs. Public GitHub Pages
does not set `EXPO_PUBLIC_SUPABASE_BOOKING_ENABLED`, so its booking button stays
disabled and no request is sent.

Booking drafts are separate from accounts. Drafts are saved with versioned AsyncStorage only on the current device, expire after 30 days, never auto-submit, and omit restored consent acknowledgements. The app flushes recent edits when its Back control is used or the app backgrounds. AsyncStorage is app-local but is not application-level encrypted and device backups may retain it; customers can clear the draft at any time. Review encrypted/protected draft storage and mobile backup exclusions before public release.

## Private Netlify web preview

The repository-level `netlify.toml` exports this Expo app as a static web/PWA preview. Keep the Netlify project visibility set to **Private** for production and preview deploys before uploading anything. Do not configure `EXPO_PUBLIC_API_BASE_URL` on that owner preview; booking submissions then remain disabled and fail closed, and no account, customer-data, notification or image-upload provider is contacted. This preview does not replace the native EAS build or host the Cloudflare/D1 booking API.

## Validate

```bash
pnpm run typecheck
pnpm run lint
pnpm exec expo install --check --pnpm
pnpm dlx expo-doctor
```

## EAS builds

The iOS bundle identifier and Android application ID are both `com.psiperformance.booking`. The first Apple release is deliberately iPhone-only; iPad support remains disabled until a native iPad layout, screenshot and acceptance pass is complete. The app is linked to the owner-controlled Expo project `@psi-performance/matt-psi` (`e62e9cdf-867c-4eb7-b8c5-a2610f969286`), where unauthenticated access to internal distribution builds is disabled. `eas.json` includes a fail-closed internal `preview` profile, an internal `qa` profile for the approved existing customer pilot, and a store-ready production profile. The `qa` profile enables Supabase Auth, keeps new-user registration closed and leaves `EXPO_PUBLIC_API_BASE_URL` unset. Public GitHub Pages remains fully disabled independently of this profile. The signed-device acceptance sequence and evidence fields are maintained in `../docs/IOS-NATIVE-QA-CHECKLIST.md`.

Expo can otherwise reuse the same generated JavaScript filename for public and Auth-enabled exports whose source is identical but whose compiled environment differs. Always prepare EAS Hosting exports with `pnpm run export:web:hosting`. The post-export steps rename the entry bundle from its actual SHA-256 content, update every static route, and permanently add the PSI web-app manifest, Apple touch icon and favicons. This prevents a protected QA alias from reusing either a stale public-demo bundle or Expo's generic Home Screen icon. Deploy the prepared `dist` directory to the stable protected alias with `pnpm dlx eas-cli deploy --export-dir dist --alias qa-current --non-interactive`. The maintained owner QA URL is `https://psi-performance-qa--qa-current.expo.app/`; it remains subject to the Expo project's authenticated-access setting.

One-time owner setup:

1. Sign in with the Expo account that will own the app: `npx eas-cli login`.
2. Run `npx eas-cli init` from this directory.
3. In the Expo project settings, disable unauthenticated access to internal builds before sharing any QA link.
4. Register the approved iPhone and create Apple ad hoc signing credentials, or build an Android QA APK with `npx eas-cli build --profile qa --platform android`.
5. Keep the `qa` profile's booking API empty until the approval-first API exists.
6. Add the deployed `EXPO_PUBLIC_API_BASE_URL` only to a later reviewed production environment.

Production still requires the deployed HTTPS API, payment provider and signed webhook, receipt/email workflow, explicitly authorised PSI calendar, single-owner staff authentication, managed customer identity, approved privacy/booking/deposit terms, and Apple/Google developer accounts.

## Over-the-air updates

Native builds use EAS Update with `runtimeVersion` tied to the app version. The
three build profiles are isolated on separate channels:

- `preview` for submission-disabled internal previews;
- `qa` for signed authenticated device testing; and
- `production` for a future App Store and Play Store release.

Publish JavaScript, styling and bundled-asset changes to QA first from a clean,
pushed checkpoint:

```bash
pnpm dlx eas-cli update --channel qa --environment preview --message "Describe the QA update"
```

Do not publish directly to `production`. After the exact checkpoint has passed
signed-device acceptance, publish that same clean commit with the production
environment. Native dependency, permission, app-icon, splash, signing and other
native configuration changes require a new signed build rather than an OTA
update. A newly installed build checks its own channel and compatible runtime;
it cannot receive updates from either of the other channels.
