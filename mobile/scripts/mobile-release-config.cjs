const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const MOBILE_ROOT = path.resolve(__dirname, '..');
const PROJECT_ID = 'e62e9cdf-867c-4eb7-b8c5-a2610f969286';
const TARGETS = Object.freeze([
  Object.freeze({ platform: 'ios', channel: 'app-store-release', runtime: '1.0.0-app-store-release-1' }),
  Object.freeze({ platform: 'android', channel: 'android-play-internal', runtime: '1.0.0-android-play-internal-1' }),
]);

function releaseEnvironment(target, inherited = process.env, root = MOBILE_ROOT) {
  assert.ok(TARGETS.some(item => item.platform === target.platform && item.channel === target.channel), 'Unknown public release target');
  const env = Object.fromEntries(Object.entries(inherited).filter(([key]) => !key.startsWith('EXPO_PUBLIC_') && !['EAS_BUILD_PROFILE', 'EAS_BUILD_PLATFORM'].includes(key)));
  const profile = JSON.parse(fs.readFileSync(path.join(root, 'eas.json'), 'utf8')).build[target.channel];
  assert.equal(profile.channel, target.channel);
  assert.equal(profile.environment, 'production');
  return { ...env, ...profile.env,
    EXPO_PUBLIC_API_BASE_URL: '', EXPO_PUBLIC_ASK_PSI_PRIVATE_PREVIEW: 'false',
    EXPO_PUBLIC_ASK_PSI_DEVICE_QA: 'false', EXPO_PUBLIC_PSI_BOOST_PREVIEW: 'false',
    EXPO_PUBLIC_PSI_APPLE_REVIEW: 'false', EXPO_PUBLIC_PSI_GOOGLE_REVIEW: 'false',
    EAS_BUILD_PROFILE: target.channel, EAS_BUILD_PLATFORM: target.platform,
    EXPO_NO_TELEMETRY: '1', EXPO_NO_DOTENV: '1', CI: '1',
  };
}

function resolvedReleaseConfig(target, root = MOBILE_ROOT) {
  const previous = process.env;
  process.env = releaseEnvironment(target, previous, root);
  try {
    const resolve = require(path.join(root, 'app.config.js'));
    const config = resolve({ config: JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo });
    assert.equal(config.extra?.eas?.projectId, PROJECT_ID);
    assert.equal(config.runtimeVersion, target.runtime);
    assert.equal(config.updates.url, `https://u.expo.dev/${PROJECT_ID}`);
    assert.equal(config.ios.bundleIdentifier, 'com.psiperformance.booking');
    assert.equal(config.android.package, 'com.psiperformance.booking');
    assert.equal(config.extra.psiDemoModeAvailable, true);
    assert.ok(!config.extra.psiEnvironment && !config.extra.psiAskPsiDeviceQa && !config.extra.psiBoostPreview);
    return config;
  } finally { process.env = previous; }
}

module.exports = { MOBILE_ROOT, PROJECT_ID, TARGETS, releaseEnvironment, resolvedReleaseConfig };
