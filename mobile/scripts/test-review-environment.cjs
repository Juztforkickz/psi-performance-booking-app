const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { resolveReviewEnvironment, REVIEW_URL, REVIEW_PUBLIC_KEY, REVIEW_CHANNEL, REVIEW_RUNTIME } = require('../review-environment.cjs');

const valid = {
  flag: 'true', url: REVIEW_URL, key: REVIEW_PUBLIC_KEY, auth: 'true', booking: 'true',
  registration: 'false', channel: REVIEW_CHANNEL,
};

test('live and disabled public-demo configurations are unchanged', () => {
  assert.equal(resolveReviewEnvironment({}).enabled, false);
  assert.equal(resolveReviewEnvironment({ flag: 'false', url: 'https://lslhfrujyuqcavsnugfx.supabase.co', key: 'live-public-key', auth: 'true' }).enabled, false);
  const base = JSON.parse(readFileSync(require.resolve('../app.json'), 'utf8')).expo;
  assert.deepEqual(require('../app.config.js')({ config: base }), base);
});

test('review only accepts the pinned isolated project with closed registration', () => {
  assert.equal(resolveReviewEnvironment(valid).enabled, true);
  for (const override of [
    { url: 'https://lslhfrujyuqcavsnugfx.supabase.co' }, { key: 'live-public-key' },
    { url: `${REVIEW_URL}/unexpected` }, { url: `${REVIEW_URL}.attacker.invalid` },
    { url: `http://${REVIEW_URL.slice(8)}` }, { registration: 'true' }, { registration: undefined },
    { auth: 'false' }, { booking: 'false' }, { channel: 'production' }, { channel: 'qa' },
  ]) assert.throws(() => resolveReviewEnvironment({ ...valid, ...override }));
});

test('sandbox cannot be mistaken for the live app when the flag is absent or malformed', () => {
  for (const flag of [undefined, 'false', 'TRUE', '1']) {
    assert.throws(() => resolveReviewEnvironment({ ...valid, flag }));
  }
});

test('review runtime is distinct from the live app-version runtime', () => {
  const base = JSON.parse(readFileSync(require.resolve('../app.json'), 'utf8')).expo;
  assert.notEqual(REVIEW_RUNTIME, base.version);
  assert.equal(base.runtimeVersion.policy, 'appVersion');
});

test('native review config keeps the existing app identity but isolates its runtime and build profile', () => {
  const { spawnSync } = require('node:child_process');
  const eas = JSON.parse(readFileSync(require.resolve('../eas.json'), 'utf8'));
  const script = "const base=require('./app.json').expo; console.log(JSON.stringify(require('./app.config.js')({config:base})))";
  const run = (profile) => spawnSync(process.execPath, ['-e', script], {
    cwd: require('node:path').resolve(__dirname, '..'), encoding: 'utf8',
    env: { ...process.env, ...eas.build['apple-review'].env, EAS_BUILD_PROFILE: profile },
  });
  const result = run('apple-review');
  assert.equal(result.status, 0, result.stderr);
  const config = JSON.parse(result.stdout);
  assert.equal(config.name, 'PSI Review');
  assert.equal(config.runtimeVersion, REVIEW_RUNTIME);
  assert.equal(config.ios.bundleIdentifier, 'com.psiperformance.booking');
  assert.equal(config.extra.eas.projectId, 'e62e9cdf-867c-4eb7-b8c5-a2610f969286');
  for (const profile of ['production', 'qa', 'preview']) {
    const rejected = run(profile);
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /REVIEW_REQUIRES_ITS_OWN_BUILD_PROFILE/);
  }
});

test('review mode cannot register, unregister or dispatch live device pushes', () => {
  const notifications = readFileSync(require.resolve('../src/lib/notifications.tsx'), 'utf8');
  assert.match(notifications, /if \(REVIEW_ENVIRONMENT.enabled\) throw new Error\('REVIEW_EXTERNAL_PUSH_DISABLED'\)/);
  for (const name of ['dispatchBookingPushNotifications', 'dispatchPsiEventPushNotifications', 'unregisterCurrentPushDevice']) {
    assert.match(notifications, new RegExp(`function ${name}\\([^)]*\\) \\{\\s+if \\(REVIEW_ENVIRONMENT.enabled\\) return;`));
  }
  assert.match(notifications, /const PUSH_TOKEN_STORAGE_KEY = environmentStorageKey/);
});

test('review build profile is pinned and existing production/QA profiles stay separate', () => {
  const eas = JSON.parse(readFileSync(require.resolve('../eas.json'), 'utf8'));
  const profile = eas.build['apple-review'];
  const env = profile.env;
  assert.equal(profile.channel, REVIEW_CHANNEL);
  assert.equal(profile.environment, 'preview');
  assert.equal(resolveReviewEnvironment({ flag: env.EXPO_PUBLIC_PSI_APPLE_REVIEW, url: env.EXPO_PUBLIC_SUPABASE_URL, key: env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, auth: env.EXPO_PUBLIC_SUPABASE_AUTH_ENABLED, booking: env.EXPO_PUBLIC_SUPABASE_BOOKING_ENABLED, registration: env.EXPO_PUBLIC_SUPABASE_REGISTRATION_ENABLED, channel: env.EXPO_PUBLIC_PSI_UPDATE_CHANNEL }).enabled, true);
  assert.equal(eas.build.production.channel, 'production');
  assert.equal(eas.build.qa.channel, 'qa');
  assert.equal(eas.build.qa.env.EXPO_PUBLIC_SUPABASE_URL, 'https://lslhfrujyuqcavsnugfx.supabase.co');
  assert.equal(eas.build.production.env?.EXPO_PUBLIC_PSI_APPLE_REVIEW, undefined);
});

test('review database and Edge code stay outside the live deployment directories', () => {
  const { readdirSync } = require('node:fs');
  const { join } = require('node:path');
  const root = require('node:path').resolve(__dirname, '../..');
  for (const file of readdirSync(join(root, 'supabase/migrations'))) {
    if (!file.endsWith('.sql')) continue;
    assert.doesNotMatch(readFileSync(join(root, 'supabase/migrations', file), 'utf8'), /jwikoldibbpxyhbdrsow|apple_review_staff_access/);
  }
  for (const name of ['invite-customer', 'complete-account-deletion']) {
    const live = readFileSync(join(root, 'supabase/functions', name, 'index.ts'), 'utf8');
    assert.match(live, /matt@psiperformance\.com\.au/);
    assert.match(live, /claimsData\?\.claims\?\.aal !== "aal2"/);
    assert.doesNotMatch(live, /jwikoldibbpxyhbdrsow/);
    const review = readFileSync(join(root, 'operations/apple-review/supabase/functions', name, 'index.ts'), 'utf8');
    assert.match(review, /supabaseUrl !== "https:\/\/jwikoldibbpxyhbdrsow\.supabase\.co"/);
    assert.match(review, /userClient\.auth\.getUser\(token\)/);
    assert.match(review, /rpc\("apple_review_staff_access"\)/);
  }
});
