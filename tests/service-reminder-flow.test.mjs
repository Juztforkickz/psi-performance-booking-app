import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('completed consented services schedule six and twelve month reminders one month before due', async () => {
  const migration = await read('../supabase/migrations/20260911090000_service_due_reminders.sql');
  assert.match(migration, /request_context -> 'serviceReminderConsent' = 'true'::jsonb/u);
  assert.match(migration, /foreach interval_months in array array\[6, 12\]/u);
  assert.match(migration, /due_on := \(completed_on \+ make_interval\(months => interval_months\)\)::date/u);
  assert.match(migration, /remind_on := \(due_on - interval '1 month'\)::date/u);
  assert.match(migration, /'Australia\/Melbourne'/u);
  assert.match(migration, /booking_integration_jobs_service_reminder_unique_idx/u);
});

test('due reminder worker sends email and creates one private app and push event', async () => {
  const [integration, push] = await Promise.all([
    read('../supabase/functions/process-booking-integrations/index.ts'),
    read('../supabase/functions/process-push-notifications/index.ts'),
  ]);
  assert.match(integration, /notify_customer_service_due/u);
  assert.match(integration, /Would you like to arrange a booking with PSI\?/u);
  assert.match(integration, /Email: info@psiperformance\.com\.au/u);
  assert.match(integration, /Phone: 0433 431 781/u);
  assert.match(integration, /context\.remindersEnabled/u);
  assert.match(integration, /turn off Service & visit reminders in PSI Settings/u);
  assert.match(integration, /\[PSI QA TEST\]/u);
  assert.match(integration, /QA TEST ·/u);
  assert.match(integration, /kind: "service_reminder"/u);
  assert.match(integration, /deep_link: "\/booking"/u);
  assert.match(integration, /body\.action === "process_due_service_reminders"/u);
  assert.match(integration, /jobsQuery = jobsQuery\.eq\("job_kind", "notify_customer_service_due"\)/u);
  assert.match(integration, /isProjectServiceRoleToken\(accessToken, supabaseUrl\)/u);
  assert.match(push, /isInternalServiceCall/u);
  assert.match(push, /isProjectServiceRoleToken\(token, supabaseUrl\)/u);
  assert.match(push, /booking_reminders_enabled/u);
});

test('daily scheduler keeps the protected project settings in Vault', async () => {
  const [schedule, gateway] = await Promise.all([
    read('../supabase/migrations/20260911150000_secure_service_reminder_cron.sql'),
    read('../supabase/migrations/20260911151500_service_reminder_gateway_auth.sql'),
  ]);
  assert.match(schedule, /psi_service_reminder_project_url/u);
  assert.match(schedule, /psi_service_reminder_cron_token/u);
  assert.match(schedule, /verify_service_reminder_cron_token/u);
  assert.match(schedule, /x-psi-cron-token/u);
  assert.match(schedule, /'5 0 \* \* \*'/u);
  assert.match(schedule, /"action":"process_due_service_reminders"/u);
  assert.doesNotMatch(schedule, /eyJ[A-Za-z0-9_-]+\./u);
  assert.doesNotMatch(schedule, /psi_service_reminder_service_role/u);
  assert.match(gateway, /psi_service_reminder_anon_jwt/u);
  assert.match(gateway, /'Authorization', 'Bearer ' \|\| anon_jwt/u);
  assert.match(gateway, /'x-psi-cron-token', cron_token/u);
});

test('customer screens state the Free and Performance+ boundary and reminder authority', async () => {
  const [plus, vault, booking, notifications, alerts] = await Promise.all([
    read('../mobile/src/app/performance-plus.tsx'),
    read('../mobile/src/app/vehicle-vault.tsx'),
    read('../mobile/src/app/booking.tsx'),
    read('../mobile/src/lib/notifications.tsx'),
    read('../mobile/src/app/(tabs)/alerts.tsx'),
  ]);
  assert.match(plus, /PSI FREE/u);
  assert.match(plus, /PERFORMANCE\+/u);
  assert.match(plus, /premium PSI records · locked/u);
  assert.match(vault, /Performance\+ archive locked/u);
  assert.match(booking, /Calculated from the actual completed-service date/u);
  assert.match(booking, /contact you one month before each/u);
  assert.match(notifications, /url === '\/booking'/u);
  assert.match(alerts, /Service & visit reminders/u);
  assert.match(alerts, /Turn this off to stop future reminders/u);
});
