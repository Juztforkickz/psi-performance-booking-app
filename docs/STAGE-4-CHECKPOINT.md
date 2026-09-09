# Stage 4 beta checkpoint — 9 September 2026

Code checkpoint: `8e761c07a4efde6f701980af1fb0196cf3ee6269`, pushed to the existing `main` branch.

Follow-on refinements: the [54-car library and compact picker](GARAGE-ARTWORK-EXPANSION.md) were published to the web preview and the compatible build-9 iOS beta runtime. The Home discovery experience now uses a compact default `Performance+` dashboard tile immediately before Settings; its full-width promotional card was removed. The details below describe the original Stage 4 foundation checkpoint.

## View the result

- [Performance+ public preview](https://juztforkickz.github.io/psi-performance-booking-app/performance-plus)
- [My Garage public preview](https://juztforkickz.github.io/psi-performance-booking-app/garage)
- [Successful preview build/deployment](https://github.com/Juztforkickz/psi-performance-booking-app/actions/runs/34288136044)
- [iOS beta build 9](https://expo.dev/accounts/psi-performance/projects/matt-psi/builds/5839004a-e7ea-435e-a7dc-cbeaf63d6e8d) — finished successfully from the code checkpoint above.
- [Permanent-owner build-9 beta update](https://expo.dev/accounts/psi-performance/projects/matt-psi/updates/0da20f28-80d4-4fb8-b007-cf025d0fb0df) — commit `abee1bb`, exact runtime `1.0.0-beta-performance-plus-1`; no new Apple binary required.
- [Current complete build-9 beta update](https://expo.dev/accounts/psi-performance/projects/matt-psi/updates/1aff1fb2-45c2-41fb-ad36-33c73c321d07) — commit `7b82bf3`, exact runtime `1.0.0-beta-performance-plus-1`; includes the plus-symbol Performance+ tile, 54-car Garage selector and bright-theme refinements.
- [Successful upload to App Store Connect for TestFlight](https://expo.dev/accounts/psi-performance/projects/matt-psi/submissions/f2c83882-557e-467d-bcfa-ec15c0631cc2) — EAS submission FINISHED on 9 September at 09:12 Sydney. Build 9 is now assigned to the internal `Team (Expo)` group and external `PSI Beta Testing` group. App Store Connect shows `Testing`, and automatic tester notification is enabled. No public App Store release was submitted.

The public preview uses fictional data. It cannot take payments or retrieve private customer records. The native beta uses the existing main account backend plus its existing selectable demo mode. The approved main database and function rollout is complete. Matt's verified owner/customer account (`matt@psiperformance.com.au`) has permanent complimentary PSI Performance+ access at **A$0**, with no purchase, renewal or expiry. Its former 30-day beta row remains revoked for audit.

## Included changes

- New mobile Performance+ and private vault pages, locked own-record counts, subscription terms/privacy text, thumbnails and chronological records.
- Free account/garage/bookings/kilometres/reminders and existing dyno/repair functions retained. Existing invoices are now entitlement-gated in both main and sandbox.
- Garage landscape photo framing and 20 consistent silver illustrations; native PDF selection/opening for dyno and invoices.
- Staff workshop jobs, private publication, upload progress, beta grants, import/draft visibility and verified PC manifests.
- PC photo/PDF preparation, compression, metadata stripping, duplicate prevention, verified identity matching and interrupted-upload resume with byte checks. No Windows startup service installed.
- Supabase additive migrations, owner/entitlement RLS, server-only signed file access, RevenueCat verification/webhook foundation and Xero webhook review queue.
- New isolated Apple purchase-test profile and distinct native runtimes; no paid purchase configuration activated.
- AUD-only pricing preference saved in `AGENTS.md`; application/support drafts and activation instructions supplied.

Main entry files are under `mobile/src/app`, reusable vault/purchase/upload logic under `mobile/src/lib`, portal/photo components under `mobile/src/components`, and the PC tool under `operations/workshop-pc`. Database changes are the four `20260908...performance_plus...sql` migrations plus `20260909004916_permanent_complimentary_performance_access.sql`; private access/provider functions are under `supabase/functions`.

## Verified

- Mobile TypeScript check: passed.
- Mobile source and Expo configuration lint: passed after resolving the expiry-clock purity issue.
- Expo web export: passed, 25 routes; GitHub Pages CI typecheck, environment tests, export and deployment passed.
- Review/demo/purchase-test environment checks: 16 passed.
- Provider entitlement interpretation: 8 passed, covering expiry, cancellation, grace, refund, identity mismatch, sandbox and unsupported purchases.
- PC importer: 9 passed, covering image preparation, original retention, PDF rejection, missing/incorrect manifests and safe upload resume.
- Main and sandbox SQL acceptance: passed, including free, paid, expired and permanent access; invalid permanent-row shapes and revocation; legacy invoice protection; forged grants/server RPC denial; cross-account denial; private storage; deleted identities; and stale provider response protection. Fixtures ran inside a rollback transaction; no fixture accounts remain on main.
- Main and sandbox endpoint probes: anonymous customer requests returned 401; unconfigured provider webhooks returned 503. No private files or purchases were exposed.
- Full root suite: 78 passed, 7 failed. The same seven failures were reproduced against the prior `8ec070d` source checkpoint: stale copy/layout expectations in booking preview, account preview/setup, maintenance preview, responsive layout and partner categories. They were not silently changed to make this work appear fully green.
- Independent read-only review found no concrete cross-customer retrieval or customer entitlement-write bypass. Its expiry-screen, PC retry and initial purchase-control gating findings were corrected.

Main and sandbox security advice has no new vault warning. Existing notices remain for deliberately service-only tables without customer policies and disabled leaked-password protection. Review [Supabase's password-protection guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) before public account expansion. This does not replace device or penetration testing.

## Deployment boundaries and blockers

**Sandbox:** the four Stage 4 foundation migrations, permanent-owner schema update and `open-vault-file`, `sync-performance-subscription`, `performance-subscription-webhook`, `xero-vault-webhook` are deployed. `complete-account-deletion` includes the new private bucket. Provider secrets are absent, and sandbox purchase acceptance remains closed until deliberate setup.

**Main:** following the user's explicit target approval, the foundation migrations, permanent-owner update and the same five functions above are deployed. `complete-account-deletion` is version 2 and includes the new bucket. Main baseline counts remain unchanged: 7 profiles, 8 vehicles, 5 booking requests, 2 invoices, 2 dyno records. All three file buckets are private. No beta reset, account removal, paid infrastructure upgrade or Netlify deployment occurred. Only Matt's verified owner/customer account has the permanent complimentary owner entitlement; other accounts remain governed by their free, bounded beta or verified paid entitlement.

**Apple/RevenueCat:** build 9 is processed and active for both internal and external TestFlight testing. No live purchases or public App Store release are active. Product configuration, provider credentials and full device purchase testing still remain. Existing build 7 is confirmed VALID, IN_BETA_TESTING internally and unexpired. The Small Business drafts are not submitted applications.

**Xero:** no OAuth account connection, invoice-fetch worker or automatic publication is active. The signed event receiver and queue are ready for the next connection stage. No Xero invoice/customer/account was changed.

**PC:** initial supervised staff login, actual folder selection and a real job upload remain. Manual portal drafts need administrator recovery; PC-generated drafts support safe resume. The first archive view currently loads up to 200 new records plus 200 legacy invoices per vehicle; add pagination before large customer histories are launched. Push aggregation, full PDF extraction/comparisons, malware scanning and backup restore exercises remain launch work.

## Pre-Stage 4 recovery point

The annotated tag `psi-beta-before-performance-plus-2026-09-09` is pushed and independently verified on the remote. It resolves to `8ec070d8c1264d7ac2017da86085ae8b5c1ff016`, the previous working beta. Local ignored recovery files under `work/stage4-restore-point` contain that source archive, the unrelated pre-existing payment-work patch, and an encrypted snapshot of 97 pre-rollout access policies, bucket settings and migration names/versions. SHA-256 hashes are saved alongside them.

The [restoration procedure](PERFORMANCE-PLUS-ROLLBACK.md) and manual SQL restore the prior own-customer invoice access without dropping vault data or disabling privacy controls. The script has been statically checked and its original-policy/private-bucket prerequisites verified read-only on main; it has not been executed. This is an application/access recovery point, **not a full backup of database rows, Auth or uploaded files**. The standard CLI database dump was unavailable without a separate CLI login.

The existing uncommitted booking-payment changes in `supabase/functions/PAYMENTS.md`, `process-booking-integrations`, `stripe-booking-webhook` and `tests/mobile-payment-contract.test.mjs` were preserved and excluded from this checkpoint.

See [assessment and AUD costs](STAGE-4-PERFORMANCE-PLUS.md), [Apple drafts](APPLE-SMALL-BUSINESS-DRAFTS.md) and [activation checklist](PERFORMANCE-PLUS-ACTIVATION.md).
