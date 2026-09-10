import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('confirmed app bookings create one exact workshop job and PC manifest workflow', async () => {
  const [migration, bookingTools, uploader, guide] = await Promise.all([
    read('../supabase/migrations/20260911143000_booking_job_xero_completion.sql'),
    read('../mobile/src/components/staff-workshop-job.tsx'),
    read('../operations/workshop-pc/psi_uploads.py'),
    read('../operations/workshop-pc/README.md'),
  ]);
  assert.match(migration, /after insert or update of state on public\.booking_requests/u);
  assert.match(migration, /new\.state not in \('confirmed', 'completed'\)/u);
  assert.match(migration, /'PSI-' \|\| upper\(replace\(new\.id::text, '-', ''\)\)/u);
  assert.match(migration, /on conflict \(booking_request_id\) do nothing/u);
  assert.match(bookingTools, /Use this exact reference in Xero/u);
  assert.match(bookingTools, /Download PC folder file/u);
  assert.match(uploader, /def create_job_folder/u);
  for (const folder of ['before', 'progress', 'after', 'dyno', 'invoices', 'documents']) {
    assert.match(uploader, new RegExp(`'${folder}'`, 'u'));
  }
  assert.match(guide, /Save a Mainline result as PDF into the job's `dyno` folder/u);
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
