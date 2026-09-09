# Workshop portal restructure

## Scope

Approved on 9 September 2026. The existing staff portal is organised into a compact workspace within the same PSI app. Existing protected operations and customer data are preserved.

The main staff navigation is Dashboard, Bookings, Customers, Records and Menu. Customer navigation returns when leaving the portal. Settings is the last workspace-menu item.

## Where work lives

| Area | Tasks |
| --- | --- |
| Dashboard | To-review and active-booking counts, add a vehicle record, find a customer, and work needing attention |
| Bookings | Search Active, To review or History; open one request for review, transfer verification or service completion |
| Customers | Find customers by name, email, registration or vehicle model; view vehicles; start a record with the selected customer and vehicle |
| Records | Select customer and vehicle, then choose service/repairs, recommended work, invoices, workshop photos, dyno results, documents or build history; open one relevant form |
| Records → Imports & drafts | Existing import-review entries and unfinished vault drafts |
| Customers → Owner controls | Invitations, approved accounts, temporary beta access and deletion requests |
| Menu → PSI events | Short event list, then create/edit one event |
| Menu → Connections | Xero, email/Calendar delivery and payment setup status |
| Menu → Connections → Workshop PC uploads | Current folder/import setup status |
| Menu → Activity history | Search the loaded audit snapshot by month; eight entries per page |
| Menu → Settings | Account and existing authenticator management |

Record formats retain their existing destinations. Invoice details/PDF, service notes and verified dyno figures remain available alongside workshop-job vault uploads. This change does not merge or migrate their data.

## Data and security

- Existing staff allowlist, MFA checks, owner-only controls, database policies and private-file APIs remain in force.
- No database schema, storage policy, credential or external integration configuration is changed by this restructure.
- The new navigation does not grant staff access. Signed-out and unapproved accounts still fail the existing access gate.
- Record forms require customer/vehicle checks. Changing identity or details clears the publishing confirmation.
- Unfinished forms prompt before leaving; in-progress operations block navigation. Only one deletion form can be open at a time.
- Existing backend snapshot limits are unchanged. Search and pagination operate on those loaded records, not an unlimited server history.

## Customer layout refinements

- Performance+ cards and price choices stack when width or text size makes columns too narrow. “Documents” retains a complete readable label.
- Account details use full-width rows, including the email address.
- The My Garage Plan & Build artwork fits inside its existing frame without stretching or cropping. The generic descriptive sentence is removed; saved customer goals and the action remain.
- Existing vehicle-photo containment remains unchanged.

## Checkpoints and release

The first restructure passed mobile TypeScript, targeted ESLint, 36 navigation/layout/entitlement/environment/account-isolation tests and an iOS production-bundle export. Browser checks used fictional sandbox accounts at 320px, 390px and desktop widths; these are not physical-iPhone tests. Booking detail navigation, customer-to-record identity selection, draft keep/discard, events, customer artwork selection and light-theme vault labels were checked without submitting workshop records, payments or deletions.

During QA, the sandbox customer loader was found to request a live-only payment table. The review environment now skips only that unavailable payment query; the existing live query and error handling remain intact. Five regression tests cover both modes. The repaired sandbox customer profile, vehicles and garage loaded successfully in the browser.

Before editing, the pushed tag `codex/psi-portal-before-restructure-2026-09-09` was created at `f6866316103a509456d21749ce6b94dc6dd0f50d`.

The earlier pre-subscription checkpoint remains `psi-beta-before-performance-plus-2026-09-09` at `8ec070d8c1264d7ac2017da86085ae8b5c1ff016`.

Recovery should use a reviewed revert or a republished compatible update from the selected checkpoint. Do not reset the live database or force-push main as a UI rollback.

The release uses the existing beta update channel and runtime. Publication identifiers and final validation are recorded in the task's completion report. Installed compatible builds must download the update and reopen before displaying it; a website refresh alone does not update an installed app.

## Portal refinement — 10 September 2026

The second pass reduces the dashboard to daily work, replaces heavy frames with thin cards, and applies readable sentence-case buttons and fields only to the staff workspace. Customer screens keep their established styling.

- Customers begins with a searchable list, with no customer selected automatically. Open one customer to see their contact details and vehicles. Tapping the Customers tab returns to that list.
- Records chooses customer and vehicle before the record type. A validated customer/vehicle shortcut carries that identity into one focused form, with one visible identity summary and a guarded Change vehicle action.
- Header and hardware Back step through the record flow. Leaving entered details prompts to keep or discard the draft; publishing blocks navigation. Existing ownership confirmations and backend publishing calls remain intact.
- Booking lists retain their selected Active, To review or History filter when refreshed. Visit details and notes open on demand. Approval, verified transfer and service-completion controls are shown at the relevant stage.
- Approved accounts are searchable and paginated. Account requests separate pending from completed. Events and connections use compact lists; Settings remains last in Menu.
- No new database, payment, subscription or integration changes are included.

The pushed rollback marker `codex/psi-portal-before-polish-2026-09-09` preserves the first release at `483176b224061c7ff074c69d1f3e422f55c6873b` before this refinement.

Six new component-state tests cover explicit customer/vehicle selection, invalid shortcuts, keep/discard behavior, publishing navigation guards, and both fixed-identity publishers. The combined focused suite has 42 passing tests. Phone-sized browser QA checks the workflow and bright-theme form at 320px, plus the dashboard and draft guards at 390px, using fictional sandbox data. Final validation and update publication are recorded in the release receipt and task completion report.

## Direct public preview and operator refinements · 10 September 2026

The workshop design is now accessible at `https://juztforkickz.github.io/psi-performance-booking-app/portal-preview` without staff sign-in. The demo home and public `/staff` entry both link to it. It uses the shared `StaffWorkspace` and publishing/review components with fictional fixtures; authenticated builds retain the protected staff gate. No real records, contact destinations, files or connected services are loaded from this preview. Form entry, search, navigation and draft guards work; final writes, file pickers, external contacts and connection actions are disabled in both controls and handlers.

Bookings now separate **Enquiry & contact** from **Workshop actions**. Email and mobile have a full-width contact block, with email/call shortcuts in the private portal and complete enquiry text alongside them. Alerts separate the blue PSI inbox from the red customer inbox, show four unread items per page, and open the selected enquiry. Phone-registration copy distinguishes a registered device from a verified delivery result.

Notification state is scoped to the signed-in account, stale refresh responses cannot restore old unread badges, and repeated native notification taps navigate once. Returning to the app checks OS permission and registration, while explicit enable/disable takes precedence. Generic staff pushes open the portal Alerts page. These client fixes require an updated installed app; browser QA does not verify native sound, banners or delivery.

Relevant files: `mobile/src/app/staff.tsx`, `mobile/src/app/portal-preview.tsx`, the demo home and shared navigation, `staff-portal-preview.ts`, `staff-events-preview.tsx`, the staff review/record/vault components, and the notification provider/lifecycle helper. Focused validation passes 55 tests, mobile TypeScript and targeted ESLint. The web export includes the new route. The existing broad-suite wording failures on unrelated customer screens were not part of this pass.

Browser checks at 320px and 390px cover dashboard scale, booking tabs/contact, alert-to-enquiry navigation, registration search, customer-to-record identity, and booking/record/event draft keep/discard. Desktop layout and the bright theme were also inspected. These checks use sample data and do not submit workshop records or test physical phone delivery.

The rollback marker `codex/psi-portal-before-visible-preview-2026-09-10` points to `cd7f9911aa6198437177d9051d76b110627d5a60`, preserving the approved notification/contact checkpoint before this preview pass. Publishing remains the existing GitHub Pages workflow after the checkpoint push. This pass does not deploy native updates or change Supabase, Xero, payments or Apple review services.

## Work still separate from this release

- First verified Xero customer/vehicle/job match and end-to-end automatic invoice import.
- Apple subscription activation, purchase/restore/renewal testing and store review.
- Stripe options and owner approval before final account/payment activation.
- Workshop-PC installer, secure machine setup and a chosen daily photo/dyno-PDF upload schedule.
- End-to-end confirmed-payment/Calendar testing and final launch checks.

No paid service was purchased or activated for this restructure.
