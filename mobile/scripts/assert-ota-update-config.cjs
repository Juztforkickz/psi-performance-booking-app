const assert = require('node:assert/strict');
const baseConfig = require('../app.json').expo;
const resolveAppConfig = require('../app.config.js');
const {
  APP_STORE_RELEASE_CHANNEL,
  APP_STORE_RELEASE_RUNTIME,
  BETA_CHANNEL,
  BETA_RUNTIME,
  LIVE_PUBLIC_KEY,
  LIVE_URL,
  ANDROID_PLAY_INTERNAL_CHANNEL,
  ANDROID_PLAY_INTERNAL_RUNTIME,
} = require('../demo-mode.cjs');

const target = process.argv[2];
assert.ok(
  target === BETA_CHANNEL || target === APP_STORE_RELEASE_CHANNEL || target === ANDROID_PLAY_INTERNAL_CHANNEL,
  `Unsupported OTA target: ${target ?? '(missing)'}`,
);

const release = target === APP_STORE_RELEASE_CHANNEL;
const android = target === ANDROID_PLAY_INTERNAL_CHANNEL;
assert.equal(process.env.EXPO_PUBLIC_API_BASE_URL ?? '', '', 'Direct booking API must remain disabled');
assert.equal(process.env.EXPO_PUBLIC_PSI_UPDATE_CHANNEL, target, 'OTA channel environment mismatch');
assert.equal(process.env.EXPO_PUBLIC_PSI_DEMO_MODE_ENABLED, 'true', 'PSI live mode is not enabled');
assert.equal(process.env.EXPO_PUBLIC_PSI_APPLE_REVIEW, 'false', 'Apple review isolation must be disabled');
assert.equal(process.env.EXPO_PUBLIC_PSI_GOOGLE_REVIEW, 'false', 'Google review isolation must be disabled');
assert.equal(process.env.EXPO_PUBLIC_PERFORMANCE_PURCHASE_TEST, release ? 'true' : 'false', 'Purchase mode mismatch');
assert.equal(process.env.EXPO_PUBLIC_SUPABASE_URL, LIVE_URL, 'Live Supabase project mismatch');
assert.equal(process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, LIVE_PUBLIC_KEY, 'Live Supabase key mismatch');
assert.equal(process.env.EXPO_PUBLIC_SUPABASE_AUTH_ENABLED, 'true', 'Customer auth must be enabled');
assert.equal(process.env.EXPO_PUBLIC_SUPABASE_BOOKING_ENABLED, 'true', 'Customer booking must be enabled');
assert.equal(process.env.EXPO_PUBLIC_SUPABASE_REGISTRATION_ENABLED, release || android ? 'true' : 'false', 'Registration mode mismatch');
if (android) {
  assert.equal(process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY, 'goog_oeWwvijtRSonQTqJOsLGvGZAQRdOct', 'Google purchases require the PSI RevenueCat project');
}
if (release || android) {
  for (const flag of ['EXPO_PUBLIC_ASK_PSI_PRIVATE_PREVIEW', 'EXPO_PUBLIC_ASK_PSI_DEVICE_QA', 'EXPO_PUBLIC_PSI_BOOST_PREVIEW']) {
    assert.ok(!process.env[flag] || process.env[flag] === 'false', `${flag} must remain disabled`);
  }
}
if (release) {
  assert.equal(
    process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY,
    'appl_qJcOAgyhLBExQHfYkgStIaOxQGj',
    'Apple purchases require the PSI RevenueCat project',
  );
}

const resolved = resolveAppConfig({ config: baseConfig });
assert.equal(resolved.extra?.eas?.projectId, 'e62e9cdf-867c-4eb7-b8c5-a2610f969286', 'Expo project mismatch');
assert.equal(resolved.extra?.psiDemoModeAvailable, true, 'PSI live app configuration did not resolve');
assert.equal(resolved.runtimeVersion, android ? ANDROID_PLAY_INTERNAL_RUNTIME : release ? APP_STORE_RELEASE_RUNTIME : BETA_RUNTIME, 'OTA runtime mismatch');

console.log(`Verified ${target} OTA runtime ${resolved.runtimeVersion}.`);
