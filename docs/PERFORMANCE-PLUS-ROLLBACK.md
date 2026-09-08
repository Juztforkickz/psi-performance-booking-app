# Performance+ beta restoration procedure

Prepared 9 September 2026. This document and the SQL script are a recovery procedure, not evidence that a rollback has been executed.

The code checkpoint is `8ec070d8c1264d7ac2017da86085ae8b5c1ff016`, tagged `psi-beta-before-performance-plus-2026-09-09`. The annotated tag was pushed and its remote target verified on 9 September 2026. Verify it again before restoring. Preserve the existing TestFlight build 7 as the previous working beta while testing build 9.

## Saved recovery materials

Local ignored directory: `work/stage4-restore-point/` in this repository. It contains:

- `beta-before-performance-plus.zip`: complete tracked source at the tagged checkpoint.
- `existing-uncommitted-payment-work.patch`: the five unrelated payment-file changes already present before Stage 4.
- `main-access-rules-before-performance-plus.dpapi`: encrypted pre-rollout reference snapshot of 97 access policies, bucket settings and migration names/versions from main. It contains no database rows, Auth backup or uploaded object bytes. Windows DPAPI CurrentUser protection requires the same Windows account/profile to decrypt; simply copying this file to another machine does not provide independent recovery.
- `sha256.json`: SHA-256 integrity hashes for all three files above. The encrypted snapshot hash is `df87133d120b6b246b40af25acb40f828559b35f80d111ba5d98c13c252e9be2`.

These local files are not pushed to the public repository. The source tag is also stored on GitHub. No full database dump was obtained: the standard CLI command requires a separate authenticated CLI session. Keep that limitation explicit when assessing recovery coverage.

All four Stage 4 migrations and five compatible functions are now deployed to main and sandbox. Post-rollout main counts still match the original 7 profiles, 8 vehicles, 5 bookings, 2 invoices and 2 dyno records. Read-only verification found all six original privacy policies, all three invoice gates, RLS on the three affected tables and all three buckets private. This verifies the manual script's preconditions; it does not claim that a rollback has been run or that all restore scenarios have been tested.

## What this restores

The [manual SQL script](../supabase/rollback/performance_plus_restore_free_access.sql) removes only the three Stage 4 restrictions on existing invoice records, invoice file metadata and invoice Storage links. It restores the previous behaviour in which a signed-in customer can access their own existing invoices without Performance+.

Existing ownership policies, staff MFA controls, deleted-identity restrictions and private buckets remain in place. Customers still cannot access another customer's records. The script checks that the expected original policies and RLS exist before proceeding; review their definitions as well, because a matching policy name does not prove its contents.

The new workshop jobs, vault records, assets, subscriptions, import queue and illustrations remain stored. Their access policies are unchanged. New vault contents remain private and entitlement-protected; rolling back the old invoice gate does not make the new vault free or public. Already entitled customers retain the access their current entitlement permits. This procedure does not revoke subscriptions, cancel billing or remove their data.

## Before restoring

1. Record the current commit, deployed function versions, applied migrations and target project. Main PSI is `lslhfrujyuqcavsnugfx`; Apple Review Sandbox is `jwikoldibbpxyhbdrsow`. Do not infer the target from a local CLI link.
2. Preserve the current work and any unrelated uncommitted changes separately. The baseline tag contains committed code only. Retain the pre-rollout code archive, schema/policy/function definitions and any data snapshots made for this rollout in their protected location.
3. Stop new vault publishing and PC import processes while validating the restoration. If real subscription purchases or Xero processing have since been enabled, review their state before changing availability. Removing an app screen does not stop an external renewal or webhook.
4. Verify the checkpoint with read-only commands:

   ```powershell
   git show --no-patch --oneline 8ec070d
   git rev-list -n 1 psi-beta-before-performance-plus-2026-09-09
   git status --short
   ```

## Restore the existing invoice experience

Review and run the entire manual SQL script first in the sandbox, then in the explicitly selected main project if its checks pass. It is transactional and safe to repeat: it drops only the named Stage 4 policies with `IF EXISTS`. A preflight or lock error aborts the transaction; do not bypass it by disabling RLS.

Keep the four Stage 4 migrations and migration history. Do not drop the new tables, buckets, functions or entitlement records. Do not rerun the original foundation migration to restore access: doing so can create conflicts and change unrelated definitions.

Validate the resulting access with temporary fixtures inside a transaction that is rolled back, or existing designated test accounts:

- A free customer can read their own existing invoice and file metadata and request their own invoice link through the previous client flow.
- The same customer cannot read another customer's invoice/file metadata or obtain another customer's private file link.
- Anonymous requests and stale JWTs for deleted identities remain denied.
- New vault records/assets remain inaccessible to free customers; their bucket remains private and customer direct Storage signing remains denied.
- Existing garage, bookings, kilometres, maintenance and free dyno records still work.

The Stage 4 entitlement test that expects existing invoices to be locked will intentionally differ after this rollback. Record that expected difference; do not weaken its ownership or new-vault assertions. Recheck Supabase security advisors after the change.

If the access rollback becomes the continuing deployed state, record it in a new forward migration generated with the Supabase CLI, rather than editing or deleting the already-applied Stage 4 migrations. Keep the manual execution and migration history consistent so future environments do not silently restore the paid gate.

## Restore the app code without rewriting history

Create a new revert commit from the current working branch. Review `git log` and `git diff` against `8ec070d` to identify the Stage 4 commits and affected app files. Revert only the Stage 4 app changes needed to recover the working beta, resolving conflicts to retain unrelated approved fixes. Do not bulk-revert every later commit or restore the whole repository blindly.

Keep the additive database migration history, this recovery procedure, and the compatible server functions. In particular, keep `performance-vault` in the account-deletion function's private-bucket cleanup whenever new vault files may exist. Do not redeploy the old deletion function unconditionally: it would omit those files. Keep `open-vault-file` available for any installed Stage 4 clients that still use it.

Run the relevant tests and the web export, review the new revert commit, and push it normally to the current branch. The approved GitHub Pages workflow can then refresh the preview. Do not use `git reset --hard`, force-push, delete the checkpoint tag or deploy to Netlify as part of this restoration.

Native compatibility is a separate checkpoint. Build 7 does not contain the newly added native purchase/document/image-processing modules. **Do not send Stage 4 JavaScript to build 7 through an OTA update.** Retain build 7 and its compatible update/runtime configuration. A new native build is required for the added modules; any replacement or rollback binary must use an appropriate build number and go through the applicable Apple/TestFlight process. If an OTA rollback is ever used, it must contain the matching prior JavaScript for the exact installed runtime, not merely the current web build.

## Limits of this recovery point

This is a non-destructive application/access rollback, not a full disaster-recovery backup. A Git tag or source archive contains no live Auth users, database rows, uploaded object bytes, service secrets or Apple/Xero account configuration. A database definition snapshot is not a database data backup, and a Storage object listing is not a copy of those files. Record the actual contents and date of each saved snapshot; do not promise recovery of anything it does not contain.

The rollout is additive: existing customer accounts, beta testers, sandbox, vehicle data and stored originals are intended to remain in place. This rollback relies on that preserved data rather than replacing it with a historical dump. It does not recover files deleted separately or undo customer activity after rollout. Workshop-PC originals and other existing backups should be retained independently.

If data has been deleted or corrupted, stop and establish a separate, verified restoration plan using the backups that actually exist. Do not restore a whole old database over newer bookings or customer changes merely to remove Performance+.

The original access foundation was checked against the repository migrations and the current [Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security). The rollback still requires the environment-specific validation above before it is considered verified.
