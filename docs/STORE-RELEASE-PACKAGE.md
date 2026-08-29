# PSI Performance store release package

Status: metadata and disclosure draft, 29 August 2026. Do not submit until the
signed release build and final owner/legal checks are complete.

## App identity

- App name: **PSI Performance**
- Installed Home Screen label: **PSI**
- Bundle/application ID: `com.psiperformance.booking`
- Apple Developer organisation: **PSI PERFORMANCE PTY LTD** — active 29 August 2026
- D-U-N-S status: **Active D&B record confirmed by the owner on 29 August 2026**
- Company ACN: **175 164 626** — owner-confirmed; recheck against current ASIC documentation during enrolment
- Company ABN: **98 175 164 626** — owner-confirmed; recheck against current ABR documentation during enrolment
- Workshop supplier wording: **Matthew Ebert trading as PSI Performance**
- Primary category: **Business**
- Secondary/category description: **Automotive customer and workshop services**
- First Apple release devices: **iPhone only**
- Price: **Free**
- Paid digital products/subscriptions: **None**
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

## Apple App Privacy draft

The following data is linked to the customer's account and used for app
functionality, account management, workshop communications, security and legal
compliance. No data is used for third-party advertising or cross-app tracking.

| Apple category | PSI examples | Linked | Tracking |
| --- | --- | --- | --- |
| Contact Info | name, email address, phone number | Yes | No |
| User Content | vehicle photos, booking/build notes, customer-selected attachments | Yes | No |
| Identifiers | Supabase user ID, opted-in Expo push token/device registration | Yes | No |
| Purchases | PSI invoice and workshop transaction history displayed to the customer | Yes | No |
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
the customer service; their final production terms and SDK behaviour must still
be rechecked when the signed binary is uploaded.

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
verified dyno results, invoices, recommended work and future build planning into
one clear experience. Secure email-code access keeps customer records private,
while PSI-published service and dyno history remains protected from customer
editing. Workshop availability, scope, pricing and timing are confirmed by PSI.

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

## App Review access draft

Create a dedicated synthetic customer account shortly before submission. Do not
put its credentials, mailbox password or live email code in this repository.
Enter the review email directly into App Store Connect and provide access to a
dedicated review mailbox so Apple can retrieve a fresh one-time code. The
customer account should remain active and contain only synthetic vehicle and
workshop data.

Suggested review notes (replace every bracketed field in App Store Connect):

> This app uses passwordless email-code authentication. On the sign-in screen,
> enter [DEDICATED REVIEW EMAIL], request a code, then retrieve the current
> six-digit code from the dedicated review mailbox using the credentials
> supplied in the App Review sign-in fields/notes. New public registration is
> intentionally disabled; the review account is already active and does not
> expire. It contains synthetic customer and vehicle information only. Staff
> functions are not required to review the customer app and remain restricted
> to PSI's owner with authenticator MFA. Booking requests enter PSI review and
> do not take payment or create a confirmed appointment.

Also complete the App Review contact name, monitored phone number in
international format, and `info@psiperformance.com.au`. Test the supplied review
mailbox from a clean device immediately before submission.

## Still requires owner action

- Install and acceptance-test the completed signed internal iPhone QA build,
  including passwordless Auth, private files, deletion controls and native push.
  Keep Apple credential material, the enrolment identifier, device UDID and
  D-U-N-S number outside the public repository.
- Create or verify the Google Play organisation/developer account.
- Decide supported territories and confirm the drafted age-rating answers.
- Create the dedicated synthetic App Review account/mailbox and enter its
  credentials only in App Store Connect.
- Reconfirm the legal entity/ABN, privacy wording and retention schedule with
  PSI's accountant or legal adviser.
- Approve every screenshot, partner mark and manufacturer/platform mark before
  upload.

References: [Apple screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/), [Apple account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/), [Google Play Data safety](https://support.google.com/googleplay/android-developer/answer/10787469), [Google Play account deletion](https://support.google.com/googleplay/android-developer/answer/13327111).
