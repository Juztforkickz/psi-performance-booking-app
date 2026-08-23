# PSI Performance Booking

Customer booking software for PSI Performance Garage in Pakenham, Victoria.

The repository contains:

- a responsive web booking experience at the repository root;
- a Cloudflare D1-backed booking-request API;
- an installable web app (manifest, icons and offline static shell);
- a native Expo app in `mobile/` for iOS and Android.

The intended production journey is deliberately **approval first**. A customer requests an eligible preferred date, or says they are flexible, without seeing PSI's calendar. PSI reviews workshop capacity and confirms or proposes a date before the app sends a secure deposit link ($100 AUD for Service & Report or $300 AUD for Dyno Tuning). Only a verified deposit payment confirms the booking, queues the confirmation email and creates the internal Google Calendar event.

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

The public flow reads `GET /api/v1/booking-catalog` and submits an unpaid request with `POST /api/v1/booking-requests`. It never accepts a client-supplied price, deposit amount or currency. Service requests accept Monday to Friday; dyno requests accept Monday, Wednesday and Thursday. Customers can instead choose a flexible date. Validation errors use a stable JSON error object and field messages. Each logical attempt sends a stable `Idempotency-Key`, conflicting reuse is rejected, and per-IP request limits protect the endpoint.

Service requests keep a short guided flow. Dyno customers can either complete the structured vehicle specification or ask PSI to inspect a setup they are unsure about. Web and native share the same validated contract. Unfinished forms are saved only on the customer's device for up to 30 days and can be cleared without sending anything to PSI.

No live payment, email, Calendar or customer-identity provider is configured in source. The owner-review build can store and display a request, but it cannot take money, send a real deposit link, email a customer or write a Calendar event. Payment checkout is created only from the staff approval workflow, and a signed payment-provider webhook is the only production path that may mark a deposit paid.

Booking data is stored in the D1 binding named `DB`. The schema is in `db/schema.ts`; generated migrations are under `drizzle/`.

The existing web customer-account groundwork remains deliberately fail-closed. `GET /api/v1/account/status` reports that authentication and registration are disabled, while profile reads and writes return `503 CUSTOMER_ACCOUNTS_DISABLED`. The mobile app now has a separate Supabase foundation for passwordless email codes, RLS-protected Sydney data and private files, but activation remains off until custom SMTP and end-to-end access tests pass. See [`docs/CUSTOMER-ACCOUNTS.md`](docs/CUSTOMER-ACCOUNTS.md) and [`docs/SUPABASE-APP-FOUNDATION.md`](docs/SUPABASE-APP-FOUNDATION.md).

`/admin` is currently an owner-review preview using clearly labelled local synthetic data; it is not connected to the real queue and does not store an admin key. The protected API at `/api/v1/admin/booking-requests` supports the future single-owner queue behind a URL-safe `PSI_ADMIN_KEY` of at least 32 characters. Connecting that API to a production owner interface and managed owner authentication remains launch work; the key must not be exposed in client bundles. Calendar contents are never exposed to customers, and the software never automatically moves a customer into an earlier opening.

## Native app

See [`mobile/README.md`](mobile/README.md) for local development, configuration and EAS build instructions. The native app must be configured with a stable production API origin through `EXPO_PUBLIC_API_BASE_URL` before an app-store build.

Shipping signed binaries requires PSI-owned Apple Developer, Google Play Console and Expo/EAS access. Keep signing credentials and API configuration out of Git.

The repository also includes a Netlify configuration for a public-by-link static Expo web demo. It intentionally omits `EXPO_PUBLIC_API_BASE_URL`, shows a public-demo notice and disables the final submission control, so booking submission and customer accounts remain unavailable. The Cloudflare/D1 web application is not deployed through that Netlify preview.

The OpenAI Sites web demo uses `PSI_PUBLIC_DEMO_MODE=true` as a second, server-side safety boundary. In that mode the booking-request endpoint returns `PUBLIC_DEMO_SUBMISSIONS_DISABLED` before parsing a request body or accessing D1. The interface also labels the site as a public demo and disables its final submission control. Keep that environment variable enabled for any shareable demo deployment.

## Operational launch checklist

- Confirm the consumer guide prices of $423.50 including GST for Service & Report and $649 including GST for Dyno Tuning, the booking-type deposit amounts, workshop hours and contact details with PSI.
- Select and configure the live deposit provider; register and verify its signed webhook before accepting customer traffic.
- Confirm the legal entity name, ABN, GST registration, deposit GST treatment and cancellation/refund wording before issuing anything labelled a tax invoice.
- Select managed identity that supports passwordless email on web and native, then complete the invite-only activation gates in `docs/CUSTOMER-ACCOUNTS.md`; do not enable account writes beforehand.
- Authorise server-side, least-privilege access to PSI's chosen Google Calendar. Calendar contents must never be returned to customers.
- Configure a transactional email provider for customer confirmation and `info@psiperformance.com.au`, with domain authentication and delivery testing.
- Connect a stable booking domain, ideally `book.psiperformance.com.au`.
- Put `PSI_ADMIN_KEY` in the team password manager and assign responsibility for monitoring `/admin`.
- Update the privacy policy for account, booking, payment, retention and mobile disclosures.
- Test real requests with workshop staff before promoting the link.
- Complete TestFlight and Google Play internal testing before public store release.

The complete owner-review journey, date rules, deposit wording, account history and reminder behavior are recorded in [`docs/BOOKING-WORKFLOW.md`](docs/BOOKING-WORKFLOW.md).

Source and brand provenance is recorded in [`docs/CONTENT-SOURCES.md`](docs/CONTENT-SOURCES.md). Brand-use status and the formal registration handoff are recorded in [`TRADEMARKS.md`](TRADEMARKS.md). This private repository is not an open-source distribution; see [`LICENSE`](LICENSE).
