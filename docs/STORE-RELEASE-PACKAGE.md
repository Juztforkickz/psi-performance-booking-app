# PSI Performance store release package

Status: metadata and disclosure draft, 10 September 2026. Do not submit until the
signed release build and final owner/legal checks are complete.

## App identity

- App name: **PSI Performance**
- Installed Home Screen label: **PSI**
- Bundle/application ID: `com.psiperformance.booking`
- Apple Developer organisation: **PSI PERFORMANCE PTY LTD** — active 29 August 2026
- D-U-N-S status: **Active D&B record confirmed by the owner on 29 August 2026**
- Company ACN: **175 164 626** — owner-confirmed; recheck against current ASIC documentation during enrolment
- Company ABN: **98 175 164 626** — owner-confirmed; recheck against current ABR documentation during enrolment
- Public workshop supplier wording: **PSI Performance Garage**
- Entity split: **PSI PERFORMANCE PTY LTD** owns/publishes the apps and supplies
  Performance+ digital subscriptions; the owner's sole-trader business **PSI
  Performance Garage** supplies workshop services and accepts workshop deposits.
- Primary category: **Business**
- Secondary/category description: **Automotive customer and workshop services**
- First Apple release devices: **iPhone only**
- Price: **Free**
- Paid digital products/subscriptions: **Optional PSI Performance+ subscription
  at A$9.99 monthly or A$99 annually**
- Store subscription proceeds: company App Store/Google Play agreements and
  company tax/accounting identity. A destination bank account does not change
  the contractual supplier. Confirm the final payout account and inter-entity
  treatment with PSI's accountant before paid activation.
- Workshop deposits and invoices: sole-trader Stripe/bank/Xero route, separate
  from the app-store subscription products.
- Support email: `info@psiperformance.com.au`
- Support phone: `0433 431 781`
- Workshop: `21 Exchange Drive, Pakenham VIC 3810, Australia`

## Store URLs ready for QA

- Support: `https://juztforkickz.github.io/psi-performance-booking-app/support`
- Privacy: `https://juztforkickz.github.io/psi-performance-booking-app/privacy`
- Account deletion: `https://juztforkickz.github.io/psi-performance-booking-app/delete-account`

These public routes contain no account data or production credentials. Move
them to a stable PSI-owned domain before final store submission if practical.
Google Play requires the external deletion resource even when deletion can be
initiated inside the app.

The dedicated App policy draft and its Shopify publication checklist are now
maintained in `APP-PRIVACY-POLICY.md` and
`SHOPIFY-APP-PRIVACY-PUBLISHING.md`. Before public submission, publish the
approved App-specific policy on a PSI-owned page, update App Store Connect to
that URL, and keep the general Shopify store policy separate. Short contextual
notices for account, booking, upload, notification and deletion collection are
in `PRIVACY-COLLECTION-NOTICES.md`.

## Apple App Privacy draft

The following data is linked to the customer's account and used for app
functionality, account management, workshop communications, security and legal
compliance. No data is used for third-party advertising or cross-app tracking.

| Apple category | PSI examples | Linked | Tracking |
| --- | --- | --- | --- |
| Contact Info | name, email address, phone number | Yes | No |
| User Content | vehicle photos, booking/build notes, customer-selected attachments | Yes | No |
| Identifiers | Supabase user ID, opted-in Expo push token/device registration | Yes | No |
| Purchases | Apple subscription transaction and entitlement status; PSI invoice and workshop transaction history displayed to the customer | Yes | No |
| Other Data | vehicle identity, registration, odometer and service history | Yes | No |

Do not declare precise location, contacts/address book, browsing history,
search history, health, fitness, advertising data or payment-card details: the
current release does not collect them. Review every SDK and the signed binary
again before certifying the form.

Recommended purpose selections in App Store Connect:

- **App Functionality:** all listed categories;
- **Account Management:** contact information, account identifier, vehicle and
  workshop history;
- **Developer Communications:** contact information and booking/request text;
- **Fraud Prevention, Security and Compliance:** account identifier and opted-in
  push-device registration; and
- **Advertising, third-party advertising and analytics:** none.

The release has no third-party advertising, IDFA use, cross-app tracking,
contact-book access, precise location collection or payment-card collection.
Supabase, Resend, Expo and Google Calendar are service providers used to operate
the customer service. Apple processes optional Performance+ purchases and
RevenueCat verifies the resulting entitlement; their final production terms and
SDK behaviour must still be rechecked when the signed binary is uploaded.

## Apple age-rating draft

Use these conservative answers in the current App Store Connect questionnaire,
then confirm the generated rating before submission:

| Capability/content | Draft answer |
| --- | --- |
| Parental controls / age assurance | No |
| User-generated content | Yes — private vehicle photos and customer-entered booking/build text |
| Messaging or chat | No — there is no in-app person-to-person chat |
| Advertising | No |
| Unrestricted web access | No — only controlled external support/partner links |
| Social media capabilities | No |
| Mature, sexual, violent, horror, medical or drug content | None |
| Gambling, contests or loot boxes | None |

The private customer content answer is deliberately conservative even though
customers cannot publish content to other customers. The expected result is a
low age rating, but App Store Connect is the authority for the final result.

## Google Play Data safety draft

- Data collected: **Yes**
- Data shared with unrelated third parties: **No**, subject to confirming every
  provider remains a contracted service processor acting on PSI's behalf
- Encryption in transit: **Yes**
- Account deletion: **Yes — in-app and external web resource**
- Optional collection: vehicle photos, attachment selections and push/device
  registration are optional; verified email is required for an account

Declare these types where the production build sends them off-device:

| Google category | Examples | Purposes |
| --- | --- | --- |
| Personal info | name, email, phone | App functionality, account management, developer communications |
| Photos and videos | customer vehicle images | App functionality |
| Files and docs | private invoice/dyno attachments where enabled | App functionality |
| App activity / other user-generated content | booking request and build-plan text | App functionality, developer communications |
| Device or other IDs | account UUID and opted-in Expo push token | App functionality, fraud prevention/security |
| Financial info / purchase history | workshop invoice amount/history | App functionality, account management |

Supabase, Resend, Expo and Google Calendar processing must be evaluated against
Google's service-provider rules at submission time. The developer is responsible
for the final declaration even when an SDK supplies guidance.

## Listing copy

**Apple subtitle:** Your PSI vehicle workspace

**Apple promotional text:** Your secure PSI customer workspace for vehicles,
bookings, workshop history, dyno results and future build planning.

**Apple keywords:** PSI Performance,car service,dyno,vehicle,booking,workshop,build plan

**Copyright:** © 2026 PSI PERFORMANCE PTY LTD

**Release method:** Manually release this version after PSI completes the final
signed-build acceptance pass.

**Google short description:** Your PSI vehicle history, visits, reports and next plan in one place.

**Description:**

Keep your PSI vehicle relationship together in one premium customer workspace.

PSI Performance brings your vehicles, workshop visits, booking requests,
verified dyno results, invoices, recommended work, customer cars for sale and
future build planning into one clear experience. Secure email-code access keeps
customer records private, while PSI-published service and dyno history remains
protected from customer editing. Workshop availability, scope, pricing and
timing are confirmed by PSI. The free account includes everyday Garage,
booking, kilometre, reminder and current-result features. Optional PSI
Performance+ unlocks the complete private vehicle vault for A$9.99 monthly or
A$99 annually through Apple.

## Artwork and screenshot readiness

The `PSI APP` desktop folder already contains:

- 1024×1024 Apple icon;
- 512×512 Google Play icon;
- Android adaptive foreground and black background treatment;
- native splash logo and 1290×2796 splash preview;
- 1024×500 Google Play feature graphic; and
- five 1290×2796 portrait screenshots ordered Home, Garage, Vehicle Reports,
  Bookings, Plan & Build.

Opaque 1290×2796 JPEG copies are an accepted Apple 6.9-inch portrait size. Apple
permits one to ten screenshots and requires PNG/JPEG without transparency. A
separate opaque 1080×1920 Google phone set preserves the app screenshot aspect
inside a black 9:16 canvas rather than stretching Apple artwork. Both sets are
QA marketing drafts; recapture them from the final signed native build after
iPhone/Android acceptance testing so store imagery exactly matches the submitted
binary and recheck Play Console's then-current rules before upload.

The first Apple release is explicitly iPhone-only in `mobile/app.json`.
Therefore an iPad screenshot set is not required for this release. Do not enable
iPad support until PSI has completed a separate native iPad layout, screenshot
and acceptance pass. Upload the opaque JPEG copies, not the current Apple PNG
drafts, because those PNG files contain an alpha channel.

Draft captions:

1. **YOUR PSI APP** — Your vehicles, visits and next plan in one place.
2. **MY GARAGE** — Keep every vehicle and its PSI history together.
3. **VEHICLE REPORTS** — Review PSI dyno results, repairs, recommendations and invoices.
4. **BOOKINGS** — See upcoming and previous PSI workshop visits.
5. **PLAN & BUILD** — Shape a staged conversation around your vehicle goals.

### Pending Performance+ subscription review capture

The existing five marketing screenshots do not include a native Performance+
purchase screen. This review artifact is still pending. Capture it only after
the signed `performance-test` build is available and its sandbox purchase flow
works on an iPhone:

1. Record the actual build number, EAS build ID, runtime, device and iOS version.
   Confirm the isolated review backend and purchase-test configuration.
2. Sign in with a dedicated free synthetic customer account that owns a test
   vehicle. Use its app password; keep it out of screenshots and this document.
   Matt's permanent complimentary account hides the paid controls and is not
   suitable for this capture.
3. Open Home > Performance+, scroll to Choose Performance+, and capture the
   actual rendered offer with A$9.99/month, A$99/year and the corresponding
   enabled purchase controls. Retain additional native captures of Restore
   purchases, renewal information, Privacy and Subscription terms if they do
   not fit in the same viewport. Do not resize the interface or fabricate an
   Apple payment sheet to fit everything into one image.
4. Keep the native PNG/JPEG dimensions and check the current upload requirements
   in each subscription's App Review Information. Attach a relevant screenshot
   to both monthly and annual product records, keeping supplementary evidence
   separate from the public marketing screenshot pack.
5. Record successful monthly/annual purchase and restore results separately.
   A screenshot alone is not purchase verification. Before final submission,
   verify the same purchase access in the submitted binary and recapture any
   screen whose content or navigation changed.

The public web preview and ordinary beta/review demonstration have disabled
purchase controls and cannot supply this evidence. The purchase-test build is
for isolated acceptance; it does not establish that the final submitted binary
already supports App Review purchases.

## App Review access draft

Reuse the existing isolated synthetic customer and separate workshop review
accounts described in `APPLE-REVIEW-SANDBOX.md`. Verify their dedicated **app
passwords** on the signed device and enter them only in App Store Connect's
private review fields. Reviewers do not need mailbox access or live email codes.
Never supply a Gmail, Apple Account or live PSI password. The normal customer
app retains invitation-only email-code sign-in and live workshop MFA.

The current same-build demonstration instructions below cover ordinary app and
workshop review. Check the actual selected build before using them. They do not
claim subscription purchase access; see the separate pending requirement below.

> Open Account, select Open demonstration, then Enter demo and restart. Use the
> dedicated customer app credentials supplied in the private review fields on
> the Apple review sign-in form. This isolated environment contains fictional
> records. No mailbox access or one-time email code is required. To review the
> workshop portal, sign out and use the separate workshop app credentials in
> the private review notes, then open PSI Portal from Account. Live workshop
> access remains protected by staff MFA. The ordinary demonstration disables
> external email, remote push, Calendar changes and Apple purchases. In-app
> records and notifications remain available for inspection.

Subscription review access is **not yet verified in the eventual submitted
binary**. The separate `performance-test` profile enables Apple sandbox
purchases against the isolated backend and opens the review sign-in directly;
it does not require switching from normal mode. Complete its signed-device
monthly/annual purchase and restore checks, then implement and verify the
purchase route in the actual binary selected for App Review. Only then add
accurate subscription navigation instructions and the captured review image to
App Store Connect. Do not direct reviewers to disabled controls in the ordinary
demo or offer a later replacement binary as the review arrangement.

Also complete the App Review contact name, monitored phone number in
international format, and `info@psiperformance.com.au`. Test both supplied app
logins from a signed-out device immediately before submission.

## Still requires owner action

- Install and acceptance-test the completed signed internal iPhone QA build,
  including passwordless Auth, private files, deletion controls and native push.
  Keep Apple credential material, the enrolment identifier, device UDID and
  D-U-N-S number outside the public repository.
- Create or verify the Google Play organisation/developer account.
- Decide supported territories and confirm the drafted age-rating answers.
- Verify the existing synthetic App Review accounts and enter their dedicated
  app credentials only in App Store Connect. Verify purchase access in the
  submitted binary and attach the native subscription review screenshot.
- Reconfirm the legal entity/ABN, privacy wording and retention schedule with
  PSI's accountant or legal adviser.
- Approve every screenshot, partner mark and manufacturer/platform mark before
  upload.

References: [Apple screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/), [Apple account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/), [Google Play Data safety](https://support.google.com/googleplay/android-developer/answer/10787469), [Google Play account deletion](https://support.google.com/googleplay/android-developer/answer/13327111).
