# PSI Android native QA checklist

Status: signed internal QA APK prepared; physical-device acceptance remains
outstanding. This checklist begins when a supported Android phone is available.

## Evidence to record

- source checkpoint commit;
- EAS build ID and protected installation URL;
- phone manufacturer/model and Android version;
- app version/version code;
- synthetic customer identity used;
- tester name, date and pass/fail notes; and
- final Google Play screenshots containing no private customer information.

Never record passwords, email codes, access tokens, push tokens, signing-key
material or private service credentials in this file or an issue.

## Build and installation

- [x] Confirm Android application ID `com.psiperformance.booking`.
- [x] Create and retain the PSI-owned Expo-managed Android keystore.
- [x] Configure the protected `qa` profile as a directly installable APK with
  customer Auth enabled, booking QA enabled and public registration disabled.
- [x] Configure the production profile for a future Google Play App Bundle on
  the isolated `production` update channel.
- [x] Prepare the PSI launcher icon, adaptive icon, splash treatment and Google
  Play feature graphic.
- [ ] Install the latest protected QA APK on a supported physical Android phone.
- [ ] Confirm the PSI launcher icon, splash, dark presentation and first launch.
- [ ] Confirm the installed package, app version and version code match the EAS
  build record.

## Authentication and privacy

- [ ] An approved customer receives and verifies a six-digit email code.
- [ ] Invalid, expired, consumed/replayed and rapid resend attempts fail safely.
- [ ] Session restoration works after closing/reopening the app; sign-out clears
  private account data from every screen.
- [ ] Public registration remains unavailable.
- [ ] Customer A cannot read Customer B's profile, vehicle, booking, photo,
  invoice, dyno or notification data.
- [ ] Matt's staff portal remains unavailable to customers and requires AAL2
  authenticator MFA for workshop-wide data.

## Customer data, camera and files

- [ ] Profile and owned vehicle edits persist correctly.
- [ ] Camera permission is requested only after **Take photo** is chosen.
- [ ] Photo-library selection and direct camera capture both return to the app
  without closing it or losing the current form.
- [ ] A vehicle/profile photo uploads to private storage, reopens through a
  signed URL, can be replaced/removed and is unavailable after sign-out.
- [ ] Private invoice/dyno attachments open only for their owner.
- [ ] Customer odometer entries remain separate from PSI-verified service data.
- [ ] Account-deletion request and cancellation work; complete the separate
  controlled deletion procedure with a disposable account and private image.

## Booking workflow

- [ ] An owned vehicle can submit one pending request with AUD wording and no
  checkout.
- [ ] Service and Dyno flows open correctly, use the eligible Melbourne dates
  and display the current short-range weather presentation.
- [ ] Duplicate submission remains idempotent.
- [ ] PSI proposal, customer approval and cancellation states display correctly.
- [ ] The related customer/PSI emails arrive once per event.
- [ ] Cancellation clears any unpaid expected deposit.
- [ ] No client or staff action can mark payment complete.
- [ ] No Google Calendar event exists before the trusted future
  payment-confirmed transition.

## Notifications

- [ ] Permission appears only after **Enable device notifications** is selected.
- [ ] Android notification channel is visible in system settings and permits
  banners, default sound and app-icon badges where the launcher supports them.
- [ ] Denial leaves in-app notifications and email available.
- [ ] Foreground and background booking alerts show with sound as expected.
- [ ] Badge behaviour is recorded for the tested Android launcher.
- [ ] Customer notification deep links open only safe customer routes.
- [ ] A published PSI Event appears for the customer, sends an alert, opens the
  safe Events route and can schedule its local reminder.
- [ ] Event changes and cancellation notify the customer once; a customer cannot
  create, edit, publish or cancel an event.
- [ ] Matt-only staff notification deep links recheck staff status and AAL2.
- [ ] Sign-out or disabling notifications prevents further account delivery to
  that registered device.

## Android behaviour and presentation

- [ ] Check system Back and predictive-back behaviour on every primary route.
- [ ] Check Home, Garage, Vehicle Reports, Bookings, Plan & Build, Trusted
  Partners, Events, Account, Settings, Privacy, Support and Delete Account.
- [ ] Check portrait layout, keyboard resize/avoidance, larger text, TalkBack
  labels/focus order, external links and the KNG Tow two-number call chooser.
- [ ] Check camera/photo permission denial, later re-enabling through Android
  settings and return-to-app behaviour.
- [ ] Confirm every approved partner logo and detail, including Luxe Automotive
  Interiors.
- [ ] Capture the required Google Play phone screenshots from the accepted build
  and confirm the 512x512 icon and 1024x500 feature graphic remain current.
- [ ] Compare final Google Play Data safety, content-rating and target-audience
  answers with the signed binary.

## Exit criteria

The Android QA gate passes only when every applicable item above has evidence,
there are no unresolved security/privacy failures, and PSI approves the final
screenshots and disclosures. An iPhone pass, web preview or Expo simulator does
not replace physical Android acceptance.
