# Customer account deletion

Status: protected owner completion workflow, 2 September 2026.

## Customer control

An authenticated customer can open **Account**, choose **Request account
deletion**, review the consequences and confirm the request in the app. The
request is stored in the Sydney Supabase project and appears only to that
customer and Matt's MFA-protected owner portal. A pending request can be
cancelled by the customer until PSI starts processing it.

Submitting a request does not delete anything automatically. The app states
that PSI targets completion within 30 days and never presents a request as a
completed deletion.

## Protected owner completion

Only the active PSI owner identity `matt@psiperformance.com.au` at AAL2 can see
and use the final completion control. The control is available only for an
active customer request and requires both:

- confirmation that required retention, export or de-identification work has
  been completed; and
- the requesting customer's exact email address typed into the confirmation
  field.

The server then performs one ordered operation:

1. Rechecks the owner identity, AAL2 session, target request and target's
   non-staff status.
2. Locks the customer identity before cleanup, so an already-issued access
   token cannot continue reading or writing protected customer data.
3. Removes the customer's private vehicle photos and documents through the
   Supabase Storage API.
4. Removes the customer's vehicles, bookings, dyno results, repair records,
   recommendations, invoices, service data, notification data and registered
   push devices.
5. Deletes the Supabase Auth identity and its remaining customer profile and
   deletion-request rows.
6. Records a non-identifying completion audit reference.

The server-only service-role credential is never sent to the app or browser.
If cleanup stops after the identity is locked, the portal reports that the same
request must be retried; it does not unlock the account or falsely report a
successful deletion.

## Matt's operating procedure

1. Sign in as `matt@psiperformance.com.au`, complete authenticator verification
   and open the account-deletion queue in the staff portal.
2. Confirm the requesting identity and request date. Do not ask the customer to
   send a password or authenticator code.
3. Review whether any workshop, invoice, taxation, dispute or legal record must
   be retained. Obtain professional advice where the retention position is not
   clear. Export or de-identify the minimum required material before continuing.
4. Expand **Review and delete account**, complete the retention checkbox and
   type the customer's exact email address.
5. Press the permanent-delete control only when the displayed customer is the
   intended requester. The action cannot be undone.
6. Confirm the queue refreshes and the former customer can no longer sign in.
   Notify the customer using the approved PSI response process.

## Validation boundary

The repository includes a rollback-only database test for the synthetic,
non-staff `QATEST1` identity. It exercises the owner-only lock, ordered data
cleanup, simulated Auth deletion, completion tombstone and absence of customer
UUID references. The test refuses to run if the synthetic identity owns Storage
objects. Because it contains destructive statements, even inside a transaction,
it must only be run against the protected project with explicit approval. The
test is `../supabase/tests/account-deletion-acceptance.sql`.

Before public release, repeat the full server workflow with a disposable native
customer that owns one private test image. Confirm Storage removal, Auth
deletion, loss of access from an existing session and the approved customer
completion response. Never use a real customer request as a test.

This operational note supports implementation review; it is not legal advice.
