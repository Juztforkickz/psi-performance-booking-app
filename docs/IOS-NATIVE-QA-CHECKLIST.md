# PSI iPhone native QA checklist

Status: signed QA build installed 29 August 2026. The first Apple release is
iPhone-only; initial authentication passed and broader real-device acceptance
remains in progress.

## Evidence to record

- source checkpoint commit;
- EAS build ID and installation URL;
- iPhone model and iOS version;
- app version/build number;
- synthetic customer identity used;
- tester name, date and pass/fail notes; and
- screenshots of each final store screen with no private customer information.

Never record passwords, email codes, access tokens, push tokens, D-U-N-S numbers,
Apple enrolment identifiers or service credentials in this file or an issue.

## Build and installation

- [x] Apple organisation membership is active and the organisation name is PSI
  PERFORMANCE PTY LTD.
- [x] Register the approved iPhone for the internal QA build.
- [x] Create/reuse Expo-managed iOS distribution and push credentials under the
  PSI-owned Apple team.
- [x] Build the `qa` profile for iOS from checkpoint `7748a95`; EAS build
  `8a1e5433-1056-45f0-83d2-e470ba57b652` completed successfully.
- [x] Build the Account sign-in-first update from checkpoint `04c6e74`; EAS
  build `e4301f59-d444-4fb7-8c08-394f0ba4a5bb` completed successfully.
- [x] Build the final PSI launcher-label, PERFORMANCE icon and notification UI
  update from checkpoint `c151cef`; EAS build
  `233ee61e-b9a0-41a0-bf20-77b6c410ec2f` completed successfully.
- [x] Build the standardised, smaller Home dashboard tile update from
  checkpoint `3406354`; EAS build
  `acce75be-e92a-4c8c-82d8-efcb800aa9ff` completed successfully.
- [x] Build the artwork-fit correction from checkpoint `05d4e1d`; EAS build
  `5c1df258-125e-41ec-a097-4d52b915477d` completed successfully.
- [x] Build the five-image vertical-alignment and black-fill update from
  checkpoint `d2545c2`; EAS build
  `1205ab6c-93c1-4417-a0e1-b01b58ffcad6` completed successfully.
- [x] Confirm bundle ID `com.psiperformance.booking`, version/build number and
  iPhone-only support in the build details.
- [x] Install from the protected EAS page and confirm the PSI icon, splash and
  launch experience.

## Authentication and privacy

- [x] A known approved customer receives and verifies a six-digit email code on
  the registered iPhone.
- [ ] Invalid, expired, consumed/replayed and rapid resend attempts fail safely.
- [ ] Session restoration works after closing/reopening the app; sign-out clears
  private account data from every screen.
- [ ] Public registration remains unavailable.
- [ ] Customer A cannot read Customer B's profile, vehicle, booking, photo,
  invoice, dyno or notification data.
- [ ] Matt's staff portal remains unavailable to customers and requires AAL2
  authenticator MFA for workshop-wide data.

## Customer data and files

- [ ] Profile and owned vehicle edits persist correctly.
- [ ] A vehicle photo uploads to private storage, reopens through a signed URL,
  can be replaced/removed and is unavailable after sign-out.
- [ ] Private invoice/dyno attachments open only for their owner.
- [ ] Customer odometer entries remain separate from PSI-verified service data.
- [ ] Account-deletion request and cancellation work; complete the separate
  controlled deletion procedure with a disposable account and private image.

## Booking workflow

- [ ] An owned vehicle can submit one pending request with AUD wording and no
  checkout.
- [ ] Duplicate submission remains idempotent.
- [ ] PSI proposal, customer approval and cancellation states display correctly.
- [ ] The related customer/PSI emails arrive once per event.
- [ ] Cancellation clears any unpaid expected deposit.
- [ ] No client or staff action can mark payment complete.
- [ ] No Google Calendar event exists before the trusted future
  payment-confirmed transition.

## Notifications

- [x] Permission appears only after **Enable device notifications** is selected.
- [ ] Denial leaves in-app notifications and email available.
- [ ] Foreground and background booking alerts show with sound as expected.
- [ ] App-icon badge increments and clears correctly.
- [ ] Customer notification deep links open only safe customer routes.
- [ ] Matt-only staff notification deep links recheck staff status and AAL2.
- [ ] Sign-out or disabling notifications prevents further account delivery to
  that registered device.

On 29 August 2026, three isolated delivery checks were accepted for the one
registered iPhone. The tester confirmed a PSI lock-screen banner, the normal
notification sound and an app-icon badge change from one to two. No push token
or device identifier was recorded. Foreground presentation, deep-link routing,
badge clearing and unregister behaviour remain open, so the combined checklist
items above are intentionally not marked complete yet.

## Presentation and store evidence

- [ ] Check Home, Garage, Vehicle Reports, Bookings, Plan & Build, Trusted
  Partners, Account, Settings, Privacy, Support and Delete Account on the target
  iPhone in light/dark system conditions where applicable.
- [ ] Check portrait layout, keyboard avoidance, Dynamic Type, screen-reader
  labels, focus order, external links and the KNG Tow two-number call chooser.
- [ ] Confirm every approved partner logo and detail, including BNB Autohaus.
- [ ] Recapture the five store screenshots from this signed build at an accepted
  iPhone size, crop only device chrome, and export opaque JPEG/PNG files.
- [ ] Compare final App Privacy and age-rating answers with the signed binary.

## Exit criteria

The iPhone QA gate passes only when every applicable item above has evidence,
there are no unresolved security/privacy failures, and PSI approves the final
screenshots and disclosures. A passing web/PWA preview or unsigned Expo Go test
does not replace this signed-native acceptance.
