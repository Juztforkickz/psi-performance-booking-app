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
Personal last-service/next-check-in reminders and vehicle photos remain local to
the open session. Garage can hand the selected owned vehicle into the existing
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
does not query `vehicle_files`, download private objects or upload files, and
all Add forms and selected images remain session-local preview tools. The public
GitHub Pages build continues to render only synthetic Stage 1 data.

All customer tables use Row Level Security. Data API grants are also explicitly
least-privileged: anonymous clients have no business-table grants, authenticated
clients receive only the operations backed by the reviewed policies, and new
public objects inherit no client grants. The `vehicle-photos` and
`vehicle-documents` buckets are private and have file type/size limits; nothing
is publicly listed. The security advisor's only warning is password-leak
protection, a paid password feature that is not used by this passwordless app.

## PSI portal

PSI still needs its own staff portal. It will use the same Supabase project, but
with a separate staff interface and MFA-gated policies—not a shared customer
password or service-role key in the browser.

The first portal should provide:

- pending booking requests and approve/contact actions;
- customer and vehicle lookup;
- read-only customer submissions;
- PSI-authored repairs, recommended work, invoices and verified dyno results;
- a Complete Service action that records the completion odometer, work summary
  and next PSI check-in before the booking can close;
- private attachment access; and
- an audit trail plus owner-only staff access management.

The first client foundation for that portal now exists at the Expo route
`/staff`. It is deliberately unlinked from customer navigation and available
only when Auth is enabled in a controlled QA build. The route first verifies the
current Auth user through a narrowly scoped function that can return only that
user's own `staff_members` row, then checks the current authenticator assurance
level. It does not issue workshop-wide queries until an
active allowlisted staff identity has reached AAL2. At AAL2, its initial view is
read-only: active booking requests plus customer and vehicle lookup through the
existing RLS policies. The public build renders only an unavailable notice.
Publishing, edits, file access, Calendar actions and staff management remain
disabled pending separate review and acceptance tests.

The private route now includes the TOTP step-up flow needed to reach AAL2.
Active allowlisted staff without a verified factor can create one in Supabase,
scan its one-time QR code on web or use the native authenticator URI/manual key,
and verify the current six-digit code. Existing verified TOTP factors are
challenged directly. The setup QR, URI and secret are held only in React memory,
are never logged or written to repository/app storage, and disappear when the
route closes or verification succeeds. Supabase promotes the verified session
to AAL2 and signs out that user's other sessions. PSI must document a controlled
lost-device recovery process and add factor-management/replacement UX before
staff access is treated as production-ready.

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

The planned booking flow is:

1. Customer submits a request after the production API is enabled.
2. PSI receives an email notification; the initial operational recipient is
   `matt@psiperformance.com.au`.
3. A server-side integration creates a clearly labelled `[PENDING]` event on
   the Google Calendar owned by `matt@psiperformance.com.au`.
4. PSI approves the request in the staff portal or contacts the customer.
5. Approval updates the database and calendar event, then sends the customer a
   confirmation email.

Google Calendar OAuth tokens belong only in encrypted server-side secrets. They
are not stored in customer tables or the mobile app. The calendar connection is
not active until Matt completes Google consent and the approval/update workflow
is tested for duplicates, cancellation and time-zone handling.

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
