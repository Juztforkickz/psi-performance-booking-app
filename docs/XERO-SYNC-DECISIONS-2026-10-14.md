# Preserve invoice sync decisions

Xero webhook updates previously reset saved queue states and replaced owner
identifiers. A payment update could therefore reopen a completed invoice or erase
the details of a waiting customer decision. Delivery state now has its own revision
and lease, separate from imported, waiting and ignored decisions.

The webhook merges event metadata under a database row lock. Duplicate and older
deliveries do no work, including the first duplicate after migration. The worker
retains saved targets, verifies current ownership before reusing a published
record, and refreshes balance and completion metadata without replacing its PDF.
Waiting records refresh financial metadata without importing or inviting.
Legacy waiting records without a verified target stay held. Changed identities
or vehicle ownership still require review.

Only one lease can own a row. A later delivery remains due after completion.
Owner selections changed while a sync is running cannot be overwritten, including
changes made without changing the status. Interrupted work becomes eligible
after lease expiry. A protected background check runs every five minutes and
dispatches only eligible work, using the existing scheduler credentials.
Unchanged review reasons do not dispatch another review alert.

Validation includes 83 passing focused tests, actual importer refresh fixtures,
PGlite transaction fixtures, expired lease recovery, saved selections, waiting
records, PDF reuse, mismatched ownership and scheduler dispatch. Both functions
pass strict Deno checks. The optional subscription presence guard in their shared
dependency was made explicit for strict typing; its existing entitlement tests
pass and no subscription or owner protection was changed.

Two canonical migrations are applied. Webhook version 19 and importer version 31
are active in the existing production project. The signed webhook retains its
existing custom authentication, and the importer retains gateway JWT verification.
The new RPCs deny customer execution, and no application table grants were widened.
The security advisor reports the same baseline notice categories.

Production readback verified all 66 existing queue rows retained their decisions,
identifiers, job, record and completion values. An authenticated scheduler smoke
request returned HTTP 200 with zero due entries. The new retry job is active and
returns no request when the queue has no eligible work. A proposed production
mutation test was rejected by automatic approval review over rollback uncertainty;
it did not execute. Local database fixtures and read-only production checks were
used instead.

The historical invoice's missing customer link was restored through the existing
authenticated owner confirmation flow after the owner verified the saved PDF.
The queue now shows imported and points to the same existing workshop job and
published record. Readback confirmed exactly one invoice record and one PDF asset,
with byte-for-byte unchanged asset metadata and unchanged Xero balances.
The workshop desktop is a separate machine and its folder was not inspected.
Deployed source backups, queue snapshots and private target evidence are saved
in the ignored work/xero-sync-repair-2026-10-14 directory. No replacement PDF,
invoice, payment or customer message was created for that target.
