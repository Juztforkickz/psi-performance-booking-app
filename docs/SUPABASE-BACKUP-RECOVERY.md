# Supabase backup, capacity and recovery

Status: controlled QA review, 25 August 2026.

## Current project

- Project: **PSI Performance App** (`lslhfrujyuqcavsnugfx`)
- Region: **Sydney** (`ap-southeast-2`)
- Organisation plan: **Free**
- Project status: **ACTIVE_HEALTHY**
- Postgres: **17.6**
- Database size at review: **13 MB** of the Free Plan's 500 MB per-project quota
- Storage objects at review: **0** of the Free Plan's 1 GB quota
- Auth identities at review: **2 controlled QA identities**

This is ample controlled-QA capacity, but it is not the recommended production
recovery arrangement. Supabase does not provide downloadable scheduled database
backups on the Free Plan and may pause an inactive Free project. PSI must not
invite general customers while depending on Free-only recovery.

## Approved controlled-QA position

1. Keep the project on Free while it contains only controlled QA information.
2. Keep every migration and Edge Function checkpointed in the private source
   history even though the public demo build contains no credentials.
3. Create an encrypted logical export after meaningful QA data/schema changes
   and at least monthly using `scripts/Backup-PsiSupabase.ps1`.
4. Store exports outside the repository on an encrypted drive accessible only
   to Matt. Never upload a data dump to GitHub, Netlify or a public file service.
5. Storage objects require a separate private export; database dumps contain
   Storage metadata, not the actual files. There are currently no Storage
   objects to export.
6. Before external onboarding, upgrade to a plan with scheduled daily backups,
   confirm the available retention window and perform a restore rehearsal in a
   separate non-production environment. Consider PITR only when the required
   recovery point and customer volume justify its additional paid cost.

## Manual export

The supplied PowerShell script refuses to write inside the repository and never
contains the database password. Docker Desktop and the current Supabase CLI are
required because the official dump command runs Postgres tooling in a container.

Set `PSI_SUPABASE_DATABASE_URL` only in the current PowerShell session using the
Session Pooler connection string from Supabase **Connect**, then run:

```powershell
.\scripts\Backup-PsiSupabase.ps1 -BackupDirectory 'D:\Encrypted PSI Backups'
```

The export contains roles, schema, data and SHA-256 checksums. Clear the
temporary environment variable after completion. Auth/provider configuration,
SMTP secrets, Edge Function secrets, project API keys and actual Storage files
must be documented or exported separately; they must never be added to the dump
folder in plain text.

## Recovery acceptance

Before launch, restore a current export into a separate test project or local
Supabase environment and verify:

- migrations, grants, triggers and RLS policies;
- approved synthetic Auth/account recovery strategy;
- customer isolation and Matt-only AAL2 staff access;
- private bucket configuration and separately restored test files;
- Edge Function deployment and freshly entered provider secrets; and
- email, booking and notification behavior without touching production data.

Restoring the production project causes downtime. Never start a production
restore without a verified recovery point, an outage notice and an explicit
owner decision.

References: [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups), [Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), [Supabase billing and quotas](https://supabase.com/docs/guides/platform/billing-on-supabase).

