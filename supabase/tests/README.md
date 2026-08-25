# Supabase acceptance tests

`customer_account_rls.sql` exercises the deployed customer/workshop boundary
using two reserved customer identities and one reserved staff identity. It verifies:

- anonymous clients have no business-table access and file buckets are private;
- each customer sees only their own profile, vehicle, records and audit history;
- cross-account inserts and updates are rejected;
- customer entries cannot be promoted to PSI-verified records; and
- customers cannot create PSI invoices, PSI repair history or PSI odometer data;
- an active staff identity cannot publish at AAL1 and can publish only at AAL2;
- staff record and attachment metadata cannot mismatch customer and vehicle
  ownership; and
- only AAL2 staff can complete a confirmed service booking;
- authenticated customers can create idempotent pending requests only for
  vehicles they own;
- AAL1 staff cannot review requests, AAL2 staff can approve/propose valid PSI
  dates, and staff cannot promote a date-approved request to paid/confirmed;
- Melbourne-local past dates are rejected even while PostgreSQL remains on UTC,
  and replaying an identical proposal or cancellation does not duplicate jobs;
- a proposal can be cancelled with exactly one customer cancellation job while
  the protected AUD deposit remains absent until date approval;
- only the trusted server role can perform the future payment-confirmed
  transition;
- booking creation and review changes create the expected deduplicated
  notification jobs, while anonymous customers and AAL1 staff cannot read the
  provider queue;
- only the trusted future `confirmed` transition creates customer/PSI
  confirmation jobs and the Google Calendar job;
- service completion automatically closes the booking and projects immutable
  PSI repair, odometer and next-check-in history; and
- each customer can read only the PSI records and service history published to
  their account.

The script starts a transaction and ends with `rollback`, so its users, records
and audit events never persist. Run it only with a privileged database test
connection; it deliberately changes to the `authenticated` database role while
testing the real policies.
