# PSI Apple Review Sandbox operations

Current delivery uses the normal app's `beta` profile with explicit demo selection.
See [same-build review and testing](../../docs/SAME-BUILD-APPLE-REVIEW.md); do not
build the older standalone `apple-review` profile for the Apple handover.

These files target **jwikoldibbpxyhbdrsow only**. Never move them into the root
`supabase/migrations` or `supabase/functions` directories. The protected live
project is **lslhfrujyuqcavsnugfx** and must not receive these overrides.

The baseline schema was replayed from the 25 approved root migrations, followed
by the three sandbox-only migrations in this folder. The first override requires
exactly the three pre-created review users and an otherwise empty installation;
it is not a reset script. Do not replay it against an established database.
Keep server and client targets pinned. No live data export or provider secret
is required to rebuild fictional fixtures.

The Edge Functions are sandbox-specific variants. They verify Auth in their
handlers and protect owner operations with `apple_review_staff_access()`.
Deploy only to the exact sandbox ref, with `verify_jwt: false` at the gateway.
Never remove handler verification or copy this gateway setting to live functions.

## Test commands and effects

Run the PowerShell scripts as the Windows owner, not the isolated Codex account.
Credential files and acceptance outputs live under ignored `artifacts/`.

* `scripts/Test-PsiAppleReviewSandbox.ps1`: fresh login and isolation checks.
* `-UploadDemoDocuments`: upload the three existing fictional JPGs, then test
  private reads and cross-customer/public denial. Source JPGs are under
  `output/pdf/apple-review/`; do not substitute real customer files.
* `-TestOperations`: additionally tests Edge authorization and creates/reuses
  the disposable `demo5@example.invalid` account. It never invites a real email.
* `deletion-rehearsal.sql`: creates a single disposable vehicle and requested
  deletion for that existing demo5 account. Never run for another identity.
* `-TestDeletionOnly`: permanently deletes that fixture and its test file through
  the actual sandbox completion endpoint. This is a destructive test, not a
  normal health check. The completed rehearsal is recorded in the private report.

The current fixture is cleaned up. Re-running operations tests would recreate
it; do not do that just to obtain a second identical report.

## Restore and cleanup

The source restore tag is `restore/pre-apple-isolated-review-2026-09-03`.
It does not restore live Auth, database or Storage data. Preserve current work;
any rollback should use a reviewed forward revert, not a hard reset/rebase.

To stop review access later, revoke or disable the sandbox review accounts and
expire their sessions under explicit owner approval. Keep the environment working
through review. Deleting the entire sandbox or restoring live data needs separate
approval. Never remove live users as part of sandbox cleanup.

See `docs/APPLE-REVIEW-SANDBOX.md` for configuration, tested scope and remaining
native/App Store Connect handover steps. No passwords belong in this document.
