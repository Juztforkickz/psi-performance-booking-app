# Xero invoice registration matching

Prepared 4 October 2026. Production backend deployment and native app publication require approval and remain pending.

An issued invoice can identify a vehicle in its description while its Reference contains only the work description. Previously owner confirmation checked only the Reference, then reported a customer or vehicle mismatch even when the customer, vehicle and workshop job were correct.

The proposed flow inspects the current invoice from Xero before confirmation. One complete line labelled Registration, Rego or Reg supplies exact vehicle evidence. Repeated identical registrations are accepted. Different registrations, partial plates, unlabelled mentions and compound values cannot supply this evidence. The owner still selects and confirms the customer and vehicle. Name similarity does not authorize a transfer or automatic customer link.

The database still requires an authenticated owner with AAL2, an active customer, a current vehicle owned by that customer and a job for that vehicle. It accepts either the exact job reference, a complete registration token in Reference, or the inspected description registration. The secure importer fetches Xero again and rechecks the selected vehicle against the fresh evidence before publication or deduplication of a saved job selection. Edited queue metadata cannot replace that final check.

An existing customer vehicle job on the invoice date is reused. The inspection refreshes the invoice number and date before job lookup. The existing Reference matching path remains available when the older worker is running during rollout. The review card labels the Xero Reference accurately, shows inspected registration evidence when available and separates missing evidence from an ownership mismatch.

Changed source files are the registration parser, invoice matcher, importer, owner review card, feedback messages and SQL confirmation migration. Tests cover the parser, fresh inspection, review workflow and database confirmation. No desktop executable change is needed.

## Validation

81 targeted tests pass across Xero matching, inspection, fetching, production flow contracts, customer visibility and record workflow. Mobile TypeScript, targeted mobile ESLint and the importer Deno typecheck pass. The existing hash helper now explicitly accepts an ArrayBuffer backed byte array, matching the PDF reader and the Deno crypto API without a runtime change. An iOS export passes. The new migration and SQL regression run successfully against an isolated in memory PostgreSQL runtime with fixture tables. This verifies the actual confirmation function, retries, duplicate links, missing and partial registrations, replay rejection, ownership mismatch, owner gate and execute grants. It does not replace acceptance against the complete deployed schema or a physical phone.

Regression SQL is `supabase/tests/xero_description_confirmation.sql`. It requires isolated fixture IDs and an authenticated owner test session as stated in its header. Local validation artifacts and the PostgreSQL harness are in `output/xero-registration-validation` and are excluded from the checkpoint.

## Publication and recovery

After approval, deploy `process-xero-imports` with its shared registration module first, then apply `20261004092134_xero_invoice_description_registration.sql`. Verify the function against the full schema and confirm the existing owner protections and grants. Publish the app change to the verified installed channel and runtime. Test the affected invoice through the owner review flow, confirm one published PDF for the existing job and confirm the workshop sync creates no duplicate. Matching and publication do not change Xero invoice amounts, payment state or customer contact details.

The GitHub Pages preview can refresh through the approved checkpoint push. That preview is separate from production Supabase and native app publication. Production has not been changed and the affected invoice has not been imported by this task.

For rollback, restore the prior importer and owner review implementation, then restore the confirmation function from `20260927122457_fix_xero_confirmation_variable_ambiguity.sql`. Preserve published customer records and audit evidence. Do not reset the database or force push the branch.
