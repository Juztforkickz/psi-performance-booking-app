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
  const [reports, plus, vault, terms] = await Promise.all([
    read('../mobile/src/app/vehicle-reports.tsx'),
    read('../mobile/src/app/performance-plus.tsx'),
    read('../mobile/src/app/vehicle-vault.tsx'),
    read('../mobile/src/app/subscription-terms.tsx'),
  ]);

  assert.match(reports, /loadVaultOverview\(vehicleId\)/u);
  assert.match(reports, /overview\?\.plan === 'performance_plus'/u);
  assert.match(reports, /Vehicle details, dates, kilometres, reminders, bookings and your notes stay free/u);
  assert.match(reports, /lock-closed-outline/u);
  assert.doesNotMatch(reports, /loadVaultRecords|loadCustomerVehicleReports/u);
  assert.match(reports, /Your original invoice is still emailed/u);
  assert.match(reports, /params: \{ vehicleId, kind \}/u);
  assert.match(plus, /REPORT_UNLOCKS/u);
  assert.match(plus, /See everything included with Performance\+/u);
  assert.match(plus, /One Performance\+ subscription unlocks this category and every other Performance\+ category/u);
  assert.match(plus, /profile and vehicle photos, enquiries, every booking option/u);
  assert.match(plus, /invoice copies, dyno files, supporting documents, downloads/u);
  assert.match(vault, /Performance\+ records locked/u);
  assert.match(terms, /Xero invoices continue to be delivered by email/u);
});
