# PSI release closeout, 27 September 2026

## Completed

Luke's INV-1615 now imports successfully. Production logs identified a PL/pgSQL variable collision in `private.confirm_xero_import_match`: local `tenant_id` conflicted with the UPSERT conflict target. Migration `20260927122457_fix_xero_confirmation_variable_ambiguity.sql` renames the two local variables while preserving owner MFA, active customer, vehicle ownership, registration and job checks. Original Xero references remain unchanged.

Matt retried and confirmed success. Read verification found one existing workshop job, one published invoice record and one ready PDF asset, 67,524 bytes. The invoice belongs to Luke's customer ID and vehicle registration 1TX4SZ. His account and production Performance+ subscription are active. This verifies the published record and access prerequisites, not a login to Luke's device.

The two exact registration test email addresses requested by Matt are filtered from normal staff customer lists and selectors. Accounts and deletion administration remain intact. No other info address or owner account is excluded. Import failures now distinguish verification, session, system errors and a match already saved.

App checkpoint: `a29bec8f4c9ec64a0d50523e61d0feaa08d63b8a`.

The existing public OTA workflow passed validation, its owner approval was completed with Matt's authorization, and publication succeeded:

* Workflow: `01a0e2de-b85a-78e2-9b1f-ae73028504c0`
* Channel and branch: `app-store-release`
* Runtime: `1.0.0-app-store-release-1`
* Update group: `7229d545-8f3a-47f3-ab15-46512279e4d2`
* iOS update: `01a0e2e4-50c7-7f56-9879-7e75eb83124d`

The public Expo endpoint returned HTTP 200 with this exact update and runtime. Individual phones must download and apply it on restart.

## Website

Published through the signed in Edge Shopify editor, active theme `130077360257`:

* `shopify/psi-ev-hybrid-page.liquid`: smaller right panel, wider copy column and container relative headline sizing for the live Ethnocentric font. All three headline lines fit clear of the panel at the verified desktop viewport.
* `shopify/footer-group.json`: the custom Liquid section contains the power estimator only on its own page. Hide its empty outer section elsewhere, removing the white strip while preserving the entire estimator.

The exact pasted editor contents were checked before each save. The public page confirms the new styles and zero height for the empty section. Desktop screenshot and original sources are in `output/layout-xero-release-2026-09-27/`.

The previously published footer still provides 23 brands, including BYD, Tesla and Polestar. No footer brand content was replaced in this change.

Fresh mobile visual verification remains incomplete. Edge's viewport override did not change the measured viewport. The Windows fallback stopped because it could not determine the browser URL reliably. No claim of a completed phone check is made for this revision. The responsive CSS remains in place.

## Validation

49 targeted customer visibility, Xero matching and staff record workflow tests passed. Mobile TypeScript and lint passed locally and in the release workflow. Three Shopify EV tests passed. The rollback only SQL regression test passed in the isolated sandbox for initial matching, existing contact retry, punctuation, customer isolation and replay protection. The older sandbox needed temporary worker metadata columns within the rolled back test transaction. No fixture data remains.

Production security advisors were checked. Existing notices concern the public pg_net extension, two intentional customer SECURITY DEFINER entry points and disabled leaked password protection; these are outside this focused release. See [database linter guidance](https://supabase.com/docs/guides/database/database-linter) and [password protection guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Recovery and cleanup

Full Git history and all refs were saved and verified before cleanup:

`output/release-2026-09-27-recovery/all-refs-before-cleanup.bundle`

SHA256: `FC3C1C993C746107355E6449A232E1C099A5FF7F67E9744D86FD1A0AE2B0A164`

Reference names and object IDs are saved in `output/layout-xero-release-2026-09-27/git-refs-before-cleanup.txt`. The bundle is intentionally local and ignored, not an application asset.

Removed three merged remote branches: `codex/illustrated-customer-app`, `codex/reports-performance-plus-notes`, `codex/web-booking-next`. Removed three merged local branches: `codex/brand-protection-and-backup`, `codex/illustrated-customer-app`, `codex/reports-performance-plus-notes`. No open PRs or additional worktrees used them.

Removed nine obsolete website version tags from local and remote, versions 3 through 9 including the two version 9 variants. Every target is retained in main history and the verified bundle. Version 10 and key app recovery tags remain. Removed one generated Python cache directory.

Retained `origin/ota-release-2026-09-26` because it has two commits outside main. Older release exports, unrelated screenshots, the existing screenshot generator and sketch remain preserved. Bulk deletion of these artifacts was not performed. A preexisting unsaved `theme.liquid` editor tab was left untouched.

To restore website files, use the exact `.before` copies in the release folder and save only those corresponding Shopify files. To recover old branch or tag names, fetch the required ref from the local bundle. Prefer a forward correction for database defects; do not restore the known broken confirmation function. Previous public OTA group `8b3533fb-a137-440e-ab3e-37fb27042efc` remains available through the existing Expo rollback workflow if required.

## Remaining work

The separate product, pricing and catalogue audit has not begun. Fresh phone visual verification and further archival cleanup remain. Social screenshots supplied by Matt show EV wording in both bios; a dedicated EV highlight and pinned launch post were not verified or published here.
