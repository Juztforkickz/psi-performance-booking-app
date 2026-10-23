# Performance+ expiry repair, 23 October 2026

Production audit confirmed 51 active customer profiles, 21 expired complimentary trials still stored as active, 10 valid trials, one permanent complimentary account and zero active paid subscriptions. All 21 expiry emails were already recorded as sent. Two RevenueCat rows were expired, not evidence of active paid subscriptions.

The production migration corrected exactly 21 trial rows. The resulting account totals are 10 trials, zero paid subscriptions, one permanent account and 40 free accounts. No customer history, files, payments or existing subscription rows were deleted. The protected owner's permanent grant remains active with no expiry. The older revoked grant was preserved.

## Database and server changes

Migration `20261023110613_performance_subscription_expiry_reconciliation.sql` matches the production migration version. `private.reconcile_performance_expiry()` runs every minute through the named `psi-performance-expiry-reconciliation` cron job. Successful scheduled runs were verified. It only changes nonpermanent active or grace records whose effective expiry has passed. Future paid and grace deadlines remain valid. Rows are locked during reconciliation, and repeat runs make no additional changes. It preserves provider `verified_at` ordering. A write trigger also prevents already expired provider data being stored as active.

`private.performance_expiry_audit` records the subscription ID, customer ID, previous status, deadline and reconciliation time. It is private, RLS protected and unavailable to customer roles. Existing subscription audit events remain in place. Reconciliation does not call an email or notification worker. The 21 completed notification jobs were not reset or replayed; the 10 future jobs remain pending.

Account status is calculated from current server time and verified subscription rows, independently of vehicle ownership or whether a vehicle has been added. Permanent access takes priority, followed by valid paid access and valid trials. Historical import access stays separate from an account lifetime grant. The vehicle overview preserves its free record counts and import access.

Premium record RLS continues to enforce customer ownership, current entitlement, publication and identity restrictions. Invoice, vault asset, workshop photo, dyno and repair file access is checked on the server. Legacy file policies now preserve completed historical imports. Customer supplied vehicle/profile photos remain free. Private storage does not allow customers to mint arbitrary long premium download URLs. `open-vault-file` first reads the record through customer RLS, then checks the vehicle access RPC and signs a short URL capped to the known subscription deadline. Staff operational access remains subject to the existing staff checks.

Deployed and source compared:

* `open-vault-file`, version 19, existing custom user authentication preserved.
* `sync-performance-subscription`, version 19, gateway JWT validation preserved.
* `performance-subscription-webhook`, version 20, existing webhook authorization preserved.

Renewal and restore still fetch authoritative RevenueCat subscriber data on the server. Client SDK JSON and webhook claimed status cannot grant access. Product, store, environment and customer identity checks remain enforced. Cancellation retains verified access until the paid deadline; a verified grace period extends only to its own deadline. A later verified purchase restores existing records without recreating or deleting them. Stale provider responses cannot override a newer verification.

## App changes

Account and My Garage now include a compact status card. Performance+ and the existing plan card use the same status calculation: `ACTIVE`, `TRIAL ACTIVE`, `FREE / EXPIRED`, `FREE` or `PERMANENT ACCESS`. An unavailable initial lookup says `CHECKING ACCESS` rather than claiming a paid plan. The upgrade option remains available to free customers.

A shared overview hook refreshes at expiry, on app resume, browser focus, server subscription events and completed server purchase verification, with a foreground polling fallback. It uses the server time to account for device clock differences. Expired vault contents are hidden and open viewers close. Purchased vehicle history remains accessible without incorrectly labelling the whole account permanent. Free vehicle details, dates, kilometres, notes and bookings remain independent.

## Verification

* 56 targeted Node tests passed, including real hook lifecycle execution, actual plan card and badge rendering, provider entitlement interpretation, server sync with mocked provider responses, native checkout cancellation/failure handling and file endpoint execution.
* Production transactional SQL fixtures passed free, active trial, expired trial, paid, cancellation, grace, failed renewal, reactivation, stale provider response, refund/revocation, permanent and historical import cases.
* RLS assertions covered premium metadata and files, dyno records, workshop photos, foreign vehicles, self granting denial, free account/vehicle/photo/notes access and reconciliation idempotency. Fixtures were rolled back.
* Existing historical import SQL acceptance test passed and rolled back.
* Mobile TypeScript, targeted ESLint and Deno checks passed.
* Live anonymous HTTP requests to the file, subscription sync and webhook functions, subscription table and account status RPC all returned HTTP 401.
* Production advisories showed no new warning introduced by this repair. The private audit table intentionally has no customer policies. Existing unrelated warnings were not changed.

## Release boundary and remaining verification

Backend repairs are live. Web publication uses the existing main branch GitHub Pages workflow. No native OTA, App Store or Google Play release is authorised by this task, and none was published. Native exports are prepared for later release approval; installed phone apps retain their previous display code until an authorised update is distributed.

There are no active paid customer subscriptions to observe in production. Renewal and payment failure behavior was verified with isolated provider fixtures and transactional database cases, not by charging a customer. A real store purchase and on device renewal remains an operational verification step.

Already downloaded copies cannot be recalled. Signed links issued before this repair remain valid until their original token expires. New links use the current server checks and a maximum 60 second lifetime capped to known timed entitlement; an already issued link can survive an unexpected early revocation until its token deadline.

Private deployment receipts, rollback source, export hashes and final publication evidence are retained under `work/performance-expiry-2026-10-23/`.
