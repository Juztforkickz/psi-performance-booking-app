# PSI Performance App — Supabase foundation

Status: database and security foundation applied; customer and staff sign-in
remain deliberately inactive until the email sender and end-to-end access tests
are complete. No application deployment was performed for this work.

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

Before activation:

1. Verify `psiperformance.com.au` with the chosen SMTP provider.
2. Configure Supabase custom SMTP with `info@psiperformance.com.au` as the
   approved From address.
3. Change the Supabase email template to contain the OTP token and PSI wording.
4. Test code expiry, replay prevention, resend throttling, logout and account
   recovery on real iPhone and Android devices.
5. Set `EXPO_PUBLIC_SUPABASE_AUTH_ENABLED=true` only in a controlled build after
   those tests pass.

`info@psiperformance.com.au` is approved as the intended sender, but it is not
yet technically verified as a sender. Sender verification requires DNS/SPF,
DKIM and preferably DMARC plus SMTP credentials; no credentials are stored in
this repository.

## Staff access and MFA

The allowlist is pre-created but no invitation or login email has been sent:

| Email | Role | Access |
| --- | --- | --- |
| `matt@psiperformance.com.au` | Owner | Full staff management and owner override |
| `dale@psiperformance.com.au` | Staff | Workshop records and booking workflow |
| `jamie@psiperformance.com.au` | Staff | Workshop records and booking workflow |

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

The security advisor currently reports no security findings. All customer
tables use Row Level Security. The `vehicle-photos` and `vehicle-documents`
buckets are private and have file type/size limits; nothing is publicly listed.

## PSI portal

PSI still needs its own staff portal. It will use the same Supabase project, but
with a separate staff interface and MFA-gated policies—not a shared customer
password or service-role key in the browser.

The first portal should provide:

- pending booking requests and approve/contact actions;
- customer and vehicle lookup;
- read-only customer submissions;
- PSI-authored repairs, recommended work, invoices and verified dyno results;
- private attachment access; and
- an audit trail plus owner-only staff access management.

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

Supabase's built-in test email service is not suitable for customers (currently
two emails per hour). A custom SMTP provider is required. Resend's current Free
tier is a reasonable starting point at 3,000 emails per month and 100 per day;
paid services and Supabase Pro are billed in USD, so PSI should review the live
AUD equivalent and GST before upgrading.
