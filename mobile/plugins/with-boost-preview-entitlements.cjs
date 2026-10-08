const { withBaseMod } = require('expo/config-plugins');

// Expo can automatically apply a dependency's plugin even when it is not listed.
// Run after the inherited entitlement actions so this preview needs no APNs capability.
module.exports = config => withBaseMod(config, {
  platform: 'ios',
  mod: 'entitlements',
  isIntrospective: true,
  async action(config) {
    const result = await config.modRequest.nextMod(config);
    delete result.modResults['aps-environment'];
    return result;
  },
});
