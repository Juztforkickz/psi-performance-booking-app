# Android automatic update repair

Matt authorised repairing Android update delivery and matching the Google Play icon to Apple's, preserving customer information and features, on 26 October 2026.

## Verified starting point

Google Play production still serves 1.0.2, build 8, released 5 October. Its EAS build is `2419ff37-2dbb-47ec-84f8-b71939e87f8f`. The native build log confirms `android-play-internal` request headers, and its runtime is `1.0.0-android-play-internal-1`. That channel already serves the latest approved features. The 25 October update bundle and all 236 assets were downloaded and their integrity verified. The customer's old interface therefore does not establish a channel mismatch. The exact failed download or launch on that phone remains unobserved.

The published Google Play listing uses the PSI only icon. Apple and the existing native source assets use PSI PERFORMANCE. The existing `public/psi-icon-512.png` is the approved 512 pixel store asset and visually matches Apple's published artwork. No replacement logo is generated.

## Repair

Android now checks at startup, on return to the foreground and periodically while active. Requests are coalesced and throttled. A completed download can apply automatically before customer screens mount. Startup waits at most eight seconds, then opens the existing app and allows the download to continue. A late download cannot restart a mounted booking, payment, upload or other form. It opens on the next cold launch, or through an explicit restart in Settings. Offline use remains available.

Settings shows update progress, content date, retry and restart actions, and minimal support details: installed build, update identifier, channel, recovery state and a provider error code. Native stack traces, credentials, URLs and customer data are not displayed or uploaded.

A private update attempt marker prevents repeated automatic restart loops. This is a separate AsyncStorage key. Authentication, customer profiles, vehicle records, saved documents, points, bookings, purchases, file storage and subscription permissions are not altered. Native signature validation, runtime selection and failed update quarantine remain enabled. No custom update URL or channel override is added.

The repair applies only to the existing live Android channel/runtime. Apple, web, review and QA startup behavior remains unchanged. Android's new store version is 1.0.3, keeping the existing package, update runtime, signing identity and live backend. Customers unable to receive automatic updates may require this one Google Play update to obtain the repaired updater and current bundled features. Future compatible updates download automatically; native changes can still require a store release.

## Validation and release

93 targeted and preservation checks passed, including 24 update controller/lifecycle cases and existing booking, deposit, Rewards, Wallet access and owner complimentary double rules. Mobile TypeScript and targeted ESLint passed. The Android export and signed native build passed.

Source checkpoint `1287ef8522e548cca71fe723707c55b6c239a393` is pushed. Pages run `40252262733` succeeded. Android update `01a175c4-2731-7192-b354-cf0ef01dd452`, group `5ee74596-53a8-453e-b0c6-9645f697604a`, is published on the existing channel/runtime. The public bundle SHA256 is `acb3e2606a9e090556afb9298554910b98e3d1f7debfa9b4ff40b4ac713ff64d`, matching the tested export. Both correct loading artwork files match source; the rejected yellow wheel image is excluded.

EAS build `b7dbf266-b6ee-4e16-aebc-5bc3f0336e99` completed at 12:21 pm Melbourne on 26 October. The original AAB is 110,550,951 bytes, SHA256 `5715b011b6dbea303fc60a7801e17b67190202f08550f0410599f317220c851c`. Inspection of the actual signed manifest confirms automatic updates ALWAYS enabled, the correct server, request header and runtime. Its upload signing certificate matches the existing PSI build. The compiled bundle includes the repair, and the extracted native launcher visually matches the approved PSI PERFORMANCE artwork.

Google Play accepted version 1.0.3, build 9, into the existing production track. Supported devices and existing targeted country are preserved. The rollout targets 100 percent of the existing audience. Google reports no validation errors and two nonblocking warnings: larger installation size, 65.4 MB with a 23.4 MB update estimate, and absent deobfuscation mapping. No unrelated native optimisation or SDK migration was introduced.

At 12:32 pm Melbourne, Publishing overview confirms **Changes in review**, with exactly two submitted changes: the 1.0.3 (9) production rollout and the matching PSI PERFORMANCE icon. Google's quick checks are still running. Managed publishing remains off, so approval can publish automatically. This is submission evidence, not approval or public availability. The old public version and icon can remain visible until Google completes processing.

Private receipts and screenshot are in `work/android-update-repair-2026-10-26/`, including `release-verification.json`, `bundle-verification.json`, `identity-verification.json`, `android-export-verification.json` and `google-review-submitted.png`. A real customer's installation, latest interface and next automatic update remain separate physical device observations; no Android phone or emulator was available in this session. Do not claim successful installation on every phone from server download checks alone.

No Supabase or financial changes, Apple update publication, new fees or paid plan upgrades are part of this repair. Google Wallet publishing remains held separately.
