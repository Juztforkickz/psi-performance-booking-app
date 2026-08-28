# PSI Performance store release package

Status: metadata and disclosure draft, 25 August 2026. Do not submit until the
signed release build and final owner/legal checks are complete.

## App identity

- App name: **PSI Performance**
- Bundle/application ID: `com.psiperformance.booking`
- Apple seller organisation requested: **PSI PERFORMANCE PTY LTD**
- D-U-N-S status: **Active D&B record confirmed by the owner on 29 August 2026**
- Company ACN: **175 164 626** — owner-confirmed; recheck against current ASIC documentation during enrolment
- Company ABN: **98 175 164 626** — owner-confirmed; recheck against current ABR documentation during enrolment
- Workshop supplier wording: **Matthew Ebert trading as PSI Performance**
- Primary category: **Business**
- Secondary/category description: **Automotive customer and workshop services**
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

Draft captions:

1. **YOUR PSI APP** — Your vehicles, visits and next plan in one place.
2. **MY GARAGE** — Keep every vehicle and its PSI history together.
3. **VEHICLE REPORTS** — Review PSI dyno results, repairs, recommendations and invoices.
4. **BOOKINGS** — See upcoming and previous PSI workshop visits.
5. **PLAN & BUILD** — Shape a staged conversation around your vehicle goals.

## Still requires owner action

- Complete Apple organisation enrolment in the Apple Developer app and confirm
  the displayed seller name. Web enrolment is unavailable for the signed-in
  Apple Account; the active D&B record may take up to two business days to
  propagate to Apple.
- Create or verify the Google Play organisation/developer account.
- Decide supported territories and final age-rating answers.
- Supply store-review credentials for a dedicated synthetic account and explain
  the email-code plus Matt-only staff separation in review notes.
- Reconfirm the legal entity/ABN, privacy wording and retention schedule with
  PSI's accountant or legal adviser.
- Approve every screenshot, partner mark and manufacturer/platform mark before
  upload.

References: [Apple screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/), [Apple account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/), [Google Play Data safety](https://support.google.com/googleplay/android-developer/answer/10787469), [Google Play account deletion](https://support.google.com/googleplay/android-developer/answer/13327111).
