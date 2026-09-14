# Payment and entity decision

Updated 14 September 2026. The workshop payment path is configured for live
operation, but no live customer payment has been taken. Store subscription
income is not yet enabled.

## Current business separation

| Activity | Intended supplier | Current payment state |
|---|---|---|
| Workshop servicing, repairs, dyno work and booking deposits | **PSI Performance**, the owner's existing sole-trader business | The live Stripe account, signed webhook, encrypted configuration and nominated workshop payout route are configured; no live customer payment has been taken |
| Performance+ digital subscriptions bought through the App Store or Google Play | **PSI PERFORMANCE PTY LTD**, the registered app publisher | Apple products are configured but not submitted; Google Play products do not yet exist; neither store has a verified payout route |
| Xero invoice import | The connected PSI Xero organisation | Connected for records and automation; Xero is not a payment processor |

The payment card or bank account used to pay an establishment cost does not by
itself decide which entity incurred that cost. Keep the Apple, Google, RevenueCat
and development receipts and ask the accountant how each payment should be
recorded, including any reimbursement or owner/director loan treatment.

## Accountant decisions required before activation

Owner-supplied ATO evidence confirms **PSI PERFORMANCE PTY LTD** is registered
for GST from 1 September 2026 with quarterly lodgment. The source screenshot and
company ABN are not stored in this public repository. This confirms the
company's registration only; it does not establish the separate sole trader's
GST status or decide the allocation of receipts and costs between the entities.

1. Confirm that PSI Performance workshop deposits and workshop income remain in
   the sole-trader business and use its ABN, GST status and bank account.
2. Confirm whether Performance+ subscription income should be earned by PSI
   PERFORMANCE PTY LTD, consistent with the company-owned Apple and Google
   publisher accounts.
3. Confirm how Apple and Google establishment costs paid from the existing PSI
   sole-trader account should be recorded between the sole trader and company.
4. Confirm the supplier name, ABN/ACN, GST and receipt wording required for each
   payment channel.
5. Confirm whether a web subscription channel should use the company or the
   sole trader before creating its merchant account.

## Subscription sales options

### Native App Store and Google Play purchases

This is the current implementation. Apple or Google processes the customer's
purchase, RevenueCat verifies it against the authenticated PSI customer UUID,
and the server unlocks Performance+ for that account across supported devices.
The relevant store's paid agreement, tax information and payout bank account
must be completed before sales can begin.

### RevenueCat Web with Paddle Billing

Paddle can act as merchant of record for a hosted web subscription checkout.
Paddle operates the subscription and customer receipts, and RevenueCat maps the
verified web purchase to the same Performance+ entitlement used by the mobile
apps. The PSI app is not a reader app. Any link or wording inside the Apple or
Google build must therefore be reviewed against the applicable storefront rules
before release. Customers may be directed to the website through permitted
outside-app channels while the mobile app recognises their verified entitlement.

This option reduces payment, receipt, chargeback and indirect-tax administration,
but PSI must still nominate and account for the legal entity receiving Paddle's
payouts. It has not been configured.

### RevenueCat Web with Stripe Billing

Stripe can process a hosted web subscription and RevenueCat can unlock the same
mobile entitlement. PSI remains responsible for the selected Stripe merchant
entity, subscription administration and applicable tax configuration. It has
not been configured. If chosen, keep the subscription configuration separate
from the sole-trader Stripe setup used for workshop deposits.

## Activation order after the accountant responds

1. Keep the configured sole-trader Stripe account limited to workshop deposits
   and keep the signed live webhook and nominated payout route under review.
2. Retain the completed controlled sandbox checkout acceptance as the provider
   contract test. Do not make a live self-payment merely to move and refund
   money through PSI-controlled accounts. Observe and reconcile the first
   genuine customer payment, receipt, webhook and Calendar confirmation; pause
   checkout if any part fails.
3. Complete the Apple Paid Apps Agreement, tax and banking information for the
   confirmed subscription supplier, then pass a signed TestFlight purchase and
   restore test.
4. Finish Google organisation and phone verification, create the Play app and
   subscriptions, connect it to RevenueCat and pass Play licence-tester checks.
5. Add a web provider only if the accountant and PSI select one of the web
   subscription options above. Test it in the provider sandbox before exposing
   any purchase route.

## Verified checkpoint

- Production payment ledger: no completed payment events. One pending bank
  transfer attempt remains for separate test-data review; it is not evidence of
  a payment.
- Stripe: live workshop account and signed webhook are configured. The
  controlled sandbox acceptance is complete and is sufficient; no live
  self-payment/refund is required.
- RevenueCat: Apple app and offerings configured; zero purchases and A$0 revenue.
- Google Play: organisation account created; organisation and phone verification
  remain incomplete; no Play app or subscription products exist.
- Company tax: GST registration is confirmed effective 1 September 2026 with
  quarterly lodgment. Apple and Google portal tax-profile entry still needs
  confirmation after the relevant portal allows it.
- Apple: no verified active payout route is recorded; the latest release record
  shows the Paid Apps Agreement, tax, banking and signed TestFlight subscription
  purchase/restore acceptance remain incomplete.

References:

- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple receiving payments: https://developer.apple.com/help/app-store-connect/getting-paid/overview-of-receiving-payments
- Google Play payments policy: https://support.google.com/googleplay/android-developer/answer/10281818
- RevenueCat Web overview: https://www.revenuecat.com/docs/web/overview
- RevenueCat Paddle integration: https://www.revenuecat.com/docs/web/integrations/paddle
