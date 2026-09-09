# Garage artwork expansion — 9 September 2026

This refinement keeps the existing app, garage photo handling, subscription split and private per-vehicle preference table. Garage personalisation remains free. No database migration, customer-record change or new dependency is needed.

## Selection experience

The garage shows one compact selected-artwork row. It opens a searchable library with make filters, model/generation labels and a confirmed selection. Relevant makes/models sort first using the selected vehicle's existing details; nothing is assigned automatically. An unchanged draft follows a saved choice that arrives after opening. Cancel does not save. Failed saves leave the selection available for retry.

The library uses a virtualised list and separate 480 × 270 JPEG thumbnails. Full portrait artwork is used for the existing garage/dashboard composition. The header scrolls; short screens and large text get a compact footer, and the footer yields space while the keyboard is open. Existing uploaded photos take priority on the vehicle profile; illustrations still personalise the home tile.

The 54 full artwork JPEGs total 6,566,122 bytes; all 54 thumbnails total 965,670 bytes. Combined library size is about 7.5 MB. The additions and thumbnails add about 4.75 MB over the original 20-illustration collection. These are app/preview assets and do not consume customer Supabase Storage capacity.

The 20 original saved IDs and all 18 first-expansion IDs are retained. The expanded collection has 54 model/generation choices. The Instagram-informed set adds VE GTS, VT Clubsport and Senator, VZ Senator, VF Tourer, VN SS, VY Calais, VZ SS, VF Storm, VE SS V Sportwagon, C5 Corvette, Nissan 370Z, Audi S3, Mercedes-AMG E63 S and C63 S, and RAM 1500. This is a selectable illustration collection, not a catalogue of individual customers or exact photographed builds.

## Research and coverage

The user explicitly requested Commodore VF, HSV VS GTS, Hyundai Veloster and i30 N. Veloster FS Turbo and i30 N PD hatch are clearly labelled artwork options; the user's message did not establish the generation of a particular customer's vehicle. The phrase “echo nuts” was not interpreted as another model.

PSI's [own website](https://psiperformance.com.au/) identifies a WM Caprice and a 2005 Clubsport in customer testimonials. Those support including the model families; personal names and vehicle registrations were not copied into the app.

Indexed reproductions of PSI's captions on [FindGlocal](https://www.findglocal.com/AU/Pakenham/580648228624691/PSI-Performance) supported VF/VE/VY Commodores, SS utes, Maloo, Grange and Calais variants. [Autoyas](https://www.autoyas.com/AU/Pakenham/580648228624691/PSI-Performance) supplied additional indexed references to VX Commodore, 1955 Bel Air and VZ GTO. These are secondary mirrors with varying cached periods, not verified original social-post permalinks or a complete history. Some trim/body details remain illustration choices rather than confirmed customer specifications.

The owner later authorised a read-only review of PSI's signed-in Instagram profile in Edge. The address bar and profile identity were verified before the current workshop grid was sampled. The sample confirmed recurring VE/VF/VY/VZ/VN Holden and HSV variants, VT Clubsport and Senator, VF Tourer, VZ Senator, C5 Corvette, Nissan 370Z, Audi S3, Mercedes-AMG E63 S and C63 S, and a 2022 RAM 1500. That evidence supports the final workshop-focused additions without using customer names, registrations or individual photographed builds in the app. The sample is not a claim that every one of the profile's historical posts was audited. No messages were opened and no likes, posts, profile details or account settings were changed.

## Artwork and reproducibility

All 18 new vehicles were generated with the built-in imagegen tool, using the existing Porsche as the style/composition reference: metallic silver, charcoal studio, black wheels, restrained ice-blue accents and the same front three-quarter framing. Artwork agents inspected each output and corrected unsuitable generation details before handover.

The saved JPEGs and prompt manifest are under `mobile/assets/images/garage-vehicles`. `manifest.json` preserves the generation prompts and labels. Generated PNG originals remain in the local Codex visualisation folders `garage-art-expansion` and `garage-art-workshop`; they are not bundled in the app. `mobile/scripts/prepare-garage-thumbnails.py` deterministically prepares the thumbnail set with the existing Pillow runtime. Customer uploads are never processed by this script.

Implementation: `mobile/src/lib/garage-art-catalog.ts`, `garage-art-assets.ts`, `mobile/src/components/garage-artwork-picker.tsx` and its existing garage call site. Original account/vehicle ownership policies continue to enforce preference access.

## Delivery and rollback

Validation: mobile TypeScript and changed-file ESLint passed; all 25 web routes and the compatible build-9 iOS bundle exported successfully; 16 existing review/demo isolation checks passed. Direct catalogue checks passed for all 54 asset pairs, unique/storable IDs, make filtering, 16 exact recurring-model searches, empty results and make/model suggestion ordering. All full illustrations retain the 4:5 ratio and all picker thumbnails are 480 × 270. An independent source review found and then verified corrections for the asynchronous saved-choice race and short-screen layout issue. Every new generated artwork was visually inspected.

The pre-subscription tag `psi-beta-before-performance-plus-2026-09-09` remains intact. The immediate pre-expansion source checkpoint is `b8d6b2a`. This change adds JavaScript and static artwork only; it requires no native module or runtime change. A beta OTA update, if published, must use the exact build-9 runtime `1.0.0-beta-performance-plus-1` and beta channel. Build 7's different runtime must remain unaffected. Public GitHub Pages continues through the existing workflow; no Netlify deployment is involved.

Published code checkpoint: `b85a8c57d52f8bfb1e1bd934a13e56754a726a1f` (feature commit `a586ae8`). The [GitHub Pages deployment](https://github.com/Juztforkickz/psi-performance-booking-app/actions/runs/34291963785) passed. [Open the garage preview](https://juztforkickz.github.io/psi-performance-booking-app/garage).

The native iOS export also passed and the [beta update](https://expo.dev/accounts/psi-performance/projects/matt-psi/updates/2e9f576e-4798-49d8-81cf-71cd2ee6206c) was published successfully: group `2e9f576e-4798-49d8-81cf-71cd2ee6206c`, iOS update `01a0836b-4529-70a5-80cf-1a8eba4070f4`, beta channel/branch, runtime `1.0.0-beta-performance-plus-1`. Only compatible iOS builds can receive it; build 7 keeps its previous `1.0.0-beta-demo-1` update. No new binary was submitted and no subscriptions were activated for this refinement. Installed-device receipt and interaction testing remain to be confirmed.

The updater reported a dirty working tree solely because the five pre-existing unrelated root booking-payment files remain uncommitted. They were preserved and excluded from this checkpoint and are outside the mobile bundle. If recovery is required, use the saved code checkpoint or Expo's supported rollback-to-embedded workflow for the exact build-9 runtime; never publish Stage 4 JavaScript to build 7.
