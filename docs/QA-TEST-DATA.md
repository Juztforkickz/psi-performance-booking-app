# PSI booking QA test data

Use these records only in local, preview, payment-provider test-mode and explicitly labelled staff tests. The `example.com` addresses are intentionally non-deliverable. Never use them to test production email delivery, and never let a synthetic record appear as a real customer booking or testimonial.

## Synthetic service record

| Field | Value |
| --- | --- |
| Booking type | Service & Report |
| First / last name | PSI / QA Service |
| Email | `psi.qa.service@example.com` |
| Mobile | `+61 400 000 000` |
| Vehicle | 2020 Holden Commodore |
| Registration | `TEST001` |
| VIN | `TESTV1N0000000000` |
| Request | `Synthetic service and report request. Do not treat as a real booking.` |
| Preferred date | An eligible Monday–Friday, or choose flexible; never a past date or a date more than 18 months ahead |
| Arrival | Business hours, before-hours drop-off, after-hours drop-off or flexible |
| Deposit | Nothing at request time; `$100 AUD` only after PSI approves the date, derived by the server from the `service` booking type |

## Synthetic dyno record

Use PSI / QA Dyno, `psi.qa.dyno@example.com`, registration `TEST002`, and the same synthetic contact/vehicle fields above. Use this complete setup to exercise every conditional input:

The Dyno tuning price guide must show **from $764.50 including GST**, and its server-derived post-approval booking deposit must be exactly **$300 AUD**. A specific dyno date must be a Monday, Wednesday or Thursday.

- Engine: modified; `Stage 2 camshaft, valve springs and upgraded balancer`.
- Transmission: automatic; converter and cooler; `3,200 rpm converter and external cooler`.
- Differential: Truetrac; ratio `3.46:1`; `Synthetic QA Truetrac`.
- Fuel: upgraded pump `Synthetic QA pump`; upgraded injectors `Synthetic QA 1000 cc injectors`; flex fuel.
- Intake: upgraded; `Synthetic QA OTR intake`.
- Previous tune: yes; `Synthetic Previous Tuner`.
- Exhaust: full system; 3 inch; Varex controlled; `Synthetic three-inch headers-back Varex system`.
- Camshaft: upgraded; `Synthetic cam code QA-224-228`.

Also test each stock, modified, unknown, automatic/manual and dropdown choice. Where a choice reveals a details field, leave it blank once to confirm the form blocks progress, then enter the synthetic description and continue. Converter/cooler choices must be rejected for a manual transmission; upgraded-clutch must be rejected for an automatic.

## Required end-to-end sequence

1. Open `/`, `/parts`, `/account`, `/admin`, `/manifest.webmanifest` and `/robots.txt`; confirm no public link produces a 404.
2. Follow every header, footer, parts, account, phone, email, map, privacy, Facebook, Instagram and YouTube link. External links must use HTTPS; new-window links must protect the opener.
3. Submit each booking step empty and confirm the relevant field is identified. Repeat with malformed email, fewer than eight and more than fifteen mobile digits, invalid/future vehicle years, unsafe registration/VIN characters, a past date, a Sunday, and a date beyond 18 months.
4. Submit the two valid synthetic records to `/api/v1/booking-requests`. Expect `201`, state `pending_staff_review` and `paymentRequiredNow: false`. One immutable guest request snapshot, idempotency row and transition may be stored; no canonical customer profile/vehicle, checkout, payment, receipt, Calendar event or delivery email may be created.
5. Retry the same logical request with the same idempotency key. It must return the same reference. Reuse the key with changed details and confirm `409 IDEMPOTENCY_KEY_REUSED`.
6. Confirm both legacy public pay-first endpoints, `/api/v1/booking-checkouts` and `/api/v1/bookings`, return `410 APPROVAL_REQUIRED` with `/api/v1/booking-requests` as the successor. They must not write a checkout, payment or booking.
7. Through the protected admin API, propose or approve an eligible date with an explicit all-day allocation or valid start/end times. In the owner preview, issuing the deposit must fail closed with `503 PAYMENT_PROVIDER_NOT_CONFIGURED`; the approved date remains saved and no checkout or delayed email is created.
8. Only after providers are deliberately connected in test mode, confirm a Service checkout requests exactly `$100 AUD` and a Dyno checkout requests exactly `$300 AUD`. Cancel once, fail once, then complete one test payment for each type. A cancelled or failed payment must not confirm a booking, create a receipt, queue a Calendar event or send confirmation.
9. After a signed successful provider event, confirm one verified payment, one confirmed request, one receipt job, one private internal Calendar outbox item and one deduplicated confirmation to each intended recipient. Replay the identical event and confirm none are duplicated; reuse its event ID with changed signed contents and confirm `409 EVENT_CONFLICT`.
10. Confirm the customer-facing date remains requested or proposed until PSI staff approve it, and remains unconfirmed until deposit verification. Calendar contents and other customers' details must never be exposed.
11. Confirm clients send booking policy `psi-booking-v1`, never send an amount or currency, and the server records deposit policy `psi-deposit-v3`. Staff checkout and payment verification must fail closed if the request, checkout or provider amount/currency differs from the canonical booking type.

The app cannot honestly pass the provider-delivery portions of steps 8–9 until test-mode payment, transactional email and server-side Google Calendar credentials are connected. A manually created calendar invitation or manually sent email is useful only as a provider-delivery check; it is not proof that the app integration works.

## Email and receipt checks after providers are connected

- Use an address the owner explicitly approves for the live delivery test; do not substitute a customer address.
- Verify the customer and `info@psiperformance.com.au` receive the same booking reference, service/dyno choice, preferred date, vehicle summary, pending status and verified deposit amount.
- Verify the message never says the preferred date is confirmed before staff approval.
- Verify Reply-To, SPF, DKIM and DMARC alignment; check spam/junk folders and the provider event log.
- Call the document a payment receipt unless PSI's legal entity, ABN, GST treatment and tax-invoice requirements have been confirmed.
- Do not put bank account details, admin credentials, idempotency keys, full payment data or another customer's information in the email.

## Troubleshooting matrix

| Symptom | Expected check | Safe resolution |
| --- | --- | --- |
| A link opens a 404 | Route exists and fragment matches a real target/state | Fix the internal path/fragment; do not add a redirect that hides a typo |
| A field will not advance | Inline field message identifies the exact input | Correct the value; keep server and client rules aligned |
| Valid request returns `pending_staff_review` | Guest snapshot exists; no profile, checkout, payment or Calendar item exists | Review it in the protected owner workflow; do not ask for payment yet |
| `issue_deposit` returns `PAYMENT_PROVIDER_NOT_CONFIGURED` | Approved date remains durable; no checkout or delayed email exists | Keep owner preview disabled or connect and verify all providers in test mode before retrying |
| Request returns `BOOKING_REQUEST_STORAGE_UNAVAILABLE` | D1 binding and additive migrations are healthy | Restore storage; do not ask the customer to resubmit repeatedly |
| Same click creates multiple checkouts | Same logical attempt reused one idempotency key | Preserve the key across retries; reject conflicting reuse |
| Checkout returns `RATE_LIMITED` | `Retry-After` is present and no extra rows were created | Wait for the stated window; investigate automation or abuse before raising limits |
| Payment succeeded but booking is absent | Signed webhook event and amount/currency verification | Reprocess the deduplicated event; never create a paid booking from a browser claim |
| Booking exists but calendar/email is absent | Outbox item exists once with a non-sensitive error code | Repair provider credentials and retry the same dedupe key |
| Confirmation says “confirmed” too early | Booking/calendar state is still pending | Correct the template and notify the recipient; preferred dates require staff approval |
| Test email is missing | Provider accepted event; SPF/DKIM/DMARC and recipient folders checked | Use provider logs and an approved deliverable test address |
| Installed PWA shows old content | Service-worker cache version and new build are active | Reload/update the service worker; never clear unrelated browser data |
| Native app cannot submit | Production HTTPS API base URL is configured | Correct the build-time API origin and rebuild; never fall back silently to localhost |

## Testimonial integrity rule

Only publish customer words traceable to a PSI-controlled public source or owner-supplied record with permission. Keep the original rating scale, identify excerpts, record the source and capture date, and never invent a customer, quote, date or score. Do not convert five-star feedback into “10/10 reviews.” The current “10/10 care” line is PSI's own clearly labelled service commitment, not a customer rating or aggregate.

## Automated coverage

Run `npm test`. The suite builds the worker and checks public routes and links, the complete catalog, customer/vehicle/date boundaries, every tuning selector, server-owned deposits, pay-first protection, error envelopes, rate limiting, idempotent request replay/conflict, guest-snapshot isolation, additive migrations and testimonial provenance. Provider delivery checks remain intentionally unavailable until test-mode payment, email and Calendar integrations are explicitly configured.
