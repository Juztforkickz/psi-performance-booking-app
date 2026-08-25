# Customer account deletion

Status: controlled QA procedure, 25 August 2026.

## Customer control

An authenticated customer can open **Account**, choose **Request account
deletion**, review the consequences and confirm the request in the app. The
request is stored in the Sydney Supabase project and appears only to that
customer and Matt's MFA-protected owner portal. A pending request can be
cancelled by the customer.

The app states that deletion is not immediate and targets completion within 30
days. It does not claim the account has been deleted merely because a request
was submitted.

## Matt's owner procedure

1. Sign in as `matt@psiperformance.com.au`, complete authenticator verification
   and open the account-deletion queue in the staff portal.
2. Confirm the requesting identity and record the request date. Do not ask the
   customer to send a password or authenticator code.
3. Review whether any workshop, invoice, taxation, dispute or legal record must
   be retained. Obtain professional advice where the retention position is not
   clear.
4. Remove customer-controlled uploads and records that are no longer required,
   including private vehicle photos and customer-added attachments. Storage
   objects must be removed before deleting the Supabase Auth user.
5. Delete or de-identify other personal information that PSI no longer needs.
   Keep any lawfully required record restricted to the minimum information and
   retention period needed; it must not remain available as an active customer
   account.
6. Use the server-side Supabase Auth administration process to delete the Auth
   identity. Never place the service-role key in the app, browser or repository.
7. Revoke registered push devices and confirm the former identity can no longer
   sign in or read customer data. Existing access tokens must be treated as live
   until they expire, so removal and access checks are part of the same
   controlled operation.
8. Mark the request complete only after the data and access checks succeed, add
   a non-sensitive staff note and notify the customer by email.

## Current boundary

Request initiation, cancellation, owner visibility and audit logging are
implemented. Destructive account removal is intentionally not automatic in the
customer app. Before external onboarding, PSI must acceptance-test the complete
owner procedure with a synthetic account and approve the final retention
schedule and customer response wording.

On 25 August 2026, the ordered database deletion path was exercised against the
existing non-staff `QATEST1` identity inside a rollback-only transaction. The
test created and reviewed a request, removed the synthetic Auth identity and all
matching public UUID references, asserted that none remained, then rolled back.
Post-test checks confirmed the two QA Auth identities, the QATEST1 vehicle and
zero deletion requests remained unchanged. There were no Storage objects to
exercise. The repeatable test is `../supabase/tests/account-deletion-acceptance.sql`.

Before external onboarding, repeat the test with a disposable signed-in native
account and one private test image so the Storage API removal, Auth Admin call,
session expiry/revocation and customer confirmation email are also proven.

This operational note supports implementation review; it is not legal advice.
