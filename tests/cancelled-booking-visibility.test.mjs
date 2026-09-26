import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('cancelled and archived bookings stay out of staff and customer views', async () => {
  const [customerAccount, staffPortal, staffQueues, customerBookings] = await Promise.all([
    read('../mobile/src/lib/customer-account.ts'),
    read('../mobile/src/lib/staff-portal.ts'),
    read('../mobile/src/lib/staff-booking-queue.ts'),
    read('../mobile/src/app/(tabs)/bookings.tsx'),
  ]);

  assert.match(customerAccount, /\.is\('archived_at', null\)[\s\S]*?\.neq\('state', 'cancelled'\)/u);
  assert.match(staffPortal, /from\('booking_requests'\)[\s\S]*?\.is\('archived_at', null\)\.neq\('state', 'cancelled'\)/u);
  assert.match(staffQueues, /if \(booking\.state === 'cancelled'\) return null/u);
  assert.match(customerBookings, /\.filter\(\(booking\) => booking\.state !== 'cancelled'\)/u);
  assert.match(customerBookings, /const past = displayBookings\.filter\(\(booking\) => booking\.state === 'completed'\)/u);
});
