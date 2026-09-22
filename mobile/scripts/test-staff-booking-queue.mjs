import assert from 'node:assert/strict';
import test from 'node:test';

import { bookingQueueView, organizeStaffBookings } from '../src/lib/staff-booking-queue.ts';

const now = Date.parse('2026-09-22T10:00:00.000Z');
const daysAgo = days => new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
const booking = (id, state, updatedAt = daysAgo(1)) => ({
  id,
  state,
  created_at: daysAgo(4),
  updated_at: updatedAt,
  reviewed_at: state === 'pending_staff_review' ? null : daysAgo(2),
  approved_date: '2026-09-25',
});

test('each booking belongs to exactly one portal queue', () => {
  const rows = [
    booking('new', 'pending_staff_review'),
    booking('proposed', 'date_proposed'),
    booking('deposit', 'date_approved'),
    booking('confirmed', 'confirmed'),
    booking('completed', 'completed'),
    booking('cancelled', 'cancelled'),
  ];
  const queues = organizeStaffBookings(rows, [], now);
  assert.deepEqual(queues.needs.map(row => row.id), ['new']);
  assert.deepEqual(queues.actioned.map(row => row.id).sort(), ['deposit', 'proposed']);
  assert.deepEqual(queues.booked.map(row => row.id), ['confirmed']);
  assert.deepEqual(queues.archive.map(row => row.id).sort(), ['cancelled', 'completed']);
  assert.equal(Object.values(queues).flat().length, rows.length);
});

test('30-day removal changes only portal visibility, and existing held tests stay in archive', () => {
  const oldCompleted = booking('old-completed', 'completed', daysAgo(31));
  const recentCompleted = booking('recent-completed', 'completed', daysAgo(29));
  const heldTest = booking('held-test', 'pending_staff_review', daysAgo(10));
  const holding = [{ booking_request_id: heldTest.id, queued_at: daysAgo(3), source: 'owner_removed' }];
  const queues = organizeStaffBookings([oldCompleted, recentCompleted, heldTest], holding, now);
  assert.deepEqual(queues.archive.map(row => row.id), ['held-test', 'recent-completed']);
  assert.equal(Object.values(queues).flat().some(row => row.id === oldCompleted.id), false);
  assert.equal(bookingQueueView(heldTest, holding[0], now), 'archive');
  assert.equal(bookingQueueView(heldTest, { ...holding[0], queued_at: daysAgo(30) }, now), null);
});
