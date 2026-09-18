# PSI complete customer guide — 18 September 2026

Matt requested a clearer, smoother and more complete showcase, including account setup and how the app operates. The approved format is a clearly labelled animated demonstration using PSI artwork and source-checked app behaviour. These are illustrated sequences, not screen recordings or live transactions.

## Deliverables

- **Complete guide:** 40 scenes, approximately eight minutes, with Australian computer-generated narration, restrained original music, on-screen instructions and caption files.
- **Launch showcase:** 90 seconds, 18 selected scenes with a separately written concise narration.
- Both are 1080 × 1920, 30 fps, H.264/yuv420p MP4 with AAC audio and fast start. Silent copies are also supplied.
- The phone delivery page includes playback controls, downloads, captions and chapter navigation.
- The ending says **Launching soon**. No Meta advertisement was published, advertising spend incurred or App Store submission changed.

Finished files are delivered under `public/campaign-videos/complete-guide-2026-09-18/`. Working narration WAVs, exports, contact sheets and verification results are retained under `work/launch-walkthrough-guide-2026-09-18/`.

## Covered operations

Approved customer access; emailed sign-in code; contact and vehicle setup; saved account; vehicle selector; Home navigation and shortcut customisation; car illustration and vehicle-photo selection; inline odometer editing; Service & Report request; contact and date preferences; reminders, policy and consent; staff review and booking status; dyno setup; Plan & Build contact draft; free and Performance+ access; all seven archive categories; free customer notes; pictures and document inspection; notification preferences; theme; events; customer-car listing enquiries; account help and privacy.

The tutorial explains that workshop records are read-only for customers, customer notes and odometer readings are separate, booking requests do not reserve dates, confirmation follows PSI approval and verified deposit, and contact drafts are not sent automatically. Document illustrations consistently use Alex Driver, DEMO001 and the same Holden vehicle. All records, figures, dates, email and account actions are fictional.

## Reproduction

Requires Python with Pillow and NumPy, Windows Segoe UI fonts, installed mobile Ionicons dependencies, the repository's existing FFmpeg binary, and the installed Microsoft James Australian voice for narration. Use the normal permitted PowerShell runtime; this workflow does not alter execution policies.

1. Run `create_documents.py` to generate the three fictional document illustrations.
2. Run `guide.py --prepare` to write narration scripts.
3. Run `narrate.ps1` using the normal permitted PowerShell runtime with access to the Windows speech engine.
4. Run `guide.py --boards` and inspect the storyboard.
5. Run `guide.py --render` for the complete narrated guide.
6. Run `guide.py --render --promo` for the 90-second narrated showcase.
7. Run `package_guide.py` to produce the phone page, silent copies and delivery validation.

The renderer imports drawing primitives and existing artwork from `output/launch-walkthrough-2026-09-18/render_demo.py`. The earlier videos remain available.

## Checks

Source audits covered account access, setup, garage, bookings, reports, Performance+, notifications, themes, events, listing enquiries and account help. Independent visual review identified and corrected tap locations, narration/action timing, inline odometer presentation, booking consent, category labels and fictional-document continuity. Encoded files are fully decoded by FFmpeg; packaging verifies fast-start MP4 boxes and local links. Final download verification checks file hashes, HTTP content types and byte-range seeking.

No app runtime, real customer account, email delivery, purchase, booking or backend was used to create this demonstration. Mobile source is unchanged.
