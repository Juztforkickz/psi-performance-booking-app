import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [staff, portal, publisher, migration] = await Promise.all([
  readFile(new URL('../mobile/src/app/staff.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/src/lib/staff-portal.ts', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/src/components/staff-vault-publisher.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/migrations/20261007024500_complete_waiting_xero_invoice_workflow.sql', import.meta.url), 'utf8'),
]);

test('dashboard separates booking stages from invoice workflow counts', () => {
  assert.match(staff, />Booking requests</u);
  assert.match(staff, />Invoice records</u);
  assert.match(staff, /snapshot\.vaultImports\.filter\(item => \['failed', 'needs_review'\]/u);
  assert.match(staff, /label="Waiting account"[\s\S]*?importView: 'waiting'/u);
  assert.match(staff, /label="Imported"[\s\S]*?importView: 'imported'/u);
  assert.match(portal, /vaultClient\(\)\.from\('vault_import_queue'\)\.select\('\*'\)/u);
});

test('invoice workspace has distinct action, waiting and imported tabs', () => {
  assert.match(publisher, /type ImportTab = 'review' \| 'waiting' \| 'imported'/u);
  assert.match(publisher, />Needs action/u);
  assert.match(publisher, />Waiting for account/u);
  assert.match(publisher, />Imported/u);
  assert.match(publisher, /item\.status !== 'waiting_for_customer' && item\.status !== 'imported'/u);
});

test('manual waiting allocation is owner and MFA protected', () => {
  assert.match(migration, /queue_xero_import_for_customer_account_confirmed/u);
  assert.match(migration, /not private\.is_owner_staff\(\)[\s\S]*?auth\.jwt\(\)->>'aal'/u);
  assert.match(migration, /invoice_status_requires_review[\s\S]*?AUTHORISED', 'PAID'/u);
  assert.match(migration, /waitingConfirmedBy[\s\S]*?waitingConfirmedAt/u);
  assert.match(migration, /revoke all on function public\.queue_xero_import_for_customer_account_confirmed[\s\S]*?grant execute/u);
});

test('new waiting customers sync only after a strong account and vehicle match', () => {
  assert.match(migration, /create_xero_waiting_customer/u);
  assert.match(migration, /existing_workshop_vehicle_match_available/u);
  assert.match(migration, /match_waiting_xero_imports_for_customer/u);
  assert.match(migration, /lower\(btrim\(contact\.email\)\) = lower\(btrim\(customer\.email\)\)/u);
  assert.match(migration, /normalized_identity_mobile\(contact\.mobile\)[\s\S]*?normalized_identity_mobile\(customer\.mobile\)/u);
  assert.match(migration, /source_vehicle\.registration[\s\S]*?customer_vehicles/u);
  assert.match(migration, /set status = 'matched'[\s\S]*?Secure invoice syncing is queued/u);
  assert.match(migration, /zz_match_waiting_xero_after_customer_vehicle_save/u);
  assert.match(migration, /zz_match_waiting_xero_after_customer_profile_save/u);
});
