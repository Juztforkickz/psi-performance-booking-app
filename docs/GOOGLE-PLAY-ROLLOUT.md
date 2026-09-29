# Google Play rollout checkpoint

Updated 29 September 2026 from the signed in PSI Performance Play Console.

## Current state

Google Play setup shows **10 of 11 tasks complete** for PSI Performance Garage.
The only incomplete setup task is the default Store Listing because Google
requires at least two Android phone screenshots. Capture at least four clean
portrait screenshots from the accepted physical Android build so the listing
uses real Android presentation and qualifies for promotion.

The app remains a draft for production. No production, closed testing, open
testing or public Google Play release has been created. The private internal
testing track is active.

## Active private release

The owner only tester list contains `matt@psiperformance.com.au`. The active
release is **PSI Android internal 1.0.1 (4)** and Google Play reports it as
**Available to internal testers**, released on 29 September 2026 at 16:33 and
not reviewed.

[Join the private test](https://play.google.com/apps/internaltest/4701264059153280916)

Google may show the temporary app name
`com.psiperformance.booking (unreviewed)` until the first review is complete.

The signed App Bundle was built by EAS from exact source checkpoint
`da6fc5ded83964dfad93b73d1e21c1101a38366e`:

* Version: `1.0.1`
* Version code: `4`
* Package: `com.psiperformance.booking`
* EAS profile: `android-play-internal`
* Update channel: `android-play-internal`
* Runtime: `1.0.0-android-play-internal-1`
* EAS build ID: `e85a6635-9aab-4895-b199-694c452941ab`
* [EAS build record](https://expo.dev/accounts/psi-performance/projects/matt-psi/builds/e85a6635-9aab-4895-b199-694c452941ab)
* AAB size: `92,709,033` bytes
* AAB SHA256: `1346202D39D0D0B03BE283EA0F6C22831A95320D08B8E4C3BBDA69F37141CB18`
* Minimum API: `24`
* Target SDK: `36`
* Google Play estimated new install size: `47.4 MB`

Google Play reported one nonblocking warning because there is no deobfuscation
file. Native debug symbols are attached. The release keeps Google Play
purchases disabled. Performance+ products, RevenueCat Google configuration and
the Google Payments merchant profile remain outside this first Android release.

## Completed Play declarations

The following setup items are saved and counted complete by Google Play:

* Privacy policy
* Reviewer sign in access through the fictional demonstration
* Ads declaration
* IARC content rating, all ages or equivalent across regions
* Target audience, 18 and over
* Data safety
* Government apps declaration
* Financial features declaration
* Health declaration
* App category and support contact details

The reviewer instructions open the fictional demonstration without a username,
password or email code. Live submissions, payments, emails and push delivery
are disabled in that demonstration.

The Data safety declaration records encrypted transport, account deletion and
the required data categories used by the app: name, email address, user IDs,
phone number, other personal information, purchase history, photos, files and
documents, other user generated content, and device or other IDs. It declares
no third party sharing because the app providers act as service providers. The
public account deletion route is:

<https://juztforkickz.github.io/psi-performance-booking-app/delete-account>

## Store Listing draft

The following assets and text are saved as a draft:

* App name: **PSI Performance Garage**
* Short description: **Your PSI vehicle history, visits, reports and next plan in one place.**
* 512 by 512 app icon
* 1024 by 500 feature graphic
* Full description with petrol, diesel, hybrid and electric vehicle support

The missing Android phone screenshots are the only reason the Store Listing
task is incomplete. Do not substitute iPhone images or mockups.

## Remaining work

1. Borrow a supported Android phone and follow
   `ANDROID-BORROWED-PHONE-ACCEPTANCE.md`.
2. Confirm version `1.0.1` and build `4` are installed from Google Play.
3. Complete the physical acceptance checks without real customer information.
4. Capture at least four clean portrait Android screenshots at 1080 pixels or
   more using fictional demonstration records.
5. Add those screenshots to the default Store Listing and review the complete
   listing.
6. Submit to production review only after the physical acceptance pass and
   Matt's separate approval.

This checkpoint does not change iOS, RevenueCat, Supabase, workshop computer,
customer data or existing public website services. Identity documents,
verification codes, service account keys and review credentials must never be
stored in Git or public artifacts.
