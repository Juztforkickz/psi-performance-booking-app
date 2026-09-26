import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('permanent account deletion clears payment dependencies before bookings', async () => {
  const migration = await readFile(new URL('../supabase/migrations/20260926233500_repair_customer_account_deletion_dependencies.sql', import.meta.url), 'utf8');
  const paymentEvents = migration.indexOf('delete from public.booking_payment_events');
  const paymentAttempts = migration.indexOf('delete from public.booking_payment_attempts');
  const bookings = migration.indexOf('delete from public.booking_requests');

  assert(paymentEvents >= 0, 'payment events must be removed');
  assert(paymentAttempts > paymentEvents, 'payment attempts must follow their events');
  assert(bookings > paymentAttempts, 'booking deletion must follow payment cleanup');
  assert.match(migration, /update public\.workshop_contacts[\s\S]*?claimed_customer_id = null/u);
  assert.match(migration, /update public\.workshop_vehicles[\s\S]*?claimed_vehicle_id = null/u);
  assert.match(migration, /grant execute on function public\.complete_customer_account_data\(uuid, uuid\) to service_role/u);
});
