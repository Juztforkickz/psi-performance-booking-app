# PSI Performance mobile app

Native iOS, Android and responsive React Native Web client for PSI Performance Garage. The app uses Expo SDK 57, React Native 0.86 and Expo Router.

The opening route is a black PSI booking gateway inspired by the workshop website. It supports:

- Service & Report from $423.50 AUD including GST.
- Dyno tuning from $649 AUD including GST.
- Direct links to PSI's official parts store and gift-card checkout.
- A five-stage job, vehicle, customer, date and approval-request flow.
- Approval-first deposits: $100 AUD for service and $300 AUD for dyno, requested only after PSI approves a date.
- Provider-ready account screens for customer details, vehicles, visit/payment history and the next confirmed booking.
- Unfinished booking drafts stored only on the device, with a 30-day expiry and visible clear action.

The preferred date is never presented as confirmed. Other customer bookings and PSI's Google Calendar remain private.

Expo Router registers `/`, `/booking`, `/parts`, `/account` and `/account/sign-up`. Native deep links use the `psiperformance` scheme from `app.json`; universal HTTPS links should only be enabled after PSI controls the final production domain and publishes the required Apple/Android association files.

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

## Accounts

The account routes are a provider-ready UI preview only. They show the intended customer detail, vehicle, request, confirmed/completed visit, receipt and next-booking structure without loading real customer records. No password field or fake signup request is implemented. Connect and test managed identity, email verification, recovery, per-customer access controls and retention before enabling accounts.

Booking drafts are separate from accounts. Drafts are saved with versioned AsyncStorage only on the current device, expire after 30 days, never auto-submit, and omit restored consent acknowledgements. The app flushes recent edits when its Back control is used or the app backgrounds. AsyncStorage is app-local but is not application-level encrypted and device backups may retain it; customers can clear the draft at any time. Review encrypted/protected draft storage and mobile backup exclusions before public release.

## Validate

```bash
pnpm run typecheck
pnpm run lint
pnpm exec expo install --check --pnpm
pnpm dlx expo-doctor
```

## EAS builds

The iOS bundle identifier and Android application ID are both `com.psiperformance.booking`. `eas.json` includes internal preview and store-ready production profiles.

One-time owner setup:

1. Sign in with the Expo account that will own the app: `npx eas-cli login`.
2. Run `npx eas-cli init` from this directory.
3. Add the deployed `EXPO_PUBLIC_API_BASE_URL` to EAS preview and production environments.
4. Build an Android preview APK with `npx eas-cli build --profile preview --platform android`.
5. Create the iOS internal and production builds after PSI's Apple signing access is available.

Production still requires the deployed HTTPS API, payment provider and signed webhook, receipt/email workflow, explicitly authorised PSI calendar, single-owner staff authentication, managed customer identity, approved privacy/booking/deposit terms, and Apple/Google developer accounts.
