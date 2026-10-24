# PSI Rewards, 1× and 2× implementation review

Release update: Matt subsequently approved rollout with “Make the change please”. See [Rewards release, 24 October](REWARDS-RELEASE-2026-10-24.md). The review below records the state and evidence before that release approval.

24 October 2026. Matt approved the complete financial plan and requested implementation and testing before rollout. The implementation is prepared locally. Nothing has been pushed, deployed, activated or published. Earlier checkpoints: screen `a2033e4`, payment date and grace decisions `17c96cf`.

## Customer rules

| Customer | Earning rate |
| --- | --- |
| PSI Free | 1 point per whole AUD 1 |
| Complimentary 14 day trial | Standard 1× |
| Verified paid monthly or annual Performance+ | 2× during verified paid access |
| Renewal cancelled, paid period still valid | 2× until paid expiry |
| Expired paid period or unpaid billing grace | Standard 1× until renewal payment is verified |
| Permanent complimentary access, including Matt | Standard 1× unless separately authorised |
| Historical vehicle import purchase | Does not qualify for double points |

Every customer keeps free Rewards membership, existing points, history, card and redemption access. **1,000 points = AUD 10 workshop credit** remains unchanged. No subscription price, extra fee, billing plan, point expiry or redemption threshold changes.

The original eligible spending calculation remains, including GST, discounts, applied credit notes and Rewards credit exclusions. Only fully paid AUD sales invoices award points. Each payment's original receipt date determines bonus eligibility, including deposits allocated later. Processing and allocation dates cannot substitute for receipt dates. Payments before the separately approved future activation time are not retrospectively doubled.

| Fully paid invoice example | Standard | Bonus | Total | Workshop credit |
| --- | ---: | ---: | ---: | ---: |
| AUD 1,000, Free or complimentary trial | 1,000 | 0 | 1,000 | AUD 10 |
| AUD 1,000 paid during verified paid access | 1,000 | 1,000 | 2,000 | AUD 20 |
| AUD 100 paid before paid access, AUD 900 during paid access | 1,000 | 900 | 1,900 | AUD 19 |

These are examples, not customer balances. The additional nominal workshop credit is AUD 10 per AUD 1,000 of fully qualifying spending. This measures credit issued, not cash profit or tax expense.

## Backend implementation

RevenueCat events pass the existing server authorization check and enter a minimal durable evidence inbox. Fresh server subscriber verification binds paid evidence to the PSI identity, configured store and product. Customer flags, SDK JSON, arbitrary products, sandbox purchases, family sharing and zero price trials cannot grant double points. Historical events require already verified transaction lineage; ambiguous evidence remains pending.

Paid intervals and invalidations remain immutable. Cancellation retains the paid interval. Ordinary expiry does not rewrite past earning. Verified renewal restores newly eligible spending. Membership refunds and verified shortening stop later eligibility while preserving legitimate earlier points. A verified refund reversal can restore future earning using previous positive payment proof, preserving the refunded gap. Transfers stop future bonuses for the former identity pending review.

Xero payment, prepayment and overpayment readers validate original receipt dates, invoice and contact identity, currency, allocation amounts and capacity. Names, email strings and registrations cannot establish ownership. Unallocated workshop credits reduce original contributions proportionately, using integer cents and deterministic rounding. A date only receipt qualifies automatically only when its whole Melbourne calendar day is covered by verified paid access and activation. Ambiguous bonuses wait for review; standard points continue.

One SQL coordinator atomically applies standard points, bonus differences, redemptions, states, balance and audit evidence. Existing standard ledger rows and balances remain intact. Invoice, account, receipt and evidence locks protect calculations. A retry cannot award again. Late paid proof can add its bonus once without a new Xero invoice version. Failed bonus processing cannot leave a partial standard award. Refunds append corrections, including negative balances after previously redeemed credit.

The original invoice worker is fenced after activation. The new worker and existing five minute schedule retry pending provider evidence and bonus failures. The implementation reuses the existing invoice queue instead of adding the proposed separate bonus queue, retaining one lease and bounded retry path. No new paid infrastructure or scheduler is required.

Own customer RLS protects bonus history. Private evidence, policy controls and financial RPCs are unavailable to customers and anonymous roles. Staff financial reporting retains the staff and MFA boundary. Opening balances are audited separately from issued points. The policy installs disabled, requires an explicit future activation and release reference, checks active worker leases and rejects unexpected schema drift before replay. Pausing future earning preserves prior credit and refund handling.

## App and Wallet

Rewards preserves the actual balance, credit, membership ID and QR. It displays the 1× and 2× comparison, verified current rate, upgrade option when available, and standard, bonus and total points per invoice. Combined ledger history can be paged without losing older bonus or redemption records. Performance+ also shows the verified comparison and benefit.

Existing lifecycle refresh covers resume, restart, subscription changes, realtime balance updates and earning deadlines. Expired or stale offline evidence cannot keep advertising active double points. History resets with customer identity changes. Branding, themes, rounded navigation, existing checkout, free features and premium file guards remain intact.

Apple and Google retain the same membership and QR. Account revisions update the combined balance and supported earning labels. Provider tests preserve independent update success and failure handling. No membership, pass, test points or customer notification was issued in production for this task.

## Verification

**232 automated tests passed, zero failures, zero skipped.** This includes 28 isolated PostgreSQL financial and permission scenarios. One allocation test also checks 100 varied instalment and refund totals.

| Verification | Result |
| --- | --- |
| Free, trial, paid, expired, permanent and renewed cases | Passed |
| Cancellation within paid period and billing grace | Passed |
| Mixed instalments, original deposits, activation and late processing | Passed |
| Workshop refunds, invoice voids, negative balances and redemption limits | Passed |
| Membership refund, refund reversal and shortened paid period | Passed |
| Repeated or stale Xero versions, duplicate receipts and capacity | Passed |
| Failure after standard processing | All writes rolled back, replay passed |
| Multiplier manipulation, anonymous calls, ownership and RLS | Passed |
| Provider and invoice retry paths | Passed |
| Opening balances and full ledger reconciliation | Passed |
| Migration replay and deliberate permission drift | Safe replay passed, drift rejected |
| History pagination across 34 rows | No duplicate or missing rows |
| Melbourne daylight saving | Both 23 hour and 25 hour days passed |
| Open app expiry, resume, restart and offline scenarios | Passed |
| Performance+ access, file guards and Xero import regression | Passed |
| Apple and Google generation and update tests | Passed with isolated provider fixtures |
| Mobile TypeScript and targeted ESLint | Passed |
| Four backend entry points, frozen Deno type checking | Passed |
| iPhone, Android and web exports | Passed, unpublished |
| Actual component previews at 320, 390 and 768 pixels | No horizontal overflow |

Tests use fictional identities and isolated PostgreSQL through PGlite. Provider HTTP responses and worker authentication use controlled fixtures. Advisory lock paths and transaction rollback are exercised locally. Multi process production contention and a genuine paid subscription transaction remain release observation checks. A fixture or export is not a real device purchase, invoice award or live Wallet refresh.

Repeatable test command, with `PSI_PGLITE_MODULE` set to the existing local module's file URL:

```powershell
node --test supabase/tests/run-rewards-bonus.mjs tests/rewards*.test.mjs tests/performance*.test.mjs tests/xero*.test.mjs
```

Private logs, export hashes and previews: `work/rewards-double-2026-10-24/`. Tracked test sources include `supabase/tests/run-rewards-bonus.mjs`, `tests/rewards-bonus-providers.test.mjs`, `tests/rewards-worker-runtime.test.mjs` and existing regression suites.

## Production and release requirements

Read only checks on 24 October at 11:04 am Melbourne found four Rewards accounts, zero ledger rows, zero points, zero invoice states and three held jobs. The bonus schema is absent. There are zero incorrectly active expired subscription rows and one protected permanent complimentary account. Production financial data was not changed.

Two held jobs last recorded `xero_refresh_busy`; one recorded `verified_rewards_customer_required`, all at the existing 30 attempt limit. The connection was unlocked at inspection, revision 3514. This does not establish every earlier failure's cause. The new reader briefly retries genuine token contention and distinguishes other failures. No held job was reset or invoked, and no customer was guessed. A controlled retry and verified staff customer match remain rollout prerequisites.

Google public Wallet publishing and a real Android save remain unverified. Class approval alone does not enable publishing. The existing monitor and no additional fee restrictions remain. Real updated iPhone and Android Wallet balance checks require an approved release and genuine eligible transaction. No synthetic production credit will simulate them.

Before rollout, obtain Matt's explicit release approval, verify live store allowlists and counts, review the three held jobs, and choose a future Melbourne activation time. Apply both pending migrations, deploy compatible functions and approved app channels with bonuses disabled, verify permissions and standard behaviour, then activate only through the approved release procedure. An App Store, Play Store or native OTA release is not authorised by this implementation approval alone.

Executable migration: `supabase/migrations/20261023234403_rewards_verified_paid_bonus.sql`, following unpublished status and Wallet migration `20261023120145_rewards_earning_status_wallet_refresh.sql`. Neither is applied in production.

Provider contracts checked against [RevenueCat events](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields), [RevenueCat subscriber responses](https://www.revenuecat.com/docs/api-v1/customer-info-model), [Xero's API schema](https://github.com/XeroAPI/Xero-OpenAPI/blob/master/xero_accounting.yaml) and [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
