# PSI Performance mobile app

Native iOS, Android and responsive React Native Web client for PSI Performance Garage. The app uses Expo SDK 57, React Native 0.86 and Expo Router.

The opening route is an illustrated PSI customer dashboard with a persistent five-button navigation bar for **Home**, **My Garage**, **Bookings**, **Vehicle Reports** and **Settings & Notifications**. It supports:

- Responsive automotive tiles for the garage, bookings, booking ahead, alerts, hub-dyno results, vehicle reports, Plan & Build and Trusted Partners.
- Device-local Home shortcut preferences, allowing any dashboard tiles to be shown in the opening shortcut grid without storing customer information.
- Service & Report from $423.50 AUD including GST.
- Dyno Tuning from $649 AUD including GST.
- Direct links to PSI's official parts store and gift-card checkout.
- A five-stage job, vehicle, customer, date and approval-request flow.
- Approval-first deposits: $100 AUD for service and $300 AUD for dyno, requested only after PSI approves a date.
- Provider-ready account and garage screens for customer details, vehicle selections, visit/payment history, the next confirmed booking and PSI-published dyno results.
- Unfinished booking drafts stored only on the device, with a 30-day expiry and visible clear action.

The preferred date is never presented as confirmed. Other customer bookings and PSI's Google Calendar remain private.

Expo Router keeps `/`, `/garage`, `/bookings` and `/alerts` inside the customer tab navigator while one shared root-level bar remains visible across those screens and the stacked `/booking`, `/parts`, `/vehicle-reports`, `/account` and `/account/sign-up` journeys. The Vehicle Reports button opens its dedicated route directly, and the shared bar hides while the software keyboard is open so forms keep their usable screen space. Native deep links use the `psiperformance` scheme from `app.json`; universal HTTPS links should only be enabled after PSI controls the final production domain and publishes the required Apple/Android association files.

Home's **Customise** control can add or remove any available dashboard tile from **Your shortcuts**. This is the only new persistent value in this feature: a versioned list of tile identifiers stored in device-local AsyncStorage. It contains no customer, vehicle, booking or partner-contact data, and at least one shortcut must remain selected. The fixed Workshop tiles remain available even when their matching shortcut is removed.

The full-screen `/trusted-partners` directory presents public business contact details for independent automotive specialists PSI may recommend. It is a referral directory only: customers contact each business directly and must confirm its current services, availability and pricing. Opening a phone, email, website or Instagram link does not create a PSI booking or transmit customer data through the app. The directory has no account connection, API write, analytics or application storage. Partner names, public details and identity badges must be re-confirmed with each business before an app-store release.

The dashboard and customer tabs currently use clearly labelled synthetic, in-memory examples for the account, vehicles, bookings, alerts, dyno results and build plan. Validated account-setup fields and the selected vehicle photo, the active vehicle selection, booking prefill and the Plan & Build handoff travel only through the root in-memory preview context. My Garage also lets the customer edit a preview odometer plus personal last-service and next-check-in dates; those values are shared with Vehicle Reports during the open session and can never replace the separately displayed PSI service history. They put no personal information in route URLs, make no customer-data fetch, and perform no upload or persistence; the context clears when the app reloads or closes. This preview context is separate from the explicitly saved 30-day booking-form draft described below. Future dyno figures are intended to be published by PSI after a completed run and remain read-only to the customer; customers must never be able to enter or alter verified power and torque results.

Vehicle Reports Stage 1 has its own full-screen `/vehicle-reports` workspace, separate from My Garage. It filters synthetic PSI-style history and locally added preview records by the vehicle selected in the existing root preview context. Customer-added dyno entries, previous repairs, recommended work and invoice references use screen-local React state only and clear when the preview reloads or closes. Selected dyno graph and invoice images remain temporary local references from the system image picker; they are not uploaded, placed in URLs, written to AsyncStorage or saved to an account. Genuine PSI-published dyno results remain distinctly labelled, read-only and PSI-controlled; customer preview entries never receive PSI verification. PDF invoice support is deferred because no durable private file provider is connected.

Stage 2 of Vehicle Reports must not begin until managed authentication, verified record ownership, database row-level access controls, audit-safe PSI publishing and durable private file storage with retention/deletion controls are designed and tested. The Stage 1 workspace does not connect a persistent customer record, production API, invoice provider or dyno file provider.

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

Set `EXPO_PUBLIC_API_BASE_URL` to the public HTTPS origin that serves the booking-request API. Do not include the API path. `EXPO_PUBLIC_*` values are compiled into the client and must never contain secrets.

## Booking-request contract

The app sends `POST {EXPO_PUBLIC_API_BASE_URL}/api/v1/booking-requests` with a cryptographically random UUID in the required `Idempotency-Key` header. The same key is reused when retrying unchanged details.

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

The account screens now contain the activation-gated six-digit email-code request/verification flow, secure native session restoration, a visible 60-second resend cooldown, local sign-out, and typed authenticated profile/vehicle reads and writes. One root account provider owns the authenticated RLS-scoped snapshot, removes it from every consumer on sign-out, refreshes it after an approved profile/vehicle save, and supplies the same private vehicle list to Account and My Garage. The authenticated account form loads the existing profile and primary vehicle before editing; customer-authored vehicle updates match both the exact vehicle ID and authenticated customer ID so changing a registration does not create a duplicate, while PSI-authored vehicle details remain visibly read-only. In an authenticated QA build, Garage no longer substitutes synthetic vehicles while a private account is loading or empty; its booking handoff prefills the selected owned vehicle, while the verified Auth email plus owned profile name/mobile prefill the customer step. Photos and customer maintenance edits remain explicitly session-local and are not uploaded or persisted. Supabase remains the server-side authority for code expiry, request throttling and replay prevention; the client does not treat a code as verified unless Supabase returns a real session. Supabase is the selected app identity/data foundation: a Sydney project has RLS-protected customer/workshop tables, explicit least-privilege Data API grants, a staff allowlist and private file buckets. Its protected service-history model links one immutable PSI completion to a confirmed service booking, projects the official repair/odometer record automatically, prevents a booking being marked completed without that link, and derives the latest PSI service and next PSI check-in separately from append-only customer odometer readings. Resend custom SMTP, both PSI six-digit 10-minute templates, a controlled live login and cross-account isolation tests are complete. Authentication and registration now use separate build gates: the internal `qa` profile enables login only for approved existing accounts while registration remains closed. The public web preview explicitly builds with both disabled; web sessions remain memory-only, while native sessions use operating-system protected storage. No password field exists. Vehicle photos remain local-only and no notification, booking API or file upload is activated. See `../docs/SUPABASE-APP-FOUNDATION.md` for the exact roles, ownership rules, email and Google Calendar gates; the existing root web account endpoints remain disabled as described in `../docs/CUSTOMER-ACCOUNTS.md`.

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

The iOS bundle identifier and Android application ID are both `com.psiperformance.booking`. The app is linked to the owner-controlled Expo project `@psi-performance/matt-psi` (`e62e9cdf-867c-4eb7-b8c5-a2610f969286`), where unauthenticated access to internal distribution builds is disabled. `eas.json` includes a fail-closed internal `preview` profile, an internal `qa` profile for the approved existing customer pilot, and a store-ready production profile. The `qa` profile enables Supabase Auth, keeps new-user registration closed and leaves `EXPO_PUBLIC_API_BASE_URL` unset. Public GitHub Pages remains fully disabled independently of this profile.

One-time owner setup:

1. Sign in with the Expo account that will own the app: `npx eas-cli login`.
2. Run `npx eas-cli init` from this directory.
3. In the Expo project settings, disable unauthenticated access to internal builds before sharing any QA link.
4. Register the approved iPhone and create Apple ad hoc signing credentials, or build an Android QA APK with `npx eas-cli build --profile qa --platform android`.
5. Keep the `qa` profile's booking API empty until the approval-first API exists.
6. Add the deployed `EXPO_PUBLIC_API_BASE_URL` only to a later reviewed production environment.

Production still requires the deployed HTTPS API, payment provider and signed webhook, receipt/email workflow, explicitly authorised PSI calendar, single-owner staff authentication, managed customer identity, approved privacy/booking/deposit terms, and Apple/Google developer accounts.
