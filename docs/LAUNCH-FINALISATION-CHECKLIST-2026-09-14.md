# PSI launch finalisation checklist — 14 September 2026

This is the current ordered launch checklist. It supersedes older summaries but
does not erase their evidence or rollback records.

## Completed foundation

- [x] Customer app, Matt's AAL2 staff portal, private accounts, vehicles,
  bookings, reports, files, service reminders and Performance+ access controls.
- [x] Cleaner portal and customer navigation, current website launch artwork and
  customer-cars-for-sale feature.
- [x] Booking approval, deposit-ready email/push wording and payment-confirmed
  Google Calendar automation with default Calendar visibility.
- [x] Live workshop Stripe account, encrypted configuration, signed webhook and
  controlled sandbox checkout acceptance. No live self-payment/refund is needed.
- [x] Xero read-only OAuth connection, token rotation, signed invoice webhook and
  owner-reviewed import queue.
- [x] Apple organisation membership, iPhone-only app record, TestFlight build 9,
  Apple subscription catalogue and RevenueCat Apple/webhook foundation.
- [x] PSI PERFORMANCE PTY LTD ABN/GST form Active in App Store Connect on 14
  September 2026. Private identifiers and evidence remain outside Git.
- [x] Public privacy, support and account-deletion pages and draft Apple/Google
  disclosures and store artwork.

## 1. Finish Apple business processing

- [ ] Recheck App Store Connect after Apple's stated processing window. Confirm
  the Paid Apps Agreement and `PSI Performance APP` bank account are **Active**.
- [ ] If either remains Processing after 24 hours, allow normal processing time;
  contact Apple only if the status remains unresolved or Apple requests evidence.
- [ ] Decide the initial storefront territory. Australia-only is the simplest
  launch. Complete the DSA trader declaration consistently with the selected EU
  availability; do not publish an unnecessary EU contact address.
- [ ] Consider the Apple Small Business Program separately for commission
  eligibility. It is useful but is not required to launch.

## 2. Complete Apple Performance+ acceptance

- [x] Produce and upload isolated iOS `performance-test` build 10 using the Apple
  sandbox backend and RevenueCat Apple SDK key. EAS build
  `13c4690e-9ac5-4664-bf59-8753d7775d30` and submission
  `fb6d05c0-5355-4292-beb2-e13036943acb` finished on 14 September 2026. Sandbox
  receipts remain disabled on the main customer backend.
- [ ] With a free synthetic customer, test monthly and annual purchase, cancelled
  purchase sheet, restore after reinstall/second device, renewal, plan change,
  expiry, billing retry/grace, refund and revocation.
- [ ] Verify RevenueCat, Supabase entitlement, premium file access and account
  switching for every result. Confirm another PSI account cannot inherit the
  receipt.
- [ ] Capture the real Performance+ purchase screen from that signed build for
  both subscription product review records.
- [ ] Attach monthly and annual products to the app version submitted for review.

## 3. Finish signed iPhone acceptance

- [ ] Test build 9 on the target iPhone in light and dark modes: authentication,
  session restore/sign-out, profile/vehicle persistence, photos, reports, PDF
  return navigation, bookings, reminders and account deletion request/cancel.
- [ ] Test notification opt-in/denial, foreground/background sound, red customer
  and blue PSI badges, badge clearing and safe deep links.
- [ ] Complete a two-customer private-data isolation check and disposable-account
  permanent deletion with a private test file.
- [ ] Recapture the final five iPhone store screenshots from the accepted signed
  binary and reconcile App Privacy, age rating, review login and review notes.

## 4. Finish Google Play and Android

- [ ] Complete Google Play organisation verification with the unedited company
  registration evidence, then complete the unlocked phone verification.
- [ ] Create/confirm the Play app for `com.psiperformance.booking` and upload the
  signed internal-test Android App Bundle.
- [ ] Create and activate A$9.99 monthly and A$99 annual Performance+ base plans.
- [ ] Create the Google Play service credentials, connect the Play app to
  RevenueCat and set the `goog_` public SDK key and exact Google product allowlist
  only in the intended Android purchase-test environment.
- [ ] Run the Android physical-device checklist: authentication, private data and
  files, booking/calendar boundary, notifications/sound/badges/deep links,
  purchase/restore/renewal/cancellation/expiry/refund and accessibility.
- [ ] Upload final Android screenshots and feature graphic; complete Data safety,
  content rating, target audience, app access and account-deletion declarations.

## 5. Finish the workshop-PC file automation

- [ ] Complete the importer installation on the workshop computer and use the
  dedicated `C:\PSI Uploads` root.
- [ ] Download one verified job's `psi-job.json` manifest from the AAL2 portal.
- [ ] Create/use `before`, `progress`, `after`, `dyno`, `invoices` and `documents`
  subfolders and run `--prepare-only` first.
- [ ] Check resized images, thumbnails and removed GPS metadata while retaining
  originals. Then upload synthetic files and confirm they persist under the
  correct customer, vehicle and job and remain inaccessible to another customer.
- [ ] Enable watch mode only after that controlled upload passes. Staff OTP and
  authenticator verification remain local to the workshop computer.

## 6. Complete Xero and workshop-payment acceptance

- [ ] Use one controlled PSI Xero invoice whose Reference exactly matches a PSI
  job reference. Confirm it enters the review queue, matches the correct customer
  and vehicle, imports its PDF privately and never guesses an ambiguous match.
- [ ] Confirm the service completion creates the correct 6- or 12-month reminder
  from the completed service date and queues the one-month-before prompt.
- [ ] Keep the completed Stripe sandbox result as the technical payment proof.
  Monitor the first genuine customer deposit through Checkout, signed webhook,
  receipt, booking confirmation and Google Calendar creation; pause checkout if
  any stage fails.
- [ ] Test ordinary bank transfer with an exact PSI reference and AAL2 cleared-
  statement confirmation. Customers must never self-confirm a transfer.

## 7. Business, recovery and release approval

- [ ] Obtain the accountant's written confirmation for the sole-trader workshop
  deposits, company Performance+ subscriptions, GST/receipt wording, refunds and
  allocation of Apple/Google setup costs already paid.
- [ ] Upgrade the production Supabase plan before real customer onboarding,
  confirm scheduled backup retention and complete a separate restore rehearsal.
- [ ] Reconfirm the ten Trusted Partner listings and contact details immediately
  before submission.
- [ ] Submit the accepted iPhone build and its two subscriptions for Apple review;
  answer review questions and release manually after approval.
- [ ] Complete Google Play internal testing and required testing period, then
  submit the accepted Android release.
- [ ] Start the external pilot with a small approved customer group, monitor Auth,
  email, push, storage, Xero, Stripe, RevenueCat and Calendar logs, then open wider
  onboarding only after the pilot has no unresolved failures.

## Decisions that do not need repeating

- Do not perform a live PSI self-payment/refund to retest Stripe.
- Workshop deposits use the sole-trader PSI Performance payment route.
- Native Performance+ proceeds use the company Apple/Google agreements and their
  nominated app-payout account.
- Xero remains read-only and ambiguous invoice matches require Matt's review.
- The first Apple release is iPhone-only; iPad work is deferred.
- The initial launch may be restricted to Australia; overseas distribution can
  be added later after its legal and support requirements are reviewed.
