# PSI Rewards release, 24 October 2026

Matt approved rollout with “Make the change please” after reviewing the 1× and 2× implementation and test results. This supersedes the earlier hold on deploying that reviewed implementation. Source checkpoint: `cc80feb4899bdb02f6fc60cf22d352cecb9449df`.

## Customer behaviour

All PSI customers retain free Rewards membership, earning one point per whole eligible AUD 1. Verified paid Performance+ members earn an additional point per qualifying AUD 1. Complimentary trials, permanent complimentary access and expired subscriptions remain at 1×. There is no additional Rewards subscription. Existing points, membership IDs, QR codes and redemption rights remain intact. The conversion remains 1,000 points = AUD 10 workshop credit.

Bonus eligibility uses each payment's actual receipt date and verified paid entitlement, with awards posted only after the invoice is fully paid. Unpaid grace earns standard points. Cancellation retains 2× until the paid period ends. Refunds and adjustments append corrections. No older payments are retrospectively doubled. Date only receipts overlapping an entitlement or activation boundary remain pending for bonus review while standard points continue.

## Production release

Both reviewed migrations were applied successfully through the connected Supabase project `lslhfrujyuqcavsnugfx`: earning status and Wallet refresh, then verified paid bonuses. The schema contract matched after installation. Activation was recorded through the private release function for **24 October 2026 at 4:45 pm Melbourne**, equivalent to `2026-10-24T05:45:00Z`, using Matt's approval and source checkpoint as the audit reference.

Four deployed functions were downloaded again and their source files matched the reviewed local files:

| Function | Version | Gateway JWT verification |
| --- | ---: | --- |
| process-rewards-invoices | 5 | Enabled |
| rewards-wallet | 9 | Existing protocol authentication retained |
| sync-performance-subscription | 20 | Enabled |
| performance-subscription-webhook | 21 | Existing provider authentication retained |

The existing invoice and Wallet schedules remain active every five minutes. No extra scheduler, fee, billing change, notification campaign or synthetic points were introduced. Existing held invoices were preserved without guessing customer ownership or resetting their attempts.

Live product configuration SHA256 values matched the existing Apple monthly and annual product IDs and Google monthly and annual base plan IDs. Sandbox entitlement remained excluded. Google Wallet public downloads remained disabled. Apple signing remained configured.

## Phone and web distribution

The existing phone channels received JavaScript updates, with no new App Store or Play Store binary submission:

| Platform | Channel | Update ID |
| --- | --- | --- |
| iPhone | app-store-release | `01a16c6e-7ba8-766e-b65f-6c44f78a5380` |
| Android | android-play-internal | `01a16c6e-c52c-76ef-b3d3-68c347848136` |

The web app uses the existing main branch GitHub Pages workflow. Its deployment result and delivered bundle checks are recorded in the private release receipts after this checkpoint is pushed. Physical phone installation of this update is separate from publication and feed verification.

## Verification and preserved information

All 232 automated checks passed again, with zero failures or skipped checks. Mobile TypeScript passed. The previously reviewed iPhone, Android and web exports and security scenarios remain documented in the implementation review. New release exports use each platform's existing live configuration.

Production preflight found 52 active customer accounts: 11 active complimentary trials, one permanent complimentary account, 22 expired subscription accounts and 18 other free accounts. There were no currently active paid subscriptions and no incorrectly active expired subscriptions. Every current customer correctly remained at 1×. Matt's permanent complimentary premium access remained protected.

Five existing Rewards accounts held a combined 2,665 points, with one standard ledger award for INV-1679. Installation preserved those points, that ledger row and all five membership identities. Opening balances were audited without rewriting the original ledger. Production checks confirmed bonus ledger RLS, no anonymous ledger access, no customer access to the private policy, no customer financial writer permission and no service role activation permission.

Unauthenticated requests to the Rewards summary, invoice worker, subscription sync and provider webhook were rejected with HTTP 401. The public Wallet health endpoint confirmed Apple configured and Google public downloads disabled. Security advisors showed no new warnings compared with preflight; new private tables intentionally have no customer policies.

## Remaining observations

The first genuine paid subscription bonus, actual renewed paid entitlement and new Wallet balance display on physical phones remain live observations. No purchase, fake provider event, synthetic credit or previously rejected financial smoke test was used to imitate them. Provider fixtures and local PostgreSQL tests do not establish those physical outcomes.

Google's business identity error and publishing approval remain in existing support case 05714410. This Rewards release does not bypass that gate. A real Android Wallet save is still pending. The monitoring task must preserve this release while continuing only its outstanding Google work.

Private audit and recovery material: `work/rewards-release-2026-10-24/`, including prior deployed function source, original account and ledger snapshots, test logs, platform export and publication logs, source verification and final production checks. Existing distinct customer data and unrelated untracked files remain unchanged.
