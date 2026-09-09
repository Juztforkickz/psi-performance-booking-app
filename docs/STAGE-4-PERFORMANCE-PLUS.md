# Stage 4 — PSI Performance+

Prepared 9 September 2026. All amounts in this document are AUD. This extends the existing beta; no customer reset or architecture replacement is part of this checkpoint.

## A. Current state inspected

- The customer app is Expo 57 / React Native 0.86 / React 19, using Expo Router. Its real customer and staff backend is Supabase Auth, Postgres, private Storage and Edge Functions.
- The repository also contains the existing Vinext/React booking website and Cloudflare D1 booking backend. Those are retained. Existing Stripe workshop-deposit work is separate from digital subscriptions.
- Supabase has the main Sydney project and a separate Apple review sandbox. The public GitHub Pages preview uses fictional local data and disabled real authentication. Existing account, registration and review-environment switches remain in place.
- Existing database areas include customer profiles and vehicles, booking requests/status/payment records, service completions, odometer readings, repair history, recommended work, invoices, dyno records, vehicle-file metadata, staff roles, audit events and notification jobs.
- Existing private buckets are `vehicle-photos` and `vehicle-documents`. New premium objects belong in the private `performance-vault` bucket.
- Existing navigation, Home, My Garage, Bookings, Vehicle Reports, Alerts/account areas, and the staff portal are preserved. Staff access already requires an active role and MFA.

## B. Reusable foundation

Reuse Supabase identities, customer/vehicle IDs, staff MFA and audit system, private Storage, current booking and maintenance logic, dyno measurement conventions, account deletion and demo isolation. Existing invoice rows are displayed in the new vault rather than copied. Existing dyno records remain readable through the existing free experience.

The new model adds subscription entitlements, workshop jobs, premium records/assets, safe update summaries, an import review queue and per-vehicle illustration preferences. It does not replace customer or vehicle tables, recreate accounts, or migrate working bookings.

## C. Exact feature split for this checkpoint

| PSI Free | PSI Performance+ |
|---|---|
| Login, account and profile | All free functionality |
| My Garage, vehicle profiles and own car photo | Private Invoice Vault, including existing stored invoices |
| All 20 selectable vehicle illustrations | PSI-published premium service/workshop reports |
| Bookings, status and booking history | Before/progress/after workshop photo galleries |
| Kilometre entry and existing maintenance scheduling/reminders | Vehicle documents and modification/build records |
| Existing service/repair summaries and recommendations | New historical dyno PDF archive and recorded figures |
| Existing verified dyno results and their existing history | Chronological premium vehicle record |
| Existing notifications, contact/enquiries and safe vault update counts | Access across every vehicle owned by the subscribing account |
| Locked vault cards showing own-record counts | Restore, renewal status and Apple subscription management |

Price remains **A$9.99 per month or A$99 per year**. Prices are centralised in `mobile/src/lib/performance-plus.ts`; Apple products must match before a purchase can proceed. Annual savings are A$20.88 against twelve monthly payments. Physical workshop work/parts are separately priced and are not included.

Basic reminders and kilometre recording must never depend on premium entitlement. No customer should have to subscribe simply to book servicing. Normal invoice delivery through Xero remains part of the workshop relationship; the premium feature is the organised in-app archive.

## D. Architecture and access

`customer → vehicle → workshop job → vault record → assets` is the main relationship. Record/job/asset composite foreign keys prevent mixing a job with a different customer or vehicle. Staff confirm the customer, registration and job before publication. A plate alone is not a permanent vehicle identity, and the existing partial-VIN field is insufficient for full-VIN matching.

`performance_subscriptions` is server controlled. Clients may read their own status; they cannot insert, update or grant entitlements. Paid, grace-period and beta records require an expiry. Turning off renewal retains the paid period. Expiry returns records to locked state without deletion. Sandbox receipts cannot activate the main project. The verified PSI owner/customer account is represented separately by a production-only permanent complimentary entitlement at A$0 with no renewal or expiry. Other complimentary grants remain bounded to a 1–90 day beta period controlled by the MFA-verified owner.

Premium database rows have RLS ownership and entitlement checks. Free users receive only safe counts through a narrowly scoped RPC that verifies vehicle ownership. They cannot read titles, notes, paths, amounts or premium assets by changing request IDs.

Customers cannot create arbitrary long-lived Storage links. `open-vault-file` verifies their JWT, queries the asset through their own RLS session and then signs that authorised object for 60 seconds. Signed URLs are bearer links during those 60 seconds; someone deliberately sharing a valid link can share that file until it expires. Previously downloaded files cannot be recalled. This is the practical boundary of signed URL access, rather than a promise to prevent copying.

Original PDFs and prepared photos are objects; dates, captions, ownership, SHA-256 hashes, file sizes and relationships are Postgres records. Object paths use UUIDs, not customer names, registrations or VINs. No private bucket is public. Subscription expiration never deletes objects. The existing account-deletion function now includes the new bucket.

Apple architecture: RevenueCat's iOS SDK handles StoreKit purchase/restore; Supabase fetches RevenueCat's server-side subscriber truth. The webhook never grants access from its claimed status alone. Verified responses are stored with ordering protection. Missing credentials, unknown products, non-AUD prices or sandbox/identity mismatches fail closed. RevenueCat must be configured to keep a purchase with its original app user; family sharing and receipt transfers are not enabled by this implementation.

Purchases are deliberately unavailable until Apple products, RevenueCat keys/webhooks and end-to-end sandbox tests exist. No payment processor account has been created or charged. The schema reserves a Stripe provider for a later website subscription path; web checkout itself is not implemented in this checkpoint. Keep that work separate from existing workshop deposits.

## E. Automation

### Xero

The account to connect is `info@psiperformance.com.au`. Email alone is not an OAuth credential and does not identify the Xero organisation.

Implemented: HMAC-verified webhook receiver, pinned tenant, idempotent invoice-event queue and a private explicit Xero ContactID-to-PSI customer mapping table. The staff portal shows the review queue. The receiver cannot publish an invoice.

Next connection stage: register a standard OAuth app on Xero's Starter tier; obtain read-only invoice/contact access and offline refresh permission; keep OAuth secrets/refresh tokens server-side with restricted access and serialized token rotation. Confirm the organisation/tenant. A worker must retrieve the actual invoice and original PDF, check invoice type/status and delivery state, and reconcile by stable InvoiceID. An invoice-update event does not itself prove that an invoice was completed or emailed.

Matching must follow `tenant + ContactID → verified PSI customer → explicit PSI job reference → vehicle UUID`. The invoice reference should carry the PSI job reference. A contact with multiple cars and no explicit matching job goes to review. Never infer the vehicle from a customer name, most recent car, partial plate or last four VIN characters. Corrected invoices need version history and duplicate-safe reconciliation; void/deleted invoices require an audit decision, not silent erasure.

OAuth connection, invoice fetching, contact-link administration and the final review/approval worker are not connected yet. Staff can publish PDFs manually in the meantime. No Xero messages, invoices or account settings have been changed.

### Workshop PC

The included [PC importer](../operations/workshop-pc/README.md) compresses and prepares photos, creates thumbnails, validates PDFs, checks a server-verified job manifest and uploads through staff MFA and RLS. It retains originals and records local upload/error status. `--watch` supports ongoing scans while it is running. It is not yet installed as a startup service; a first supervised login/upload is still required.

### Mainline dyno

Use the same verified job folder's `dyno` subfolder for original PDF reports, or upload PDFs in the staff portal. New dyno uploads are PDF-only. The existing free dyno publisher accepts PDF attachments and the Garage has an Open dyno PDF action. Enter power in HP at hubs and torque in Nm at hubs only after checking the report; the database stores power in kW using the existing conversion convention. The premium publisher supports before/baseline/after labels. No Mainline API or reliable numerical extraction is assumed. Automatic PDF graph rendering, OCR and comparative graph overlays remain a later stage.

### Engagement

Publishing creates/updates a safe per-job notification summary visible in Alerts to the owner, including free users. It links to the vault. No new push notifications or emails are sent automatically. The later push step should coalesce a job's uploads so 14 photos do not create 14 notifications, honour opt-outs and avoid private details on lock screens.

## F. UI/UX review and changes

The charcoal, brushed-silver and ice-blue artwork already provides a distinctive automotive identity. Strong dashboard imagery, familiar navigation, readable vehicle facts and established maintenance controls should remain. No gold, new brand palette or wholesale redesign is warranted.

The main weaknesses are inconsistent uploaded-photo framing, a single illustration for every garage, dense staff forms, and limited organisation of vehicle paperwork. These are targeted refinements, not reasons to rebuild the app.

Added: landscape crop/fit preview that preserves proportions; 20 consistent silver vehicle choices shared by Home and Garage; Performance+ entry cards; locked counts; a restrained subscription page; chronology/category views; private photo thumbnails; PDF actions; purchase/restore/status controls; and staff publication/manifest controls. These retain the existing design language.

The new photo editor defaults to a 16:9 crop with position controls. Fit whole photo preserves the entire portrait image within a horizontal frame, leaving side space rather than stretching. Illustrations use the same framing and palette. The 20-car set is approximately 2.4 MB total; generated illustrations are representative artwork, not manufacturer-approved exact model photography.

This checkpoint has compile/build and automated checks. It still needs hands-on iPhone/iPad testing, large text/accessibility review, actual camera-library framing and a real private photo/PDF gallery run before calling the paid experience launch ready.

## G. Safe checkpoints and launch

1. Existing architecture inspection and additive data model — completed in this development pass.
2. RLS acceptance tests in sandbox, customer/staff beta UI, PDF and image workflows — implemented and being validated; see final delivery status for deployment results.
3. Supervised private upload and beta entitlement walkthrough with existing testers. Keep all beta accounts and sandbox.
4. Apple/RevenueCat configuration and sandbox purchase, restore, renewal, cancellation, expiration, refund, billing grace, account switch and revoked-access tests. Produce a new native beta build because new native libraries cannot be added to an old binary by an over-the-air update.
5. Connect Xero OAuth, implement and test the explicit matching/review worker using sample invoices. First test one known vehicle, then ambiguous/multiple-vehicle cases and corrected invoices.
6. Run workshop-PC watch mode with one selected job, verify every photo/customer association, then expand gradually. Keep backups and monitor storage/download usage.
7. Update privacy/store disclosures and subscription metadata; test all free workflows and account deletion; submit a new app version and first subscription products for Apple review. An existing approved version does not automatically approve these native/subscription changes.
8. Only after beta completion, prepare a separate approved reset with exported backups and a reviewed allowlist of retained **user IDs**. `matt@…` and `Matt@…` are not reliable separate identities. Preserve the actual portal role, personal customer identity and the permanent `performance_subscriptions` row bound to that customer UUID. If the personal profile must be recreated, restore its verified permanent owner entitlement before reopening the app. Never wipe by email spelling. Keep a fictional demo; a free signup does not replace App Review/test environments.

## H. Cost and risk

### Storage assumptions

Planning model: 1.5 vehicles/customer × 3 workshop visits/year × each visit containing 20 prepared photos at 250 KB, 20 thumbnails at 25 KB, a 0.5 MB invoice, 1 MB dyno PDF and 1 MB other documents. This is about **36 MB/customer/year** of cloud objects. PDFs/photos vary substantially. Originals remain on the PC and need separate backup capacity.

| Customers with uploaded records | One year's objects | Three years' objects | Extra metadata estimate/year |
|---:|---:|---:|---:|
| 100 | 3.6 GB | 10.8 GB | 10 MB |
| 500 | 18 GB | 54 GB | 50 MB |
| 1,000 | 36 GB | 108 GB | 100 MB |
| 5,000 | 180 GB | 540 GB | 500 MB |

The metadata estimate assumes 0.1 MB/customer/year and excludes existing auth, bookings, audit logs and indexes. Records for free customers also consume storage when PSI uploads them. A single full archive download/customer/month in the first year would roughly repeat the one-year object column as monthly download volume; thumbnails reduce ordinary browsing substantially.

### Monthly infrastructure planning, AUD only

| Item | Expected incremental cost |
|---|---|
| PC importer + Pillow | A$0 software licence; PC electricity, internet and backups remain PSI costs |
| Supabase Free | A$0 while within free limits |
| Supabase Pro, if later needed | About A$34.64/month before applicable tax and card FX fees for the entry configuration; about A$38.10 if 10% tax applies |
| Additional billable Supabase project | From about A$13.85/month before tax/FX; confirm the two-project organisation quote first |
| RevenueCat | A$0 initially; its current free threshold is approximately A$3,463.56 monthly tracked revenue at the conversion below, then 1% of tracked revenue under its published plan |
| Standard Xero OAuth Starter | A$0 developer tier, up to five connected organisations and 1,000 requests/day/organisation; existing Xero accounting subscription remains separate |
| Xero Core if ever needed | A$35/month excluding tax; one PSI organisation should not require this just because many PSI customers use the app |
| Apple commission | 15% once accepted into the Small Business Program; use actual App Store Connect proceeds for budgeting |

Foreign-priced estimates are converted using the [RBA 8 September 2026 rate](https://www.rba.gov.au/statistics/frequency/exchange-rates.html); the AUD conversion factor used is 1.385425 per source billing unit. They are estimates, not fixed AUD vendor prices. Exchange rates, taxes and card fees can change. No paid infrastructure plan has been enabled.

[Supabase Free](https://supabase.com/pricing) currently includes 500 MB database, 1 GB object storage, 5 GB uncached egress and 5 GB cached egress, with two active projects and inactivity pausing. It cannot hold this full photo-rich model at 100 customers for a year: 1 GB is only about 27 customer-years under these assumptions, before current usage. Start small and measure; do not promise permanent A$0 hosting or unlimited uploads. Paid plan database backups do not by themselves back up Storage objects.

[RevenueCat pricing](https://www.revenuecat.com/pricing) is based on tracked revenue rather than PSI's net Apple payout. [Xero developer pricing](https://developer.xero.com/pricing) offers a free Starter tier; a paid Custom Connection is a different product and is not needed for this proposed standard OAuth approach.

For a simple illustration only, A$9.99 including 10% GST leaves about A$7.72 after removing that GST and then a 15% commission. Actual proceeds depend on Apple's tax/adjustment treatment, territory, refunds and programme effective date. Do not treat A$9.99 × 85% as guaranteed take-home income. Confirm with App Store Connect and PSI's accountant.

Operational risks to resolve before charging: receipt restoration/account ownership, reliable webhook/reconciliation delivery, account deletion while a subscription is active, retained invoice obligations, wrong physical photos in a correctly named folder, stale/changed registrations, PDF content validation beyond its header, storage/egress growth, malware scanning, unfinished-upload recovery and backup restore testing. Lifecycle cleanup must target verified orphan/temp files only; subscription cancellation is never a deletion trigger.

## I. Information still needed from Matt

No further architecture decisions are needed to view/test the beta foundation. Activation requires account-holder work that cannot be inferred from the repository:

- Apple legal entity/Team ID and confirmation of associated developer accounts for the Small Business form; Apple subscription product setup and a RevenueCat project with server credentials supplied through secure configuration.
- Xero OAuth consent for the correct organisation, then one representative invoice showing where the PSI job reference is recorded. Do not send passwords or secret keys in chat.
- The actual PC upload-root location, staff login/MFA for the first run and one selected job's photos/PDFs.
- Before any future reset, the exact retained Auth UUID, its portal-owner and customer-profile records, its permanent entitlement row, and a reviewed backup/retention decision.

See [Apple drafts](APPLE-SMALL-BUSINESS-DRAFTS.md) and [activation checklist](PERFORMANCE-PLUS-ACTIVATION.md). Messages are drafts only and have not been sent.
