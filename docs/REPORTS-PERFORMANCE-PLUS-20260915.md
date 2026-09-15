# Reports access and free customer notes

## Approved behaviour

Free customers see report categories and saved-record counts, with a Performance+
lock. Detailed service/repair history, recommended work, dyno figures and graphs,
invoice records, photos, modifications and documents require an active entitlement.
Profile and vehicle information/photos, service/check-in dates and kilometres,
bookings, enquiries, notifications and reminders remain free. Original emailed
invoices are unaffected.

Customers can add free text notes in Reports. These are shared with PSI, explicitly
labelled customer-supplied and unverified, and stored separately from PSI records.
Notes are append-only; there are no customer controls to alter verified workshop
records. Old customer-entered report records are preserved, not converted into
verified PSI records.

Staff: Customers → choose customer → vehicle → Vehicle records & customer notes
→ View records & customer notes. Staff can read both workshop history and customer
notes independently of the customer's subscription. Existing live staff MFA and
record-authority rules remain in place.

## Rollback saved before implementation

- Baseline: 732ce129f214315e650db9cec31d23957b82e9c9.
- Local and remote Git tag: psi-before-reports-subscription-20260915.
- Ignored local backup: work/reports-rollback-20260915.
- Source ZIP, complete verified Git bundle, both projects' policy/function/view
  snapshots, original deployed file-opening function snapshots and SHA-256 manifest.
- The pre-existing untracked SVG was copied into the backup and left untouched.

This is a rollback package for the changed code and access rules, not a full
database/storage disaster-recovery backup. No existing customer records or files
are deleted by these migrations.

To revert the implementation, revert its commits on the delivery branch and
publish the compatible reverted update. Apply
docs/rollback/reports-subscription-20260915.sql to each project where the migrations
were applied. Restore the saved open-vault-file implementation if also reverting
staff attachment viewing. Retain customer_vehicle_notes and its rows: the rollback
deliberately preserves notes added since this change.

Previous build-10 Apple review update group:
c86da9be-aae7-4f29-a438-337f18b758b1, branch apple-review,
runtime 1.0.0-performance-purchase-test-1.

## Validation

- Automated suite: 226 tests passed.
- TypeScript and targeted ESLint checks passed before final packaging.
- Production-mode review web export passed.
- Transactional SQL checks: free/paid/expired access; staff access; cross-customer
  denial; note insert/read; denied cross-vehicle writes and updates; free service
  dates. Test file: tests/sql/reports-subscription-access.sql.
- Browser: free categories conceal contents; subscription prompt; temporary
  complimentary access unlocks dyno contents; graph opens in a returnable viewer;
  customer note survives a page reload and is readable in the staff portal;
  staff can read a free customer's dyno history.
- Rollback rehearsed in a transaction: old read access restored while the new
  customer note survived. Transaction rolled back to keep the new rules installed.
- Supabase security advisors reported no finding on the new notes table or
  functions. Existing sandbox findings remain: pg_net in public and leaked-password
  protection disabled; service-only private tables intentionally have no policies.
  References: https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public
  and https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

## Delivery boundary

The two migrations and open-vault-file version 4 were applied to the isolated
Apple review project jwikoldibbpxyhbdrsow. The live project
lslhfrujyuqcavsnugfx is unchanged: automatic approval review rejected the live
destination pending explicit authorisation. Work is on
codex/reports-performance-plus-notes so main does not receive an interface that
depends on unapplied live tables.

The native subscription purchase/restore transaction itself was not retested:
browser entitlement testing used a temporary complimentary sandbox grant, not a
charge or an Apple purchase. Final native appearance remains to be checked on the
owner's iPhone after its compatible review update arrives.

Checkpoint: 7d34db6, pushed to the review branch. Migration filenames were aligned
with the sandbox's recorded versions (20260914234417 and 20260914235116) to avoid
duplicate reapplication through the CLI. The implementation and rollback SQL are
unchanged by that filename alignment.

Staff attachment opening was also verified visually while the customer was free.
Both the temporary complimentary entitlement and the labelled test note were
removed afterwards; the cleanup query confirmed zero remaining test entries.

Published iOS review update:
- Branch: apple-review.
- Runtime: 1.0.0-performance-purchase-test-1 (compatible with existing build 10).
- Update group: 6fa042bd-a370-4e6a-9b0a-f5b3d54b9caf.
- iOS update: 01a0a261-1202-75fc-9075-fdc30907a7d3.
- App code checkpoint: 7d34db60d615840a2b75c6a8482a8ca95525144d.
- No new native build was created. No live/beta channel was updated.
