const { resolveReviewEnvironment, REVIEW_CHANNEL, REVIEW_RUNTIME } = require('./review-environment.cjs');
const { resolveDemoBuild, BETA_CHANNEL, BETA_RUNTIME } = require('./demo-mode.cjs');

module.exports = ({ config }) => {
  const demo = resolveDemoBuild({
    demo: process.env.EXPO_PUBLIC_PSI_DEMO_MODE_ENABLED,
    review: process.env.EXPO_PUBLIC_PSI_APPLE_REVIEW,
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    key: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    auth: process.env.EXPO_PUBLIC_SUPABASE_AUTH_ENABLED,
    booking: process.env.EXPO_PUBLIC_SUPABASE_BOOKING_ENABLED,
    registration: process.env.EXPO_PUBLIC_SUPABASE_REGISTRATION_ENABLED,
    channel: process.env.EXPO_PUBLIC_PSI_UPDATE_CHANNEL,
  });
  if (demo) {
    if (process.env.EAS_BUILD_PROFILE && process.env.EAS_BUILD_PROFILE !== BETA_CHANNEL) throw new Error('DEMO_REQUIRES_BETA_PROFILE');
    return { ...config, runtimeVersion: BETA_RUNTIME, extra: { ...config.extra, psiDemoModeAvailable: true } };
  }
  const review = resolveReviewEnvironment({
    flag: process.env.EXPO_PUBLIC_PSI_APPLE_REVIEW,
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    key: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    auth: process.env.EXPO_PUBLIC_SUPABASE_AUTH_ENABLED,
    booking: process.env.EXPO_PUBLIC_SUPABASE_BOOKING_ENABLED,
    registration: process.env.EXPO_PUBLIC_SUPABASE_REGISTRATION_ENABLED,
    channel: process.env.EXPO_PUBLIC_PSI_UPDATE_CHANNEL,
  });
  if (!review.enabled) return config;
  if (process.env.EAS_BUILD_PROFILE && process.env.EAS_BUILD_PROFILE !== REVIEW_CHANNEL) {
    throw new Error('REVIEW_REQUIRES_ITS_OWN_BUILD_PROFILE');
  }
  return {
    ...config,
    name: 'PSI Review',
    runtimeVersion: REVIEW_RUNTIME,
    extra: { ...config.extra, psiEnvironment: 'apple-review', psiReviewProject: review.projectRef },
  };
};
