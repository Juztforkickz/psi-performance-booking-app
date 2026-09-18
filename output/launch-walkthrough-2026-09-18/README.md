# PSI animated walkthrough — 18 September 2026

Approved format: animated demonstration using real PSI assets and source-checked wording, with fictional customer data. This is not an app screen recording. Matt approved this format in the current conversation.

## Deliverables

- Full walkthrough: 100 seconds, 19 scenes.
- Short advertising cut: 30 seconds.
- Both: 1080 × 1920 portrait, 30 fps, H.264/yuv420p MP4, fast start.
- Soundtrack versions use an original procedural instrumental score encoded as AAC. Silent alternatives are also supplied.
- Full-video text captions are supplied as SRT; key text is already visible within the videos.
- Finished downloadable files: `public/campaign-videos/launch-walkthrough-2026-09-18/`.
- Phone delivery URL: https://juztforkickz.github.io/psi-performance-booking-app/campaign-videos/launch-walkthrough-2026-09-18/

## Content

Home scroll; five booking request steps; request awaiting PSI review; changing a car illustration; entering a customer odometer reading; viewing pictures, dyno results, invoices and supporting documents; service reminder preferences.

The animation shows fictional actions only. Booking requests require PSI review. Archive features are labelled Performance+. The ending says **Launching soon**, not that the app is already available. No Meta campaign was published and no advertising spend was incurred.

Suggested post caption:

> Your car. Your PSI. Request your next workshop visit, keep kilometres current and explore your saved vehicle story. PSI Performance Garage is launching soon. Follow PSI for release news. Performance+ archive features require a paid subscription. Animated demonstration with fictional data.

## Validation

Both sound versions and both silent versions passed full FFmpeg decoding. MP4 box inspection confirmed `moov` precedes `mdat` for streaming. Exported frames were inspected across both timelines; the home tile, booking screens, artwork selector, documents and reminder controls were visible without clipping. HTML references were checked against packaged files. No browser or backend was used to create this animation.

`delivery-validation.json` contains hashes and sizes. Original renderer, fixture images and packaging script are archived here. Rendering requires Python with Pillow and NumPy, the repository's existing FFmpeg binary, Windows Segoe UI fonts and installed mobile Ionicons dependencies. Run `render_demo.py --render`, then `render_demo.py --render --short`, then `package_demo.py` to recreate outputs.

Only campaign assets and this delivery page were added. The mobile application and Apple submission were not changed by this work.
