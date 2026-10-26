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

93 targeted and preservation checks passed, including 24 update controller/lifecycle cases and existing booking, deposit, Rewards, Wallet access and owner complimentary double rules. Mobile TypeScript and targeted ESLint passed. Native export, signed Android build, published update delivery, Google Play submission and icon readback receipts are recorded in `work/android-update-repair-2026-10-26/`. Pending steps must not be described as completed until their receipts confirm success. A real customer phone's installation and next update remains a separate device observation.

No Supabase or financial changes, Apple update publication, new fees or paid plan upgrades are part of this repair. Google Wallet publishing remains held separately.
