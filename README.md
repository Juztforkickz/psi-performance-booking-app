# PSI Performance Booking

Customer booking software for PSI Performance Garage in Pakenham, Victoria.

The repository contains:

- a responsive web booking experience at the repository root;
- a Cloudflare D1-backed booking-request API;
- an installable web app (manifest, icons and offline static shell);
- a native Expo app in `mobile/` for iOS and Android.

Bookings are deliberately submitted as **requests**. A preferred date is not confirmed until the PSI team contacts the customer.

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

The booking endpoint is `POST /api/v1/bookings`. Successful submissions return HTTP 201 with a high-entropy public reference and `status: "requested"`. Validation errors use a stable JSON error object and field messages. Each logical submission must send a stable `Idempotency-Key`; retries replay the original result, conflicting reuse is rejected, and per-IP request limits protect the public endpoint.

Booking data is stored in the D1 binding named `DB`. The schema is in `db/schema.ts`; generated migrations are under `drizzle/`.

Staff can review and update requests at `/admin`. Set a URL-safe `PSI_ADMIN_KEY` of at least 32 characters in the hosting environment. The browser keeps that key in session storage only. The queue is the operational inbox; it does not yet send automatic email or push notifications, so staff must monitor it until notifications are added.

## Native app

See [`mobile/README.md`](mobile/README.md) for local development, configuration and EAS build instructions. The native app must be configured with a stable production API origin through `EXPO_PUBLIC_API_BASE_URL` before an app-store build.

Shipping signed binaries requires PSI-owned Apple Developer, Google Play Console and Expo/EAS access. Keep signing credentials and API configuration out of Git.

## Operational launch checklist

- Confirm every service label, workshop hour and contact detail with PSI.
- Connect a stable booking domain, ideally `book.psiperformance.com.au`.
- Put `PSI_ADMIN_KEY` in the team password manager and assign responsibility for monitoring `/admin`.
- Add an email or push notification channel before relying on unattended bookings.
- Update the privacy policy for booking data, retention and mobile disclosures.
- Test real requests with workshop staff before promoting the link.
- Complete TestFlight and Google Play internal testing before public store release.

Source and brand provenance is recorded in [`docs/CONTENT-SOURCES.md`](docs/CONTENT-SOURCES.md).
