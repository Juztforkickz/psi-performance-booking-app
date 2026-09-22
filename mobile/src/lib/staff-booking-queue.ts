import type { StaffPortalSnapshot } from '@/lib/staff-portal';

type Booking = StaffPortalSnapshot['bookings'][number];
type Holding = StaffPortalSnapshot['bookingHolding'][number];

export type StaffBookingView = 'needs' | 'actioned' | 'booked' | 'archive';

export const STAFF_BOOKING_VIEWS: readonly StaffBookingView[] = ['needs', 'actioned', 'booked', 'archive'];

const ARCHIVE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export function bookingViewFromParam(value: string): StaffBookingView {
  if (value === 'actioned' || value === 'booked' || value === 'archive' || value === 'needs') return value;
  // Older portal links and staff alerts still use these view names.
  if (value === 'holding' || value === 'history') return 'archive';
  return 'needs';
}

export function bookingArchiveStartedAt(booking: Booking, holding?: Holding): string | null {
  if (holding) return holding.queued_at;
  return booking.state === 'cancelled' || booking.state === 'completed' ? booking.updated_at : null;
}

export function bookingQueueView(booking: Booking, holding: Holding | undefined, nowMs: number): StaffBookingView | null {
  const archiveStartedAt = bookingArchiveStartedAt(booking, holding);
  if (archiveStartedAt) {
    const startedMs = Date.parse(archiveStartedAt);
    return Number.isFinite(startedMs) && nowMs - startedMs < ARCHIVE_WINDOW_MS ? 'archive' : null;
  }
  if (booking.state === 'pending_staff_review') return 'needs';
  if (booking.state === 'date_proposed' || booking.state === 'date_approved') return 'actioned';
  if (booking.state === 'confirmed') return 'booked';
  return null;
}

export function organizeStaffBookings(bookings: Booking[], holding: Holding[], nowMs: number): Record<StaffBookingView, Booking[]> {
  const holdingById = new Map(holding.map(entry => [entry.booking_request_id, entry]));
  const queues: Record<StaffBookingView, Booking[]> = { needs: [], actioned: [], booked: [], archive: [] };
  for (const booking of bookings) {
    const view = bookingQueueView(booking, holdingById.get(booking.id), nowMs);
    if (view) queues[view].push(booking);
  }
  queues.needs.sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at));
  queues.actioned.sort((left, right) => Date.parse(right.reviewed_at ?? right.updated_at) - Date.parse(left.reviewed_at ?? left.updated_at));
  queues.booked.sort((left, right) => (left.approved_date ?? '').localeCompare(right.approved_date ?? ''));
  queues.archive.sort((left, right) => Date.parse(bookingArchiveStartedAt(right, holdingById.get(right.id)) ?? '') - Date.parse(bookingArchiveStartedAt(left, holdingById.get(left.id)) ?? ''));
  return queues;
}

export function bookingNextStep(booking: Booking, isHeld: boolean): string {
  if (isHeld) return 'Removed from active portal lists. Records remain protected.';
  switch (booking.state) {
    case 'pending_staff_review': return 'Review this request and approve or propose a date.';
    case 'date_proposed': return 'Follow up on the proposed date.';
    case 'date_approved': return 'Await deposit. Verify a bank transfer when it clears.';
    case 'confirmed': return 'Prepare for the workshop visit; complete it when finished.';
    case 'completed': return 'Visit completed. Workshop and vehicle records remain available.';
    case 'cancelled': return 'Request cancelled. No workshop action is due.';
  }
}
