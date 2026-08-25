# Final release checklist

Status: controlled QA, 25 August 2026. Payments are deliberately last.

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

- [x] Exercise the ordered database deletion path against QATEST1 in a
  rollback-only transaction and confirm the synthetic account remains intact.
- [ ] Complete signed-native deletion acceptance with a disposable account and
  private test image; approve PSI's retention schedule and response template.
- [ ] Complete two-customer isolation, expired/replayed email-code, sign-out and
  private-file regression tests on signed native builds.
- [ ] Complete iPhone notification permission, sound, badge and deep-link tests
  after PSI's Apple Developer organisation enrolment is approved.
- [ ] Complete equivalent Android testing on a supported borrowed or dedicated
  test device before Google Play release.
- [x] Record current Supabase plan, region and capacity; add a guarded encrypted
  logical-backup procedure for controlled QA.
- [ ] Upgrade before external onboarding, confirm scheduled backup retention and
  complete a separate-environment restore rehearsal.
- [ ] Reconfirm every Trusted Partner listing, logo and public contact detail
  with that business.
- [x] Prepare App Store/Google Play disclosure drafts, public support/privacy/
  deletion URLs and validate the existing Apple-size screenshot pack.
- [ ] Approve final disclosures and recapture screenshots from the signed release
  build after confirming legal entity details.
- [ ] Run final date-proposal, approval, cancellation, duplicate-worker and
  Melbourne-time-boundary booking tests.

## Deliberately last: payments

- [ ] Select the deposit provider and confirm AUD/GST, cancellation and refund
  wording with PSI's professional advisers.
- [ ] Implement a signed server-side webhook. No customer or staff client action
  may mark a deposit paid.
- [ ] Verify receipt email, refund handling and the trusted payment-confirmed
  transition that creates the internal Google Calendar event.

No public store release or general customer onboarding is approved until every
applicable item above is completed and recorded with evidence.
