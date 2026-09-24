# Google Play rollout checkpoint

Updated 24 September 2026 from the signed-in PSI Performance Play Console.

## Current gate

Google approved Matt's identity and both developer phone numbers show verified.
The PSI Performance Garage Play app now exists under Console app ID
`4974273807519558547`, with Android package `com.psiperformance.booking`.
Its default language is English (Australia) and download price is free.

The Play setup dashboard shows **6 of 11 tasks complete**. Saved changes are
awaiting submission in Publishing overview. The approved PSI App privacy URL is
`https://psiperformance.com.au/policies/privacy-policy`. Ads, government apps,
health, financial features, and the Auto & vehicles category with public support
contacts are complete. The store name, descriptions, 512 × 512 icon and
1024 × 500 feature graphic are saved as a draft. The feature graphic attached to
the listing is a 24-bit PNG copy without alpha of the approved design. Final
Android phone screenshots are still required; the current marketing screenshots
are drafts pending device acceptance.

Sign-in details, content rating, target audience, Data safety and the completed
store listing remain. Google blocks the target-audience form until sign-in
details are complete. Google reviewers cannot create a new account or use a
personal account to get through the app's email-code sign-in; establish a
pre-existing independent review path before declaring access. Content rating
requires the account owner to review and accept IARC terms. Do not claim review
access or Data safety is complete before testing against the final signed build.
The App Bundle has been uploaded to the private internal track. No production
release or subscription catalogue has been published.

A Data safety draft has been saved with the confirmed basics: the app collects
user data, uses encrypted transport and creates accounts through an email
address plus one-time code. Google's account-deletion URL was set to the live
[public PSI deletion page](https://juztforkickz.github.io/psi-performance-booking-app/delete-account),
which explains both in-app and email requests, the normal 30-day process, and
data deletion versus lawful retention. The **unsubmitted Data safety draft**
selects Name, Email address, User IDs, Phone number, Other personal
info, Purchase history, Photos, Files and docs, Other user-generated content,
and Device or other IDs. These reflect account/profile and vehicle fields,
workshop transactions, uploaded images/documents, customer-entered notes and
the optional Expo push token. Handling answers for all ten selected types were
saved as a draft and the resulting Store Listing preview was checked. The
preview shows required stored account/contact and transaction data, optional
photos/documents/notes/push identifier, encryption in transit, the deletion
link and no declared third-party sharing. **Do not submit this preview yet**:
audit the finished Android binary, SDK/provider flows and backend transfers,
including whether app interactions, diagnostics, inferred location or
third-party sharing require different answers. Play also blocks Data safety
submission until Target audience is complete; that questionnaire is itself
blocked until the reviewer sign-in details are complete. Google says an
app active exclusively on the
[internal testing track](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en-GB)
is currently exempt from completing this form, but it is required for wider
release.

The internal testing track has a saved email list, **PSI owner internal test**,
containing only `matt@psiperformance.com.au`. The private release
**PSI Android internal 1.0.0 (3)** is active and Play Console says it is
**Available to internal testers**, released on 24 September 2026 at 16:45,
and marked **Not reviewed**. [Owner opt-in link](https://play.google.com/apps/internaltest/4701264059153280916).
Until app setup
and review finish, testers see the temporary name
`com.psiperformance.booking (unreviewed)`.
The isolated EAS App Bundle build finished successfully
on 24 September 2026:
[build a0b3a419-dda5-43eb-aa23-6810bdaa2750](https://expo.dev/accounts/psi-performance/projects/matt-psi/builds/a0b3a419-dda5-43eb-aa23-6810bdaa2750),
profile `android-play-internal`, version 1.0.0 (3), source commit `51d80e6a1de66f549702f2bb2c94d404612588bb`.
The uploaded 92,696,504-byte AAB has SHA-256
`B517743C1EEE37F7F99906B887427C724E4ACBD6A8D967721C7FF94CE9D9FC39`.
Play identified target SDK 36 and reported one non-blocking warning: no code
deobfuscation mapping file. Native debug symbols were attached to the bundle.

Play subscriptions are locked until a Google Payments merchant profile is
created. That onboarding has not been started, and no payment was made.
The current Android release keeps purchases disabled.

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

## Remaining rollout steps

1. Confirm an independent passwordless reviewer-access method with a dedicated
   synthetic customer identity before completing Play sign-in details. Do not
   share a live staff login, mailbox password or one-time code in this file.
2. Capture final Android phone screenshots from the accepted native build and
   complete the default store listing. Answer target audience, content rating
   and Data safety from actual functionality and SDK behaviour, not solely the
   historical draft. The account owner must review any binding IARC terms.
3. Verify the finished Play internal-test App Bundle linked above against the
   final release configuration. It uses its own update channel and runtime;
   Android purchases are disabled. Do not change iOS, beta, public-web or
   production update channels.
4. Install the active owner-only internal release using the opt-in link and
   complete physical Android acceptance. Confirm the temporary name and that
   no in-app purchase is offered in this build.
5. Once the payments profile prerequisite is authorised and completed, create
   monthly and annual Performance+ base plans at the approved Australian
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
