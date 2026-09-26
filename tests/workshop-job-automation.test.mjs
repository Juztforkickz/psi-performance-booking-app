import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('confirmed app bookings create one exact workshop job and PC manifest workflow', async () => {
  const [migration, bookingTools, uploader, launcher, tray, installer, guide] = await Promise.all([
    read('../supabase/migrations/20260911143000_booking_job_xero_completion.sql'),
    read('../mobile/src/components/staff-workshop-job.tsx'),
    read('../operations/workshop-pc/psi_uploads.py'),
    read('../operations/workshop-pc/Start-PSIWorkshopUploader.ps1'),
    read('../operations/workshop-pc/Start-PSIWorkshopTray.ps1'),
    read('../operations/workshop-pc/Install-PSIWorkshopUploader.ps1'),
    read('../operations/workshop-pc/README.md'),
  ]);
  assert.match(migration, /after insert or update of state on public\.booking_requests/u);
  assert.match(migration, /new\.state not in \('confirmed', 'completed'\)/u);
  assert.match(migration, /'PSI-' \|\| upper\(replace\(new\.id::text, '-', ''\)\)/u);
  assert.match(migration, /on conflict \(booking_request_id\) do nothing/u);
  assert.match(bookingTools, /Use this exact reference in Xero/u);
  assert.match(bookingTools, /automatically creates the verified folder/u);
  assert.match(bookingTools, /Download PC folder file · fallback/u);
  assert.match(uploader, /def create_job_folder/u);
  assert.match(uploader, /def sync_job_folders/u);
  assert.match(uploader, /def create_manual_job/u);
  assert.match(uploader, /class SessionStore/u);
  for (const folder of ['photos', 'dyno', 'invoices', 'documents']) {
    assert.match(uploader, new RegExp(`'${folder}'`, 'u'));
  }
  assert.match(uploader, /LEGACY_PHOTO_CATEGORIES = \('before', 'progress', 'after'\)/u);
  assert.match(guide, /Save a Mainline result as PDF into the job's `Dyno results & graphs` folder/u);
  assert.match(launcher, /PSIWorkshopWindow/u);
  assert.match(launcher, /SetWindowPos/u);
  assert.match(launcher, /\$LASTEXITCODE -eq 10/u);
  assert.match(launcher, /Local\\PSIWorkshopMenu/u);
  assert.match(launcher, /Automatic watching is already running in the background/u);
  assert.match(tray, /Local\\PSIWorkshopTray/u);
  assert.match(tray, /function Open-PSIMenu/u);
  assert.match(uploader, /Type back at any question/u);
  assert.match(uploader, /Returning to the PSI Workshop Uploads menu/u);
  assert.match(installer, /\$LegacyStartupNames/u);
  assert.match(installer, /PSI Workshop Sync Status\.lnk/u);
  assert.match(installer, /Remove-Item -LiteralPath \(Join-Path \$Startup \$LegacyStartupName\)/u);
  assert.match(guide, /bottom-right PSI notification-area app/u);
});

test('Xero imports assist service completion without closing the booking', async () => {
  const [migration, worker, component] = await Promise.all([
    read('../supabase/migrations/20260911143000_booking_job_xero_completion.sql'),
    read('../supabase/functions/process-xero-imports/index.ts'),
    read('../mobile/src/components/staff-service-completion.tsx'),
  ]);
  assert.match(migration, /create table public\.service_completion_candidates/u);
  assert.match(migration, /staff read Xero completion candidates/u);
  assert.doesNotMatch(migration, /insert into public\.service_completions/u);
  assert.match(worker, /syncServiceCompletionCandidate/u);
  assert.match(worker, /suggestedWorkSummary/u);
  assert.match(component, /The invoice date and line descriptions have filled this form/u);
  assert.match(component, /Check the actual finish date, odometer and work before completing it/u);
});

test('owners can explicitly keep non-app customer invoices in Xero only', async () => {
  const [migration, hardening, review] = await Promise.all([
    read('../supabase/migrations/20260911143000_booking_job_xero_completion.sql'),
    read('../supabase/migrations/20260911153000_harden_ignore_xero_rpc.sql'),
    read('../mobile/src/components/staff-vault-publisher.tsx'),
  ]);
  assert.match(migration, /create or replace function public\.ignore_xero_import/u);
  assert.match(migration, /private\.is_owner_staff\(\)/u);
  assert.match(hardening, /alter function public\.ignore_xero_import\(uuid\) set schema private/u);
  assert.match(hardening, /security invoker/u);
  assert.match(review, /Keep in Xero only/u);
  assert.match(review, /It will not appear in an app customer’s vault/u);
});

test('phone and walk-in jobs wait safely and transfer on a strong customer-created account match', async () => {
  const [migration, indexMigration, automaticClaim, uploader, launcher, review, guide] = await Promise.all([
    read('../supabase/migrations/20260914061154_workshop_only_customers.sql'),
    read('../supabase/migrations/20260914062740_index_workshop_claims.sql'),
    read('../supabase/migrations/20260924233000_auto_claim_workshop_jobs_on_customer_vehicle.sql'),
    read('../operations/workshop-pc/psi_uploads.py'),
    read('../operations/workshop-pc/Start-PSIWorkshopUploader.ps1'),
    read('../mobile/src/components/staff-workshop-customers.tsx'),
    read('../operations/workshop-pc/README.md'),
  ]);

  assert.match(migration, /create table public\.workshop_contacts/u);
  assert.match(migration, /create table public\.workshop_vehicles/u);
  assert.match(migration, /create or replace function public\.create_workshop_only_job/u);
  assert.match(migration, /create or replace function public\.claim_workshop_contact/u);
  assert.match(migration, /security invoker/u);
  assert.match(migration, /lower\(btrim\(contact\.email\)\) = lower\(btrim\(customer\.email\)\)/u);
  assert.match(migration, /if not exact_email and not \(exact_name and exact_registration\)/u);
  assert.match(migration, /upper\(btrim\(app_vehicle\.registration\)\) = upper\(btrim\(workshop_vehicle\.registration\)\)/u);
  assert.match(migration, /enable row level security/u);
  assert.match(indexMigration, /workshop_contacts_claimed_by_idx/u);
  assert.match(indexMigration, /workshop_jobs_workshop_vehicle_contact_idx/u);
  assert.match(automaticClaim, /auto_claim_workshop_history_after_customer_vehicle_save/u);
  assert.match(automaticClaim, /normalized_identity_mobile/u);
  assert.match(automaticClaim, /workshop_contact\.email is not null/u);
  assert.match(automaticClaim, /app_vehicle\.registration/u);

  assert.match(uploader, /'schema': 2, 'owner_type': 'workshop'/u);
  assert.match(uploader, /waiting_for_customer_account/u);
  assert.match(uploader, /create_workshop_only_job/u);
  assert.match(uploader, /PSI_WORKSHOP_ERROR_LOG/u);
  assert.match(launcher, /last-error\.log/u);
  assert.match(launcher, /Local\\PSIWorkshopAutomaticUploader/u);
  assert.match(launcher, /Enter-PSIUploaderLock/u);
  assert.match(launcher, /finally \{/u);
  assert.match(launcher, /Press Enter to close/u);
  assert.match(review, /transfer automatically when the customer completes their own account/u);
  assert.match(review, /Review & transfer/u);
  assert.match(review, /exact email match or an exact name plus registration match/u);
  assert.match(guide, /without creating an app login or sending an invitation/u);
  assert.match(guide, /automatically links the eligible workshop vehicles and jobs/u);
  assert.match(guide, /Similarity alone never transfers records automatically/u);
});
