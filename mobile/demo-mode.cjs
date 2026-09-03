// Same binary, two explicitly selected environments. No credentials or hot swaps.
const LIVE_URL = 'https://lslhfrujyuqcavsnugfx.supabase.co';
const LIVE_PUBLIC_KEY = 'sb_publishable_B1fbCA2hQegGaE9JDCcp-Q_L2rvyeDN';
const BETA_CHANNEL = 'beta';
const BETA_RUNTIME = '1.0.0-beta-demo-1';

function resolveDemoBuild(input) {
  const flag = input.demo ?? '';
  if (!['', 'false', 'true'].includes(flag)) throw new Error('INVALID_DEMO_MODE_FLAG');
  if (flag !== 'true') return false;
  if (input.review === 'true' || input.url !== LIVE_URL || input.key !== LIVE_PUBLIC_KEY
      || input.auth !== 'true' || input.booking !== 'true' || input.registration !== 'false'
      || input.channel !== BETA_CHANNEL) throw new Error('DEMO_BUILD_CONFIGURATION_MISMATCH');
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

module.exports = { LIVE_URL, LIVE_PUBLIC_KEY, BETA_CHANNEL, BETA_RUNTIME, resolveDemoBuild, createDemoRuntime };
