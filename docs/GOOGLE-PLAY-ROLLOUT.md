# Google Play rollout checkpoint

Updated 1 October 2026 from the signed in PSI Performance Play Console and
the completed Expo Android build.

## Current state

PSI Performance Garage version `1.0.1`, version code `6`, has been submitted to
Google for production review. Google Play reports **Release PSI Performance
Garage 1.0.1 (6) in review**. Australia is the selected country. Managed
publishing is off, so Google will publish the approved release automatically.

The default Store Listing is complete with the approved name, description,
icon, feature graphic and five phone screenshots. The feature graphic and the
five prepared screenshots are labelled under Google's AI asset declaration.
The existing PSI app icon is recorded as the original brand asset.

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

## Store Listing

The following assets and text were submitted for review:

* App name: **PSI Performance Garage**
* Short description: **Your PSI vehicle history, visits, reports and next plan in one place.**
* 512 by 512 app icon
* 1024 by 500 feature graphic
* Full description with petrol, diesel, hybrid and electric vehicle support

Five 9:16 phone screenshots at 1512 by 2688 pixels are included. They meet
Google's phone screenshot and promotion size requirements.

## Production review submission

All ten production changes were sent to Google on 1 October 2026. The review
submission includes:

* production release `PSI Performance Garage 1.0.1 (6)`
* Australia as the release country
* the English Australia Store Listing
* content rating and target audience declarations
* privacy policy, ads, Data safety and health declarations
* the Auto and vehicles app category
* corrected reviewer sign in details for the isolated fictional demonstration
* the required Advertising ID declaration, set to **No** after checking the app
  dependencies and configuration for advertising SDKs or the Android AD ID
  permission

Google accepted the submission and shows it under **Changes in review**. Review
is commonly completed within seven days but Google may take longer.

The release has one nonblocking deobfuscation warning. Google also reports DEX
code optimisation below its future threshold, with a February 2027 deadline,
and recommends reviewing deprecated edge to edge APIs. Neither item blocked
this submission. They should be addressed in a later Android maintenance build.

## Remaining work

1. Wait for Google's review decision. No further Play Console submission action
   is currently required.
2. Review Google's automated pre launch report when it becomes available.
3. Run the borrowed phone acceptance pass when a supported Android device is
   available. This physical device check was not completed before submission.
4. Confirm the public Play Store listing and installation after Google approves
   and publishes the release.

This checkpoint does not change iOS, RevenueCat, Supabase, workshop computer,
customer data or existing public website services. Identity documents,
verification codes, service account keys and review credentials must never be
stored in Git or public artifacts.
