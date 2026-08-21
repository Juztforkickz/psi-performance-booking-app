# PSI booking workflow

Status: owner-review specification. No payment, email, Google Calendar or
customer-identity provider is enabled by this document or by the preview build.

## Customer journey

1. The customer chooses Service & Report or Dyno tuning once.
2. They enter their contact, vehicle and request details. A dyno customer can
   either describe a known setup or ask PSI to inspect what is fitted.
3. They request one eligible preferred date or choose **I'm flexible**. The
   public app never exposes PSI's calendar or other bookings.
4. The request is saved as `pending_staff_review`. No payment is requested and
   no booking date is represented as confirmed.
5. PSI reviews workshop capacity and either proposes another date or approves a
   date. A note explains that changing workshop conditions may require PSI to
   contact the customer and reschedule.
6. After PSI approves the date, the configured payment provider creates the
   secure deposit checkout: $100 AUD for service or $300 AUD for dyno.
   The payment request repeats the staff-approved date and workshop allocation.
   An expired unpaid link is explicitly retired by staff before a fresh,
   separately identified checkout can be issued for that approved date; the
   expired checkout and provider identifiers remain in the audit history.
7. Only a verified, signed payment-provider event may mark the deposit paid.
   The paid transition queues the customer and PSI confirmation email and the
   internal Google Calendar event. It must be idempotent so a webhook retry
   cannot duplicate a payment receipt, email or calendar event.
8. PSI completes or cancels the booking from the single-owner staff queue.

If an unpaid provider link has already been delivered, cancellation first enters
`cancellation_pending` and queues provider invalidation. The request is not
represented as cancelled until a signed provider event confirms that no payment
was captured. A payment-success event wins any race, records the money and
suppresses the pending cancellation command; refunds or transfers remain an
explicit PSI/manual decision.

## Date rules

- Service & Report: Monday to Friday.
- Dyno tuning: Monday, Wednesday and Thursday.
- Customers may choose a specific eligible date or say they are flexible.
- Before-hours drop-off, after-hours drop-off and after-hours collection are
  requests that PSI must confirm; they are not guaranteed automatically.
- Customers can ask PSI to tell them if an earlier time becomes possible. This
  is a staff-only signal. The software must never automatically offer or move a
  booking because workshop work can carry over or expand unexpectedly.

## Pricing shown to consumers

- Service & Report: from **$423.50 AUD including GST**.
- Dyno tuning: from **$649 AUD including GST**.
- Service deposit after date approval: **$100 AUD**.
- Dyno deposit after date approval: **$300 AUD**.

The guide price is not a final quote. PSI confirms scope and any additional
costs before work outside the agreed scope proceeds.

## Deposit wording for owner review

> Once PSI has reviewed and confirmed your booking date, we will send a secure
> link for the applicable deposit. Once paid, the deposit ordinarily cannot be
> refunded because PSI reserves technician time, hoist or dyno capacity and
> workshop planning for your vehicle. If PSI needs to move your booking, we
> will work with you to reschedule and keep the deposit attached to the agreed
> replacement date, or provide another remedy where required. Nothing in this
> policy limits rights that cannot be excluded under the Australian Consumer
> Law.

This wording must receive owner/legal sign-off before public launch. The final
policy should also define customer cancellation notice, no-shows, serious
illness or exceptional circumstances, PSI cancellation, deposit transfers and
any expiry period.

## Customer records and accounts

The provider-ready account model is intended to keep:

- the customer's current contact details;
- one or more vehicles;
- booking requests and confirmed/completed visits;
- deposit checkout and receipt history;
- the next confirmed booking; and
- communication/reminder preferences.

No public account registration is enabled until managed identity, account
recovery, email verification, privacy/retention and per-customer data access are
tested. Unfinished booking drafts stay only on the customer's device, expire
after 30 days and have a visible clear action. The preview uses browser local
storage or native app-local storage, which is not application-level encrypted
and may be retained by device/browser backups. Protected storage or backup
exclusions require a separate security decision before public launch.

## Service reminders

After payment confirms a booking, the system prepares factual appointment
reminders for seven days and 24 hours before the confirmed date. A reschedule
cancels and recreates those reminders from the replacement date; cancellation
suppresses them. These messages contain booking logistics only and do not add a
sales or review request.

Six- and twelve-month “Ready for your next service?” reminders are created only
for completed service bookings where the customer explicitly opted in. Each
message identifies PSI, links to rebook or contact the workshop, and provides a
working unsubscribe that does not require account sign-in. Reminders do not ask
for a public review and do not promote curated vehicle packages.

## Integration gates

The owner preview must remain fail-closed until all of the following exist:

- a payment provider with signed webhook verification;
- a transactional email provider with authenticated PSI sending domain;
- an explicitly selected Google Calendar ID and least-privilege event-write
  authorization;
- managed customer authentication;
- production privacy, retention and booking/deposit terms; and
- a public HTTPS API origin for the native app.

The internal calendar event is created only after verified payment. It does not
invite the customer or expose calendar availability. Its date and times must
come from PSI's staff confirmation, never from an assumed service duration.
The selected Calendar ID is snapshotted with the approved checkout and persisted
with the Calendar sync record. Reschedule and cancellation target that stored
record rather than whichever Calendar happens to be configured later.

Issuing a checkout remains gated on all payment, email and Calendar readiness.
After a provider may have captured money, signed webhook verification and
durable payment recording depend only on the provider identity and signing
secret; temporary email or Calendar outages leave retryable outbox work and
must never cause the payment itself to be discarded.

## Review references

- ACCC total-price guidance: https://www.accc.gov.au/consumers/pricing/price-displays
- ACCC personal-services deposit/refund guide: https://www.accc.gov.au/about-us/publications/personal-services-an-industry-guide-to-the-australian-consumer-law
- ACMA email/SMS unsubscribe rules: https://www.acma.gov.au/sites/default/files/2024-05/Fact%20sheet%20-%20email%20and%20SMS%20unsubscribe%20rules.pdf
- Google Calendar event insertion: https://developers.google.com/workspace/calendar/api/v3/reference/events/insert
- Google Calendar authorization scopes: https://developers.google.com/workspace/calendar/api/auth
