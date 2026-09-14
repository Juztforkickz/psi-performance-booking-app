# Payment and GST checkpoint — 14 September 2026

This record corrects the launch checklist after the controlled Stripe sandbox
acceptance had already completed.

## Payment decision

- The live PSI workshop Stripe account, signed webhook and encrypted booking
  payment configuration are active.
- The controlled sandbox checkout acceptance is complete and is sufficient to
  prove the provider contract.
- PSI will not make a live self-payment and refund solely to repeat the sandbox
  proof. Moving money through PSI-controlled accounts would add accounting noise
  without providing a materially better technical test.
- No live customer payment has been taken. The first genuine customer payment
  must be observed through Checkout, signed webhook verification, receipt,
  booking confirmation and Google Calendar creation. Checkout must be paused if
  any stage fails.
- Store subscription purchase and restore testing is a separate Apple/Google/
  RevenueCat release test and remains outstanding.

## GST evidence

The owner supplied ATO portal evidence showing **PSI PERFORMANCE PTY LTD** has a
current Goods and Services Tax registration effective **1 September 2026**, with
**quarterly** lodgment.

The company ABN and source screenshot are deliberately not stored in this
public repository. This evidence applies to the company only. It does not prove
the separate PSI Performance sole trader's GST status and does not decide how
workshop and subscription receipts or establishment costs are allocated between
the two entities.

## External portal follow-up

- Apple App Store Connect accepted the company ABN/GST registration document on
  14 September 2026 and shows the tax form as **Active**. The Paid Apps Agreement
  and nominated bank account are **Processing**; Apple advises that banking
  updates can take up to 24 hours.
- Add or verify the company tax details in Google Play after organisation
  verification unlocks the payments profile.
- Keep workshop deposits under the separately configured sole-trader Stripe,
  Xero and payout route unless PSI's accountant directs a change.
