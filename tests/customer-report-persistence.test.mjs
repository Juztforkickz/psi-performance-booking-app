import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('signed-in report forms publish private account records and refresh the list', async () => {
  const [screen, publisher] = await Promise.all([
    read('../mobile/src/app/vehicle-reports.tsx'),
    read('../mobile/src/lib/customer-report-publishing.ts'),
  ]);

  for (const fn of ['saveCustomerDyno', 'saveCustomerRepair', 'saveCustomerRecommendation', 'saveCustomerInvoice']) {
    assert.match(screen, new RegExp(`await ${fn}\\(`, 'u'));
    assert.match(publisher, new RegExp(`export async function ${fn}\\(`, 'u'));
  }
  assert.match(screen, /await onRefreshReports\?\.\(\)/u);
  assert.match(screen, /saved and locked/u);
  assert.doesNotMatch(screen, /<PerformanceVaultCard/u);
  assert.match(screen, /Back to vehicle reports/u);
  assert.match(publisher, /PRIVATE_DOCUMENT_BUCKET = 'vehicle-documents'/u);
  assert.match(publisher, /MAX_CUSTOMER_ATTACHMENT_BYTES = 8 \* 1024 \* 1024/u);
  assert.match(publisher, /record_source: 'customer_entry'/u);
  assert.match(publisher, /upsert: false/u);
});

test('report migration keeps customer history append-only and separates PSI invoices', async () => {
  const migration = await read('../supabase/migrations/20260910205010_save_customer_vehicle_reports.sql');

  assert.match(migration, /record_source in \('psi_record', 'customer_entry'\)/u);
  assert.match(migration, /customers can create own invoice records/u);
  assert.match(migration, /drop policy if exists "customers can update own unverified dyno records"/u);
  assert.match(migration, /drop policy if exists "customers can update own repair entries"/u);
  assert.match(migration, /drop policy if exists "customers can update own recommendation notes"/u);
  assert.match(migration, /PRIVATE_DOCUMENT_BUCKET|vehicle-documents/u);
  assert.match(migration, /not exists \([\s\S]*?from public\.vehicle_files file/u);
});
