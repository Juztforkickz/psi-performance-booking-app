# Performance+ activation checklist

Updated 10 September 2026. Prices: **A$9.99/month or A$99/year**. This checklist records the verified rollout checkpoint and remaining activation work. Preserve existing beta accounts and the sandbox.

Following explicit approval for the main rollout, the Performance+ foundation migrations, including the permanent complimentary owner-access update, and all four vault/provider functions are deployed to **main and sandbox**. Main `complete-account-deletion` remains **ACTIVE, version 10**, including the premium storage bucket. The JWT compatibility repair migration `20260910115915` is applied; that database repair did not replace the function. These checks do not constitute completion of a customer's permanent deletion request.

The Apple subscription catalogue and RevenueCat provider pipeline are configured.
Both authenticated RevenueCat webhook test deliveries returned HTTP 200. Actual
signed-iPhone purchase, renewal and restore acceptance is still pending; a
provider test event does not prove those end-to-end customer flows.
RevenueCat validates the
active Apple in-app purchase key `7GKV76RS3D`; both Apple products are attached
to the `performance_plus` entitlement and default offering. Apple production
and sandbox server notifications point to RevenueCat. RevenueCat sends those
events through separate authenticated webhooks to the matching main and sandbox
Supabase projects. The required server secrets and product allowlist are set in
both projects. Main continues to reject sandbox entitlements. The sandbox
environment and database acceptance gates are open only in the isolated Apple
Review Sandbox so the controlled purchase test can run.
Xero is connected separately and is no longer an activation blocker for
Performance+.

iOS **build 9**, EAS build ID `5839004a-e7ea-435e-a7dc-cbeaf63d6e8d`, is **FINISHED and uploaded to Apple for TestFlight**. [EAS submission `f2c83882-557e-467d-bcfa-ec15c0631cc2`](https://expo.dev/accounts/psi-performance/projects/matt-psi/submissions/f2c83882-557e-467d-bcfa-ec15c0631cc2) finished on 9 September 2026 at 09:12:42 Sydney time (`2026-09-08T23:12:42Z`). App Store Connect subsequently confirmed **VALID / IN_BETA_TESTING** for internal testing. Its external status is **READY_FOR_BETA_SUBMISSION**, so external beta review remains. Build 7 remains valid, in internal testing and unexpired. No public App Store review or release has been submitted.

The [permanent-owner beta update](https://expo.dev/accounts/psi-performance/projects/matt-psi/updates/0da20f28-80d4-4fb8-b007-cf025d0fb0df) was published from commit `abee1bb5c12e9c8148a1f6faf94d70104c89f1ef`: group `0da20f28-80d4-4fb8-b007-cf025d0fb0df`, iOS update `01a083c4-5a5b-771d-8bd9-eabed8f06264`, beta branch, runtime `1.0.0-beta-performance-plus-1`. It is compatible with build 9 and does not affect build 7 or require another Apple binary.

Matt's verified owner/customer account (`matt@psiperformance.com.au`) has **permanent complimentary PSI Performance+ access**. Cost: **A$0**. It has no purchase, renewal, billing period or expiry and is excluded from Apple/RevenueCat billing. The former 30-day beta row is retained in revoked state for audit. This owner entitlement does not replace Apple purchase and restore testing.

For a permanent account, the app shows the A$0/no-expiry owner status and omits subscribe, restore and Apple subscription-management controls. Paid controls remain hidden while entitlement status is loading or unavailable, and the app rechecks the server immediately before any future Apple purchase call.

## 1. Apple and RevenueCat configuration

Use the existing app: bundle ID `com.psiperformance.booking`, App Store Connect app ID `6806902732`. Confirm account agreements, banking, tax and the Account Holder's Small Business enrolment separately. See [Apple drafts](APPLE-SMALL-BUSINESS-DRAFTS.md).

The Apple subscription group and both auto-renewable products now exist at the
same service level. Both unlock every vehicle owned by the subscribing PSI
account. No introductory offer or Family Sharing is implemented. App Store
Connect shows the monthly product at **A$9.99** and the annual product at
**A$99.00**, available in Australia. Both are currently **Prepare for
Submission**.

| Configuration | Required value |
|---|---|
| RevenueCat entitlement identifier | `performance_plus` |
| RevenueCat offering identifier | `performance_plus` |
| Offering monthly package | Standard monthly package, `$rc_monthly`, exposed by SDK `.monthly` |
| Offering annual package | Standard annual package, `$rc_annual`, exposed by SDK `.annual` |
| Apple subscription group | `PSI Performance+` — group ID `22371456` |
| Apple monthly product ID | `psi_performance_plus_monthly` — Apple ID `6810231913` |
| Apple annual product ID | `psi_performance_plus_annual` — Apple ID `6810232965` |
| RevenueCat App User ID | Authenticated Supabase customer UUID; never email or an anonymous ID |
| Restore policy | Keep with original App User ID; no automatic transfer to another PSI account |

Use the exact verified Apple product IDs above in RevenueCat and the server
allowlist. Product IDs are configuration; the entitlement and offering names
above are hard-coded in the current implementation. Attach both Apple products
to the entitlement and their corresponding packages. See RevenueCat's
[entitlements](https://www.revenuecat.com/docs/getting-started/entitlements),
[offerings](https://www.revenuecat.com/docs/offerings/overview) and
[restore behaviour](https://www.revenuecat.com/docs/projects/restore-behavior)
guidance.

The RevenueCat project **PSI Performance** is created and its email is verified.
The production App Store app uses bundle ID `com.psiperformance.booking`, public
SDK key `appl_qJcOAgyhLBExQHfYkgStIaOxQGj`, and the validated Apple in-app
purchase key `7GKV76RS3D`. The key file is stored outside the repository in the
dedicated PSI secure integration folder. Its contents must never be emailed or
committed. The onboarding Test Store remains separate and its SDK key is not
used by the PSI iOS build.

The main RevenueCat webhook accepts production events only and targets main
Supabase. The sandbox webhook accepts sandbox events only and targets the Apple
review sandbox. Both use the same separately stored Authorization value, while
each Supabase project has its own environment boundary. Apple production and
sandbox server notification URLs both use RevenueCat's app-specific endpoint.

Apple business readiness remains separate from the technical catalogue. The
Paid Apps Agreement currently requires the Account Holder to review and accept
it, and Digital Services Act trader compliance is incomplete. Banking and tax
details must be completed after the agreement. These legal/business actions,
the required subscription review screenshot, and a successful sandbox
purchase/restore test are release blockers; do not submit the subscription or
enable charging before all are complete.

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

The verified value for `PERFORMANCE_APPLE_PRODUCT_IDS` is
`psi_performance_plus_monthly,psi_performance_plus_annual`. Set it in each
Supabase project's secure function configuration with the matching provider
credentials; never place server secrets in a public build variable.

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

Sandbox acceptance has **two gates**: `PERFORMANCE_ALLOW_SANDBOX=true` in that
backend and `private.performance_settings.allow_sandbox=true` in that backend's
database. Both are enabled only in the isolated Apple Review Sandbox for the
controlled purchase test. Main remains false at both boundaries. Never enable
either on main to make a TestFlight test pass.

Use the implemented `performance-test` profile in `mobile/eas.json`. It extends
`apple-review`, sets `distribution=store`, enables the isolated purchase-test
flag, and includes the RevenueCat Apple public SDK key. It inherits the pinned
sandbox and `apple-review` update channel. Its native runtime is
`1.0.0-performance-purchase-test-1`. `mobile/app.config.js` rejects this flag
outside that profile and the verified isolated review configuration.

The ordinary `apple-review` and fictional demo modes keep purchases disabled. Normal `beta`/`qa` customer sessions use main; leave their RevenueCat key unset during foundation testing. Do not inject an Apple key into ordinary beta and then relax main's sandbox protections to make purchases work. Existing beta/review runtime IDs have also changed for the new native modules.

TestFlight purchases run in Apple's sandbox and renewal timing is accelerated. Test renewal and billing failure using Apple's supported test controls, not live charges. [Apple TestFlight purchase testing](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testing-subscriptions-and-in-app-purchases-in-testflight/)

The new native purchase, document-picker and image-manipulation modules require a **new signed iOS build**. An over-the-air update to an old binary is insufficient; build 9 now supplies that foundation binary and has been uploaded and processed for internal testing. It is not the separately configured `performance-test` build. That purchase-test build must use the intended EAS environment, signing identity, bundle ID, runtime and update channel; its build and signed-device acceptance remain pending. The ordinary review/demo path keeps purchases disabled. Before submitting subscriptions, implement and verify the isolated purchase route in the actual binary selected for App Review; do not describe the ordinary demo as purchase-enabled or promise to substitute a different binary after review.

## 4. Required acceptance checks before charging

- Run the repository's Performance+ RLS and entitlement tests. Verify free/expired users cannot retrieve premium rows, legacy invoices or objects; paid users can retrieve only their own; staff MFA and deleted-account denial remain intact.
- Test monthly and annual purchase, user cancellation of the purchase sheet, restore after reinstall and on a second device, account switching, and attempts to restore another PSI customer's receipt. Confirm no anonymous receipt migration. Define support recovery for a lost/deleted/recreated PSI account using the same Apple receipt before launch; the strict original-account policy can otherwise leave a new account unable to access its purchase.
- Test renewal, switching monthly/annual, auto-renew cancellation with access through expiry, expiration, billing retry, verified grace period, recovery, refund and revocation. Check the server record and actual content access, not only the UI label.
- Test forged/unknown products, non-AUD price mismatch, sandbox receipt rejection on main, duplicate/out-of-order webhook events, provider outage and retry after a successful Apple payment. Never ask a customer to buy again to fix delayed verification.
- Test a free, complimentary and paid account with the same representative PDFs/photos. Check short-lived original/thumbnail links, sign-out, stale screens, account deletion and active-subscription cancellation instructions.
- Test iPhone photo framing, the complete illustration library, PDF opening, thumbnails, slow network, interrupted upload and wrong-job manifests. Verify bookings, kilometres, reminders and existing free dyno functionality still work.
- Verify `STORE-RELEASE-PACKAGE.md`, privacy/provider disclosures, terms, support URLs and App Review instructions against the actual submitted binary. The release package already describes optional paid Performance+; its subscription screenshot and purchase-access evidence remain pending. Submit the first subscription products/group with a new app version.

The subscription review screenshot is separate from the five existing store
marketing drafts. Follow the pending native capture checklist in
`STORE-RELEASE-PACKAGE.md`: use the signed purchase-test build and a free
synthetic account with a vehicle, capture the real Performance+ purchase screen,
and retain the build/runtime and test evidence. The public web preview and
Matt's permanently complimentary account cannot demonstrate a working purchase
screen. Recapture against the actual submitted binary if its UI or purchase
route differs; never manufacture a successful Apple purchase image.

Record the actual build ID, project, test identities, test results and webhook timestamps. A complimentary beta grant is not a substitute for purchase/restore testing. Keep purchases closed until failures are resolved.

## 5. Xero status

The standard OAuth connection, encrypted token rotation, signed webhook,
read-only invoice/PDF worker, exact customer/job/vehicle matching and
owner-reviewed vault publication are deployed. The in-app **Check status**
action now verifies live Xero invoice-read access without creating or changing
accounting data. See [Xero connection setup](XERO-CONNECTION-SETUP.md).

The remaining acceptance proof requires one representative real PSI invoice
whose Xero Reference exactly matches a PSI job reference. Missing or conflicting
identifiers continue to require owner review; the app never guesses from a
customer name, partial registration, recent vehicle or folder name.

## 6. Workshop PC first run

Follow the [PC importer README](../operations/workshop-pc/README.md). Choose the real upload-root directory; install Python and the pinned Pillow requirement. In the staff portal, verify one customer, vehicle, registration, job and date, then download that job's `psi-job.json` into its folder.

Run `--prepare-only` first. Inspect the resized photos/thumbnails and retain originals. Then run one upload with the matching Supabase project URL, public publishable key and staff email; enter OTP and MFA locally. Never use a service-role key. Confirm every file in the intended customer's vault before using `--watch`.

Use `before`, `progress`, `after`, `dyno`, `invoices` and `documents` subfolders. Dyno and invoice uploads are PDFs; dyno values still require checked manual entry. The tool generates photos/thumbnails, strips GPS metadata, deduplicates prepared content and reports errors. It is not installed as a startup service and cannot resume staff authentication unattended after every restart. Interrupted PC uploads resume by checking existing object bytes and uploading missing pieces; differing contents require review. Manual portal drafts still need administrator review.

Monitor database, object storage and downloads; the free plan has finite capacity. No automatic paid-plan upgrade or customer-data reset is part of this activation. See the [Stage 4 assessment](STAGE-4-PERFORMANCE-PLUS.md) for AUD estimates, retention and migration risks.
