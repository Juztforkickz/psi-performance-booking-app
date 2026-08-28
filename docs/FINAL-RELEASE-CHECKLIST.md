# Final release checklist

Status: controlled QA, 29 August 2026. Payments are deliberately last.

## Ready in controlled QA

- [x] Sydney-hosted Supabase Auth and RLS customer ownership foundation.
- [x] Passwordless email-code sign-in for approved existing accounts.
- [x] Matt-only staff access with authenticator assurance level AAL2.
- [x] Customer account editing, owned vehicles and private workshop records.
- [x] Account-deletion request, cancellation and owner queue.
- [x] Approval-first booking requests with customer and PSI email delivery.
- [x] Server-only Google Calendar connection; customers cannot list calendar
  contents and no event is created before the trusted confirmed transition.
- [x] Public GitHub Pages demo remains synthetic and submission-disabled.
- [x] Customer privacy, support and booking-policy screens.

## Required before inviting external customers

- [x] Obtain an active D&B record for **PSI PERFORMANCE PTY LTD**. D-U-N-S
  status was confirmed on 29 August 2026; the identifier is intentionally not
  stored in the public repository.
- [x] Submit Apple Developer Program organisation enrolment through the Apple
  Developer app. Apple review began on 29 August 2026; private enrolment and
  D-U-N-S identifiers are intentionally excluded from the repository.
- [ ] Receive Apple approval, pay/activate the membership and confirm the
  displayed seller name is **PSI PERFORMANCE PTY LTD**.
- [x] Exercise the ordered database deletion path against QATEST1 in a
  rollback-only transaction and confirm the synthetic account remains intact.
- [ ] Complete signed-native deletion acceptance with a disposable account and
  private test image; approve PSI's retention schedule and response template.
- [ ] Complete two-customer isolation, expired/replayed email-code, sign-out and
  private-file regression tests on signed native builds.
- [x] Re-run the rollback-only database boundary suite for two isolated
  customers, private file metadata, AAL1/AAL2 staff separation and protected
  booking transitions on 26 August 2026. Signed-native Auth/file tests remain
  required above.
- [ ] Complete iPhone notification permission, sound, badge and deep-link tests
  after PSI's Apple Developer organisation enrolment is approved.
- [ ] Complete equivalent Android testing on a supported borrowed or dedicated
  test device before Google Play release.
- [x] Record current Supabase plan, region and capacity; add a guarded encrypted
  logical-backup procedure for controlled QA.
- [ ] Upgrade before external onboarding, confirm scheduled backup retention and
  complete a separate-environment restore rehearsal.
- [x] Confirm approval for the six continuing Trusted Partner listings and
  logos. Owner confirmation was recorded on 27 August 2026; Raceline was
  removed because its approval was not available.
- [ ] Confirm the new BNB Autohaus listing and logo directly with that business.
- [ ] Reconfirm each retained partner's public contact details immediately before
  store submission.
- [x] Prepare App Store/Google Play disclosure drafts, public support/privacy/
  deletion URLs and validate the existing Apple-size screenshot pack.
- [x] Scope the first Apple release to iPhone only. iPad remains disabled until
  its own native layout, screenshot and acceptance pass is complete.
- [x] Draft the current Apple age-rating, privacy, App Review login and listing
  responses without storing review credentials in the repository.
- [ ] Approve final disclosures and recapture screenshots from the signed release
  build after confirming legal entity details.
- [x] Close the final booking lifecycle data-cleanliness item.
  The rollback-only database boundary suite passed on 26 August 2026, the
  reviewed Melbourne-date migration is active, and live synthetic proposal,
  approval and cancellation emails each completed exactly once. Immediate
  worker replays created no duplicates and no Calendar job or event appeared.
  Matt explicitly approved the cancelled-deposit cleanup migration; it is now
  active and live verification confirmed the cancelled QA request has no
  expected deposit, Calendar job or Calendar event.

## Deliberately last: payments

- [ ] Select the deposit provider and confirm AUD/GST, cancellation and refund
  wording with PSI's professional advisers.
- [ ] Implement a signed server-side webhook. No customer or staff client action
  may mark a deposit paid.
- [ ] Verify receipt email, refund handling and the trusted payment-confirmed
  transition that creates the internal Google Calendar event.

No public store release or general customer onboarding is approved until every
applicable item above is completed and recorded with evidence.
