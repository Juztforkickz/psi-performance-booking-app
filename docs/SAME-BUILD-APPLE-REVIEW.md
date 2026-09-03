# PSI same-build Apple review and beta testing

## Plan and current status

One PSI binary includes the normal app and an explicit isolated demonstration.
Apple selects the demonstration and uses dedicated customer and workshop logins.
External testers use the same Apple-approved binary, sign in normally with their
own invited accounts and see their own records. No post-review swap or rollback
to a different binary is part of this plan. Apple decides whether the disclosed
review arrangement is sufficient; approval is not guaranteed.

Source, local iOS bundle and browser checks passed on 3 September 2026. A signed
build and real-iPhone mode-switch checks are still required before review handover.
Do not send the reply draft as a completed claim before those checks pass.

## Clearly labelled restore points

Before these changes, local and remote main matched
`9d7246a63b0783792a9869df8d7228bbb5089854` with a clean worktree.
The pushed tag `restore/pre-same-build-demo-2026-09-03` preserves that state.
Earlier source bundles and tags are recorded in `APPLE-REVIEW-SANDBOX.md`.

These are source backups, not a verified full live database/file backup. This
change does not migrate, reset or alter the live database or uploaded files.
If a rollback is requested, make a reviewed forward revert and a new release;
never reset main, erase approved work or substitute an unapproved beta binary.

## Build identity and boundaries

* EAS profile/channel: `beta`.
* Runtime: `1.0.0-beta-demo-1`, separate from existing runtime `1.0.0`.
* Name: PSI. Bundle identifier: `com.psiperformance.booking`.
* Existing production, QA, public-demo and historical apple-review profiles stay
  intact. Do not build the historical standalone apple-review profile for this plan.
* No live OTA publish, automatic App Store submission, public registration, paid
  upgrades, payments or live provider changes are authorised by this build step.
* Expo Free billing checked before preparation: iOS 0 of 15 used, total builds
  2 of 30, estimated bill $0. Recheck before any later build. Existing signing
  credentials only; stop rather than replace them or incur a charge.

The root `.easignore` includes only mobile sources and excludes Git history,
private credentials, environment files, signing keys, backups and caches. Local
archive inspection verified 145 files (about 9 MB), all tracked mobile files
except the intentionally excluded `.env.example`, plus the new source files.
Zero private credential, backup, Git or Expo-cache files were present.

## Separation and switching

The default is normal mode. Demo selection is available on the signed-out Account
screen and requires an explicit restart confirmation. A non-secret local choice
is loaded before any account/navigation provider starts. The active backend is
immutable for that JS runtime: no hot client or state swap is permitted.

The demo uses a separate Supabase project and project-specific auth storage.
Booking drafts are namespaced. Leaving signs out only the local demo session and
fully restarts. Normal customer sign-in, staff allowlist and mandatory live AAL2
remain unchanged. Invalid saved mode blocks startup rather than selecting live
silently. A recovery button restarts normal mode.

Demo email, remote push, Calendar delivery and payment effects remain disabled.
Creating local event reminders is also blocked in demo. Existing real device
notifications/reminders are not deleted by this feature.

## Verified here

* 15 automated mode/configuration/isolation checks and TypeScript passed.
* Targeted ESLint passed without errors or warnings.
* iOS Hermes export passed with the beta configuration.
* Browser normal email-code sign-in remained the default.
* Explicit demo entry, customer password login, two demo vehicles and private
  dyno image opened correctly.
* Separate staff password login opened the fictional portal, booking queue,
  publishing controls, audit history and blocked external-delivery status.
* Leaving both customer and staff demo sessions returned to normal authentication;
  the normal staff route required staff sign-in, not the demo session.
* A read-only live check confirmed staff AAL2 enforcement, no sandbox override
  in live staff SQL, and no demo staff email in the live staff allowlist.

## Required on the signed iPhone build

1. Install the new build via internal TestFlight, without deleting the existing
   app first. Check normal saved account access and existing records.
2. Sign out normally. Account > Open demonstration > Enter demo and restart.
3. Sign in with the dedicated customer **app** password. Check garage, private
   reports, document upload/camera, booking workflow and Settings.
4. Sign out within demo; sign in with the separate demo staff credentials.
   Account > Open PSI Portal. Confirm only fictional records are visible.
5. Return to normal PSI app. Verify normal sign-in and real staff MFA still apply.
   Repeat a complete close/reopen in both modes to check saved selection.
6. Enter the two app credentials privately in App Store Connect, attach/select
   the tested build and send `APPLE-REVIEW-REPLY-DRAFT.md` with its actual number.
7. Submit that build for external beta review; after approval invite testers to
   that same build and approve their customer emails through the real PSI portal.

Never share Gmail, Apple account or live staff passwords with reviewers. The
dedicated Gmail address identifies the demo account; mailbox access is unnecessary.
