# Performance+ activation checklist

Updated 9 September 2026. Prices: **A$9.99/month or A$99/year**. This checklist records the verified rollout checkpoint and remaining activation work. Preserve existing beta accounts and the sandbox.

Following explicit approval for the main rollout, the Performance+ foundation migrations, including the permanent complimentary owner-access update, and all four vault/provider functions are deployed to **main and sandbox**. Main `complete-account-deletion` is deployed and **ACTIVE, version 2**, including the premium storage bucket. Main authenticated endpoint checks return HTTP 401 without authentication; unconfigured provider webhooks return HTTP 503.

Main data counts are unchanged: **7 customer profiles, 8 vehicles, 5 bookings, 2 invoices and 2 dyno records**. No customer deletion or reset has occurred. Apple/RevenueCat payment and Xero credentials remain absent, purchases remain disabled, and sandbox-entitlement acceptance remains false.

iOS **build 9**, EAS build ID `5839004a-e7ea-435e-a7dc-cbeaf63d6e8d`, is **FINISHED and uploaded to Apple for TestFlight**. [EAS submission `f2c83882-557e-467d-bcfa-ec15c0631cc2`](https://expo.dev/accounts/psi-performance/projects/matt-psi/submissions/f2c83882-557e-467d-bcfa-ec15c0631cc2) finished on 9 September 2026 at 09:12:42 Sydney time (`2026-09-08T23:12:42Z`). App Store Connect subsequently confirmed **VALID / IN_BETA_TESTING** for internal testing. Its external status is **READY_FOR_BETA_SUBMISSION**, so external beta review remains. Build 7 remains valid, in internal testing and unexpired. No public App Store review or release has been submitted.

The [permanent-owner beta update](https://expo.dev/accounts/psi-performance/projects/matt-psi/updates/0da20f28-80d4-4fb8-b007-cf025d0fb0df) was published from commit `abee1bb5c12e9c8148a1f6faf94d70104c89f1ef`: group `0da20f28-80d4-4fb8-b007-cf025d0fb0df`, iOS update `01a083c4-5a5b-771d-8bd9-eabed8f06264`, beta branch, runtime `1.0.0-beta-performance-plus-1`. It is compatible with build 9 and does not affect build 7 or require another Apple binary.

Matt's verified owner/customer account (`matt@psiperformance.com.au`) has **permanent complimentary PSI Performance+ access**. Cost: **A$0**. It has no purchase, renewal, billing period or expiry and is excluded from Apple/RevenueCat billing. The former 30-day beta row is retained in revoked state for audit. This owner entitlement does not replace Apple purchase and restore testing.

For a permanent account, the app shows the A$0/no-expiry owner status and omits subscribe, restore and Apple subscription-management controls. Paid controls remain hidden while entitlement status is loading or unavailable, and the app rechecks the server immediately before any future Apple purchase call.

## 1. Apple and RevenueCat configuration

Use the existing app: bundle ID `com.psiperformance.booking`, App Store Connect app ID `6806902732`. Confirm account agreements, banking, tax and the Account Holder's Small Business enrolment separately. See [Apple drafts](APPLE-SMALL-BUSINESS-DRAFTS.md).

Create one subscription group with monthly and annual auto-renewable products at the same service level. Both unlock every vehicle owned by the subscribing PSI account. No introductory offer or Family Sharing is implemented. The prices in App Store Connect must match the app's AUD pricing before purchase is enabled.

| Configuration | Required value |
|---|---|
| RevenueCat entitlement identifier | `performance_plus` |
| RevenueCat offering identifier | `performance_plus` |
| Offering monthly package | Standard monthly package, `$rc_monthly`, exposed by SDK `.monthly` |
| Offering annual package | Standard annual package, `$rc_annual`, exposed by SDK `.annual` |
| Apple monthly product ID | No existing ID is assumed. Proposed: `psi_performance_plus_monthly` |
| Apple annual product ID | No existing ID is assumed. Proposed: `psi_performance_plus_annual` |
| RevenueCat App User ID | Authenticated Supabase customer UUID; never email or an anonymous ID |
| Restore policy | Keep with original App User ID; no automatic transfer to another PSI account |

If different Apple product IDs already exist, use those exact verified IDs in RevenueCat and the server allowlist. Product IDs are configuration; the entitlement and offering names above are hard-coded in the current implementation. Attach both Apple products to the entitlement and their corresponding packages. See RevenueCat's [entitlements](https://www.revenuecat.com/docs/getting-started/entitlements), [offerings](https://www.revenuecat.com/docs/offerings/overview) and [restore behaviour](https://www.revenuecat.com/docs/projects/restore-behavior) guidance.

Connect the existing Apple app in RevenueCat using its requested App Store credentials. Configure App Store server notifications through RevenueCat's current setup flow. Keep private Apple keys in the provider's secure configuration. A RevenueCat Test Store key cannot replace the Apple SDK key expected here.

## 2. Exact environment variables and endpoints

Set secrets through the destination project's secure settings, never in chat, Git, screenshots or `EXPO_PUBLIC_*` variables. `EXPO_PUBLIC_REVENUECAT_APPLE_KEY` is the sole RevenueCat value intended for the native client.

| Name | Location and purpose |
|---|---|
| `EXPO_PUBLIC_REVENUECAT_APPLE_KEY` | Expo build environment; RevenueCat Apple public SDK key beginning `appl_` |
| `EXPO_PUBLIC_PERFORMANCE_PURCHASE_TEST` | `true` only in the isolated `performance-test` build profile described below |
| `REVENUECAT_SECRET_KEY` | Supabase Edge Function secret; permission to retrieve subscribers through RevenueCat API v1 |
| `PERFORMANCE_APPLE_PRODUCT_IDS` | Supabase secret/configuration; exactly two comma-separated Apple product IDs, monthly and annual |
| `REVENUECAT_WEBHOOK_AUTHORIZATION` | Supabase secret; exact value configured for RevenueCat's webhook Authorization header, including `Bearer ` if used |
| `PERFORMANCE_ALLOW_SANDBOX` | Supabase configuration; `false` on main; only `true` in the isolated purchase-test backend |
| `XERO_WEBHOOK_SIGNING_KEY` | Supabase secret; Xero webhook HMAC key, not its OAuth client secret |
| `XERO_TENANT_ID` | Supabase configuration; the single verified PSI Xero organisation UUID |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase-provided server environment; privileged key stays server-side |

For the proposed product IDs, `PERFORMANCE_APPLE_PRODUCT_IDS` would be `psi_performance_plus_monthly,psi_performance_plus_annual`. Do not set this until the actual Apple IDs are verified.

The per-project base URL is `https://PROJECT_REF.supabase.co/functions/v1/`:

| Function | Caller authentication |
|---|---|
| `sync-performance-subscription` | Customer JWT; identity comes from the verified session |
| `open-vault-file` | Customer JWT; RLS checks ownership and entitlement before short-lived signing |
| `performance-subscription-webhook` | RevenueCat's configured Authorization secret; gateway JWT verification disabled |
| `xero-vault-webhook` | Xero's HMAC signature over original bytes; gateway JWT verification disabled |

Configure separate webhook destinations and credentials for test and main. A webhook re-fetches provider truth before updating access. Verify authorised delivery, rejected invalid headers, retries and monitored failures using [RevenueCat's webhook documentation](https://www.revenuecat.com/docs/integrations/webhooks). No scheduled reconciliation worker is included yet: define monitoring and recovery for missed events before charging customers.

## 3. Keep purchase testing isolated

| Environment | Project ref | Required boundary |
|---|---|---|
| Main customer backend | `lslhfrujyuqcavsnugfx` | Production entitlements only; no sandbox unlocks |
| Existing Apple sandbox | `jwikoldibbpxyhbdrsow` | Fictional/approved test data and separate identities |
| Public GitHub Pages demo | No live authenticated customer session | Fictional previews; no purchases or writes |

Sandbox acceptance has **two gates**: `PERFORMANCE_ALLOW_SANDBOX=true` in that backend and `private.performance_settings.allow_sandbox=true` in that backend's database. Both default closed. Never enable either on main to make a TestFlight test pass.

Use the implemented `performance-test` profile in `mobile/eas.json`. It extends `apple-review`, sets `distribution=store` and `EXPO_PUBLIC_PERFORMANCE_PURCHASE_TEST=true`, and inherits the pinned sandbox and `apple-review` update channel. Its native runtime is `1.0.0-performance-purchase-test-1`. `mobile/app.config.js` rejects this flag outside that profile and the verified isolated review configuration. Add the Apple SDK key to this test build's secure build configuration only when its matching backend/provider configuration is ready.

The ordinary `apple-review` and fictional demo modes keep purchases disabled. Normal `beta`/`qa` customer sessions use main; leave their RevenueCat key unset during foundation testing. Do not inject an Apple key into ordinary beta and then relax main's sandbox protections to make purchases work. Existing beta/review runtime IDs have also changed for the new native modules.

TestFlight purchases run in Apple's sandbox and renewal timing is accelerated. Test renewal and billing failure using Apple's supported test controls, not live charges. [Apple TestFlight purchase testing](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testing-subscriptions-and-in-app-purchases-in-testflight/)

The new native purchase, document-picker and image-manipulation modules require a **new signed iOS build**. An over-the-air update to an old binary is insufficient; build 9 now supplies that foundation binary and has been uploaded. Continue with Apple's processing/tester-availability check. A separately configured purchase-test build must use the intended EAS environment, signing identity, bundle ID, runtime and update channel. App Review's sandbox purchase flow also needs a verified isolated route in the eventual submitted binary.

## 4. Required acceptance checks before charging

- Run the repository's Performance+ RLS and entitlement tests. Verify free/expired users cannot retrieve premium rows, legacy invoices or objects; paid users can retrieve only their own; staff MFA and deleted-account denial remain intact.
- Test monthly and annual purchase, user cancellation of the purchase sheet, restore after reinstall and on a second device, account switching, and attempts to restore another PSI customer's receipt. Confirm no anonymous receipt migration. Define support recovery for a lost/deleted/recreated PSI account using the same Apple receipt before launch; the strict original-account policy can otherwise leave a new account unable to access its purchase.
- Test renewal, switching monthly/annual, auto-renew cancellation with access through expiry, expiration, billing retry, verified grace period, recovery, refund and revocation. Check the server record and actual content access, not only the UI label.
- Test forged/unknown products, non-AUD price mismatch, sandbox receipt rejection on main, duplicate/out-of-order webhook events, provider outage and retry after a successful Apple payment. Never ask a customer to buy again to fix delayed verification.
- Test a free, complimentary and paid account with the same representative PDFs/photos. Check short-lived original/thumbnail links, sign-out, stale screens, account deletion and active-subscription cancellation instructions.
- Test iPhone photo framing, the complete illustration library, PDF opening, thumbnails, slow network, interrupted upload and wrong-job manifests. Verify bookings, kilometres, reminders and existing free dyno functionality still work.
- Update `STORE-RELEASE-PACKAGE.md` (its older “no paid subscriptions” statement is obsolete for launch), privacy/provider disclosures, terms, support URLs, subscription screenshots and App Review access instructions. Submit the first subscription products/group with a new app version.

Record the actual build ID, project, test identities, test results and webhook timestamps. A complimentary beta grant is not a substitute for purchase/restore testing. Keep purchases closed until failures are resolved.

## 5. Xero: remaining connection and development work

**9 September follow-up:** The standard OAuth app, encrypted credential settings, owner/MFA connection flow and organisation-confirmation backend are now implemented. See [Xero connection setup](XERO-CONNECTION-SETUP.md) for the current status and exact new environment names. The older preparation notes below describe the original gap; invoice fetching/publication, rotation and live consent remain incomplete.

The intended login is `info@psiperformance.com.au`; Matt must consent to the correct organisation. The implemented receiver only verifies and queues invoice events. It does **not** fetch invoices or automatically publish them.

Register a standard OAuth app, implement its callback and secure refresh-token storage/rotation, then request minimal read-only invoice/contact permissions plus offline access using Xero's [current scopes](https://developer.xero.com/documentation/guides/oauth2/scopes/). OAuth client ID, secret and redirect URI configuration do not yet have implemented environment names in this repository. Adding invented variables will not connect Xero.

Implement the worker and contact-link/review administration. Require `tenant + ContactID → confirmed PSI customer → explicit PSI job → vehicle UUID`; missing or conflicting identifiers require human review. Retrieve the actual invoice status, delivery state and original PDF; reconcile by InvoiceID with versions for corrections. An invoice webhook alone does not prove completion or email delivery. Test multiple-vehicle customers, duplicate events, voids, contact changes and expired consent. [Xero webhook contract](https://developer.xero.com/documentation/guides/webhooks/overview/)

Provide one representative invoice and identify its PSI job-reference field before automatic matching is enabled. Do not guess from customer names, recent vehicles, partial VIN or folder names. Manual staff PDF publication remains available while this work is pending.

## 6. Workshop PC first run

Follow the [PC importer README](../operations/workshop-pc/README.md). Choose the real upload-root directory; install Python and the pinned Pillow requirement. In the staff portal, verify one customer, vehicle, registration, job and date, then download that job's `psi-job.json` into its folder.

Run `--prepare-only` first. Inspect the resized photos/thumbnails and retain originals. Then run one upload with the matching Supabase project URL, public publishable key and staff email; enter OTP and MFA locally. Never use a service-role key. Confirm every file in the intended customer's vault before using `--watch`.

Use `before`, `progress`, `after`, `dyno`, `invoices` and `documents` subfolders. Dyno and invoice uploads are PDFs; dyno values still require checked manual entry. The tool generates photos/thumbnails, strips GPS metadata, deduplicates prepared content and reports errors. It is not installed as a startup service and cannot resume staff authentication unattended after every restart. Interrupted PC uploads resume by checking existing object bytes and uploading missing pieces; differing contents require review. Manual portal drafts still need administrator review.

Monitor database, object storage and downloads; the free plan has finite capacity. No automatic paid-plan upgrade or customer-data reset is part of this activation. See the [Stage 4 assessment](STAGE-4-PERFORMANCE-PLUS.md) for AUD estimates, retention and migration risks.
