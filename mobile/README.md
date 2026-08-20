# PSI Performance mobile app

Native iOS, Android and responsive React Native Web client for PSI Performance Garage. The app uses Expo SDK 57, React Native 0.86 and Expo Router.

The opening route is a black PSI booking gateway inspired by the workshop website. It supports:

- Service & Report with a price guide from $385 + GST.
- Dyno tuning with a price guide from $695 + GST.
- A reserved parts-store route.
- A five-stage job, vehicle, customer, date and deposit flow.
- Type-dependent server-authoritative deposits: $100 AUD for service bookings and $300 AUD for dyno tuning.
- Provider-ready account screens that do not collect or store passwords.

The preferred date is never presented as confirmed. Other customer bookings and PSI's Google Calendar remain private.

Expo Router registers `/`, `/booking`, `/parts`, `/account` and `/account/sign-up`. Native deep links use the `psiperformance` scheme from `app.json`; universal HTTPS links should only be enabled after PSI controls the final production domain and publishes the required Apple/Android association files.

Date selection and validation use the `Australia/Melbourne` workshop timezone, reject Sundays and past dates, and cap requests at 18 months.

## Run locally

Requirements: Node.js 22.13 or newer and a current Expo client that supports SDK 57.

```bash
cd mobile
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm start
```

Set `EXPO_PUBLIC_API_BASE_URL` to the public HTTPS origin that serves the checkout API. Do not include the API path. `EXPO_PUBLIC_*` values are compiled into the client and must never contain secrets.

## Checkout contract

The app sends `POST {EXPO_PUBLIC_API_BASE_URL}/api/v1/booking-checkouts` with a cryptographically random UUID in the required `Idempotency-Key` header. The same key is reused when retrying unchanged details.

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
  "vin": "",
  "preferredDate": "2026-09-01",
  "arrivalWindow": "any",
  "requestDetails": "Logbook service and investigate a driveline vibration.",
  "source": "mobile",
  "consent": true,
  "depositTermsAccepted": true,
  "depositPolicyVersion": "psi-deposit-v2",
  "company": ""
}
```

The client never sends a deposit amount or currency; the server owns both. It accepts only the server response amount expected for the selected booking type ($100 AUD for service or $300 AUD for dyno), and fails closed if the amount or currency is unexpected. A configured service checkout response must include a provider URL:

```json
{
  "checkoutId": "checkout-id",
  "reference": "PSI-ABC123",
  "state": "requires_payment",
  "deposit": {
    "amountCents": 10000,
    "currency": "AUD"
  },
  "payment": {
    "provider": "provider-name",
    "checkoutUrl": "https://secure-provider.example/checkout/..."
  }
}
```

The app opens that URL but does not claim the payment succeeded. Receipt email, PSI notification, booking creation and calendar work must be driven by a verified provider webhook on the server.

If the server returns `503 PAYMENT_PROVIDER_NOT_CONFIGURED`, the app clearly states that no booking or payment was created. It never falls back to the unpaid booking endpoint.

## Accounts

The account routes are a provider-ready UI preview only. They hold typed values in screen memory and discard them on exit. No password field, local persistence or fake signup request is implemented. Connect a managed identity provider before enabling account creation, secure links, saved vehicles, booking history or receipts.

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

Production still requires the deployed HTTPS API, payment provider and webhook, receipt/email workflow, explicitly authorised PSI calendar, managed account provider, privacy/deposit terms, and Apple/Google developer accounts.
