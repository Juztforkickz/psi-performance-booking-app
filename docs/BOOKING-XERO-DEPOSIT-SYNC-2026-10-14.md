# Booking deposits and Xero

The owner approved automatic syncing of verified PSI booking deposits and their
actual Stripe processing fees. The initial two audited deposits and fee entries
were recorded in Xero and verified. Both invoices now have no balance owing.
Private transaction evidence is held in the ignored reconciliation work folder.

## Behaviour

New paid Stripe booking attempts enter a durable queue. The worker verifies the
live Stripe payment, booking identity, customer, vehicle, verified Xero contact
link and published invoice from that booking's PSI workshop job. It applies the
gross deposit as an invoice payment and records the actual processing fee using
PSI's verified existing bank account and Stripe Fees account. The original invoice
total remains intact. Its current Xero balance and payment status refresh through
the existing verified invoice importer. Duplicate protection may retain a
previously published workshop PC PDF, which is linked through the durable Xero
import identity rather than creating a second invoice record.

Payments wait in the queue until the exact booking invoice is published and
verified. This release does not create Xero prepayments before an invoice exists.
The app's paid booking status remains the source of deposit acknowledgement while
waiting. Processing runs every five minutes, one booking per invocation.

An existing advance credit can now be mapped after individual review. The worker
verifies its bank transaction, Stripe reference, Xero prepayment identity, customer,
currency and full amount. Once the exact booking invoice is verified, it allocates
that credit instead of recording another cash receipt. Existing full allocations
to that same invoice are reused. Partial allocations, refunds and allocations to
another invoice require review. No new advance credits are created by the worker.

Existing exact provider references are checked before writes. A persistent write
intent is saved before calling Xero. An uncertain write cannot be retried without
first finding its existing remote entry, even after Xero's idempotency key expires.
Wrong currency, refunds, disputes, mismatched identities, multiple invoices,
existing payments of the same amount without a PSI reference, and insufficient
invoice balances require review. Historical paid deposits start in review instead
of creating possible duplicate manual entries. The two audited corrections are
marked synced using their verified remote payment and fee identities.

Stripe payout bank statement matching remains separate. Payouts can contain several
customers and additional payout fees. This worker neither marks bank entries as
reconciled nor treats a whole payout as fresh income. Manual bank transfer deposits
retain their existing verification flow. Refund reversals remain manual.

## Consent and activation

Ordinary Xero connection continues to request invoice and contact read access.
The owner can explicitly request additional `accounting.payments`,
`accounting.banktransactions` and `accounting.settings.read` scopes using
Authorise deposit syncing in Xero. The secure owner portal requires owner MFA.
After Xero consent, Enable automatic deposit sync verifies granted scopes and the
existing account mapping before activating financial writes.

At deployment the scheduler is installed but financial syncing is disabled pending
the owner's Xero consent and activation. Customer roles cannot read or write either
new table or invoke the lease RPC. RLS denies application access; service access
and the explicitly checked server function supply the protected boundary. The
security advisor's no policy informational notices for these service tables are
intentional. No new security warnings were introduced.

## Validation and release

Fourteen focused financial policy tests pass. Strict Deno checks pass for the new
worker, connection function and invoice importer. Mobile typecheck and targeted
owner component lint pass. The live authenticated scheduler smoke test returns
HTTP 200 with syncing disabled and zero processed entries. Database readback
confirms two audited deposits synced, two historical deposits held for review,
customer table privileges denied and anonymous lease execution denied.

On 14 October 2026 the owner authorised Xero access for PSI PERFORMANCE.
Activation verified the granted scopes and account mapping, and the persisted
configuration now shows enabled. The live worker returned HTTP 200 with enabled
true and zero due entries. The two corrected deposits remain synced, while the
other two historical deposits remain held for separate review. No payment was
repeated during activation.

The migration and all three functions are deployed to the existing Supabase
project with JWT gateway verification enabled. Owner portal controls publish through
the existing GitHub Pages pipeline. No Netlify deployment is involved.

The workshop Payments screen also removes the outdated claim that Stripe is not
connected and the Setup pending label. It explains provider confirmed card and
wallet deposits, manual bank transfer verification, and links owners to the Xero
deposit controls. Activation remains separately verified by the server.

The existing advance credit migration is applied and worker version 4 is active.
Live readback verifies a reviewed advance credit, retaining it until its booking
invoice exists. Its existing processing fee is mapped for reuse. Payout accounting
entries were individually verified against Stripe; actual bank statement matching
remains pending because Xero's reconciliation page returns Unable to load data.
The second payout paid on 14 October is absent from the imported bank statement,
whose latest line is dated 13 October. Neither payout is claimed reconciled.
