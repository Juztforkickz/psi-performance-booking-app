# Payment and entity decision

Updated 12 September 2026. No live payment or subscription income is enabled.

## Current business separation

| Activity | Intended supplier | Current payment state |
|---|---|---|
| Workshop servicing, repairs, dyno work and booking deposits | **PSI Performance**, the owner's existing sole-trader business | Stripe and bank-transfer workflows are built but have no verified payout configuration and remain disabled |
| Performance+ digital subscriptions bought through the App Store or Google Play | **PSI PERFORMANCE PTY LTD**, the registered app publisher | Apple products are configured but not submitted; Google Play products do not yet exist; neither store has a verified payout route |
| Xero invoice import | The connected PSI Xero organisation | Connected for records and automation; Xero is not a payment processor |

The payment card or bank account used to pay an establishment cost does not by
itself decide which entity incurred that cost. Keep the Apple, Google, RevenueCat
and development receipts and ask the accountant how each payment should be
recorded, including any reimbursement or owner/director loan treatment.

## Accountant decisions required before activation

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

1. Configure the sole-trader Stripe account only for workshop deposits, add the
   verified payout account and register the signed test webhook.
2. Pass deposit success, failure, expiry, replay, refund, receipt-email and
   payment-confirmed Calendar tests before enabling live workshop charging.
3. Complete the Apple Paid Apps Agreement, tax and banking information for the
   confirmed subscription supplier, then pass a signed TestFlight purchase and
   restore test.
4. Finish Google organisation and phone verification, create the Play app and
   subscriptions, connect it to RevenueCat and pass Play licence-tester checks.
5. Add a web provider only if the accountant and PSI select one of the web
   subscription options above. Test it in the provider sandbox before exposing
   any purchase route.

## Verified checkpoint

- Production payment ledger: zero attempts and zero payment events.
- RevenueCat: Apple app and offerings configured; zero purchases and A$0 revenue.
- Google Play: organisation account created; organisation and phone verification
  remain incomplete; no Play app or subscription products exist.
- Apple: no verified active payout route is recorded; the latest release record
  shows the Paid Apps Agreement, tax, banking and final sandbox purchase tests
  remain incomplete.

References:

- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple receiving payments: https://developer.apple.com/help/app-store-connect/getting-paid/overview-of-receiving-payments
- Google Play payments policy: https://support.google.com/googleplay/android-developer/answer/10281818
- RevenueCat Web overview: https://www.revenuecat.com/docs/web/overview
- RevenueCat Paddle integration: https://www.revenuecat.com/docs/web/integrations/paddle

