# Isolated Apple review environment

Status: project created only, 3 September 2026. Not ready for Apple review.

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

The new project reported `ACTIVE_HEALTHY`. Its migration list was empty after
creation. No production records, Auth users, private files, provider secrets or
staff permissions have been copied. No application configuration, native build,
OTA channel or existing web deployment has been redirected to this project.

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

## Current setup gate

The management connector can create the project but does not expose the Auth
configuration controls needed for this setup. The sandbox Auth settings page
redirects to Supabase owner sign-in. The owner must sign in before registration
settings and review-account creation can be completed. No credentials should be
placed in chat, source history or public documents.

Sandbox settings:
https://supabase.com/dashboard/project/jwikoldibbpxyhbdrsow/auth/providers

## Required implementation and acceptance

These are pending requirements, not completed functionality:

1. Disable public and anonymous registration in the sandbox, verify the saved
   server settings, and keep all providers and real-world integrations isolated.
2. Reuse the approved schema and app screens, preserving customer ownership,
   private buckets and least-privilege roles. Seed only explicitly fictional
   accounts, vehicles, documents, bookings and events. Never clone live data.
3. Supply independent customer and staff review credentials. Do not grant the
   production `psiappreview@gmail.com` customer live staff access. Do not share
   Matt's account, authenticator or provider credentials. Review login design
   must not weaken production email-code authentication or staff AAL2.
4. Implement a fail-closed review configuration pinned to the sandbox project,
   with a separate native update channel and unmistakable review labelling.
   Switching environment must not reuse production sessions or customer drafts.
5. Isolate all email, push, Calendar, invitation and deletion effects. Label any
   simulated external delivery honestly. Never claim real delivery succeeded
   when it was simulated or disabled. Payments remain disabled.
6. Test customer isolation, denied staff access for a customer, valid staff
   review actions, uploads, sign-out, fresh sign-in and environment separation.
   Verify no production changes or external messages occur during these tests.
7. Check the current Expo iOS build allowance before starting a signed build.
   Stop rather than incur a charge. Use the existing app source, not a recreated
   application. Do not publish an OTA to the existing customer channels.
8. Disclose all review-specific behaviour to Apple, resolve any required
   approval for a demo mode, and provide tested access to both account types.
   Do not describe the app as ready until the submitted native build passes the
   fresh-session tests and the access instructions match that build.

References: [Apple account-type review guidance](https://developer.apple.com/forums/thread/810791),
[Apple review guidelines](https://developer.apple.com/app-store/review/guidelines/),
[Supabase backups](https://supabase.com/docs/guides/platform/backups).
