# Google Play rollout checkpoint

Updated 24 September 2026 from the signed-in PSI Performance Play Console.

## Current gate

Google confirms receipt of the identity documents and is reviewing them. It
will email the account owner after review; its displayed estimate is a few days.
Create app remains disabled. Neither an app record nor Play subscriptions have
been created. Do not interpret document submission as verification approval.

After approval, Google requires verification of both the private contact phone
number and the public developer-profile phone number using an SMS or voice
code. The app-support phone number is a separate setting. Matt must handle any
personal authentication, verification codes and account-owner decisions.

Do not copy identity photographs, registration letters, verification codes,
service-account keys or review credentials into Git or public artifacts.

## Prepared app details

- Proposed Play listing name: **PSI Performance Garage** (matches the rollout request).
- Android application ID: `com.psiperformance.booking`.
- Installed app label: **PSI**; version: **1.0.0**.
- Free download; optional Performance+ products require separate activation and testing.
- Support email: `info@psiperformance.com.au`.
- Draft short description: **Your PSI vehicle history, visits, reports and next plan in one place.**

Draft Android description, to reconcile with the final Play binary before saving:

> Keep your vehicles and PSI workshop visits together in one secure customer
> workspace. View your garage, request bookings, review available service and
> dyno reports, and plan future work with PSI Performance Garage.
>
> Sign in using a verification code sent to your email. Your customer records
> stay private, and PSI-published workshop history is protected from customer
> editing. Workshop availability, scope, pricing and timing are confirmed by PSI.

Add Performance+ purchase wording only when the submitted Android build supports
the activated Google Play products. Never copy the Apple purchase wording or
Apple EULA footer into the Play description.

The older `STORE-RELEASE-PACKAGE.md` is a historical cross-platform draft. It
contains older company identifiers and Apple-specific purchase/review wording;
do not transfer those fields into Google Play. Use Google's approved organisation
record and the original supplied evidence for legal identity fields. This
checkpoint does not change the iOS listing or any legal/account settings.

## Existing build and artwork

- Current installable acceptance APK: version 1.0.0 (2), build
  `c1d100c8-bf21-4233-b979-7f6567b06b2b`, source `f451ca0`.
- Its `android-internal` channel enables public customer registration and the
  fictional demonstration; Google purchases remain disabled.
- The APK is for device acceptance. A Play release needs an Android App Bundle.
- Existing desktop artwork: `PSI APP/google-play-icon-512.png` and
  `PSI APP/google-play-feature-graphic-1024x500.png`.
- Existing marketing screenshots are drafts. Capture final screenshots from
  the accepted Android build without private customer information.
- Physical Android acceptance remains outstanding in
  `ANDROID-NATIVE-QA-CHECKLIST.md`; an iOS pass does not satisfy it.

## Continuation after Google unlocks the account

1. Verify identity approval and complete both phone verifications. Confirm
   Create app is enabled before attempting app creation.
2. Create the free Android app, using the approved name and appropriate English
   locale. Any new binding agreement requires an account-owner decision.
3. Populate the draft listing and reconcile support, privacy and external
   deletion URLs with the current public resources and submitted binary.
   Complete app-access, ads, audience, content-rating and Data safety forms from
   actual functionality and SDK behaviour, not solely the historical draft.
4. Prepare the Play internal-test App Bundle using a reviewed Android-only
   profile. Do not change iOS, beta, public-web or production update channels.
5. Create monthly and annual Performance+ base plans at the approved Australian
   prices of **AUD 9.99/month** and **AUD 99.00/year**. Record identifiers from
   the actual catalogue; do not invent server allowlist identifiers in advance.
6. Connect the Play app to RevenueCat using the required least-privilege access,
   subject to approval for new security-sensitive credentials/permissions.
   Preserve the existing Apple app, products, offerings and entitlements.
7. Configure the Google public SDK key and exact product allowlist only for
   isolated purchase testing. `google-performance-test` is deliberately gated
   until its real Google key, active base plans and matching allowlist exist.
   Do not relax production sandbox protection or change existing backend settings
   to make tests pass. Follow `PERFORMANCE-PLUS-ACTIVATION.md`.
8. Test installation, account/privacy flows, purchase, restore, renewal,
   cancellation, expiry and refund using approved test identities and a real
   Android device. Record evidence before submission or public activation.

This checkpoint authorises no automatic production release. Existing iOS,
RevenueCat, Supabase, beta and public settings remain intact.
