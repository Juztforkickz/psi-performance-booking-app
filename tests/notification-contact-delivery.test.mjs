import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('booking enquiries carry contact and context into staff email', async () => {
  const worker = await read('../supabase/functions/process-booking-integrations/index.ts');
  assert.match(worker, /`Email: \$\{context\.customer\.email\}`/u);
  assert.match(worker, /`Mobile: \$\{context\.customer\.mobile \|\| "Not supplied"\}`/u);
  assert.match(worker, /`Enquiry: \$\{enquiry\}`/u);
  assert.match(worker, /requestContextLines\(context\.booking\.request_context\)/u);
  assert.match(worker, /reply_to: job\.job_kind\.startsWith\("notify_psi_"\) \? context\.customer\.email : ownerEmail/u);
});

test('push delivery distinguishes roles without exposing workshop enquiry details', async () => {
  const [worker, provider] = await Promise.all([
    read('../supabase/functions/process-push-notifications/index.ts'),
    read('../mobile/src/lib/notifications.tsx'),
  ]);
  assert.match(worker, /channelId: workshopAlert \? "psi-workshop" : "psi-customer"/u);
  assert.match(worker, /title: "PSI update received"/u);
  assert.match(worker, /body: workshopAlert \? "Open the protected workshop portal to review it\." : "Open PSI to view your private update\."/u);
  assert.doesNotMatch(worker, /bookingId: event\.booking_request_id/u);
  assert.doesNotMatch(worker, /eventId: event\.id/u);
  assert.match(worker, /sound: preference\?\.sound_enabled === false \? null : "default"/u);
  assert.match(provider, /setNotificationChannelAsync\('psi-workshop'/u);
  assert.match(provider, /setNotificationChannelAsync\('psi-customer'/u);
  assert.match(provider, /pathname: '\/staff', params: \{ bookingId, section: 'bookings' \}/u);
});

test('staff portal exposes split badges, alert setup and customer contact actions', async () => {
  const [portal, navigation] = await Promise.all([
    read('../mobile/src/app/staff.tsx'),
    read('../mobile/src/components/persistent-bottom-navigation.tsx'),
  ]);
  assert.match(portal, /PortalAlertSummary/u);
  assert.match(portal, /Enable device alerts/u);
  assert.match(portal, /openCustomerEmail/u);
  assert.match(portal, /Customer enquiry/u);
  assert.match(navigation, /staffNotificationBadge/u);
  assert.match(navigation, /customerNotificationBadge/u);
});

test('new booking notification migration includes customer, vehicle and enquiry summary', async () => {
  const migration = await read('../supabase/migrations/20260909215419_enrich_booking_notifications.sql');
  assert.match(migration, /customer_display/u);
  assert.match(migration, /vehicle_display/u);
  assert.match(migration, /request_summary/u);
  assert.match(migration, /staff_request_received:/u);
  assert.match(migration, /security definer[\s\S]*set search_path = ''/u);
});
