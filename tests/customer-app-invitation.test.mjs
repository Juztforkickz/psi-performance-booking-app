import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [edgeFunction, migration, portal, importReview] = await Promise.all([
  readFile(new URL('../supabase/functions/invite-customer/index.ts', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/migrations/20261006090353_customer_app_invitation_delivery.sql', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/src/app/staff.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/src/components/staff-vault-publisher.tsx', import.meta.url), 'utf8'),
]);

test('customer invitation sends both store links and records verified email delivery', () => {
  assert.match(edgeFunction, /https:\/\/apps\.apple\.com\/au\/app\/psi-performance-garage\/id6806902732/u);
  assert.match(edgeFunction, /https:\/\/play\.google\.com\/store\/apps\/details\?id=com\.psiperformance\.booking/u);
  assert.match(edgeFunction, /https:\/\/api\.resend\.com\/emails/u);
  assert.match(edgeFunction, /email_delivery_status: "sent"/u);
  assert.match(edgeFunction, /nextStep: "await_customer_setup"/u);
});

test('owner selected workshop customer stays linked until account completion claims history', () => {
  assert.match(migration, /add column if not exists workshop_contact_id uuid/u);
  assert.match(migration, /claim_invited_workshop_history/u);
  assert.match(migration, /after insert or update of status, workshop_contact_id/u);
  assert.match(migration, /after insert or update of first_name, last_name, mobile, account_state/u);
  assert.match(migration, /status = 'matched'/u);
  assert.match(migration, /insert into private\.xero_customer_links/u);
});

test('portal exposes workshop customer selection and separates awaiting from completed accounts', () => {
  assert.match(portal, /Select a workshop customer/u);
  assert.match(portal, /Send app invitation/u);
  assert.match(portal, /Awaiting setup/u);
  assert.match(portal, /Completed app accounts/u);
  assert.doesNotMatch(portal, /Open TestFlight setup|Add the same email to TestFlight next/u);
});

test('an imported alert target cannot be forced back into the review queue', () => {
  assert.match(importReview, /\.eq\('id', focusImportId\)\.in\('status', REVIEWABLE_IMPORT_STATUSES\)\.maybeSingle\(\)/u);
  assert.doesNotMatch(importReview, /REVIEWABLE_IMPORT_STATUSES[^\n]+imported/u);
});
