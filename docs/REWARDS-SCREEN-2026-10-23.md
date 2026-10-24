# PSI Rewards screen and Wallet status

24 October update: Matt approved implementation of the financial plan, with results required before rollout. The financial system and extended invoice history are now implemented locally and verified. See [Double points implementation review](REWARDS-DOUBLE-POINTS-2026-10-24.md). The earlier report below records the first screen checkpoint; its pending financial plan approval statements are superseded by this update. Release approval remains required.

Implemented locally on 23 October 2026. No web push, native OTA, App Store release, Google Play release, Edge Function deployment or production SQL migration has been published for this change.

## Customer screen

The existing Rewards screen retains PSI branding, the workshop background, rounded navigation, live AUD credit, points, customer QR code and membership number. Two compact cards compare PSI Free with 1× points and paid Performance+ with 2× points. The verified current earning rate has the ice blue highlight.

Free, complimentary trial, expired and permanent complimentary memberships receive standard earning. Verified paid monthly or annual membership can show `2× POINTS ACTIVE` only after the separate financial earning policy is enabled and paid RevenueCat period evidence is present. Trial or lifetime premium access is not proof of a paid subscription. Existing paid vehicle history imports do not qualify.

Free and trial customers have an `UNLOCK 2× POINTS` link to the existing Performance+ screen when the bonus policy is available. Before financial activation, the link is disabled with a clear availability notice. A paid customer whose earning proof is unavailable receives a refresh action rather than another purchase prompt. Unknown status never claims an active paid rate. The protected permanent owner retains permanent premium access and standard Rewards, without an upsell to repurchase.

The app continues reading actual Supabase balances. No demonstration amount or customer identity was inserted into app code. Read only owner data was used for the private visual preview. Other layout and unit fixtures use clearly labelled fictional customers and never create production points.

## Backend and Wallet integration

Pending migration `20261023120145_rewards_earning_status_wallet_refresh.sql` adds a service only status reader and Wallet metadata refresh. It does not create or activate the separately proposed financial bonus system. The reader defaults to standard earning when the financial policy or paid period evidence is missing. It requires an enabled policy, current production paid period, positive payment evidence, purchased ownership, verified event identity and no effective invalidation. The Edge Function also validates the configured Apple or Google product before returning a double rate. Customer supplied multipliers, IDs and SDK JSON cannot grant it.

Existing membership IDs, Apple pass serial numbers, Google object IDs and QR values remain stable. Both formats retain the current points to credit conversion of 1,000 points to AUD 10. The earning rate is added to supported pass fields. An expired paid benefit does not expire the free loyalty card or remove its points.

The metadata refresh locks the existing account and Wallet member, changes only the revision and update metadata when status changes, and returns one consistent balance/revision snapshot. It never awards or redeems points. Repeated identical status checks do not bump the revision. A status refresh outage does not hide a verified balance.

The existing five minute Wallet scheduler is reused. Due status checks, subscription verification changes and known deadlines can refresh a card even without an invoice update. Balance updates take priority over periodic checks. Google and Apple attempts are independent, so a failure on one provider does not prevent the other from updating. Successful revisions are acknowledged separately; failures remain eligible for retry.

The app refreshes on resume, browser focus, purchase verification, own subscription/balance events and foreground polling. A server based deadline removes a stale double indicator even while offline. Balance, history and redemption access remain available. Wallet status delivery still depends on the scheduled worker, provider availability and the device receiving its update; it cannot instantly recall an offline pass.

## Verification

Local verification includes:

60 targeted Node checks passed. The isolated database and pass signature checks below passed separately.

* Actual screen rendering for free, trial, paid, expired and permanent accounts, with native Wallet choices and upgrade navigation.
* Actual hook execution for expiry while open and offline, restart, renewal, resume, focus and subscription events, retaining existing points and history.
* Backend verification of identity, store product, environment, deadline, paid evidence and disabled policy handling.
* Endpoint ownership, anonymous denial, protected staff scan/MFA, legacy fallback, balance snapshot consistency and independent provider updates.
* Apple pass generation using the existing Apple issued certificate, CMS signature and authenticated manifest digest verification, without installing a fixture on a customer device.
* Google save/update request tests including stable object identity, actual credit conversion, duplicate insert conflict handling, paid rate expiry and publishing approval gates. No real Google membership was issued by these tests.
* Isolated PostgreSQL execution of the pending migration twice, all membership states, cancellation, renewal, invalidations, zero price/trial/sandbox rejection, service only permissions, stable memberships, unchanged balances and metadata idempotency.
* Mobile TypeScript, targeted ESLint, frozen Deno check and iPhone, Android and web exports.
* Actual component visual checks at 320, 390 and 768 pixels, with the existing ambient background and navigation. No horizontal overflow was found.

Private receipts and previews are under `work/rewards-screen-2026-10-23/`. Existing expiry repair and standard Rewards regression checks are retained. No live financial worker test, purchase, synthetic production credit or repeated expiry notification was performed.

## Release and operational requirements

The new screen and Wallet status changes are prepared, not live. On 24 October Matt approved using each payment's actual date for bonus eligibility, with points awarded only once the invoice is fully paid. Billing grace earns standard points until renewal payment is verified; existing premium access grace is unchanged. The remaining date precision and refund policies, complete financial implementation plan, activation and release still require approval. See the local review package `work/psi-rewards-performance-plus-plan-2026-10-23/PLAN.md`. Recording these decisions does not deploy or activate double points. This change cannot cause 2× points to be advertised as active while that backend policy is disabled.

Apple signing remains configured and the existing account has a registered Apple device. A live new balance update with this unpublished build has not been observed on an iPhone.

Google's approved class was rechecked successfully through its API. Live public readiness remains `google=false`; publishing approval has not been newly verified. Outlook searches in the connected PSI mailbox found no new matching approval, and no connected browser was available for a fresh console check. The existing support request and monitoring remain in place. No publishing gate, fee restriction or account approval was bypassed.

Real Android save and balance update verification requires Google public publishing approval and an approved deployment. Real iPhone and Android checks for this new build remain release validation steps. No promise of complete live Wallet readiness is made from local payload tests.

No additional paid service, developer membership, billing detail, infrastructure plan or point redemption value was changed. The existing three held standard Rewards invoice jobs are separate launch prerequisites from the financial review plan and were not retried here.
