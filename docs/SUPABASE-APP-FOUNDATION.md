# PSI Performance App — Supabase foundation

Status: database and security foundation applied; Resend custom SMTP, both
six-digit PSI email-code templates, controlled live login and RLS isolation
tests, and the activation-gated Expo client flow are implemented. Customer
sign-in and new registration remain deliberately inactive in public builds.

## Project

- Supabase project: **PSI Performance App**
- Project reference: `lslhfrujyuqcavsnugfx`
- Region: Sydney (`ap-southeast-2`)
- Current plan: Free
- Client connection: the Expo app contains the public project URL and public
  publishable key, but `EXPO_PUBLIC_SUPABASE_AUTH_ENABLED=false` keeps real
  sign-in fail-closed.

The prior empty `Juztforkickz App` was reused and renamed. There is no second
Supabase project to maintain or delete.

## Passwordless customer access

The selected customer sign-in method is a six-digit, short-lived email code.
There is no password field and PSI does not store customer passwords.

A customer does **not** need a new code every time the app opens. A valid native
session is kept in operating-system protected storage. A fresh code is required
after the customer signs out, the session is revoked or expires, the app is
reinstalled, or the customer signs in on a new device. The Expo web preview
keeps any future session in memory only and signs out on refresh/close.

Completed email groundwork:

1. `psiperformance.com.au` is verified with Resend.
2. Supabase custom SMTP uses `smtp.resend.com`, the approved
   `info@psiperformance.com.au` From address and the `PSI Performance` sender
   name. Credentials remain encrypted in Supabase and are not in this repository.
3. The Magic Link / OTP template now sends a six-digit PSI sign-in code that
   expires after 10 minutes.

Completed acceptance checks:

1. Email delivery and six-digit verification were completed with the controlled
   `info@psiperformance.com.au` pilot.
2. The authenticated pilot saw only its own profile and no PSI staff or unrelated
   records, then the test session was signed out.
3. A rollback-only two-customer test exercised the real deployed RLS policies
   without retaining test identities or records.
4. New-user registration was independently checked closed after testing.

Remaining private-QA gates:

1. Test the implemented code-entry, secure-session and profile/vehicle adapter
   on controlled native iPhone and Android builds. Record the build ID, device,
   operating-system version and test identity for each run.
2. On each platform, request one code and confirm the client shows a 60-second
   resend cooldown. Confirm Supabase still enforces its server-side rate limit
   if a second client attempts to bypass the display cooldown.
3. Confirm a valid six-digit code creates one customer session, an incorrect or
   expired code fails without creating a session, and a successfully used code
   cannot be replayed.
4. Close and reopen the native app and confirm its protected session restores;
   sign out and confirm the same device no longer reads account records. The web
   QA session must clear on refresh because its tokens are deliberately held in
   memory only.
5. Confirm the approved customer can create/update only their own profile and
   vehicles, cannot access a second controlled customer's records and cannot
   obtain staff access. Re-run the rollback-only SQL isolation test after any
   Auth, RLS or database-policy change.
6. Confirm a staff identity remains unable to access workshop-wide records at
   AAL1 and receives that access only after its enrolled MFA factor reaches
   AAL2. Customer MFA remains out of scope for the first release.
7. Keep registration closed in the private QA build; create any additional pilot
   identity through a separately approved onboarding window.
8. The internal EAS `qa` profile sets Auth true, registration false and the
   booking API empty. The public GitHub Pages preview keeps both Auth and
   registration false.
9. The app is linked to the owner-controlled Expo project
   `@psi-performance/matt-psi`, and unauthenticated access to its internal
   distribution build pages is disabled.

## Staff access and MFA

The initial staff allowlist is owner-only. Matt accepted the owner invitation
on 23 August 2026. The unused pending Dale and Jamie entries were removed on
24 August 2026 and can be added again later through the reviewed staff-invite
process:

| Email | Role | Access |
| --- | --- | --- |
| `matt@psiperformance.com.au` | Owner (active) | Full staff management and owner override |

Staff MFA is required before the database recognises a staff session. Email
code login proves access to the mailbox; MFA adds a separately held factor.
This matters because one staff account can see multiple customers, invoices,
vehicle history and private files. A stolen mailbox session must not become a
workshop-wide data breach. Customer MFA is not required for the initial release.

## Visibility and editing rules

- Customers see only their own profile, vehicles, bookings, records, invoices,
  audit history and private files.
- MFA-authenticated PSI staff see the customer records needed for workshop work.
- A customer-created record can be changed only by that customer.
- A PSI-created record can be changed by the staff member who created it; Matt's
  owner role is the explicit operational/privacy override.
- Completed PSI services are the integrity exception: the canonical completion,
  its linked PSI service-history entry and its PSI odometer reading are
  append-only. They cannot be edited or deleted through customer or staff app
  permissions. A future owner-only correction workflow must add an audited
  correction rather than rewriting the original visit.
- Record authorship cannot be reassigned.
- Booking approval and Google Calendar synchronisation are shared staff workflow
  exceptions, because another authorised staff member may need to process the
  queue.
- Business tables use soft archive fields; routine clients are not granted hard
  delete access. File removal is restricted to the uploader or the owner role.
- Genuine PSI dyno results remain PSI-controlled. Customer dyno entries can
  never be marked PSI verified.
- Audit records capture who changed which record and when without copying full
  customer details into the audit log.

## Protected service history

The database now keeps customer maintenance information and PSI workshop facts
as separate sources:

- `service_completions` is the authoritative, immutable PSI record. Active PSI
  staff with MFA can create one only for a confirmed service booking.
- Inserting a completion automatically marks the linked booking completed,
  creates its read-only PSI service-history entry and records the workshop
  odometer. A service booking cannot be marked completed without this link.
- `odometer_readings` is append-only. Customer readings remain labelled
  `customer_entry`; a customer cannot attach one to a PSI service completion.
- `vehicle_service_summary` derives the latest PSI service, workshop odometer
  and next PSI check-in independently from the latest customer odometer. A new
  completed visit therefore updates the official dates without overwriting or
  legitimising personal entries.

The Expo account screens now contain typed RLS-bound profile/vehicle reads and
writes. A shared authenticated account provider clears private data on sign-out,
refreshes after an approved profile/vehicle save, and supplies the same owned
vehicle snapshot and service summary to Account and My Garage. An authenticated
Garage reads the protected latest PSI service/check-in and PSI odometer figures
separately from the latest customer odometer, and adds a changed customer
odometer as an append-only `customer_entry` row. The client rejects a lower
reading and never presents a
customer reading as PSI verified; database RLS remains the ownership authority.
Personal last-service/next-check-in reminders remain local to the open session.
In the authenticated QA build, a customer-selected vehicle photo is uploaded
under the customer's UUID in the private `vehicle-photos` bucket, recorded as
customer-owned metadata and displayed through a short-lived signed URL. Image
type, size, vehicle ownership and creator ownership are checked before the app
replaces or removes it; authorised AAL2 PSI staff may view it for workshop use.
Garage can hand the selected owned vehicle into the existing
booking form; the verified Auth email and owned profile name/mobile also prefill
the customer step. The account editor
loads the existing profile and primary vehicle before accepting changes, and an
existing vehicle update matches both its exact ID and the authenticated customer
ID. The live RLS policy check confirms customer updates still require the same
customer and record creator; PSI-authored vehicle details therefore render
read-only to the customer. These authenticated paths are unreachable
while the activation flag is false; the public preview continues to use
synthetic vehicles and in-memory maintenance changes. Real customer access
remains disabled until cross-account and real-device tests pass.

Vehicle Reports now has a read-only authenticated QA path using the root-owned
vehicle snapshot plus a route-local report loader. Report metadata is fetched
only while Vehicle Reports is open, rather than being held by unrelated Account
or Garage screens. It explicitly filters dyno, repair, recommended-work and
invoice queries by the verified customer ID in addition to the existing RLS
policies, then filters displayed records again by the selected owned vehicle.
PSI records and customer entries receive different labels; a customer entry can
never appear PSI verified. Invoice values remain AUD metadata only. The screen
also queries active `vehicle_files` metadata through the same customer-ID and
RLS boundary. When a PSI invoice or dyno attachment exists, Storage must
authorize that exact private object before issuing a 60-second signed URL.
Images open in the app and PDFs open through the device browser; the URL is held
only in screen memory. The app does not list a bucket, expose a public object URL
or use a service-role key. Customer Vehicle Reports Add forms and their selected
invoice/dyno images remain session-local preview tools. AAL2 PSI staff
publishing to private `vehicle-documents` is enabled separately. The public GitHub
Pages build continues to render only synthetic Stage 1 data with Auth disabled.

All customer tables use Row Level Security. Data API grants are also explicitly
least-privileged: anonymous clients have no business-table grants, authenticated
clients receive only the operations backed by the reviewed policies, and new
public objects inherit no client grants. The `vehicle-photos` and
`vehicle-documents` buckets are private and have file type/size limits; nothing
is publicly listed. The security advisor's only warning is password-leak
protection, a paid password feature that is not used by this passwordless app.

## PSI portal

PSI now has its first private staff portal in the same Supabase project, using a
separate staff interface and MFA-gated policies—not a shared customer password
or service-role key in the browser. Production hardening and operational QA are
still required.

The first portal should provide:

- pending booking requests and approve/contact actions;
- customer and vehicle lookup;
- read-only customer submissions;
- PSI-authored repairs, recommended work, invoices and verified dyno results;
- a Complete Service action that records the completion odometer, work summary
  and next PSI check-in before the booking can close;
- private attachment access; and
- an audit trail plus owner-only staff access management.

The private portal exists at the Expo route
`/staff`. It is deliberately unlinked from customer navigation and available
only when Auth is enabled in a controlled QA build. The route first verifies the
current Auth user through the `staff_members` table's own-user RLS policy, then
checks the current authenticator assurance level. No public privileged bootstrap
function is exposed. It does not issue workshop-wide queries until an
active allowlisted staff identity has reached AAL2. At AAL2 it loads active
booking requests plus customer and vehicle lookup through the existing RLS
policies. It also exposes a controlled publisher for PSI repair history,
recommended work, verified hub-dyno results and AUD invoices. Every publish
requires an explicit customer/vehicle confirmation and rechecks both AAL2 and
active staff status immediately before writing. The public build renders only an
unavailable notice.

Confirmed service bookings now expose a separate protected Complete Service
action. Staff must recheck the locked customer and vehicle, completed date,
odometer, work summary and optional next PSI check-in before explicitly
confirming. The client inserts one `service_completions` row only after an AAL2
staff recheck; database triggers take the booking ownership as authority, close
the booking, project the immutable PSI repair and odometer history, and update
the RLS-scoped service summary. Customers cannot invoke this path or rewrite the
projected PSI record.

Optional dyno-graph and invoice images are limited to JPG, PNG or WebP under
6 MB for the first reliable standard-upload workflow. They use a unique object
path beginning with the owning customer's UUID inside the private
`vehicle-documents` bucket. Matching `vehicle_files` metadata must reference the
same customer, vehicle and PSI record. If the record insert fails, the client
attempts to remove the unused object and stops with a private-Storage warning if
cleanup fails. If metadata creation fails, the valid PSI record is kept without
claiming an attachment and cleanup success or failure is reported to staff. Customers
receive only RLS-scoped metadata and a short-lived signed URL on demand. No
service-role key is present in the client.

The publishing policies require `record_source = 'psi_record'` or
`'psi_verified'`, verify that vehicle ownership matches the selected customer,
and reject cross-customer attachment paths. The rollback-only acceptance test
proves AAL1 denial, AAL2 staff publishing, customer visibility and unrelated-
customer isolation. The expanded rollback test also proves customer and AAL1
completion denial, the AAL2 Complete Service projection, immutable linked
history and unrelated-customer isolation. General record editing/removal, PDF
selection and staff management remain disabled pending separate review and
acceptance tests. A provider-neutral email/Calendar queue and fail-closed worker
are present, but actual provider delivery remains disabled pending credential
setup and acceptance testing.

The private route now includes the TOTP step-up flow needed to reach AAL2.
Active allowlisted staff without a verified factor can create one in Supabase,
scan its one-time QR code on web or use the native authenticator URI/manual key,
and verify the current six-digit code. Existing verified TOTP factors are
challenged directly. The setup QR, URI and secret are held only in React memory,
are never logged or written to repository/app storage, and disappear when the
route closes or verification succeeds. Supabase promotes the verified session
to AAL2 and signs out that user's other sessions.

The AAL2-only `/staff-security` route now lists verified TOTP devices and allows
Matt to add a separate backup authenticator. A verified factor can be removed
only while at least one other verified factor remains; the client refreshes the
session immediately afterward and routes back through the staff gate. The app
cannot remove the last factor and contains no administrator credential or
recovery bypass. Final-factor loss follows the controlled owner runbook in
[`STAFF-MFA-RECOVERY.md`](STAFF-MFA-RECOVERY.md). Production readiness still
requires a witnessed recovery drill and secure offline storage for the
Supabase organization owner's recovery method.

The root Auth provider treats Supabase Auth events as newer than its initial
session read, preventing a delayed signed-out result from replacing a completed
email-code sign-in. It also advances a session revision for sign-in, token
refresh and MFA challenge events. The staff route observes that revision and
rechecks its allowlist and AAL immediately, including when the same user moves
from AAL1 to AAL2. Normal Back navigation therefore does not require a browser
refresh to reveal the authenticator gate or the verified workspace.

The Supabase secret/service-role key must exist only in trusted server or Edge
Function configuration. It must never be placed in Expo, Netlify client code,
GitHub or browser storage.

## Email-only booking workflow and Google Calendar

Initial outbound notifications are email only. SMS and push notifications are
not enabled.

The controlled QA build now connects approved authenticated customer accounts
directly to the RLS-protected Supabase booking queue. Each request is tied to an
owned active vehicle, uses a customer-scoped idempotency UUID, remains
`pending_staff_review`, and stores its bounded structured booking context. The
public GitHub Pages build does not set the separate booking activation flag and
therefore remains submission-disabled.

At AAL2, Matt can approve the requested date, record an alternative proposed
date or cancel with an audit note. The database derives the AUD deposit amount
from the booking type and prevents staff from changing immutable customer
request details or falsely moving an approved request to `confirmed`. That
transition is reserved for a later trusted server integration after verified
payment. The customer's private Bookings tab reads only their RLS-scoped queue
and approved dates; it never exposes PSI workshop availability.

The current protected integration flow is:

1. Customer submits a request from an approved authenticated QA account. The
   database queues one PSI and one customer request-received email job.
2. PSI approves/proposes the date in the MFA-protected staff portal or cancels
   with an audit note. The database queues the matching customer email job.
3. Matt can inspect the job and audit feeds and invoke the authenticated worker
   only from an active AAL2 staff session. Anonymous, customer and AAL1 access
   cannot read or mutate the queue.
4. The worker uses Resend idempotency keys and does not store provider
   credentials, recipients or message bodies in the queue. Until the encrypted
   provider secrets exist, it records `blocked_configuration` and never claims
   delivery.
5. No pending or merely date-approved booking is written to Google Calendar.
   Only the future trusted payment-confirmed transition queues the customer/PSI
   confirmation emails and one internal Calendar event. The event is all-day,
   clearly labelled `[CONFIRMED]`, deterministic for retry safety and does not
   invite the customer.

Google Calendar OAuth tokens belong only in encrypted Edge Function secrets.
They are not stored in customer tables, the mobile app or GitHub. The Calendar
connection remains inactive until Matt completes Google consent, the four
server-only Calendar values are configured and duplicate/cancellation/time-zone
acceptance tests pass. Deposit/payment implementation is deliberately left for
the final integration stage.

## Current Free-plan position

The Free plan is suitable for controlled development and an early pilot. At the
time this foundation was created it includes two active projects, 50,000 monthly
active users, 500 MB database storage, 1 GB file storage, 5 GB egress, 500,000
Edge Function calls and 2 million Realtime messages. Free projects can pause
after inactivity and do not provide downloadable backups, so production launch
requires a capacity, backup and recovery decision.

Supabase's built-in test email service is not suitable for customers. PSI now
uses Resend custom SMTP. Resend's current Free tier is a reasonable starting
point at 3,000 emails per month and 100 per day; paid services and Supabase Pro
are billed in USD, so PSI should review the live AUD equivalent and GST before
upgrading.
