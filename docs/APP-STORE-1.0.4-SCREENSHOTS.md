# App Store 1.0.4 screenshot refresh

Matt approved version 1.0.4 and the current screenshot set on 3 November 2026.

The release candidate starts from `4c1453e0d382778e9de153c5d82eee87b9787cf5`, which contains the released portal safe area repair and customer car listing media support. The only app configuration change is the displayed version for the existing `app-store-release` profile. Android remains version 1.0.3. Dependencies, native resources, permissions, app identity, runtime, update channel and production backend settings remain unchanged.

The candidate is isolated on `codex/app-store-1-0-4-screenshots`. The live main branch and its native compatibility baselines remain unchanged during review. This store listing refresh does not require another customer OTA publication. Do not promote the new version into the main compatibility record before the exact store package and release are verified.

## Screenshots

The four approved PNGs in `operations/app-store/1.0.4/screenshots` show the current Home, My Garage, Bookings and Reports pages. They use the existing fictional review account, never real customer records. The actual current responsive app captures are resized inside the marketing layout; no app controls, balances or entitlement statuses are fabricated. The fixed review environment banner is omitted from the marketing crop.

The original images are 1242 by 2688 pixels. The matching `iphone-dynamic-island-medium` variants are 1206 by 2622 pixels, as required by the current Apple upload controls, with the composition preserved. Preserve the ordering shown by their numeric file prefixes. Replace inherited older screenshots in the new version only. The existing released version remains unchanged until Apple approves and releases the new version.

## Validation and release boundaries

Validate TypeScript, app lint, review isolation, startup and the existing app features. Compare the resolved candidate with the installed native contract, allowing only the intended iPhone marketing version change. Verify the final IPA identity, version, build, updater configuration, native loading resources and unchanged permissions before uploading it.

Use the existing PSI Expo and Apple signing access. No new credentials, fees, billing changes, database migrations or customer record changes are authorised. Preserve the protected owner Performance+ and Rewards grants and the separate Google Wallet hold.

Submission and public availability are separate states. Record the exact build and submission receipts and never report approval, publication or customer installation from an upload alone.

## Candidate checks

All 54 selected startup, artwork, Home preference, listing media, review isolation and update safety checks passed. Mobile TypeScript and lint of the current app source and configuration passed. A complete mobile directory lint also traversed old archived script copies and reported 19 existing Node global errors in those copies and the old release utility. Those unrelated files are unchanged.

The native comparison passed after allowing only the intended iPhone marketing version difference. The existing compatibility guard correctly rejects promoting the unreviewed version to live OTA; its baseline remains intact.

## Accepted Apple submission

Apple accepted version **1.0.4 (23)** for review on **3 November 2026 at 8:45 pm Melbourne time**. The verified state is **Waiting for Review**, with exactly one submitted app version. It is not yet publicly live. Automatic release after approval, immediate availability to existing eligible users and the existing rating are retained.

* Native source checkpoint: `4072ecaf9368175543c1ea1c96b50d7743fd46e9`.
* EAS build: `82b04af6-4ef5-42ac-ba4e-c822beb4f0bb`, finished and verified.
* EAS upload: `abb90701-3c7f-445c-a9f6-4dd7e6442522`, finished once, with automatic TestFlight group setup disabled.
* Apple build: `ff0fc0c8-41d1-4e76-9e12-c2b4bc6c81af`, validated by Apple.
* App Review submission: `42d64b30-ffa8-4534-8ba8-7ee11a363ab8`.

The signed package passed archive integrity, identity, native launch, unchanged provisioning profile, entitlement, device capability, permission and updater checks. No new physical device test is claimed for build 23. The native loading design remains the one the owner previously verified on build 22.

The four current screenshots are saved in the required modern iPhone placement. The copied older large Face ID screenshots were removed from this draft only; that placement now inherits the same current set through Apple's normal scaling. Asset Library originals and the released 1.0.3 page remain intact.

No customer data, backend configuration, database, Rewards rules, memberships, subscriptions, staff grants, Wallet enablement or commercial settings changed. The build used the verified existing Free plan allowance. No additional fees or billing changes were incurred. Main and both existing customer OTA feeds remain unchanged.

Do not rebuild, reupload, recreate the version, cancel the submission or promote its native baseline merely because Apple review is pending. Approval and public Australian App Store availability still require fresh evidence. Keep the separate existing Google Wallet monitoring restrictions intact.
