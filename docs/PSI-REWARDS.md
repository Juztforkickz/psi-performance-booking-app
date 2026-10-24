# PSI Rewards

Approved release, 24 October 2026: Matt approved rollout of the reviewed 1× / 2× system. The backend and existing iPhone and Android update channels have been released, with audited bonus activation at 4:45 pm Melbourne. The web app uses the existing main branch Pages workflow. See [Rewards release](REWARDS-RELEASE-2026-10-24.md) for deployment details, preserved balances and remaining device observations. The standard earning and redemption economics below remain unchanged. The earlier implementation and screen reports record the reviewed checkpoints.

Approved by Matt on 22 October 2026. The home page rewards square and customer card use the approved silver and ice blue artwork with live account balances.

## Rules

Each whole AUD 1 of eligible paid invoice spending earns one point. Each point is worth one cent of workshop credit, so 1,000 points equals AUD 10. Amounts include GST, after invoice discounts and applied credit notes. Card processing fees do not reduce customer points. Fractional dollars are rounded down per invoice. No historical batch award is included. Earning begins for invoices fully paid on or after the configured Melbourne launch date.

All active verified customer accounts can use rewards, independent of Performance+. Matt's permanent complimentary Performance+ protection is unchanged. No expiry, cash withdrawal, referral bonus or membership tier has been introduced.

## Invoice sync

The existing signed Xero webhook separately queues each invoice for rewards. Its established PDF import queue and owner waiting decisions remain intact. A scheduled worker fetches the current invoice from the existing encrypted Xero connection and validates its verified contact to customer link. Names, registration and email strings do not establish reward ownership.

Only fully paid AUD sales invoices earn points. A deposit alone earns nothing; its allocation and the final payment count toward one fully paid invoice reward. Cash and bank transfers follow the invoice's verified Xero payment state. Missing links, inconsistent payment totals, unexplained credits and ownership changes wait for review. Xero does not identify an unmatched bank deposit as an invoice payment until it is recorded or matched there.

An atomic ledger stores the difference from the previous invoice snapshot. Invoice versions and locks prevent repeated or concurrent updates from adding duplicate rewards. Invoice payment reversals and applied credit notes update the award. Refunds or chargebacks must also be reflected in Xero; an unrelated Stripe refund is not assumed to have changed an invoice. A reversal can leave a negative underlying points balance when credit has already been used. The customer sees no spendable credit until subsequent earnings cover that adjustment, with the changes retained in history.

## Using workshop credit

Staff can view the customer's available credit by scanning their QR code with the workshop iPhone Camera app and opening its protected staff link. Staff access and MFA are required. The code identifies a membership and is not an authentication credential or authority to alter balances.

To apply credit, staff add an explicit negative Xero invoice line whose description starts with `PSI Rewards credit`. Its total including tax is the credit being used. The sync deducts that amount once from existing points, before awarding any points earned by that invoice. It rejects a redemption exceeding the existing balance. This release reads those invoice lines; it does not create discounts, payments, credit notes, bank entries or reconciliation entries in Xero. Staff must check available credit before editing the invoice. Voiding or removing an invoiced rewards credit restores the corresponding points.

## Wallet cards

The in app customer card displays their name, points, available workshop credit and QR code. The Apple pass uses the same membership and balance; Google Wallet uses a loyalty object. Platform layouts control the final arrangement inside each Wallet. The approved concept is translated into those supported fields rather than promising an identical unrestricted artwork layout.

Apple downloads require a valid Pass Type ID certificate, its matching key, WWDR chain, Team ID and pass identifier. Google downloads require a Wallet issuer, dedicated service account access and an approved `psi_rewards_v1` loyalty class. Readiness is checked by the service. Missing setup produces a clear in app notice and no unsigned or fake pass is offered.

Server secret names:

* `REWARDS_APPLE_PASS_TYPE_ID`
* `REWARDS_APPLE_TEAM_ID`
* `REWARDS_APPLE_CERT_PEM`
* `REWARDS_APPLE_KEY_PEM`
* `REWARDS_APPLE_WWDR_PEM`
* `REWARDS_APPLE_KEY_PASSWORD`, only if applicable
* `REWARDS_GOOGLE_ISSUER_ID`
* `REWARDS_GOOGLE_SERVICE_ACCOUNT`
* `REWARDS_GOOGLE_PUBLISHING_ENABLED`, enabled only after issuer publishing access is verified

Apple's protocol endpoints validate a separate private pass authentication token. Temporary initial download links expire after two minutes. Device push tokens and signing material are never returned in customer summaries. Google pass updates and Apple update pushes run from a separate scheduler. Actual provider issuance, phone installation and balance refresh must be verified after setup; source checks alone do not establish those outcomes.

The Wallet function intentionally uses its own authentication with gateway JWT verification off, because Apple Wallet requests cannot supply a Supabase JWT. Customer operations still validate a real Supabase user; staff operations additionally require active staff and MFA. Background operations require the existing scheduler credential. Financial ledger RPCs remain backend only. Customers have read access only to their own balance and history.

## Release verification

Meaningful tests cover paid totals, advance deposits, credits, corrections, repeated and stale snapshots, insufficient balance, owner identity changes, customer isolation, anonymous denial, staff MFA and Wallet token separation. Local layout fixtures use fictional identities and balances. No test credits are written to real customer accounts. A live worker smoke invocation was held by automatic approval review and was not retried through another route.

The first release passed 163 isolated checks, mobile type checking, targeted lint and Deno checking. GitHub Pages published commit `3bacbec5bc0a6992f2a8dd58fd23da0484290450`. The iPhone update is `01a160e9-46db-7542-b6e3-5fbab99198f2`; the Android update is `01a160ec-921b-7d68-a63a-169f61ac8e88`. Both public feeds delivered bundles matching the tested local exports. Wallet web routes include directory aliases so both the ordinary app links and the trailing slash links in cards and QR codes load on GitHub Pages.

After Matt's specific approval, Apple signing was configured for `pass.au.com.psiperformance.rewards` on team `6HP5M94822`. A local fictional package passed CMS signature, authenticated manifest digest, asset digest and certificate chain verification using the Apple issued certificate. Matt confirmed on 22 October that the card added to Apple Wallet. A matching Apple device registration was also verified. A real customer's subsequent balance refresh remains a separate verification step. Signing secrets stay in the backend and a restricted local recovery directory, outside Git.

Google's dedicated service account, issuer Developer access, protected server secrets and Wallet API were configured after Matt's separate access and terms approvals. A read only provider check returned HTTP 200 for `3388000000023221786.psi_rewards_v1`, with `reviewStatus: approved`. Both supported approved enum spellings are accepted; draft, missing and pending review statuses remain blocked by regression tests. The issuer remains in demo mode, with `REWARDS_GOOGLE_PUBLISHING_ENABLED=false`. Google business identity setup returned “Couldn’t pull up your info” after refresh and also when Matt tried personally. Business identity verification and Google's publishing approval remain outstanding, so customer Google Wallet downloads remain unavailable. The extra draft class with a repeated issuer prefix is unused and was never published or issued.

Read only production checks confirmed both schedulers running. Two naturally received invoice events were held with `verified_rewards_customer_required`; no points were assigned to an unverified identity. Matt subsequently confirmed Apple Wallet installation, supported by one registered device for his account. No real paid invoice award or subsequent Wallet balance refresh has yet been observed. Do not treat the scheduler checks as an end to end financial test.

With Matt's explicit sending approval, a request was submitted through Google Wallet Console Support on 22 October. Google confirmed submission and said a specialist would respond by email, with review taking up to 36 hours. No case number was displayed. The request contains the business identifiers and exact setup error, excludes customer data and credentials, and explicitly excludes charges, billing changes and payment methods. Do not submit duplicate requests. Google's business identity and publishing approval remain outstanding.

Wallet readiness notices follow the current device's platform, so Android continues to show setup pending while Apple signing is already configured. The in app balance and card remain usable independently.

Matt clarified that AUD 1,000 spent must equal AUD 10 of PSI credit, which is the approved rate above. No paid Wallet provider, extra Apple membership, Google subscription or hosting plan upgrade is authorised. Existing app developer membership and hosting allowances remain relevant; stop any step requiring an additional charge. On 22 October the existing Supabase organisation showed an egress grace period ending 24 October, with current data transfer of 13.907 GB against a 5 GB free allowance. No billing change was made.

The Rewards screen now displays `Connected to Apple Wallet` only after the service confirms an Apple device registration for the authenticated customer. This is an account connection status, not proof of installation on the current device. Opening or cancelling the Wallet sheet alone cannot produce a success confirmation. The summary returns only a boolean connection status, or unknown on a failed check, and never device identifiers or push tokens. The existing foreground refresh checks the status when the customer returns to PSI.
