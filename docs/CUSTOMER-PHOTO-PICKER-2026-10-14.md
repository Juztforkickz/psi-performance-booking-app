# Customer photo selection

The garage and profile photo buttons previously requested broad photo library
access before opening the system picker. Customers who denied that access could
not select their own image. Both buttons now open the system picker directly,
granting access to the selected image. Library selection uses the modern picker
without native editing. Garage framing remains available. Taking a new picture
still requires camera permission. Ask PSI attachments use the same direct picker.

Six component regression cases cover garage and profile selection on Android,
iOS and web with broad library permission unavailable, and confirm that denied
camera permission still prevents camera launch. Nine messaging tests also pass.
Native device interaction remains to be confirmed by customers after updating.

Publication uses the existing Android internal and Apple public OTA channels,
with unchanged runtimes and production environment. Web refresh uses the existing
GitHub Pages pipeline.

Source checkpoint `8a0a491` is published and pushed. Mobile typecheck, targeted
lint and all fifteen focused tests passed. Web deployment run `38512821201`
completed successfully. Android update `01a138ba-e0ea-7379-843d-0d41f6bfd18e`
published in group `2d1819bb-b87e-41ac-9e18-3022d02ce509`; iOS update
`01a138bb-1c35-7bf1-bfbd-222eb29c50d8` published in group
`d66267a9-2c4a-44d4-b891-1d3297a5b3f5`. Both existing channel feeds return
those exact updates, and both downloaded launch bundles match the local tested
exports byte for byte. Verification uses Expo protocol asset request headers.
Publication completed at 3:45 pm Sydney time on 14 October 2026.
Installed devices receive the repair after downloading the update and relaunching.

Customer file selection adds Upload file to both full and compact garage controls
and to the profile photo controls. It opens the platform file chooser with an
image filter and copies native selections to cache before image decoding. Selected
images retain their actual dimensions and enter the existing framing and account
save flow. Canceling leaves the saved photo intact; nonimage selections and unreadable
images are rejected. The operating system decides which installed cloud file
providers appear. No directory scanning or broad device storage permission is needed.
Fifteen photo component cases pass, including all three platforms, file selection,
cancellation, invalid files and the compact garage menu. Typecheck and targeted lint pass.

File chooser source checkpoint `c621e77` is committed and pushed. Web deployment
run `38513386914` succeeded. Android update `01a138bf-bfd6-7e8e-aaa4-b8d505a9eb06`
is published in group `c9e1d582-c1c8-4a5a-ab4e-359653fc8b9a`. iOS update
`01a138c0-b79a-761d-9b7e-656a24643bd5` is published in group
`b52dd220-bd0b-48d9-93d8-7bf2736d2ea3`. Both feeds and launch bundle downloads
are verified against the latest local export metadata. Existing runtimes, channels
and release settings are retained. This release supersedes the earlier picker update.
