# PSI Performance mobile booking app

Native iOS, Android and web client for PSI Performance Garage. The app uses Expo SDK 57, React Native 0.86 and Expo Router. Customers can request either a vehicle service or a dyno tune; PSI confirms the requested date separately.

## Run locally

Requirements: Node.js 22.13 or newer and a current Expo Go client that supports SDK 57.

```bash
cd mobile
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm start
```

Set `EXPO_PUBLIC_API_BASE_URL` to the public HTTPS origin that serves the booking API. Do not include `/api/v1/bookings`; the app adds that path. The intended production origin is `https://book.psiperformance.com.au`, which will not work until its DNS/custom-domain routing is connected to the deployed booking backend. `EXPO_PUBLIC_*` values are compiled into the client and must never contain secrets.

The app submits this JSON shape to `POST {EXPO_PUBLIC_API_BASE_URL}/api/v1/bookings`. It also sends a cryptographically random UUID in the required `Idempotency-Key` header and reuses that key for retries of the same logical booking:

```json
{
  "bookingType": "service",
  "serviceOption": "logbook_service",
  "customerName": "Example Customer",
  "email": "customer@example.com",
  "phone": "0400 000 000",
  "vehicleMake": "Holden",
  "vehicleModel": "VF SS",
  "vehicleYear": 2017,
  "registration": "ABC123",
  "vin": "",
  "preferredDate": "2026-09-01",
  "arrivalWindow": "any",
  "notes": "",
  "source": "mobile",
  "consent": true,
  "company": ""
}
```

A successful response must contain `reference` and `status`, with an optional `message`:

```json
{
  "reference": "PSI-ABC123",
  "status": "requested",
  "message": "Request received. PSI will contact you to confirm."
}
```

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
2. From this directory run `npx eas-cli init`. This creates the EAS project and adds its `extra.eas.projectId` to the Expo config.
3. Add `EXPO_PUBLIC_API_BASE_URL` to the EAS `preview` and `production` environments. The value must be the deployed HTTPS API origin.
4. Run `npx eas-cli build --profile preview --platform android` for an installable APK.
5. Run `npx eas-cli build --profile preview --platform ios` for an internal iOS build. Apple requires registered test-device UDIDs for ad hoc distribution.
6. Run `npx eas-cli build --profile production --platform all` for App Store and Google Play binaries.
7. After store records exist, submit with `npx eas-cli submit --profile production --platform ios` and the equivalent Android command.

The owner still needs active Apple Developer and Google Play Console accounts, signing credentials (EAS can manage them), store listings/screenshots, support and privacy-policy URLs, and App Store privacy / Google Play data-safety declarations. Production bookings also require the deployed API and its notification workflow to be live and tested.
