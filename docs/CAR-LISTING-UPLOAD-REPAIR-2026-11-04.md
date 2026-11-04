# Car listing upload repair

The phone upload stopped before a storage reservation because the file hash was passed to Expo Crypto as an ArrayBuffer. The installed Swift and Kotlin digest functions require a TypedArray. Web Crypto accepts either, so the earlier permissive test double concealed the native failure. Listing uploads now pass a Uint8Array view of the same bytes, preserving the SHA256 digest and duplicate detection.

The portal now exposes Add cover photo before any attachments exist, and Change cover photo afterward. This picks one photo, uploads or reuses it, and saves the cover through the existing protected RPC. Browsing existing photos still provides Use this as cover photo. The first successfully completed photo retains the existing automatic cover behavior. Cover uploads keep their intent during retry. A failed cover change retains the successfully saved photo and explains how to retry. Upload feedback now appears above the controls and identifies the failed stage without exposing private technical errors.

The repair changes no database schema, storage permissions, listing status, customer information, notification rules, native configuration or dependencies. Existing private media, staff MFA requirements and ready photo validation remain intact. No customer data or saved attachments are deleted.

## Validation

119 targeted automated checks passed, including the real installed Expo JavaScript digest adapter against the native typed array contract, photo and video/file preparation, duplicate and interrupted uploads, cover selection, cancellation, retries, staff and customer boundaries, coordinated releases and Android update safeguards. TypeScript, scoped source lint, diff whitespace validation and both installed native compatibility baselines passed.

The existing sandbox database test passed 25 assertions and intentionally rolled back every fixture, including cover replacement, single cover enforcement, removal fallback, file limits, customer isolation, MFA and immutable storage. Production readback verified the private bucket, seven policies, staff MFA and no direct customer writes. No production migration or test attachment was created.

Actual phone selection, upload, playback and appearance require device confirmation after the release. Native API contract tests and delivered update files do not establish installation on an individual phone.

An isolated HTML render of the actual component was generated without customer data. Browser visual inspection could not run because local browser use is disabled in Work settings. Component action tests passed; no visual or physical device success is claimed.

## Release

This is a compatible JavaScript OTA repair for the existing Apple app-store-release and Android android-play-internal channels. It also updates the existing main branch web app. Preserve the separate pending App Store 1.0.4 submission and its isolated release branch. No native rebuild or store submission is needed for this repair.

Final publication receipts are recorded in the private continuation folder work/car-listing-upload-repair-2026-11-04.
