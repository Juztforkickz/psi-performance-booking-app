# Customer onboarding release, 9 October 2026

## Result

Customers can browse public information and choose a clearly labelled local
demonstration. Real booking forms and personal editors require a verified
account and completed profile. Guest continuation links are removed. Customers
return to the requested feature after account setup, including interrupted
booking and add vehicle flows. Booking vehicles resolve only to the customer's
saved account vehicles.

The public demonstration contains fictional garage, records, odometer,
reminders, booking, subscription and history import examples. Its actions do
not create accounts or trials, write real records, send requests or take money.
The separate Apple and Google reviewer environment and credentials remain.
Reviewer entry is now labelled **App store reviewer sign in**.

No database migration, account deletion, subscription change, trial reset,
payment or customer communication was performed for this release. Existing
booking drafts, vehicle records and permanent owner Performance+ remain.

## Source and validation

Application checkpoint: `bc218702a0051a82ae3f5bee042d8744e5968da1` on `main`.

* Full mobile TypeScript and ESLint passed with installed dependency access.
* Targeted account, booking, messaging and access suite passed, 61 tests.
* Final focused gate, booking, messaging and public demo suite passed, 44 tests.
* Separate review and selectable demo isolation checks passed, 22 tests.
* Browser checks covered guest booking entry, preserved sign in destination,
  demo entry and exit, sample odometer save, invoice view, booking completion
  and simulated subscription confirmation. Layouts inspected at 320 and
  375 pixels. No real account or purchase was used for these interactions.
* GitHub build and deployment `37926209175` succeeded. The deployed public
  demonstration route was opened and verified in the browser.

These checks verify source behavior, browser interaction and update delivery.
They do not establish that every installed phone has downloaded the update or
replace native device acceptance testing.

## Mobile publication

| Platform | Channel | Runtime | Update ID |
| --- | --- | --- | --- |
| iOS | `app-store-release` | `1.0.0-app-store-release-1` | `01a12085-08bd-7895-ade6-e456f3044e9e` |
| Android | `android-play-internal` | `1.0.0-android-play-internal-1` | `01a12086-2bf4-794c-86f5-a713b4654534` |

Apple update group: `b644a4f7-277f-4411-bfa8-3fbdbcd83b6a`.
Android update group: `36421525-d4df-437d-9b2f-f986153b4542`.
Both update records identify application checkpoint `bc218702a0051a82ae3f5bee042d8744e5968da1`.

Apple workflow `01a12080-1b42-7a57-a038-be68ed9ce5d3` completed successfully
through validation, the existing release approval step and publication.
Android publication used the existing Play channel and its matching Google
purchase configuration. Dependencies, native runtime and store binaries were
unchanged. Beta and dedicated reviewer channels were not published.

Public Expo endpoint requests with each platform, channel and runtime returned
HTTP 200 and the exact new update IDs after publication. Earlier superseded
Apple workflows for `cb61ad3` and `2d87ca5` were cancelled without publication.

Public demonstration:
https://juztforkickz.github.io/psi-performance-booking-app/demonstration
