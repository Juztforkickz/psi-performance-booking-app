# PSI app — refreshed promotional pack

13 September 2026 campaign revision. The approved website launch artwork opens the videos in separate full-screen Reel and Feed compositions. Performance+ remains the main hook, all ten trusted teams share one screen, and the dyno scene uses the newly supplied **THE RESULT. THE PROOF.** poster. See `OPENING-REVISION.md` and `PARTNER-REVISION.md` for the section previews and source details.

**Delivery status:** final rendering and visual/media verification passed on 13 September. All ten MP4s fully decode and match their expected dimensions and lengths. The original 12 September first cuts and earlier 13 September delivery are retained. The latest corrected pack is named **App Promo - Martini Black - 13 September 2026**, under **Desktop → PSI APP → Organized → Branding**, with **PSI-App-Promo-Pack-2026-09-13-Martini-Black.zip** alongside the finished files. See `MEDIA-VALIDATION.md` for the checks and full-video hashes.

## Social videos

| File | Where to use it | Length / size |
| --- | --- | --- |
| `social/PSI-Performance-App-36s-Reel-9x16.mp4` | Main Instagram/Facebook Reel or Story | 36 seconds · 1080 × 1920 |
| `social/PSI-Performance-App-15s-Reel-9x16.mp4` | Short hook / teaser | 15 seconds · 1080 × 1920 |
| `social/PSI-Performance-App-36s-Feed-4x5.mp4` | Instagram/Facebook feed | 36 seconds · 1080 × 1350 |

All three are H.264 MP4 at 30fps, with readable text built into the video. They are silent so licensed music can be added inside Facebook or Instagram. `social/Captions.txt` provides launch copy and separate preview-safe copy. The matching JPEG covers can also be used as static posts.

The full video includes Performance+, the private vehicle vault, dyno history, all ten trusted teams, Customer Cars for Sale, and everyday Garage / Bookings / Plan & Build. The revised timeline retains 36 seconds and 15 seconds respectively, with one partner screen held for six seconds in the main edit and three seconds in the short edit.

`social/PSI-Dyno-Artwork-Clean.png` is the clean standalone dyno picture. Instagram controls have been removed and the heading restored. The original chart, displayed result panels, slogan and car are preserved from the supplied screenshot. The lossless master comparison scored SSIM 1.000000 across the original chart/result region. See `DYNO-RESTORATION.md` for source details and prompts. The feed video slowly reveals the portrait from heading to car; the vertical videos show it complete.

## Website artwork and video

- `website/psi-app-preview-hero.png` / `.webp`: **Meet the PSI app** version, suitable before the public store release.
- `website/psi-app-arrived-hero.png` / `.webp`: **It's arrived** launch artwork, ready for release day.
- `website/psi-app-arrived-loop-16x9.mp4`: 12-second silent landscape launch animation.
- `website/psi-app-preview-loop-16x9.mp4`: corresponding preview animation.
- `website/psi-app-launch.liquid`: complete Shopify section with configurable media and download buttons.
- `website/psi-v3-app-aside-preview.liquid`: smaller replacement for the existing Coming Soon panel.
- `website/README.md`: installation and release steps.

The Shopify section is ready to install. It defaults to the preview, and only shows the launch headline and a platform's download button when that platform's real store link has been supplied and checked. The ten partner logos are included in `website/partner-logos` for uploading.

## What is live

These are locally prepared promotional assets. Nothing in this campaign revision has been posted to social media or installed/published to the live Shopify theme. Full-video verification is complete.

The last verified Apple status was **Prepare for Submission**, and public Android availability has not been verified. The revised full social videos open with **IT'S ARRIVED**, so they are launch assets: hold them until the public store links for every advertised platform and Performance+ availability are verified. A prepared image or video does not establish public availability. Before release, use only the website's **Meet the PSI app** image/video with the preview-safe caption.

The preview link is: https://juztforkickz.github.io/psi-performance-booking-app/

Performance+ is an optional paid subscription. Available history depends on what PSI publishes to each vehicle. Car listings require owner permission and PSI approval. No private customer files were used in the new campaign.

## Editing and original files

The source artwork, recovered original video and reproducible FFmpeg edit are retained in the project workspace under `output/promo-refresh-2026-09-12`. The delivery folder contains only the finished assets and Shopify files; it does not contain integration keys, customer exports or the video-rendering software.
