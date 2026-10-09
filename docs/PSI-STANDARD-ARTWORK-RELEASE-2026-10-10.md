# PSI standard artwork release, 10 October 2026

Matt authorised replacing the existing home panel picture in the live app.
The approved GT3 RS Manthey hero now replaces
`mobile/assets/images/psi-app-arrived-hero.webp`. The image remains 1672 by 941
pixels. The lossless WebP matches the approved Drive PNG's decoded pixels.
The component, framing, text, spacing and GTSR are unchanged.

Approved source: `05-Website-App-Hero-GT3RS-Manthey-1672x941.png`,
Drive file `1BtPQboZQCH9Zlaf6_e8uqRz-8vxhqowV`.

Application checkpoint: `f1fb3c042832ece9d729fee06c66f711f71cc63c`, pushed to
`main`. Mobile source and configuration match the previous verified release;
only this image changed within the mobile project.

## Validation and publication

All seven relevant layout tests passed. The actual exported app was inspected
at 320 and 393 pixel phone widths. The full picture and surrounding panel text
fit without cropping or overlap. Expo web export completed successfully.
GitHub preview run `37999443591` succeeded.

The existing Apple workflow completed validation, approval and publication:
https://expo.dev/accounts/psi-performance/projects/matt-psi/workflows/01a122c8-f9ed-7c16-95aa-db4afd7c67b3

| Platform | Channel | Runtime | Update ID | Update group |
| --- | --- | --- | --- | --- |
| Apple | `app-store-release` | `1.0.0-app-store-release-1` | `01a122cc-77ba-7744-a967-a23481d2167e` | `9d29a7bb-27c8-48dd-9973-f9d68532a8e0` |
| Android | `android-play-internal` | `1.0.0-android-play-internal-1` | `01a122cb-32a1-7171-96e5-3ecdf87c8b2b` | `a88ad3c8-20d1-4ab4-b8b2-3b1f7d3f4177` |

Both public Expo feeds returned HTTP 200 for their platform, channel and
runtime. Both manifests contain the replacement image hash. Downloading the
image using the manifest's asset request headers returned HTTP 200 and bytes
identical to the checked local file, 1,428,966 bytes.

Replacement SHA256:
`ed9c2d4ac3868880c1bf94eaaee997dfa371a4961ff4378011b7a84ecfafcd78`.

The delivery check initially omitted Expo's asset request headers and received
HTTP 403. Using the documented client protocol resolved that check. No app
code change was needed.

No native build, store resubmission, account, booking, subscription or backend
change was made. Beta, reviewer and Boost channels were not published.
These checks establish public update availability, not receipt on every phone.
Open the installed app online, allow its background download, then fully close
and reopen it to apply the update. A further launch may be needed.

## Recovery

Previous Apple group: `b644a4f7-277f-4411-bfa8-3fbdbcd83b6a`.
Previous Android group: `36421525-d4df-437d-9b2f-f986153b4542`.
Both previous releases use application checkpoint `bc218702a0051a82ae3f5bee042d8744e5968da1`.
Republish the matching prior group to its unchanged platform and channel if
rollback is needed. The original image also remains in Git history.

Local screenshots, approved source, original asset and compact verification
are preserved in ignored `work/gt3rs-app-image-2026-10-10`.
