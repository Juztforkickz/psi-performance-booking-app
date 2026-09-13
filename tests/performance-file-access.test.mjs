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

test('Vehicle Reports keeps information free and gates only file attachments', async () => {
  const [reports, plus, vault, terms] = await Promise.all([
    read('../mobile/src/app/vehicle-reports.tsx'),
    read('../mobile/src/app/performance-plus.tsx'),
    read('../mobile/src/app/vehicle-vault.tsx'),
    read('../mobile/src/app/subscription-terms.tsx'),
  ]);

  assert.match(reports, /loadVaultOverview\(selectedVehicle\.id\)/u);
  assert.match(reports, /performanceOverview\?\.plan === 'performance_plus'/u);
  assert.match(reports, /Vehicle details, service dates, work summaries and PSI recommendations stay available with PSI Free/u);
  assert.match(reports, /performanceFilesUnlocked \? <AttachmentPicker/u);
  assert.match(reports, /Dyno graph images/u);
  assert.match(reports, /Invoice images and PDFs/u);
  assert.match(reports, /Xero still emails the original invoice/u);
  assert.match(plus, /profile and vehicle photos, enquiries, every booking option/u);
  assert.match(plus, /invoice copies, dyno files, supporting documents, downloads/u);
  assert.match(vault, /Performance\+ files locked/u);
  assert.match(terms, /Xero invoices continue to be delivered by email/u);
});
