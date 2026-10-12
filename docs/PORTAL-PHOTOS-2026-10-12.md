# Portal Photos, 12 October 2026

The workshop record option is now called Photos. Its form no longer offers Before, Progress or After. New portal photo uploads use the existing nullable asset phase without a stage label. Dyno report stages and previously saved records retain their current behaviour.

The photo form has two compact Upload actions with trailing icons. The primary photo icon opens the system photo library directly and supports multiple images. The file icon opens Files for images or PDFs. Both have explicit accessible labels and hints. Cancelling preserves the current selection. Selected photo metadata is adapted to the existing file uploader, including a fallback filename and MIME type and the required lastModified field. Original photos still pass through the established image resizing and private storage flow. Staff confirmation, customer and vehicle matching, preview restrictions and publishing protection remain in place. The photo library API was checked against the [Expo ImagePicker documentation](https://docs.expo.dev/versions/latest/sdk/imagepicker/).

Validation: 32 staff workflow regression tests passed. Mobile typecheck and lint of all shipping source, scripts and configuration passed. The local full directory lint also visited an ignored archived mobile checkout and reported unrelated archive errors; the shipping source check is clean. A read only database query confirmed vault_assets.phase already accepts null, so no schema or existing record changes were necessary.

Changed files: mobile/src/components/staff-record-workflow.tsx, mobile/src/components/staff-vault-publisher.tsx, mobile/src/lib/staff-vault.ts and tests/staff-record-workflow.test.mjs.

## Publication

Source checkpoint 63cbd5198d14adf6c54e92c486ff44cb3b16ad23 was pushed to main. It includes the newer approved bulk notification text change that was already on the shared branch.

Apple publication completed at 6:25 pm Sydney time on 12 October 2026. Channel app-store-release, runtime 1.0.0-app-store-release-1, update group 5291fe31-6d90-44b1-a857-79155a7b1e13, update 01a12f00-52bc-7e26-b144-61e5bd16246f.

Android publication completed at 6:29 pm Sydney time on 12 October 2026. Channel android-play-internal, runtime 1.0.0-android-play-internal-1, update group b6de0731-5542-4835-a803-af0142f0124e, update 01a12f03-d5eb-73af-8ed3-81cd23b85679.

Both native update feeds and their actual launch bundles returned HTTP 200 at 6:30 pm Sydney time. Both runtimes matched, and both downloaded bundles contained the new photo and file upload controls and photo library messages. Evidence is saved in work/portal-photos-2026-10-12/feed-verification.json.

The existing GitHub Pages preview deployment completed successfully for the source checkpoint: https://github.com/Juztforkickz/psi-performance-booking-app/actions/runs/38217456421.

The actual Photos form was rendered locally using React Native Web and inspected at approximately 393 px and 320 px phone widths. Both Upload controls fit without horizontal overflow; the controls wrap vertically on the smaller screen. Screenshots are saved in work/portal-photos-2026-10-12/photos-phone-preview.png and photos-small-phone-preview.png. This checks the form layout, with mocked data and no customer writes. It does not replace checking the native system picker on a physical phone.

A final independent code review found no material issues. Native picker interaction and a real customer upload have not been exercised on Matt's phone. To apply the published update, open PSI while online, allow the update to download, then fully close and reopen the app.
