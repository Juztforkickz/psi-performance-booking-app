# Apple review demo pack

This pack is fictional and intended only for the dedicated PSI App Review
customer. It is not a real vehicle inspection, measured dyno run, tax invoice or
payment request. It includes no customer correspondence or credentials.

## Files and generation

Run `scripts/generate-apple-review-pack.py` with Python and ReportLab. It writes
three one-page PDFs to `output/pdf/apple-review/`. Render each with Poppler at
150 DPI to make the matching JPG files for the current staff image publisher.
The generator never connects to Supabase, sends email or publishes records.
The prepared PDFs, JPGs and this guide are also bundled in
`output/pdf/psi-apple-review-demo-pack.zip` for downloading together.

- `demo-workshop-inspection`: fictional repair-history attachment/reference.
- `demo-invoice-not-payable`: illustrative AUD invoice with nothing payable.
- `demo-dyno-graph`: synthetic graph, HP and Nm labelled separately.

Use JPG for the staff invoice and dyno image fields. PDFs are provided for
reference and customer document-upload testing where that picker supports PDF.
Repair-history publishing has no attachment field; copy the text below.

## Exact record entries

Select **PSI App Review**, then **2003 Holden VY SS / TEST001**, in the Matt-only
staff publisher. Confirm the customer and vehicle before each publish. Do not
publish to another account. These records are not published by this document.

### Repair history

- Title: `DEMO - Workshop inspection`
- Category: `Inspection`
- Date: `03/09/2026`
- Odometer: `120000`
- Notes: `DEMONSTRATION ONLY. Fictional inspection record for Apple App Review.
  Example engine-bay, fluid, brake and tyre checks demonstrate the report layout.
  No actual inspection, maintenance or repair was performed. No payment is due.`

### Verified dyno record (synthetic review fixture)

- Date: `03/09/2026`
- Peak power: `310` HP at hubs
- Peak torque: `470` Nm at hubs (rounded)
- Fuel: `98 RON - fictional example`
- Notes: `DEMONSTRATION ONLY. Synthetic dyno curve for app review, not a measured
  run or certification of vehicle performance. All figures are fictional.`
- Image: `demo-dyno-graph.jpg`

The protected publisher's PSI label describes who published the record, not a
claim that this fictional vehicle was tested. Keep the demo warning in both the
record notes and graph. Power and torque share a physically consistent synthetic
RPM trace; 310 HP peaks at 5000 RPM and torque rounds to 470 Nm at 4000 RPM.

### Invoice

- Number: `DEMO-INV-001`
- Date: `03/09/2026`
- Amount in app: `0.00` AUD
- Summary: `DEMONSTRATION ONLY - NOT PAYABLE - NOT A TAX INVOICE. The attachment
  illustrates $423.50 AUD including $38.50 illustrative GST. Actual amount due
  is $0.00. No goods or services were supplied. Do not enter this into Xero,
  pay this document or use it to claim GST.`
- Image: `demo-invoice-not-payable.jpg`

### Optional recommended work

- Title: `DEMO - Monitor tyre wear`
- Timing: `Example future workshop visit`
- Status: `Monitor`
- Notes: `DEMONSTRATION ONLY. Example recommendation, not a real vehicle finding.`

## Acceptance before Apple submission

- Confirm records and private images appear in the correct customer's Garage
  and Reports. The graph's 310 HP must match the record's 310 HP.
- Test sign-out and a fresh emailed code in the submitted native build. Never
  include a one-time code as a permanent review password.
- Test access to the dedicated mailbox on a signed-out browser. Passing on the
  owner's device does not establish that Google's unfamiliar-device checks will
  allow Apple access. Do not disable protections to force this arrangement.
- Agree the passwordless review method with Apple. If it cannot provide reliable
  independent access, design and approve a secure alternative before resubmission.
- Disclose the staff portal and resolve how Apple can review it using isolated
  synthetic data. Do not grant live staff permissions to the customer reviewer.
- Do not use the submission-disabled public web demo as a substitute for the
  native app's full reviewable functionality.
- Do not create bookings until their real email/notification effects are
  explicitly approved. Do not manufacture a paid or completed booking state.
- Keep all passwords and codes out of source, this pack, public pages and chat.

## Draft reply while access is being prepared

Hello App Review Team,

Thank you for identifying the access issue. PSI uses passwordless authentication
with a six-digit code delivered by email. We are preparing a dedicated customer
review account and fictional vehicle records. We propose providing access to its
dedicated mailbox so reviewers can retrieve fresh codes independently. Please
confirm whether this method is suitable.

The app also includes an owner-only staff portal containing private workshop
records. We cannot share live customer records or owner credentials. Please
advise whether an isolated demonstration environment is required to review these
staff functions.

We will enter tested access instructions in Beta App Review Information before
resubmitting. We are not yet representing review access as complete.

PSI Performance PTY LTD

## Final review notes template (do not submit with placeholders)

Complete only after independent access and sample-content tests pass. Enter the
review account identifier and approved access instructions privately in App Store
Connect. Explicitly explain that the app has no password field. Do not present
mailbox credentials as if they were an app password. If Apple accepts mailbox
access, include its verified login URL and clearly label mailbox credentials.
Describe the exact native route and steps to obtain and enter a fresh code.

List the sample vehicle, reports, graph and zero-due invoice that are actually
visible. Describe booking requests as approval-first with payments not activated.
Include the agreed staff-review arrangement and monitored owner contact details.
Do not claim a new build is uploaded or accepted until its status is verified.

References: [Apple test information](https://developer.apple.com/help/app-store-connect/test-a-beta-version/provide-test-information),
[Apple review guidelines](https://developer.apple.com/app-store/review/guidelines/),
[TestFlight build statuses](https://developer.apple.com/help/app-store-connect/reference/app-uploads/app-build-statuses).

## Preparation evidence, 03/09/2026

- All three PDFs reopened successfully, with one page, demonstration warning
  and TEST001 vehicle reference checked programmatically.
- All three rendered JPGs visually inspected; each is below 150 KB and the
  staff publisher's 6 MB limit. No real customer documents were used.
- Nothing in this pack has yet been uploaded to a customer or sent to Apple.
- The accompanying Settings heading fix changes only the title/badge layout.
  The title uses two full-width, single-line, shrink-to-fit text elements, with
  the badge alongside the eyebrow instead of beside the long title.
- TypeScript and direct ESLint checks passed. The Expo lint wrapper attempted a
  package-manager refresh and failed; direct checks used existing dependencies
  without changing the lockfile.
- Local browser layout checks passed at 320, 375, 390, 430 and 820 pixels: neither
  title line had horizontal overflow. Native large-text acceptance remains an
  iPhone check; browser testing is not a substitute for native font scaling.
- No native build or OTA was published. The existing native dependency changes
  in the preceding checkpoint require compatible-binary review before another
  production update. Public GitHub Pages remains submission-disabled.
