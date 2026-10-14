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
