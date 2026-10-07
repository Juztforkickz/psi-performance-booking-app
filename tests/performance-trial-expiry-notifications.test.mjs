import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('trial expiry jobs preserve real account and trial dates and exclude protected accounts', async () => {
  const migration = await read('../supabase/migrations/20261007133000_performance_trial_expiry_notifications.sql');
  assert.match(migration, /profile\.created_at,[\s\S]*subscription\.expires_at,[\s\S]*subscription\.expires_at/u);
  assert.match(migration, /provider_reference = 'trial:' \|\| subscription\.customer_id::text/u);
  assert.match(migration, /lower\(btrim\(profile\.email\)\) <> 'matt@psiperformance\.com\.au'/u);
  assert.match(migration, /not exists \([\s\S]*public\.staff_members/u);
  assert.match(migration, /performance_plus_already_active/u);
  assert.match(migration, /'\*\/15 \* \* \* \*'/u);
});

test('trial expiry delivery is one time and opens the Performance+ purchase screen', async () => {
  const [migration, worker, navigation] = await Promise.all([
    read('../supabase/migrations/20261007133000_performance_trial_expiry_notifications.sql'),
    read('../supabase/functions/process-performance-trial-notifications/index.ts'),
    read('../mobile/src/lib/notification-navigation.ts'),
  ]);
  assert.match(migration, /customer_id uuid not null unique/u);
  assert.match(migration, /'performance_trial_ended'/u);
  assert.match(migration, /'\/performance-plus'/u);
  assert.match(worker, /performance_trial_ended:\$\{job\.customer_id\}/u);
  assert.match(worker, /Idempotency-Key": `psi-performance-trial-ended-v1-\$\{job\.id\}`/u);
  assert.match(worker, /otherAccess/u);
  assert.match(worker, /email === OWNER_EMAIL/u);
  assert.match(navigation, /deep_link === '\/performance-plus'/u);
  assert.match(navigation, /href: '\/performance-plus'/u);
});

test('customer email contains the approved hook, AUD pricing and verified Tori banner', async () => {
  const [worker, bannerModule, bannerPartA, bannerPartB] = await Promise.all([
    read('../supabase/functions/process-performance-trial-notifications/index.ts'),
    read('../supabase/functions/process-performance-trial-notifications/tori-signature-banner.ts'),
    read('../supabase/functions/process-performance-trial-notifications/tori-signature-banner-a.ts'),
    read('../supabase/functions/process-performance-trial-notifications/tori-signature-banner-b.ts'),
  ]);
  const encodedA = bannerPartA.match(/TORI_SIGNATURE_BANNER_BASE64_A = "([A-Za-z0-9+/=]+)";/u)?.[1];
  const encodedB = bannerPartB.match(/TORI_SIGNATURE_BANNER_BASE64_B = "([A-Za-z0-9+/=]+)";/u)?.[1];
  const encoded = encodedA && encodedB ? encodedA + encodedB : null;
  assert.ok(encoded, 'approved signature banner must be embedded');
  const digest = createHash('sha256').update(Buffer.from(encoded, 'base64')).digest('hex');
  assert.equal(digest, 'c7a33dbd43daa2bdfc0eef4e629bcb8385938465d672d88921b15c046c3ac1b2');
  assert.match(bannerModule, /TORI_SIGNATURE_BANNER_BASE64_A \+ TORI_SIGNATURE_BANNER_BASE64_B/u);
  assert.match(worker, /Your PSI vehicle history is worth keeping close/u);
  assert.match(worker, /From \$9\.99 AUD per month or \$99 AUD per year/u);
  assert.match(worker, /Authorised assistant for Matthew Ebert/u);
  assert.match(worker, /src="cid:\$\{TORI_BANNER_CONTENT_ID\}"/u);
  assert.match(worker, /content_id: TORI_BANNER_CONTENT_ID/u);
  assert.match(worker, /if \(!apiKey \|\| !from \|\| !\(await bannerIsApproved\(\)\)\) throw new Error\("trial_email_configuration_missing"\)/u);
});

test('in app and device notifications use the approved trial expiry hook', async () => {
  const worker = await read('../supabase/functions/process-performance-trial-notifications/index.ts');
  assert.match(worker, /Your Performance\+ access has ended/u);
  assert.match(worker, /Keep your complete PSI vehicle history, documents, reminders and upcoming work organised in one place/u);
  assert.match(worker, /channelId: "psi-customer"/u);
  assert.match(worker, /sound: preference\?\.sound_enabled === false \? null : "default"/u);
  assert.match(worker, /admin\.from\("notification_events"\)/u);
});
