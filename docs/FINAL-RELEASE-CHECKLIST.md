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

- [ ] Acceptance-test account deletion end to end with a synthetic identity and
  approve PSI's retention schedule and deletion-response template.
- [ ] Complete two-customer isolation, expired/replayed email-code, sign-out and
  private-file regression tests on signed native builds.
- [ ] Complete iPhone notification permission, sound, badge and deep-link tests
  after PSI's Apple Developer organisation enrolment is approved.
- [ ] Complete equivalent Android testing on a supported borrowed or dedicated
  test device before Google Play release.
- [ ] Confirm Supabase backup, capacity, incident response and owner access
  recovery arrangements.
- [ ] Reconfirm every Trusted Partner listing, logo and public contact detail
  with that business.
- [ ] Approve App Store and Google Play privacy disclosures, screenshots,
  support URL and final legal entity details.
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

