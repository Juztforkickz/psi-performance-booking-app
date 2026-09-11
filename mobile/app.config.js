const { resolveReviewEnvironment, resolveGoogleReviewEnvironment, REVIEW_CHANNEL, REVIEW_RUNTIME, GOOGLE_REVIEW_CHANNEL, GOOGLE_REVIEW_RUNTIME } = require('./review-environment.cjs');
const { resolveDemoBuild, BETA_CHANNEL, BETA_RUNTIME } = require('./demo-mode.cjs');

module.exports = ({ config }) => {
  const purchaseTestFlag = process.env.EXPO_PUBLIC_PERFORMANCE_PURCHASE_TEST ?? '';
  const googleReviewFlag = process.env.EXPO_PUBLIC_PSI_GOOGLE_REVIEW ?? '';
  if (!['', 'false', 'true'].includes(purchaseTestFlag)) throw new Error('INVALID_PURCHASE_TEST_FLAG');
  if (!['', 'false', 'true'].includes(googleReviewFlag)) throw new Error('INVALID_GOOGLE_REVIEW_FLAG');
  if (googleReviewFlag === 'true' && process.env.EXPO_PUBLIC_PSI_APPLE_REVIEW === 'true') throw new Error('ONE_STORE_REVIEW_ENVIRONMENT_REQUIRED');
  const purchaseTest = purchaseTestFlag === 'true';
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
    if (purchaseTest) throw new Error('PURCHASE_TEST_REQUIRES_ISOLATED_PROFILE');
    if (process.env.EAS_BUILD_PROFILE && process.env.EAS_BUILD_PROFILE !== BETA_CHANNEL) throw new Error('DEMO_REQUIRES_BETA_PROFILE');
    return { ...config, runtimeVersion: BETA_RUNTIME, extra: { ...config.extra, psiDemoModeAvailable: true } };
  }
  if (googleReviewFlag === 'true') {
    const googleReview = resolveGoogleReviewEnvironment({
      flag: googleReviewFlag,
      url: process.env.EXPO_PUBLIC_SUPABASE_URL,
      key: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      auth: process.env.EXPO_PUBLIC_SUPABASE_AUTH_ENABLED,
      booking: process.env.EXPO_PUBLIC_SUPABASE_BOOKING_ENABLED,
      registration: process.env.EXPO_PUBLIC_SUPABASE_REGISTRATION_ENABLED,
      channel: process.env.EXPO_PUBLIC_PSI_UPDATE_CHANNEL,
    });
    if (!googleReview.enabled || !purchaseTest || (process.env.EAS_BUILD_PROFILE && process.env.EAS_BUILD_PROFILE !== 'google-performance-test')) throw new Error('PURCHASE_TEST_REQUIRES_ISOLATED_PROFILE');
    return {
      ...config,
      name: 'PSI Google Test',
      runtimeVersion: GOOGLE_REVIEW_RUNTIME,
      extra: { ...config.extra, psiEnvironment: GOOGLE_REVIEW_CHANNEL, psiReviewProject: googleReview.projectRef },
    };
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
  if (!review.enabled) {
    if (purchaseTest) throw new Error('PURCHASE_TEST_REQUIRES_ISOLATED_PROFILE');
    return config;
  }
  if (purchaseTest && process.env.EAS_BUILD_PROFILE && process.env.EAS_BUILD_PROFILE !== 'performance-test') throw new Error('PURCHASE_TEST_REQUIRES_ISOLATED_PROFILE');
  if (process.env.EAS_BUILD_PROFILE && process.env.EAS_BUILD_PROFILE !== REVIEW_CHANNEL && !(purchaseTest && process.env.EAS_BUILD_PROFILE === 'performance-test')) {
    throw new Error('REVIEW_REQUIRES_ITS_OWN_BUILD_PROFILE');
  }
  return {
    ...config,
    name: 'PSI Review',
    runtimeVersion: purchaseTest ? '1.0.0-performance-purchase-test-1' : REVIEW_RUNTIME,
    extra: { ...config.extra, psiEnvironment: 'apple-review', psiReviewProject: review.projectRef },
  };
};
