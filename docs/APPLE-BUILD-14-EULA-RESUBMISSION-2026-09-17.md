# Build 14 App Store metadata correction

## Review issue

Apple's automated App Review message dated 17 September 2026 at 7:40 PM
reported guideline 3.1.2: the App Store product-page metadata omitted a
functional Terms of Use (EULA) link for the auto-renewable subscriptions.

The live App Information page was checked and already selected Apple's
Standard License Agreement. The license selection was not changed.

## Correction

The following line was appended after a blank line to the existing
English (Australia) version 1.0 description:

Terms of Use (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/

The official Apple URL was opened successfully. Existing description wording
was preserved; the updated description is 788 characters, within the
4,000-character limit. The description was saved in App Store Connect and
the review was updated before resubmitting.

The canonical release package now records the required iOS-only footer.
No application code, binary, subscription price, screenshot, Google Play
description, or license terms were changed.

## Verified resubmission

- App: PSI Performance Garage, Apple ID 6806902732.
- App Store version: 1.0.
- Existing binary: 1.0.0 (14).
- Submission ID: 382840f3-cebc-4480-847d-d8ddee0d19b9.
- Resubmitted: 17 September 2026 at 8:31 PM, as displayed in App Store Connect.
- Submission status after resubmission: Waiting for Review.
- All four items show Waiting for Review: iOS app, PSI Performance+ Monthly,
  PSI Performance+ Annual, and the PSI Performance+ subscription group.

Review record:
https://appstoreconnect.apple.com/apps/6806902732/distribution/reviewsubmissions/details/382840f3-cebc-4480-847d-d8ddee0d19b9

This records a successful resubmission, not App Store approval. The original
review message remains visible as submission history.

## Validation

- Verified the existing standard-license selection in App Store Connect.
- Verified the official EULA URL loads.
- Verified the saved description matches the intended text.
- Verified the same build and all four submitted items returned to Waiting
  for Review.
- Documentation-only local change; no application test rerun required.
