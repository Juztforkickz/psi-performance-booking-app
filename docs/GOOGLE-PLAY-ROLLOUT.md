# Google Play rollout checkpoint

Updated 30 September 2026 from the signed in PSI Performance Play Console and
the completed Expo Android build.

## Current state

Google Play setup shows **10 of 11 tasks complete** for PSI Performance Garage.
Five 9:16 phone screenshots at 1512 by 2688 pixels have been uploaded to the
Play media library. They meet Google's phone screenshot and promotion size
requirements. The default Store Listing still needs those assets saved before
the setup task is counted complete.

The app remains a draft for production. No production, closed testing, open
testing or public Google Play release has been created. The private internal
testing track remains active on build 5 while signed build 6 is ready for the
replacement release.

Expo Submit cannot upload to Play until a Google service account key is linked
to the Expo project. No key is currently configured. The signed bundle can be
uploaded directly through Play Console without creating another app, package
or signing identity.

## Active private release

The owner only tester list contains `matt@psiperformance.com.au`. The active
release is **PSI Android internal 1.0.1 (5)** and Google Play reports it as
**Available to internal testers**, released on 29 September 2026 at 17:29 and
not reviewed.

[Join the private test](https://play.google.com/apps/internaltest/4701264059153280916)

Google may show the temporary app name
`com.psiperformance.booking (unreviewed)` until the first review is complete.

The signed App Bundle was built by EAS from exact source checkpoint
`4fea69b1c2ca3a1cddb94024be9c080544f00251`:

* Version: `1.0.1`
* Version code: `5`
* Package: `com.psiperformance.booking`
* EAS profile: `android-play-internal`
* Update channel: `android-play-internal`
* Runtime: `1.0.0-android-play-internal-1`
* EAS build ID: `24fb542a-fa79-4c2e-a9c8-69d01d4da0f0`
* [EAS build record](https://expo.dev/accounts/psi-performance/projects/matt-psi/builds/24fb542a-fa79-4c2e-a9c8-69d01d4da0f0)
* AAB size: `92,711,001` bytes
* AAB SHA256: `CD0372217783A8769495EE26427BD0F139383F7F081DE0CFBED76E15641C1C6C`
* Minimum API: `24`
* Target SDK: `36`
* Google Play estimated new install size: `47.4 MB`

## Production candidate

The replacement production candidate was built successfully from exact source
checkpoint `5416c01084b5d955a020e5386ca2c84a2ebec3f2`:

* Version: `1.0.1`
* Version code: `6`
* Package: `com.psiperformance.booking`
* EAS profile: `android-play-internal`
* Update channel: `android-play-internal`
* Runtime: `1.0.0-android-play-internal-1`
* EAS build ID: `e8c58a01-375a-4c14-a07e-4460bca1a609`
* AAB size: `92,710,775` bytes
* AAB SHA256: `4AA98A5A198932ACADD8EBAB2CF9F723E5B0438ABE2CDFF994024FC0704471F3`

This candidate changes the review demonstration wording from Apple specific
language to platform neutral store review language. It does not change the
package name, production Supabase project, Apple release or signing identity.

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

The reviewer instructions open the isolated fictional demonstration with the
dedicated review credentials supplied privately in Play Console. Live
submissions, payments, emails and push delivery are disabled in that
demonstration.

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

Five phone screenshots are ready in the Play media library. The edited feature
graphic and five screenshots are prepared for Google's AI asset declaration.
The original PSI app icon remains separately identified as the existing brand
asset.

## Remaining work

1. Save the five prepared screenshots to the default Store Listing and complete
   the AI asset declaration.
2. Replace the outdated credential free reviewer instructions with the private
   fictional customer review credentials.
3. Upload signed build 6 to the production track.
4. Review the final production changes and send them to Google for review.
5. Use Google's automated pre launch report while review is pending, then run
   a borrowed phone acceptance pass when a device is available.

This checkpoint does not change iOS, RevenueCat, Supabase, workshop computer,
customer data or existing public website services. Identity documents,
verification codes, service account keys and review credentials must never be
stored in Git or public artifacts.
