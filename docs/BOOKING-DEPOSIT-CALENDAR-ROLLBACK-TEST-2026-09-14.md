# Booking deposit and Calendar rollback test — 14 September 2026

## Scope

This test exercised the production database workflow without retaining a
booking, taking payment, sending a notification or creating a Google Calendar
event. Every synthetic record was created inside one transaction and the
transaction ended with `ROLLBACK`.

The requested reference date, 12 December 2026, is a Saturday. The production
booking rules correctly reject Saturdays for both service and dyno bookings.
The complete transition test therefore used Monday, 14 December 2026, while
retaining 12 December in the synthetic request context for traceability.

## Verified transition

The rollback-only service booking used Matt's existing PRO911 vehicle and an
A$100 synthetic Stripe deposit. Before rollback, the database showed:

- booking state changed from `pending_staff_review` to `date_approved` and then
  to `confirmed`;
- approved workshop date was 14 December 2026;
- expected and verified deposit was A$100 in AUD;
- the payment attempt changed from `awaiting_payment` to `paid`;
- the customer alert was titled **Date approved · deposit ready** and opened
  `/bookings`;
- its message told the customer to choose card, Apple Pay, Google Pay or bank
  transfer;
- the confirmed customer alert was created;
- PSI and customer confirmation jobs were queued;
- `sync_google_calendar_confirmed` was queued for 14 December 2026;
- a linked workshop job was created.

The Google integration worker builds an all-day event from the approved date,
uses `visibility: "default"`, sends no attendee invitations and uses
`sendUpdates=none`. This makes the workshop event visible according to the
shared PSI Calendar permissions without exposing customer details through
attendee invitations.

## Rollback verification

A separate read after the transaction confirmed that the synthetic booking,
payment attempt, notification events, integration jobs and workshop job do not
exist. No provider worker was called during this test.

## Build 9 beta delivery

The account-deletion hardening and removal of the temporary alert-test control
were published to the `beta` branch for iOS build 9's exact runtime,
`1.0.0-beta-performance-plus-1`.

- source commit: `f1fb693742167167bc25383ab2a165540170450b`
- update group: `3f31073c-d2dc-4a42-9547-11bc31fc065e`
- iOS update: `01a09d0d-d3f2-7dd7-85b2-4002c9e348f5`
- Android update: `01a09d0d-d3f2-72f9-b658-4a8d6dd478df`
- [Expo update record](https://expo.dev/accounts/psi-performance/projects/matt-psi/updates/3f31073c-d2dc-4a42-9547-11bc31fc065e)

An earlier publish in this session used runtime `1.0.0`. It is incompatible
with build 9 and therefore cannot be installed by that binary. The compatible
update above is the effective build 9 release.

## Customer payment experience

Date approval sends an email, push alert and in-app prompt directing the
customer to Bookings. A Stripe Checkout URL is created only after the customer
chooses card, Apple Pay or Google Pay. The date-approved email does not contain
a pre-created payment URL. This avoids creating unused checkout sessions before
the customer chooses how to pay.

The rollback test proves the database transition and queueing contract. A real
Stripe checkout, provider webhook, delivered push sound and created Google
Calendar event still require a test-mode provider payment and physical-device
acceptance.
