import type { NotificationEventRow } from '@/lib/database.types';
import type { StaffPortalSnapshot } from '@/lib/staff-portal';

/**
 * Public, fictional design data. Never replace these values with a production
 * export. Non-UUID IDs, reserved email domains and masked phone numbers keep
 * this preview distinct from customer records and contact destinations.
 */
const sampleTime = '2026-09-10T00:30:00.000Z';
const sampleOwner = 'preview-workshop-owner';

function customer(key: string, firstName: string, lastName: string, phoneSuffix: string): StaffPortalSnapshot['customers'][number] {
  return {
    user_id: `preview-customer-${key}`,
    first_name: firstName,
    last_name: lastName,
    email: `${key}@example.invalid`,
    mobile: `04•• ••• ${phoneSuffix}`,
    account_state: 'active',
    profile_photo_mime_type: null,
    profile_photo_object_path: null,
    profile_photo_updated_at: null,
    created_at: '2026-08-18T00:00:00.000Z',
    updated_at: sampleTime,
  };
}

const customers = [
  customer('alex.morgan', 'Alex', 'Morgan', '101'),
  customer('casey.taylor', 'Casey', 'Taylor', '202'),
  customer('jordan.ellis', 'Jordan', 'Ellis', '303'),
  customer('sam.parker', 'Sam', 'Parker', '404'),
];

function vehicle(index: number, year: number, make: string, model: string, registration: string, odometer: number): StaffPortalSnapshot['vehicles'][number] {
  const owner = customers[index];
  return {
    id: `preview-vehicle-${index + 1}`,
    customer_id: owner.user_id,
    created_by: owner.user_id,
    make,
    model,
    year,
    registration,
    odometer_km: odometer,
    nickname: null,
    vin_last_four: null,
    is_primary: true,
    archived_at: null,
    created_at: '2026-08-18T00:00:00.000Z',
    updated_at: sampleTime,
  };
}

const vehicles = [
  vehicle(0, 2017, 'Holden', 'Commodore SS', 'DEMO01', 84200),
  vehicle(1, 2021, 'Volkswagen', 'Golf R', 'DEMO02', 38600),
  vehicle(2, 2017, 'Ford', 'Mustang GT', 'DEMO03', 61700),
  vehicle(3, 2020, 'Toyota', 'GR Supra', 'DEMO04', 29400),
];

function booking(index: number, overrides: Partial<StaffPortalSnapshot['bookings'][number]> = {}): StaffPortalSnapshot['bookings'][number] {
  const owner = customers[index];
  return {
    id: `preview-booking-${index + 1}`,
    customer_id: owner.user_id,
    vehicle_id: vehicles[index].id,
    created_by: owner.user_id,
    client_request_id: `preview-request-${index + 1}`,
    booking_type: 'service',
    state: 'pending_staff_review',
    preferred_date: '2026-09-14',
    approved_date: null,
    currency: 'AUD',
    deposit_amount_cents: null,
    request_notes: 'Please arrange a service and check the front brakes. There is a light vibration under braking.',
    request_context: {
      schemaVersion: 1,
      bookingPolicyVersion: 'psi-booking-v1',
      appointmentPreferenceMode: 'specific',
      arrivalArrangement: 'business_hours',
      afterHoursCollection: true,
      notifyEarlierAvailability: true,
      serviceReminderConsent: true,
    },
    staff_note: null,
    reviewed_at: null,
    reviewed_by: null,
    archived_at: null,
    created_at: sampleTime,
    updated_at: sampleTime,
    ...overrides,
  };
}

const bookings = [
  booking(0),
  booking(1, {
    booking_type: 'dyno',
    preferred_date: null,
    request_notes: 'I would like a baseline dyno run and advice on a reliable daily-driver tune. The car currently has an intake and cat-back exhaust.',
    request_context: {
      schemaVersion: 1,
      bookingPolicyVersion: 'psi-booking-v1',
      appointmentPreferenceMode: 'flexible',
      arrivalArrangement: 'flexible',
      afterHoursCollection: false,
      notifyEarlierAvailability: true,
      serviceReminderConsent: false,
      setupConfidence: 'known',
      tuningDetails: {
        engineState: 'stock',
        transmissionType: 'automatic',
        transmissionSetup: 'stock',
        fuelType: '98_ron',
        intakeType: 'upgraded',
        intakeDetails: 'Aftermarket intake',
        exhaustType: 'cat_back',
        previouslyTuned: 'no',
      },
    },
  }),
  booking(2, {
    state: 'confirmed',
    preferred_date: '2026-09-11',
    approved_date: '2026-09-11',
    deposit_amount_cents: 10000,
    request_notes: 'Scheduled service and a general inspection before a weekend trip.',
    staff_note: 'Booked for the morning. Contact the customer after the inspection.',
    reviewed_at: '2026-09-09T02:15:00.000Z',
    reviewed_by: sampleOwner,
  }),
  booking(3, {
    state: 'date_approved',
    preferred_date: '2026-09-15',
    approved_date: '2026-09-15',
    deposit_amount_cents: 10000,
    request_notes: 'Please inspect the suspension and discuss an alignment for road and occasional track use.',
    staff_note: 'Workshop date approved. Awaiting booking confirmation.',
    reviewed_at: '2026-09-09T03:00:00.000Z',
    reviewed_by: sampleOwner,
  }),
  booking(0, {
    id: 'preview-booking-completed',
    client_request_id: 'preview-request-completed',
    state: 'completed',
    preferred_date: '2026-08-21',
    approved_date: '2026-08-21',
    request_notes: 'Routine service and roadworthiness inspection.',
    staff_note: 'Service completed. Records and invoice published to the vehicle.',
    reviewed_at: '2026-08-20T01:00:00.000Z',
    reviewed_by: sampleOwner,
    created_at: '2026-08-18T00:00:00.000Z',
    updated_at: '2026-08-21T05:00:00.000Z',
  }),
];

const deletionCustomer = {
  ...customer('riley.preview', 'Riley', 'Bennett', '505'),
  account_state: 'deletion_requested',
};

export const STAFF_PORTAL_PREVIEW_SNAPSHOT: StaffPortalSnapshot = {
  customers,
  vehicles,
  bookings,
  vehicleFiles: [],
  deletionCustomers: [...customers, deletionCustomer],
  accountDeletionRequests: [{
    user_id: deletionCustomer.user_id,
    status: 'requested',
    requested_at: '2026-09-09T23:00:00.000Z',
    updated_at: sampleTime,
    completed_at: null,
    staff_note: null,
  }],
  invitations: customers.map((profile, index) => ({
    id: `preview-invitation-${index + 1}`,
    auth_user_id: profile.user_id,
    email: profile.email,
    status: 'profile_complete',
    invited_at: '2026-08-17T00:00:00.000Z',
    accepted_at: profile.created_at,
    invited_by: sampleOwner,
    updated_at: profile.updated_at,
  })),
  integrationJobs: [
    { kind: 'notify_psi_request_received', bookingIndex: 0 },
    { kind: 'notify_customer_request_received', bookingIndex: 0 },
    { kind: 'notify_customer_booking_confirmed', bookingIndex: 2 },
    { kind: 'sync_google_calendar_confirmed', bookingIndex: 2 },
  ].map((item, index) => ({
    id: `preview-delivery-${index + 1}`,
    booking_request_id: bookings[item.bookingIndex].id,
    customer_id: bookings[item.bookingIndex].customer_id,
    job_kind: item.kind as StaffPortalSnapshot['integrationJobs'][number]['job_kind'],
    status: 'succeeded',
    attempt_count: 1,
    dedupe_key: `preview-delivery-key-${index + 1}`,
    available_at: sampleTime,
    created_at: sampleTime,
    last_attempt_at: sampleTime,
    completed_at: sampleTime,
    updated_at: sampleTime,
    last_error_code: null,
    provider_reference: null,
    service_completion_id: null,
    service_due_on: null,
    service_interval_months: null,
  })),
  auditEvents: [
    { table: 'booking_requests', action: 'insert', actor: 'customer' },
    { table: 'booking_requests', action: 'update', actor: 'staff' },
    { table: 'vehicle_files', action: 'insert', actor: 'staff' },
    { table: 'customer_profiles', action: 'update', actor: 'customer' },
    { table: 'booking_requests', action: 'insert', actor: 'customer' },
    { table: 'vehicle_files', action: 'update', actor: 'staff' },
    { table: 'customer_vehicles', action: 'insert', actor: 'customer' },
    { table: 'customer_profiles', action: 'insert', actor: 'system' },
    { table: 'vehicle_files', action: 'insert', actor: 'staff' },
    { table: 'booking_requests', action: 'update', actor: 'staff' },
  ].map((item, index) => ({
    id: index + 1,
    record_id: `preview-activity-record-${index + 1}`,
    customer_id: customers[index % customers.length].user_id,
    actor_user_id: item.actor === 'system' ? null : item.actor === 'staff' ? sampleOwner : customers[index % customers.length].user_id,
    action: item.action as StaffPortalSnapshot['auditEvents'][number]['action'],
    actor_kind: item.actor as StaffPortalSnapshot['auditEvents'][number]['actor_kind'],
    table_name: item.table,
    occurred_at: index < 9 ? `2026-09-10T00:${String(29 - index * 3).padStart(2, '0')}:00.000Z` : '2026-08-21T05:00:00.000Z',
  })),
};

export const STAFF_PORTAL_PREVIEW_NOTIFICATIONS: NotificationEventRow[] = [
  {
    id: 'preview-alert-workshop-1',
    recipient_user_id: sampleOwner,
    booking_request_id: bookings[0].id,
    psi_event_id: null,
    deep_link: '/staff',
    kind: 'new_booking_request',
    title: 'New service enquiry',
    body: 'Alex Morgan · Holden Commodore SS · DEMO01. Service and front-brake inspection requested.',
    created_at: sampleTime,
    read_at: null,
    source_event_key: 'preview-alert-key-workshop-1',
  },
  {
    id: 'preview-alert-workshop-2',
    recipient_user_id: sampleOwner,
    booking_request_id: bookings[1].id,
    psi_event_id: null,
    deep_link: '/staff',
    kind: 'new_booking_request',
    title: 'New dyno enquiry',
    body: 'Casey Taylor · Volkswagen Golf R · DEMO02. Baseline dyno run and tuning advice requested.',
    created_at: '2026-09-10T00:15:00.000Z',
    read_at: null,
    source_event_key: 'preview-alert-key-workshop-2',
  },
  {
    id: 'preview-alert-customer-1',
    recipient_user_id: sampleOwner,
    booking_request_id: null,
    psi_event_id: 'preview-event-1',
    deep_link: '/events',
    kind: 'psi_event_published',
    title: 'PSI open workshop morning',
    body: 'A sample customer announcement. Open workshop morning, Saturday 19 September.',
    created_at: '2026-09-09T23:00:00.000Z',
    read_at: null,
    source_event_key: 'preview-alert-key-customer-1',
  },
];
