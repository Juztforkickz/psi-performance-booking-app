const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');
const {
  createDemoRuntime,
  resolveDemoBuild,
  LIVE_URL,
  LIVE_PUBLIC_KEY,
  BETA_RUNTIME,
  APP_STORE_RELEASE_CHANNEL,
  APP_STORE_RELEASE_RUNTIME,
} = require('../demo-mode.cjs');
const valid = { demo: 'true', review: 'false', url: LIVE_URL, key: LIVE_PUBLIC_KEY, auth: 'true', booking: 'true', registration: 'false', channel: 'beta' };

test('existing builds cannot opt in by saved mode alone', () => {
  assert.equal(resolveDemoBuild({}), false);
  const runtime = createDemoRuntime(false);
  assert.equal(runtime.ready, true);
  assert.equal(runtime.enabled, false);
  assert.throws(() => runtime.initialize('demo'));
});
test('same-build demo requires exact live configuration and closed registration', () => {
  assert.equal(resolveDemoBuild(valid), true);
  for (const change of [{demo:'TRUE'},{review:'true'},{url:'https://wrong.invalid'},{key:'wrong'},{auth:'false'},{booking:'false'},{registration:'true'},{channel:'production'}]) {
    assert.throws(() => resolveDemoBuild({...valid,...change}));
  }
});
test('App Store release opens registration only on its own update channel', () => {
  assert.equal(resolveDemoBuild({ ...valid, registration: 'true', channel: APP_STORE_RELEASE_CHANNEL }), true);
  assert.throws(() => resolveDemoBuild({ ...valid, channel: APP_STORE_RELEASE_CHANNEL }), /MISMATCH/);
  assert.throws(() => resolveDemoBuild({ ...valid, registration: 'true' }), /MISMATCH/);
});
test('no backend client may open until the saved environment is loaded', () => {
  const runtime = createDemoRuntime(true);
  assert.equal(runtime.ready, false);
  assert.throws(() => runtime.assertReady(), /NOT_INITIALIZED/);
  runtime.initialize(null);
  runtime.assertReady();
  assert.equal(runtime.enabled, false);
});
test('mode is immutable for the entire JS process, including late async operations', () => {
  for (const mode of ['live','demo']) {
    const runtime = createDemoRuntime(true);
    runtime.initialize(mode);
    runtime.initialize(mode); // React Strict Mode bootstrap is idempotent.
    assert.throws(() => runtime.initialize(mode === 'live' ? 'demo' : 'live'), /RESTART/);
    assert.equal(runtime.enabled, mode === 'demo');
  }
});
test('invalid saved mode blocks startup rather than silently opening live records', () => {
  for (const value of ['true','false','', 'production', '{"mode":"demo"}']) {
    const runtime = createDemoRuntime(true);
    assert.throws(() => runtime.initialize(value));
    assert.equal(runtime.ready, false);
  }
});
test('the same build retains PSI identity and has a separate OTA runtime', () => {
  const eas = JSON.parse(readFileSync(resolve(__dirname, '../eas.json'), 'utf8'));
  const env = { ...process.env, ...eas.build.beta.env, EAS_BUILD_PROFILE: 'beta' };
  const script = "console.log(JSON.stringify(require('./app.config.js')({config:require('./app.json').expo})))";
  const run = spawnSync(process.execPath, ['-e',script], {cwd:resolve(__dirname,'..'), env, encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
  const config = JSON.parse(run.stdout);
  assert.equal(config.name,'PSI');
  assert.equal(config.ios.bundleIdentifier,'com.psiperformance.booking');
  assert.equal(config.runtimeVersion,BETA_RUNTIME);
  assert.notEqual(config.runtimeVersion,'1.0.0');
  assert.equal(config.extra.psiDemoModeAvailable,true);
  assert.equal(eas.build.beta.channel,'beta');
  for (const profile of ['production','qa','apple-review']) {
    const invalid = spawnSync(process.execPath, ['-e',script], {cwd:resolve(__dirname,'..'),env:{...env,EAS_BUILD_PROFILE:profile},encoding:'utf8'});
    assert.notEqual(invalid.status,0);
  }
});
test('the App Store release keeps live mode while isolating review purchases', () => {
  const eas = JSON.parse(readFileSync(resolve(__dirname, '../eas.json'), 'utf8'));
  const profile = eas.build[APP_STORE_RELEASE_CHANNEL];
  const env = { ...process.env, ...profile.env, EAS_BUILD_PROFILE: APP_STORE_RELEASE_CHANNEL };
  const script = "console.log(JSON.stringify(require('./app.config.js')({config:require('./app.json').expo})))";
  const run = spawnSync(process.execPath, ['-e',script], {cwd:resolve(__dirname,'..'), env, encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
  const config = JSON.parse(run.stdout);
  assert.equal(config.name,'PSI');
  assert.equal(config.ios.bundleIdentifier,'com.psiperformance.booking');
  assert.equal(config.runtimeVersion,APP_STORE_RELEASE_RUNTIME);
  assert.equal(config.extra.psiDemoModeAvailable,true);
  assert.equal(profile.channel,APP_STORE_RELEASE_CHANNEL);
  assert.equal(profile.env.EXPO_PUBLIC_SUPABASE_REGISTRATION_ENABLED, 'true');
  assert.equal(eas.build.beta.env.EXPO_PUBLIC_SUPABASE_REGISTRATION_ENABLED, 'false');
  for (const override of [
    { EXPO_PUBLIC_PERFORMANCE_PURCHASE_TEST: 'false' },
    { EXPO_PUBLIC_REVENUECAT_APPLE_KEY: '' },
    { EAS_BUILD_PROFILE: 'beta' },
  ]) {
    const invalid = spawnSync(process.execPath, ['-e',script], {cwd:resolve(__dirname,'..'),env:{...env,...override},encoding:'utf8'});
    assert.notEqual(invalid.status,0);
  }
});
test('bootstrap, explicit selection, local sign-out and private draft separation remain wired', () => {
  const read = (path) => readFileSync(resolve(__dirname,'../src',path),'utf8');
  assert.match(read('app/_layout.tsx'), /<AppModeGate><ThemeAwareRootShell \/><\/AppModeGate>/);
  assert.match(read('lib/supabase.ts'), /appModeRuntime.assertReady\(\)/);
  assert.match(read('lib/supabase.ts'), /REVIEW_ENVIRONMENT.enabled \? REVIEW_URL : supabaseUrl/);
  assert.match(read('lib/booking-draft.ts'), /return environmentStorageKey/);
  assert.match(read('components/demo-mode-control.tsx'), /scope: 'local'/);
  assert.match(read('components/demo-mode-control.tsx'), /!exiting && session.data.session/);
  assert.doesNotMatch(read('lib/app-mode-storage.ts'), /appModeRuntime.initialize\(mode\)/);
  assert.match(read('app/events.tsx'), /REVIEW_ENVIRONMENT.enabled.*reminders are disabled/);
});
