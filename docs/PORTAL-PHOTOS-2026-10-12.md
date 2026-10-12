# Portal Photos, 12 October 2026

The workshop record option is now called Photos. Its form no longer offers Before, Progress or After. New portal photo uploads use the existing nullable asset phase without a stage label. Dyno report stages and previously saved records retain their current behaviour.

The photo form has two compact Upload actions with trailing icons. The primary photo icon opens the system photo library directly and supports multiple images. The file icon opens Files for images or PDFs. Both have explicit accessible labels and hints. Cancelling preserves the current selection. Selected photo metadata is adapted to the existing file uploader, including a fallback filename and MIME type and the required lastModified field. Original photos still pass through the established image resizing and private storage flow. Staff confirmation, customer and vehicle matching, preview restrictions and publishing protection remain in place. The photo library API was checked against the [Expo ImagePicker documentation](https://docs.expo.dev/versions/latest/sdk/imagepicker/).

Validation: 32 staff workflow regression tests passed. Mobile typecheck and lint of all shipping source, scripts and configuration passed. The local full directory lint also visited an ignored archived mobile checkout and reported unrelated archive errors; the shipping source check is clean. A read only database query confirmed vault_assets.phase already accepts null, so no schema or existing record changes were necessary.

Changed files: staff-record-workflow.tsx, staff-vault-publisher.tsx, staff-vault.ts and staff-record-workflow.test.mjs. Release evidence follows below after publication.
