// Same binary, two explicitly selected environments. No credentials or hot swaps.
const LIVE_URL = 'https://lslhfrujyuqcavsnugfx.supabase.co';
const LIVE_PUBLIC_KEY = 'sb_publishable_B1fbCA2hQegGaE9JDCcp-Q_L2rvyeDN';
const BETA_CHANNEL = 'beta';
const BETA_RUNTIME = '1.0.0-beta-performance-plus-1';
const APP_STORE_RELEASE_CHANNEL = 'app-store-release';
const APP_STORE_RELEASE_RUNTIME = '1.0.0-app-store-release-1';

function demoRuntimeForChannel(channel) {
  if (channel === BETA_CHANNEL) return BETA_RUNTIME;
  if (channel === APP_STORE_RELEASE_CHANNEL) return APP_STORE_RELEASE_RUNTIME;
  throw new Error('DEMO_BUILD_CONFIGURATION_MISMATCH');
}

function resolveDemoBuild(input) {
  const flag = input.demo ?? '';
  if (!['', 'false', 'true'].includes(flag)) throw new Error('INVALID_DEMO_MODE_FLAG');
  if (flag !== 'true') return false;
  if (input.review === 'true' || input.url !== LIVE_URL || input.key !== LIVE_PUBLIC_KEY
      || input.auth !== 'true' || input.booking !== 'true' || input.registration !== 'false') {
    throw new Error('DEMO_BUILD_CONFIGURATION_MISMATCH');
  }
  demoRuntimeForChannel(input.channel);
  return true;
}

function createDemoRuntime(selectable, reviewOnly = false) {
  let mode = selectable ? null : reviewOnly ? 'demo' : 'live';
  return Object.freeze({
    get ready() { return mode !== null; },
    get enabled() { return mode === 'demo'; },
    initialize(stored) {
      const next = stored === null || stored === undefined ? 'live' : stored;
      if (!['live', 'demo'].includes(next)) throw new Error('INVALID_SAVED_APP_MODE');
      if (mode !== null && next !== mode) throw new Error('APP_MODE_CHANGE_REQUIRES_RESTART');
      if (!selectable && next !== mode) throw new Error('DEMO_MODE_UNAVAILABLE');
      mode = next;
    },
    assertReady() { if (mode === null) throw new Error('APP_MODE_NOT_INITIALIZED'); },
  });
}

module.exports = {
  LIVE_URL,
  LIVE_PUBLIC_KEY,
  BETA_CHANNEL,
  BETA_RUNTIME,
  APP_STORE_RELEASE_CHANNEL,
  APP_STORE_RELEASE_RUNTIME,
  demoRuntimeForChannel,
  resolveDemoBuild,
  createDemoRuntime,
};
