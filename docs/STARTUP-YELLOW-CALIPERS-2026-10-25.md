# Loading artwork correction, 25 October 2026

Matt clarified that the Porsche must have black wheels with yellow brake calipers, using the version already made. The yellow wheel rim loading image is rejected and must not be restored.

The correct existing reference was found in `Performance Plus - Approved Wallpaper Sizes/Workshop Desktop - 1920x1080.png`. It shows Tori, the black Holden and the grey GT3 RS with black rims and yellow calipers. The existing phone wallpaper contains large blank margins, so it was not substituted directly into the full height loading screen.

Built in ImageGen edit mode used the previous portrait solely as the composition target and that approved workshop artwork as the Porsche reference. The edit replaced the Porsche with the earlier black wheel, yellow caliper version, preserving Tori, garage, wording, phone logo and wet floor. This is illustrative app artwork. The private owner garage asset was not used or published.

Current bundled assets:

* `mobile/assets/images/psi-startup-tori-yellow-calipers.png`, corrected full height portrait.
* `mobile/assets/images/psi-startup-tori-calipers-landscape.png`, the existing approved landscape artwork copied without changes.

`GarageStartupScreen` uses these two assets with its existing cover scaling. The installed native first frame logo, all customer information, Rewards, subscriptions and backend remain unchanged.

The rejected PNG has SHA256 `51a9b428c7801870373d38cbbe1437f459c75f4a4446cfeb332c6d71f31b9cdd`. Cleanup checks exact bytes and decoded pixels, without deleting similar correct artwork. Image locations, deletion receipts, exact edit prompt, platform publication and delivered asset verification are kept under `work/startup-calipers-2026-10-25/`.

Validation uses mobile TypeScript, targeted ESLint, visual inspection of the corrected asset, and comparison of delivered phone bundles and artwork bytes with the release exports. No unrelated backend or customer changes and no new store binary are required.

The two superseded yellow wheel update groups are retired after the corrected releases are verified. Removal from current source and distributions cannot erase historical Git objects, provider retained CDN copies or bytes already cached on individual devices. Those limitations must not be reported as complete global erasure.
