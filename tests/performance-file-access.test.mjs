import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Performance+ protects vehicle documents while PSI Free keeps profile photos', async () => {
  const migration = await read('../supabase/migrations/20260913074948_lock_vehicle_files_to_performance_plus.sql');

  assert.match(migration, /drop policy if exists "invoice file subscription requirement"/u);
  assert.match(migration, /on public\.vehicle_files as restrictive for select to authenticated[\s\S]*?file_kind = 'vehicle_photo'[\s\S]*?private\.has_performance_plus\(\)[\s\S]*?private\.is_active_staff\(\)/u);
  assert.match(migration, /on public\.vehicle_files as restrictive for insert to authenticated[\s\S]*?file_kind = 'vehicle_photo'[\s\S]*?private\.has_performance_plus\(\)/u);
  assert.match(migration, /on storage\.objects as restrictive for select to authenticated[\s\S]*?bucket_id <> 'vehicle-documents'[\s\S]*?private\.has_performance_plus\(\)/u);
  assert.match(migration, /on storage\.objects as restrictive for insert to authenticated[\s\S]*?bucket_id <> 'vehicle-documents'[\s\S]*?private\.has_performance_plus\(\)/u);
});

test('Vehicle Reports advertises locked categories without fetching their contents', async () => {
  const [reports, plus, vault, terms, definitions, workflow, history] = await Promise.all([
    read('../mobile/src/app/vehicle-reports.tsx'),
    read('../mobile/src/app/performance-plus.tsx'),
    read('../mobile/src/app/vehicle-vault.tsx'),
    read('../mobile/src/app/subscription-terms.tsx'),
    read('../mobile/src/lib/performance-plus.ts'),
    read('../mobile/src/components/staff-record-workflow.tsx'),
    read('../mobile/src/components/staff-vehicle-history.tsx'),
  ]);

  assert.match(reports, /loadVaultOverview\(vehicleId\)/u);
  assert.match(reports, /overview\?\.plan === 'performance_plus'/u);
  assert.match(reports, /Vehicle details, dates, kilometres, reminders, bookings and your notes stay free/u);
  assert.match(reports, /lock-closed-outline/u);
  assert.match(reports, /REPORT_CATEGORY_ICONS\[kind\]/u);
  assert.match(reports, /recommendation: 'alert-circle-outline'/u);
  assert.match(reports, /<StaffScrollSelect[\s\S]*?label="Select vehicle"/u);
  assert.doesNotMatch(reports, /<ScrollView horizontal/u);
  assert.doesNotMatch(reports, /loadVaultRecords|loadCustomerVehicleReports/u);
  assert.match(reports, /Your original invoice is still emailed/u);
  assert.match(reports, /params: \{ vehicleId, kind \}/u);
  assert.match(plus, /REPORT_UNLOCKS/u);
  assert.match(plus, /See everything included with Performance\+/u);
  assert.match(plus, /One Performance\+ subscription unlocks this category and every other Performance\+ category/u);
  assert.match(plus, /profile and vehicle photos, enquiries, every booking option/u);
  assert.match(plus, /invoice copies, dyno files, supporting documents, downloads/u);
  assert.match(plus, /REPORT_KINDS\.map/u);
  assert.match(plus, /recommendation: 'PSI recommended work/u);
  assert.match(plus, /StaffScrollSelect label="Select vehicle"/u);
  assert.match(plus, /Restore completed\. Apple confirmed your purchase and Performance\+ access is active/u);
  assert.match(vault, /Performance\+ records locked/u);
  assert.match(vault, /Math\.max\(insets\.top \+ 10/u);
  assert.match(terms, /Xero invoices continue to be delivered by email/u);
  assert.match(definitions, /REPORT_KINDS: ReportSection\[\] = \['service', 'recommendation', 'dyno', 'invoice', 'media', 'document'\]/u);
  for (const label of ['Service & Repair History', 'Recommended Work', 'Dyno Results & Graphs', 'Invoices', 'Workshop Photos', 'Documents & DTCs']) {
    assert.ok(definitions.includes(label), `Missing customer report label: ${label}`);
    assert.ok(workflow.includes(label), `Missing staff report label: ${label}`);
  }
  assert.match(definitions, /section === 'document' \? recordKind === 'document' \|\| recordKind === 'modification'/u);
  assert.match(definitions, /section === 'document' \? counts\.modification \?\? 0 : 0/u);
  assert.match(history, /recordMatchesReportSection\(record\.kind, section\)/u);
  assert.doesNotMatch(workflow, /Build history|id: 'modification'/u);
});
