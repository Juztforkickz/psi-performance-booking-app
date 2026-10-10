# Personal garage artwork, 10 October 2026

Approved account-specific artwork is served from private Storage. Image bytes,
registration details and account identifiers are excluded from the repository
and OTA package. Source code contains only the generic personal artwork option.

The app requests signed images under the signed in user's own identity folder.
Private Storage policies grant access only to the verified existing owner role.
Successful private image access enables the personal choice in search, picker,
saved ID resolution and selection. Failed access uses the existing public
Porsche fallback. Sign out and account switching immediately hide private state.
Signed links refresh while active and expire after ten minutes.

The database selection policy is restrictive and preserves existing vehicle
ownership and deleted identity checks. The owner is resolved from existing
active staff membership and confirmed Auth identity, without hardcoded account
identifiers in migration source. Other customers cannot select personal artwork
or read its private image objects. The public image endpoint denies access.

Six tests cover persistence, catalogue assets, saved selection validation,
entitlement filtering, fallback resolution, private loading and account
switching. Mobile typecheck and source lint pass. The complete approved image
is retained in the 16:9 thumbnail. Live database tests cover owner and other
customer access, using rolled back test writes. Public Porsche art is unchanged.

The private image was prepared with built-in image generation from approved
car and interior references. Its final edit lowered the plate below the bumper
crease while preserving the car, lighting and framing. Full source and private
release evidence remain in ignored local work files.

Android publication was verified against its public delivery feed and delivered
bundle. Update `01a12334-5f2a-767a-9d47-6e9871313a37` is available on the existing
`android-play-internal` channel and `1.0.0-android-play-internal-1` runtime.
The private image bytes are excluded from its asset manifest.

Apple release workflow `01a12331-7ee5-71f6-ae32-d27944c5b306` passed validation
and reached its approval step. At 00:38 UTC on 10 October, the public Apple feed
still served the previous update, so Apple publication is not yet verified.
Saved browser permissions currently block the release approval and final
account preference activation. Readback still shows the public Porsche choice.
The generic policy is installed, but its migration history entry remains pending
with that activation transaction. Do not report the personal selection as live
until account readback and the Apple delivery feed confirm completion.

Existing channels, runtimes, subscriptions, bookings and owner benefits remain.
Reviewer, beta and Boost channels are excluded.
