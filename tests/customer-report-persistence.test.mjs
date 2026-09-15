import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Reports keeps free notes separate from the paid workshop archive', async () => {
  const [screen, notes, notesComponent] = await Promise.all([
    read('../mobile/src/app/vehicle-reports.tsx'),
    read('../mobile/src/lib/customer-vehicle-notes.ts'),
    read('../mobile/src/components/customer-vehicle-notes.tsx'),
  ]);
  assert.match(screen, /CustomerVehicleNotes/u);
  assert.doesNotMatch(screen, /saveCustomerDyno|saveCustomerRepair|saveCustomerRecommendation|saveCustomerInvoice/u);
  assert.doesNotMatch(screen, /loadCustomerVehicleReports|PREVIEW_DYNO_RECORDS/u);
  assert.match(notes, /auth\.getUser\(\)/u);
  assert.match(notes, /customer_id: auth\.user\.id/u);
  assert.match(notes, /customer_vehicle_notes/u);
  assert.match(screen, /keyboardDismissMode="on-drag"/u);
  assert.match(screen, /keyboardShouldPersistTaps="handled"/u);
  assert.match(notesComponent, /Keyboard\.dismiss\(\)/u);
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
