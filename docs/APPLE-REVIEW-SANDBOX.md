# Isolated Apple review environment

## Current delivery plan supersedes the standalone build plan

See [Same-build Apple review](SAME-BUILD-APPLE-REVIEW.md). On 3 September 2026
the owner approved one normal PSI binary with an explicit, selectable isolated
demonstration. Use the `beta` build profile, not the historical `apple-review`
profile below. The owner also approved source upload to the existing Expo project
and use of its stored signing credentials, provided the build is free.
Apple and subsequent external testers should use the same approved binary. Do not
switch to an unreviewed binary after approval. The sections below preserve the
earlier sandbox checkpoint and implementation history.

Status: sandbox implemented and browser/API acceptance passed, 3 September 2026.
The review iOS JavaScript bundle compiles. A signed native build, on-device
acceptance and App Store Connect handover remain pending at this checkpoint.

Implementation checkpoint: `426c1c2dca7fc6afd87ce38c8664cf25f73b6876` on `main`.
Saved GitHub tag: `checkpoint/apple-review-sandbox-tested-2026-09-03`.
Local source bundle: `artifacts/restore-points/PSI-APPLE-REVIEW-SANDBOX-TESTED-2026-09-03.bundle`.
`git bundle verify` confirmed complete history. SHA-256:
`619E4D42FE99D4BEAA75AF7E738E2E41527FD5DF7522CB2605F3621B673CA916`.
The implementation's automatic GitHub Pages refresh passed, including the new
isolation test step: [run 33713834957](https://github.com/Juztforkickz/psi-performance-booking-app/actions/runs/33713834957).

The attempted EAS cloud build was blocked before the command started by the
execution approval check. No build was queued, signing credentials changed or
upload performed by that attempt. Explicit owner approval is required to upload
the app source to the existing Expo project and use its existing signing
credentials for the free isolated review build. Private credential files and
local backup artifacts are Git-ignored and must remain excluded from any upload.

## Owner approval and cost boundary

The owner approved a separate review environment only if it costs nothing.
Supabase quoted a new project at 0 per month in the existing **APP Builder**
organisation (`ogxjdxpyjspaoeiwxtxn`). The cost confirmation was completed and
the project was created on the Free plan. No paid plan, branch, add-on or build
was activated. Recheck cost before any later provisioning and stop if a charge
would be required. This quote covers Supabase, not Expo build allowance.

## Exact targets

| Purpose | Project | Region |
| --- | --- | --- |
| Existing protected app, do not change | `lslhfrujyuqcavsnugfx` | Sydney |
| PSI Apple Review Sandbox | `jwikoldibbpxyhbdrsow` | Sydney |

The new project reports `ACTIVE_HEALTHY`. The 25 approved schema migrations were
replayed, followed by three sandbox-only migrations kept outside the live
deployment directory. No production records, Auth users, private files or
provider secrets were copied. Existing QA, production and public-demo builds
continue to use their original configuration.

## Saved source restore point

Before sandbox creation, local `main` and GitHub `main` both matched
`2c82c56b1ebf2bc0b37ab1ea3c25aa738a125541` and the worktree was clean.

- GitHub restore tag: `restore/pre-apple-isolated-review-2026-09-03`.
- Local ignored bundle: `artifacts/restore-points/psi-pre-apple-review-2026-09-03.bundle`.
- `git bundle verify` passed and reported complete source history.
- Bundle SHA-256: `5A7B45E4F677BE602C4EE9D4353A1ED8B5011C9683E6A7A68BA879E1D3EE1AFF`.

This is a source-code restore point, not a live database, file-storage or
provider-configuration backup. A current encrypted data/file export and restore
rehearsal have not been verified. See `SUPABASE-BACKUP-RECOVERY.md`. Do not reset
the live app or database as part of sandbox setup.

## Implemented isolation

Public, anonymous and manual-linking registration are disabled server-side.
Dedicated email/password accounts are confirmed administratively, with separate
36-character randomly generated passwords. Gmail access is not needed.

| Account | Scope |
| --- | --- |
| `psiappreview@gmail.com` | Fictional customer and two demo cars |
| `psiappreview+staff@gmail.com` | Owner role in this sandbox only |
| `psiappreview+isolation@gmail.com` | Private isolation test; not an Apple login |

The sandbox staff SQL requires the exact staff email, sandbox JWT issuer, an
active Auth session and a private installation marker. This dedicated password
session is accepted without staff TOTP only in the isolated database. The live
Matt allowlist, mandatory AAL2 and live authentication code paths are unchanged.
A client flag alone cannot grant database access. Customer ownership and private
Storage policies remain enforced.

Review credentials are saved with Windows DPAPI in the ignored file
`artifacts/apple-review-private/PSI-APPLE-REVIEW-SANDBOX-credentials.clixml`.
Only the owning Windows account can decrypt it. Never commit or print passwords,
mailbox credentials, tokens or privileged keys. `New-PsiAppleReviewCredentials.ps1`
supports ephemeral RSA-encrypted transport for private form entry, not plaintext
terminal output. Do not recreate existing credentials. DPAPI recovery requires
the original Windows identity; this file is not a portable credential backup.

Synthetic content consists of three vehicles, an inspection, a 310 HP example
dyno graph, a zero-AUD non-payable invoice, a pending booking and a fictional
event. Three private JPG attachments were uploaded and checked. No real vehicle
inspection, tax invoice or workshop appointment is represented.

Three sandbox-only Edge Functions are deployed: `invite-customer`,
`complete-account-deletion` and `process-booking-integrations`. Each rejects a
different project URL and verifies the caller via Supabase Auth. Owner actions
also require the session-aware staff RPC. Gateway `verify_jwt` is false for
asymmetric JWT compatibility; application-level verification remains mandatory.
Invitations only accept bounded fictional `demo1@example.invalid` through
`demo5@example.invalid` accounts or the existing test customer aliases. No
external invitation emails or TestFlight invitations are sent. Deletion requires
a customer request plus explicit owner confirmation. The integration worker
records deliberately blocked delivery; it cannot email, charge or access Calendar.
No push worker or external provider secrets are installed in the sandbox.

## Historical standalone build configuration (superseded)

Do not build or distribute this older profile. The current `beta` profile keeps
normal and demo access in one binary; see `SAME-BUILD-APPLE-REVIEW.md`.

| Field | Review build |
| --- | --- |
| Display name | PSI Review |
| EAS build profile / channel | `apple-review` |
| Runtime | `1.0.0-apple-review-1` |
| Bundle identifier | `com.psiperformance.booking` (existing app) |
| EAS project | `e62e9cdf-867c-4eb7-b8c5-a2610f969286` (existing project) |

`mobile/review-environment.cjs` fails closed unless the explicit review flag,
pinned sandbox URL/public key, closed registration and review channel agree.
The dynamic app config rejects review mode under a production/QA build profile.
Review sessions are project-specific; draft and push storage keys are namespaced.
Every screen shows a review banner. External device push handling is disabled.
Existing production and QA profiles are unchanged. No live OTA was published.

This is a separate signed build of the same app, not a new application. Because
the bundle identifier stays the same, installing it on a phone replaces that
phone's current PSI installation. Previous builds and live server records remain
available; do not distribute this review build to ordinary customer test groups.
Do not submit this sandbox build as the eventual public production release.

## Acceptance evidence

* Eight environment/configuration regression tests passed.
* TypeScript and targeted ESLint validation passed; the isolated iOS Hermes bundle
  exported successfully. The submission-disabled public web export also passed
  across all 22 routes.
* 34 API checks passed: fresh logins, account isolation, denied anonymous and
  invalid-token operations, bounded invitations, blocked external delivery and
  private access to all three uploaded documents.
* A separate nine-check deletion rehearsal passed. It removed only the disposable
  `demo5@example.invalid` fixture, one vehicle and one private file. The three
  review accounts and three review documents remained intact afterward.
* Browser checks passed for fresh customer sign-in, the two-car garage selector,
  visible private dyno image, sign-out, staff sign-in, workshop records and the
  queue's explicit no-delivery result. This is not an iPhone native acceptance test.
* Private test reports are in `artifacts/apple-review-private/`.

Security advisors: intentionally deny-all RLS tables produce informational
messages. Leaked-password screening remains disabled; no paid upgrade was
activated. Strong unique passwords and closed registration are used, but do not
describe this as a warning-free security audit.

Expo billing was checked immediately before build preparation: Free $0/month,
15 iOS builds included, 0 iOS used, 2 Android used and $0 estimated bill. Recheck
if the build is resumed later. Stop rather than upgrade if the free allowance is
unavailable. Supabase remains on Free.

## Historical handover gate (superseded)

The following describes the earlier standalone proposal, not current instructions.
Use the signed-iPhone checklist in `SAME-BUILD-APPLE-REVIEW.md` instead.

1. Implementation checkpoint saved and pushed; automatic Pages refresh verified.
2. Build iOS with the `apple-review` profile only; label the build and record its
   ID and source commit. Do not auto-submit or auto-distribute it.
3. Install the exact signed build and verify both fresh logins, private documents,
   customer-to-staff isolation, uploads and sign-out on iPhone. A local web pass
   does not replace these checks.
4. Provide the customer credentials in Beta App Review Information and the
   separate staff credentials in Apple's private review notes. Do not disclose
   Gmail, Apple or Matt credentials. Follow `APPLE-REVIEW-REPLY-DRAFT.md` only after
   the build and private credentials are attached and verified.
5. Disclose the isolated demo mode and all disabled external effects to Apple;
   acceptance is Apple's decision. Keep registration closed and live MFA intact.

Sandbox operations and rebuild cautions: `../operations/apple-review/README.md`.
No live database rollback, production OTA, paid service or public-store release
is part of this checkpoint.

References: [Apple account-type review guidance](https://developer.apple.com/forums/thread/810791),
[Apple review guidelines](https://developer.apple.com/app-store/review/guidelines/),
[Supabase backups](https://supabase.com/docs/guides/platform/backups).
