import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = relativePath => readFile(new URL(relativePath, import.meta.url), 'utf8');

test('Calendar reconciliation creates, updates and removes one team-visible deterministic event', async () => {
  const [worker, migration] = await Promise.all([
    read('../supabase/functions/process-booking-integrations/index.ts'),
    read('../supabase/migrations/20260910132000_calendar_reconciliation.sql'),
  ]);
  assert.match(migration, /sync_google_calendar_cancelled/u);
  assert.match(migration, /old\.state in \('confirmed','completed'\)/u);
  assert.match(worker, /const eventId = `psi\$\{job\.booking_request_id\.replaceAll/u);
  assert.match(worker, /method: "GET"/u);
  assert.match(worker, /method: "PUT"/u);
  assert.match(worker, /method: "POST"/u);
  assert.match(worker, /method: "DELETE"/u);
  assert.match(worker, /attendees: \[\]/u);
  assert.match(worker, /visibility: "default"/u);
  assert.doesNotMatch(worker, /visibility: "public"/u);
  assert.match(worker, /sendUpdates=none/u);
  assert.match(worker, /sync_state: "removed"/u);
});

test('Xero imports rotate tokens, require an owner-confirmed match and publish only a verified PDF', async () => {
  const [worker, lockMigration, importMigration, webhook] = await Promise.all([
    read('../supabase/functions/process-xero-imports/index.ts'),
    read('../supabase/migrations/20260909124112_xero_refresh_token_lock.sql'),
    read('../supabase/migrations/20260910131500_xero_import_processing.sql'),
    read('../supabase/functions/xero-vault-webhook/index.ts'),
  ]);
  assert.match(lockMigration, /for update/u);
  assert.match(lockMigration, /refresh_lock_token/u);
  assert.match(lockMigration, /commit_xero_refresh/u);
  assert.match(importMigration, /private\.is_owner_staff\(\)/u);
  assert.match(importMigration, /confirm_xero_import_match/u);
  assert.match(importMigration, /upper\(btrim\(job\.reference\)\) <> invoice_reference/u);
  assert.match(webhook, /status: 'pending'/u);
  assert.match(webhook, /EdgeRuntime\.waitUntil/u);
  assert.match(webhook, /functions\/v1\/process-xero-imports/u);
  assert.match(webhook, /SUPABASE_SERVICE_ROLE_KEY/u);
  assert.match(worker, /requestXeroTokenRefresh/u);
  assert.match(worker, /matchXeroInvoice/u);
  assert.match(worker, /reader\.pdf\(invoiceId\)/u);
  assert.match(worker, /storage\.from\('performance-vault'\)\.upload/u);
  assert.match(worker, /published_at: new Date\(\)\.toISOString\(\)/u);
  assert.doesNotMatch(worker, /body\.(?:customerId|vehicleId|jobId|invoiceUrl|pdfUrl)/u);
});
