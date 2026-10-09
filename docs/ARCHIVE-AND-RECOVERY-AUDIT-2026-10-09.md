# Archive and recovery audit, 9 October 2026

## Completed archive

Moved 12 files, totaling 93,373,523 bytes, into the local ignored directory
`artifacts/archive/2026-10-09/`, preserving their original relative paths.
Each source SHA256 was recorded before moving and checked against the archived
file afterwards. The local `manifest.json` records source, destination, size and
SHA256. Files were moved, not destroyed.

The archive contains the older website source copies and verification evidence
from `output/footer-release-2026-09-27/` and
`output/layout-xero-release-2026-09-27/`, plus the temporary Android build from
`mobile/.tmp-release/`. None is imported by application source, build workflows,
workshop scripts or tests. Historical document references now identify the
archive location. Git history retains the eight previously tracked files.

Preserved active preview inputs, including the older refined home stylesheet
still read by `scripts/serve-ask-psi-review.mjs`. Preserved marketing media,
latest release proof, database migrations, credentials, signed installers,
existing recovery bundles and unrelated ongoing work.

This improves organization, not application performance or total disk space.
The archive is excluded from Git and EAS uploads. Repository visibility and all
hosting, update channels, reviewer access and live services remain unchanged.
The configured GitHub Pages refresh after pushing is the only deployment action.

## Recovery coverage

Committed code and its history exist locally and on GitHub. The existing
27 September full history bundle was verified successfully. A fresh full source
history bundle is saved locally as
`artifacts/archive/2026-10-09/psi-source-history-2026-10-09.bundle` after the
archive checkpoint, with verification and a SHA256 checksum beside it.
It contains committed source history and refs. It does not contain ignored
credentials, customer database rows, uploaded files or unrelated uncommitted work.

The production Supabase organization was verified as Free. Its live scheduled
backups screen explicitly reports that the Free plan does not include project
backups. The existing backup script and written procedure are not evidence that
an export has been run. No complete current customer database export, separate
Storage object backup, independent offsite recovery copy or successful full
restore rehearsal was established by this audit. A backup elsewhere may exist,
but cannot be claimed from these checks.

Storage objects were checked through an aggregate, read only query. Uploaded
files exist, so the old August assumption of empty Storage is no longer current.
Database backups contain Storage metadata, not the actual uploaded file bytes.
Workshop originals may recover some records, but were not compared with every
cloud object and are not a verified full Storage backup.

No live data was exported, restored, deleted or changed. No plan was upgraded or
paid feature enabled. Complete disaster recovery still requires private database
and Auth exports with verified coverage, separate copies of uploaded files,
secure configuration and credential recovery, an independent copy on another
device or location, and a restore rehearsal in an isolated environment.

A same disk archive protects against accidental edits, not loss of this computer.
GitHub's source copy improves code recovery, but cannot restore customer data.
Manual private exports can avoid adding a platform subscription, provided an
appropriate secure destination and authorized access are available.

References: [Supabase database backups](https://supabase.com/docs/guides/platform/backups)
and [existing project recovery procedure](SUPABASE-BACKUP-RECOVERY.md).
