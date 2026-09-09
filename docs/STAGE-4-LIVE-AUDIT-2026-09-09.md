# Stage 4 live audit — 9 September 2026

This audit verifies the existing PSI beta after the Performance+ rollout. It does not represent a public App Store release or activation of paid purchases.

## Recovery and source state

- The remote pre-Stage 4 recovery tag is `psi-beta-before-performance-plus-2026-09-09`, resolving to `8ec070d8c1264d7ac2017da86085ae8b5c1ff016`.
- The current beta source is on `main`. Existing unrelated uncommitted booking-payment changes remain preserved and excluded from this work.
- iOS build 9 is the current successful Store-distribution beta binary. It uses channel `beta` and runtime `1.0.0-beta-performance-plus-1`. Build 8 was cancelled and never supplied to testers.
- The beta-tester recording supplied on 9 September showed the older build-7 Home and Garage screens. This is an installed-build mismatch rather than an account or entitlement fault: build 7 cannot receive build-9 updates because it uses runtime `1.0.0-beta-demo-1`.

## Live Supabase

- Main project `PSI Performance App` and `PSI Apple Review Sandbox` are both `ACTIVE_HEALTHY` in Sydney.
- All five Performance+ migrations are present on main and sandbox: foundation, subscription sync, legacy invoice access, vault updates and permanent complimentary access.
- Main baseline remains 7 customer profiles and 8 vehicles. There are no live vault records, vault assets or workshop jobs yet.
- Matt's verified customer account has one revoked temporary beta entitlement retained for audit and one active permanent complimentary entitlement. The permanent row is production-only, has no expiry, does not renew and costs A$0.
- `performance-vault`, `vehicle-documents` and `vehicle-photos` are private buckets. The Performance+ bucket accepts approved image formats and PDFs up to 20 MB.
- Customer vault rows require ownership, publication and a current verified entitlement. Invoice and invoice-file restrictions are live as restrictive RLS policies. Deleted-identity locks are also restrictive.
- Performance+ files are opened through the JWT-protected `open-vault-file` Edge Function. It relies on customer-scoped RLS and issues a 60-second signed URL after access succeeds.
- Subscription sync, subscription webhook, Xero receiver, account deletion and private-file functions are deployed on main. Purchase/provider credentials remain intentionally inactive.
- Supabase security advice reports no Performance+ or private-storage warning. Existing advice is limited to the service-only push queue having no customer policy and optional leaked-password protection being disabled. PSI customer authentication currently uses passwordless email codes.

## Garage photos and artwork

- A selected iPhone photo first opens `Frame your car` and defaults to a 16:9 landscape crop.
- The customer can move the crop along the long axis or choose `Fit whole photo`.
- The saved image preserves its aspect ratio, converts to JPEG at 82% quality and is limited to 1600 pixels on its long resizing dimension.
- The Garage uses a fixed 16:9 frame and `contain` for customer photos. Images cannot be stretched. A fitted portrait can show clear space at the sides; the default landscape crop fills the frame.
- Customer photos use the private `vehicle-photos` bucket, a customer-ID/vehicle-ID path, an 8 MB upload limit and ten-minute signed display URLs.
- The Garage artwork control sits directly below the selected vehicle card. It opens a searchable 54-car silver collection. The saved illustration is customer- and vehicle-scoped and becomes that vehicle's Home tile artwork; it does not replace an uploaded private vehicle photo.

## Performance+ discovery refinement

- The text-heavy full-width Home promotion has been replaced with a normal dashboard tile so Performance+ does not dominate the customer Home screen.
- `Performance+` is selected by default immediately before `Settings & Notifications`; saved copies of either earlier default shortcut set migrate to this order while genuinely customised selections remain respected.
- The tile uses a large brushed-silver plus symbol over restrained charcoal, ice-blue and deep-petrol vault imagery, avoiding any one vehicle model as its centrepiece. It opens the existing Performance+ benefits, monthly/annual pricing, purchase and restore controls.
- The Garage and Vehicle Reports keep their contextual Performance+ entry points.
- The complete current interface was republished to the exact build-9 beta runtime from commit `7b82bf3`: update group `1aff1fb2-45c2-41fb-ad36-33c73c321d07`, iOS update `01a08578-b12f-70f1-9a4f-57de4d4f48d5`. It includes the plus-symbol Home tile, 54-car Garage selector and complete bright-theme refinements.

## Remaining launch work

- Configure and approve the monthly and annual Apple subscription products, provider credentials and App Store server notifications.
- Complete device tests for purchase, restore, renewal, cancellation, expiry, billing recovery, refund and account switching before enabling charging.
- Connect Xero OAuth and implement invoice fetching, verified customer/job/vehicle matching and the ambiguous-match review workflow.
- Perform the first supervised workshop-PC import using a real job manifest, then decide whether to install the watcher for routine use.
- Test Dyno PDF ingestion and checked manual power/torque entry with real Mainline exports.
- Add archive pagination, operational monitoring, backup restore rehearsal and the final public-launch beta data reset.
