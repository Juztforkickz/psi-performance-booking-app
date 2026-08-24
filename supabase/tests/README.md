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
- each customer can read only the PSI records published to their account.

The script starts a transaction and ends with `rollback`, so its users, records
and audit events never persist. Run it only with a privileged database test
connection; it deliberately changes to the `authenticated` database role while
testing the real policies.
