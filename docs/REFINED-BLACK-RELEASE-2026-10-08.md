# Refined black colour release

Matt approved the actual Home preview and authorised the colour upgrade on 8 October 2026.

## Changes

The dark palette now uses a near black canvas, charcoal cards, lighter secondary text and softer frames. The dashboard images have an 18% brightness adjustment at display time. Original artwork is unchanged. The PSI blue, navigation, booking behaviour, existing Bright palette and native configuration are preserved.

The shared palette covers the customer app, workshop portal and booking screens. Apple and Android use their existing compatible runtimes. Boost and Ask PSI remain private, behind the existing review environment gate. No messaging backend, push or email service is activated by this release.

## Validation

TypeScript and lint passed. All 19 targeted theme and Ask PSI privacy and interaction checks passed. The actual app was exported for inspection in the isolated review sandbox. Phone layout had no horizontal overflow. Both public environment configurations and runtime identities were checked before publishing.

## Expo allowance

The signed in PSI Performance Billing page showed Free, 24 of 1,000 monthly updated installations and 183.54 MiB of 100 GiB bandwidth on 8 October 2026. Upcoming bill estimate: AUD $0. The usage period is 1 October through 1 November 2026. Expo notes that usage estimates can lag by 24 hours.

Repeated updates to the same installation count once toward the monthly installation allowance, but downloads still consume bandwidth. Existing cached images are reused. No plan upgrade or paid build is required for this colour change.

## Rollback

Source before this change: `f9a5f25`.

Public updates before this release:

* Apple channel `app-store-release`, runtime `1.0.0-app-store-release-1`, update group `813b4e3b-cba0-41ac-818a-1e38c4ad977f`, source `66414850962c8d5e68169904c93373e9d8f529de`.
* Android channel `android-play-internal`, runtime `1.0.0-android-play-internal-1`, update group `8f90e9af-c83c-465e-b671-6297692ff817`, source `a39dbe286a208e0b966df8da35d0b` (full hash in the accompanying rollback JSON).

Use Expo's existing republish operation on the matching channel and platform if rollback is required. Do not replace a channel mapping or recreate a runtime. Compact rollback references and the inspected Home screenshot are saved in `output/refined-black-release-2026-10-08`.

## Confirmed publication

Application checkpoint: `75cee2ac1a39caa0d9f472b3e85f2791183434da`, committed and pushed to `main`.

* Apple workflow `01a118ec-2596-72d3-904a-0fe3bc02d4db` succeeded through validation, the existing approval job and publication. Apple update group: `5eb71499-83c4-4b57-acc7-1db74b4a0ff3`.
* Android update group: `3312f98d-a31d-424e-8867-c475a20c27c8`. Publication used the existing Play channel and production environment. Expo reported no new assets to upload.

Both public channel mappings were read again after publication and confirmed to serve application checkpoint `75cee2a` on their unchanged compatible runtimes. Compact publication records and Apple workflow evidence are saved alongside the rollback JSON. No store resubmission, native build or plan upgrade was made.

Requests to the public Expo update endpoint, with each installed app's platform, channel and runtime headers, also returned the exact new update IDs. Apple: `01a118f0-c398-77d5-b411-e8837e77ec99`. Android: `01a118ee-0e6a-7aa9-a070-31d2eb84b4d2`. These read only checks confirm public availability; they do not claim every customer's phone has already downloaded the update.

Secondary text contrast against the updated surfaces ranges from 5.72:1 to 12.87:1. The visual inspection was a browser rendering of the real app at phone size, not a new physical device test.

To receive the update, open the installed public app while online, allow the background download, then fully close and reopen it. Some installations can require another launch before the downloaded update is applied.
