# Booking, calendar and deposit wording release

Released 13 September 2026 (Australia/Sydney), following explicit approval to commit, push main, publish the compatible build-9 beta update, apply the notification migration and deploy the booking integration worker.

## Released behavior

- Saved vehicle selections are carried into Dyno Tuning instead of starting with the default Holden.
- Booking and portal date fields use monthly calendars with weekday headings and the applicable allowed-date limits.
- Date approval emails and push notifications say **Date approved · deposit ready**. The customer is directed to Bookings to select a deposit payment method; the booking remains unconfirmed until payment is verified.
- Dyno and service deposit amounts are unchanged at A$300 and A$100. The email does not contain a pre-created checkout URL; the secure checkout is created after the customer selects a payment method in the app.

## Source and validation

Source checkpoint: `e1762962ecf0b31e7f22521d1145938d8360e93d`, pushed to `main`.

The exact 19 staged files were exported into an isolated source tree before validation. The release excludes the newer unstaged test-alert-button removal and deletion-controls work. The staged account screen also contains its small prior deletion-status effect cleanup.

Passed on that isolated release:

- Production web build.
- **203/203** repository tests.
- Mobile TypeScript and ESLint.
- **18/18** review/demo isolation checks.
- Native iOS export with the complete beta profile environment.

The exported iOS Hermes bundle is `entry-6826c6497fac3e3f711f64631e3c998b.hbc`, 7,521,787 bytes, SHA-256 `a2252442006fd83a7b25be5249e3a8d1d4d41dfa3a89daab520e693f38c2e179`. It contains the approved calendar/deposit changes and excludes the newer unstaged deletion-controls changes.

## Publication

- [GitHub Pages deployment](https://github.com/Juztforkickz/psi-performance-booking-app/actions/runs/34721491164): successful for the release commit.
- [iOS beta update](https://expo.dev/accounts/psi-performance/projects/matt-psi/updates/702471b5-822c-459e-9d7d-d971e67850c4): group `702471b5-822c-459e-9d7d-d971e67850c4`; update `01a097a8-48e1-7872-9c34-90501f05269f`.
- EAS project `e62e9cdf-867c-4eb7-b8c5-a2610f969286`; channel/branch `beta`; environment `production`; iOS runtime **1.0.0-beta-performance-plus-1**. The published update was read back and its runtime/platform/source commit verified.
- Supabase production project `lslhfrujyuqcavsnugfx`: `clarify_booking_deposit_prompt` applied successfully, recorded by the server as version `20260912220036`. Local migration file: `20260912194500_clarify_booking_deposit_prompt.sql`.
- `process-booking-integrations` deployed as **version 23**, ACTIVE, with JWT verification enabled. Retrieved deployed source exactly matches the approved worker.
- Live catalog verification confirmed both new push strings, with direct execution denied to `anon` and `authenticated`. A live unauthenticated HTTP request was rejected with **401**.

No new Apple binary was needed. Public App Store availability and Performance+ purchase activation were not changed. No live customer booking was created or altered, and no test message or payment was sent during this deployment. Receipt of the update and actual banner/sound behavior still require an installed-device check.

## Rollback and existing advisory output

Before publication, the beta channel pointed to update group `77fbd79c-1e6a-4ab8-a757-8c212ad1b530` from source `12493673d9b5d463a6fd87faeff2bbdc179d7686`. The previous live worker was version 22. Its code/import map and the prior notification function definition are retained under `output/release-2026-09-13/rollback`. Publication output, verified metadata and the isolated export are retained in the same release folder.

Security advisors report existing informational policy notices on private Xero tables and the backend push queue, plus warnings for [pg_net in the public schema](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public) and [leaked-password protection being disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). This release changes only notification wording in the existing function and preserves the existing grants and authentication settings.
