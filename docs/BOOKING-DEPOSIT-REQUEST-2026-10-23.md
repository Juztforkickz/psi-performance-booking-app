# Booking deposit request correction, 23 October 2026

The reported booking was still `date_proposed`, not `date_approved`. Its proposal email had one successful provider acceptance. No approval email job or payment attempt existed. This was a workflow distinction, rather than evidence of Android mail delivery failing.

The owner controls now say **Approve date and request deposit** and **Suggest date only, no deposit**. A proposal displays an explicit reminder that it does not request payment. Confirmation and success copy explain the next staff action after the customer agrees. Customer bookings explain that a suggested date requires agreement with PSI before the deposit request.

Approved date emails now contain a **Pay booking deposit** button and a plain text link to the existing protected Bookings page. The customer signs in with their booking account and chooses card, supported wallets or bank transfer there. The email contains no payment credential or expiring Stripe checkout URL. Proposal emails have a separate **View proposed date** button and explicitly say no deposit is requested yet.

Deposit amounts remain AUD 100 for service and diagnostics, and AUD 300 for dyno. Checkout still requires the verified owner, approved date, expected AUD amount and existing payment guards. Repeated checkout reuses an active payment attempt. Booking confirmation and calendar sync still require verified payment. No new acceptance mechanism, automatic approval, charge or bank reconciliation is introduced.

The production worker was read before replacement. Its newer, already deployed calendar notes and HTML escaping were retained. Existing gateway JWT verification, staff MFA, customer ownership, idempotent email dedupe and stale job checks remain intact. Rollback sources and private booking audit details are retained in ignored `work/deposit-link-repair-2026-10-23/`.

Validation includes rendered email output for all three booking types, HTML and plain text links, proposal separation, stale approval suppression, prevention of another deposit request after confirmation, escaping untrusted customer text, existing checkout ownership and approval guards, and repeat payment reuse. Thirteen targeted checks passed, mobile TypeScript passed and targeted lint passed.

The read only production audit found eight approved date jobs and two proposal jobs since 1 October, all recorded as succeeded with no pending or failed rows in those kinds. Provider acceptance is not proof of inbox receipt. The specific booking still requires its authorised staff approval before an approval email can be sent. Do not mark it paid or create a checkout as a test.
