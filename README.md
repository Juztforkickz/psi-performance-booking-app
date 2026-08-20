# PSI Performance Booking

Customer booking software for PSI Performance Garage in Pakenham, Victoria.

The repository contains:

- a responsive web booking experience at the repository root;
- a Cloudflare D1-backed booking-request API;
- an installable web app (manifest, icons and offline static shell);
- a native Expo app in `mobile/` for iOS and Android.

The intended production journey is deliberately **payment first**. A customer chooses a preferred date without seeing PSI's calendar, completes a server-created $200 AUD deposit checkout, and only then can a booking be created as `requested`. The date remains unconfirmed until PSI reviews it.

The web and native home screens show PSI's verified phone, email, workshop address, Facebook and Instagram links. A branded vCard QR lets a customer save the core contact details directly to their phone.

## Web app

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm run build
npm test
npm run lint
```

The public flow reads `GET /api/v1/booking-catalog` and starts payment with `POST /api/v1/booking-checkouts`. The server owns the deposit amount and currency; clients must not send either. Validation errors use a stable JSON error object and field messages. Each logical attempt must send a stable `Idempotency-Key`, conflicting reuse is rejected, and per-IP request limits protect the endpoint.

Service requests keep a short guided flow. Dyno requests expand the first stage into a structured vehicle specification covering engine, transmission, differential, fuel system, intake, previous tune, exhaust/Varex and camshaft details. Web and native use the same validated `tuningDetails` contract; D1 columns and the staff display are ready to carry those details once a verified payment adapter and webhook create paid bookings.

No live payment adapter is configured in source. Until PSI connects one, a valid checkout request returns `503 PAYMENT_PROVIDER_NOT_CONFIGURED`, persists no form details, creates no booking and takes no payment. The legacy public `POST /api/v1/bookings` route is hard-gated with `410 PAYMENT_REQUIRED` so callers cannot bypass the deposit.

Booking data is stored in the D1 binding named `DB`. The schema is in `db/schema.ts`; generated migrations are under `drizzle/`.

The protected staff interface at `/admin` is prepared to review and update paid requests. Set a URL-safe `PSI_ADMIN_KEY` of at least 32 characters in the hosting environment. The browser keeps that key in session storage only. It becomes the operational inbox after the live payment webhook creates verified requests; automatic customer/PSI email, app-issued payment receipts and Google Calendar writes remain disabled until their production credentials and integrations are connected.

## Native app

See [`mobile/README.md`](mobile/README.md) for local development, configuration and EAS build instructions. The native app must be configured with a stable production API origin through `EXPO_PUBLIC_API_BASE_URL` before an app-store build.

Shipping signed binaries requires PSI-owned Apple Developer, Google Play Console and Expo/EAS access. Keep signing credentials and API configuration out of Git.

## Operational launch checklist

- Confirm the Service & Report guide of $385 + GST, Dyno tuning guide of $350 + GST, workshop hours and contact details with PSI.
- Select and configure the live deposit provider; register and verify its signed webhook before accepting customer traffic.
- Confirm the legal entity name, ABN, GST registration, deposit GST treatment and cancellation/refund wording before issuing anything labelled a tax invoice.
- Connect managed customer identity; do not enable the account forms until web and native sign-in, recovery and data access controls are tested.
- Authorise server-side, least-privilege access to PSI's chosen Google Calendar. Calendar contents must never be returned to customers.
- Configure a transactional email provider for customer confirmation and `info@psiperformance.com.au`, with domain authentication and delivery testing.
- Connect a stable booking domain, ideally `book.psiperformance.com.au`.
- Put `PSI_ADMIN_KEY` in the team password manager and assign responsibility for monitoring `/admin`.
- Update the privacy policy for account, booking, payment, retention and mobile disclosures.
- Test real requests with workshop staff before promoting the link.
- Complete TestFlight and Google Play internal testing before public store release.

Source and brand provenance is recorded in [`docs/CONTENT-SOURCES.md`](docs/CONTENT-SOURCES.md). Brand-use status and the formal registration handoff are recorded in [`TRADEMARKS.md`](TRADEMARKS.md). This private repository is not an open-source distribution; see [`LICENSE`](LICENSE).
