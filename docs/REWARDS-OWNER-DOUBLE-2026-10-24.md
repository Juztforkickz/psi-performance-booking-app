# Rewards tier selection and permanent owner double access

24 October 2026. Matt asked to open Performance+ by tapping the 2× comparison card and explicitly authorised full time 2× Rewards for matt@psiperformance.com.au.

## Customer interaction

The 2× card on Rewards now opens the existing Performance+ screen. Tapping does not purchase, charge, change a subscription or select a financial earning rate. The highlighted card remains the current server verified rate. After a verified paid purchase, the existing subscription refresh changes the highlight to 2×. Expiry returns ordinary paid subscribers to 1× while preserving points.

The comparison title fits on one line where possible. Layout, existing colours, rounded cards, QR, balance and navigation remain intact.

## Authorised owner exception

The verified owner account received one separately audited permanent complimentary double Rewards grant. It began at `2026-10-24T06:07:13.344205Z`, **5:07:13 pm Melbourne**, and has no expiry. The existing permanent complimentary Performance+ subscription was preserved. No paid transaction, paid RevenueCat evidence, subscription purchase or new points were invented.

Both Rewards and Performance+ recognise the grant as complimentary. Rewards displays **PERMANENT ACCESS · 2× POINTS**, highlights the 2× card and shows **2× POINTS ACTIVE**. Supported Wallet payloads show the same earning rate and retain the same membership ID, QR and actual balance.

The grant applies to qualifying spending from its effective time, using the same actual receipt date, fully paid invoice, refund and redemption rules. Payments before the grant do not receive retrospective bonus points. Date only receipts crossing its boundary remain subject to the existing conservative review rule.

## Backend and security

Migration `20261024055926_rewards_complimentary_double_access.sql` adds private grant evidence and a separate complimentary grant ID audit column. The existing financial coordinator combines approved grant windows with existing paid evidence, awarding no more than one additional point per eligible AUD 1. Provider subscriptions remain separate and truthful.

No customer or service role can insert grants. Customers cannot read the private grant table. RLS is enabled. The owner was identified by the exact active email and existing permanent complimentary subscription; the operational insert is idempotent by its approval reference.

Schema version 2 records the expanded audit contract. Version 1's fingerprint intentionally no longer matches because its older coordinator must not overwrite grant support. Future maintenance must check the latest migration and schema version rather than replaying the original migration.

## Validation and release

**244 tests passed, zero failures or skipped tests.** The additional checks cover tier navigation without a false selection, permanent access, the grant start boundary, ordinary accounts remaining at 1×, paid members remaining at 2×, overlapping evidence never producing triple points, refunds, repeated invoices, migration replay, role restrictions and both Wallet payload formats. Mobile TypeScript, targeted ESLint and frozen Deno checking passed.

Production verified exactly one granted account at 2× and 51 other active accounts at 1×. The combined 2,665 existing points and original standard ledger row remained intact. Matt's balance remained zero and his membership ID was unchanged. The Wallet backend is version 11. The existing iPhone and Android channels and main branch web workflow distribute the corresponding app changes. Exact update IDs, delivered bundle hashes and Pages results are retained in `work/rewards-owner-double-2026-10-24/`.

Google Wallet public saving remains blocked pending the existing support case and publishing approval. No payment, additional fee, store binary submission, notification email or synthetic financial smoke test was introduced. Actual new phone display and future eligible invoice bonuses remain observations distinct from these local and backend checks.
