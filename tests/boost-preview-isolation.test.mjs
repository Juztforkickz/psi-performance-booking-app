import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const preview = require('../mobile/boost-preview.cjs');
const eas = require('../mobile/eas.json');
const base = require('../mobile/app.json').expo;
const config = require('../mobile/app.config.js');
const ts = createRequire(new URL('../mobile/package.json', import.meta.url))('typescript');
const root = new URL('../', import.meta.url);
const baselineProfiles = JSON.parse(execFileSync('git', ['show', 'ce30c15:mobile/eas.json'], { cwd: root, encoding: 'utf8' }));
const oldExports = { exports: {} };
vm.runInNewContext(execFileSync('git', ['show', 'ce30c15:mobile/app.config.js'], { cwd: root, encoding: 'utf8' }), {
  module: oldExports, process, require: createRequire(new URL('../mobile/app.config.js', import.meta.url)),
});

function environment(profile, override = {}, run = () => config({ config: structuredClone(base) })) {
  const saved = { ...process.env };
  try {
    for (const key of Object.keys(process.env)) if (key.startsWith('EXPO_PUBLIC_') || key.startsWith('EAS_BUILD_')) delete process.env[key];
    const chain = [];
    for (let p = eas.build[profile]; p; p = eas.build[p.extends]) chain.unshift(p.env ?? {});
    Object.assign(process.env, ...chain, { EAS_BUILD_PROFILE: profile, EAS_BUILD_PLATFORM: profile.startsWith('android-') ? 'android' : 'ios' }, override);
    return run();
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
}

test('Boost preview has a separate install identity, scheme, runtime and internal distribution', () => {
  const c = environment('boost-preview');
  assert.equal(c.name, 'PSI Boost Preview');
  assert.equal(c.ios.bundleIdentifier, 'au.com.psiperformance.garage.boostpreview');
  assert.notEqual(c.ios.bundleIdentifier, base.ios.bundleIdentifier);
  assert.equal(c.scheme, 'psiboostpreview');
  assert.notEqual(c.scheme, base.scheme);
  assert.equal(c.runtimeVersion, preview.BOOST_PREVIEW_RUNTIME);
  assert.equal(c.extra.psiBoostPreview, true);
  assert.equal(c.extra.psiEnvironment, 'boost-preview');
  assert.equal(c.extra.eas.projectId, base.extra.eas.projectId);
  assert.equal(c.plugins.some(plugin => (Array.isArray(plugin) ? plugin[0] : plugin) === 'expo-notifications'), false);
  assert.equal(eas.build['boost-preview'].distribution, 'internal');
  assert.equal(eas.build['boost-preview'].ios.distribution, 'internal');
  assert.equal(eas.build['boost-preview'].channel, 'boost-preview');
  assert.equal(eas.submit['boost-preview'], undefined);
});

test('Existing build and submission profiles and resolved public configurations remain identical', () => {
  for (const [name, profile] of Object.entries(baselineProfiles.build)) assert.deepEqual(eas.build[name], profile, name);
  assert.deepEqual(eas.submit, baselineProfiles.submit);
  for (const name of ['app-store-release', 'android-play-internal', 'apple-review', 'ask-psi-device-test']) {
    const current = environment(name);
    const old = environment(name, {}, () => oldExports.exports({ config: structuredClone(base) }));
    assert.equal(JSON.stringify(current), JSON.stringify(old), name);
  }
});

test('Preview fails closed for production data, payment keys, public channels or wrong profile', () => {
  for (const override of [
    { EXPO_PUBLIC_SUPABASE_URL: 'https://lslhfrujyuqcavsnugfx.supabase.co' },
    { EXPO_PUBLIC_SUPABASE_REGISTRATION_ENABLED: 'true' },
    { EXPO_PUBLIC_PSI_UPDATE_CHANNEL: 'app-store-release' },
    { EXPO_PUBLIC_PERFORMANCE_PURCHASE_TEST: 'true' },
    { EXPO_PUBLIC_REVENUECAT_APPLE_KEY: 'appl_public' },
    { EXPO_PUBLIC_PSI_DEMO_MODE_ENABLED: 'true' },
    { EXPO_PUBLIC_ASK_PSI_DEVICE_QA: 'true' },
    { EXPO_PUBLIC_ASK_PSI_PRIVATE_PREVIEW: 'false' },
    { EAS_BUILD_PROFILE: 'app-store-release' },
    { EAS_BUILD_PLATFORM: 'android' },
  ]) assert.throws(() => environment('boost-preview', override));
  assert.throws(() => environment('boost-preview', { EXPO_PUBLIC_PSI_BOOST_PREVIEW: 'false' }));
});

test('Shared client guard validates sandbox mode and retains the visible test banner', () => {
  const c = environment('boost-preview', {}, () => preview.resolveBoostPreview({
    flag: process.env.EXPO_PUBLIC_PSI_BOOST_PREVIEW, channel: process.env.EXPO_PUBLIC_PSI_UPDATE_CHANNEL,
    url: process.env.EXPO_PUBLIC_SUPABASE_URL, key: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    review: process.env.EXPO_PUBLIC_PSI_APPLE_REVIEW, googleReview: process.env.EXPO_PUBLIC_PSI_GOOGLE_REVIEW,
    privatePreview: process.env.EXPO_PUBLIC_ASK_PSI_PRIVATE_PREVIEW, auth: process.env.EXPO_PUBLIC_SUPABASE_AUTH_ENABLED,
    booking: process.env.EXPO_PUBLIC_SUPABASE_BOOKING_ENABLED, registration: process.env.EXPO_PUBLIC_SUPABASE_REGISTRATION_ENABLED,
    demo: process.env.EXPO_PUBLIC_PSI_DEMO_MODE_ENABLED, purchaseTest: process.env.EXPO_PUBLIC_PERFORMANCE_PURCHASE_TEST,
    deviceQa: process.env.EXPO_PUBLIC_ASK_PSI_DEVICE_QA, applePurchaseKey: process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY,
    googlePurchaseKey: process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY,
  }));
  assert.equal(c.enabled, true);
  assert.equal(c.projectRef, 'jwikoldibbpxyhbdrsow');
  assert.match(readFileSync(new URL('../mobile/src/components/apple-review-banner.tsx', import.meta.url), 'utf8'), /PSI BOOST PREVIEW · TEST DATA ONLY/);
});

test('Actual preview client stays in sandbox and never opens the purchase SDK', async () => {
  const runtime = {};
  const checkout = {};
  const compile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  let calls = 0;
  environment('boost-preview', {}, () => {
    const env = { ...process.env };
    vm.runInNewContext(compile('../mobile/src/lib/review-environment.ts'), {
      exports: runtime, process: { env }, require: createRequire(new URL('../mobile/src/lib/review-environment.ts', import.meta.url)),
    });
    vm.runInNewContext(compile('../mobile/src/lib/performance-purchases.ts'), {
      exports: checkout, process: { env }, require(name) {
        if (name === 'react-native') return { Platform: { OS: 'ios' }, Linking: { openURL() { calls++; } } };
        if (name === '@/lib/customer-auth') return { CUSTOMER_AUTH: { enabled: true } };
        if (name === '@/lib/review-environment') return runtime;
        if (name === '@/lib/supabase') return { getSupabaseClient() { calls++; throw Error('Production or purchase access must not occur'); } };
        if (name === 'react-native-purchases') { calls++; throw Error('Native purchases must not open'); }
        throw Error(`Unexpected dependency: ${name}`);
      },
    });
  });
  assert.equal(runtime.BOOST_PREVIEW.enabled, true);
  assert.equal(runtime.REVIEW_ENVIRONMENT.enabled, true);
  assert.equal(runtime.REVIEW_ENVIRONMENT.projectRef, 'jwikoldibbpxyhbdrsow');
  assert.equal(runtime.DEMO_MODE_AVAILABLE, false);
  runtime.appModeRuntime.assertReady();
  assert.throws(() => runtime.appModeRuntime.initialize('live'));
  assert.equal(checkout.subscriptionPurchasesAvailable(), false);
  assert.equal(checkout.subscriptionPurchaseTestMode(), false);
  await assert.rejects(checkout.purchasePerformancePlus('fixture', 'monthly'), /not open/);
  await assert.rejects(checkout.restorePerformancePlus('fixture'), /not open/);
  assert.equal(calls, 0);
});
