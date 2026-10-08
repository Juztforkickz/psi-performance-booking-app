const { resolveReviewEnvironment, resolveGoogleReviewEnvironment, REVIEW_CHANNEL, REVIEW_RUNTIME, GOOGLE_REVIEW_CHANNEL, GOOGLE_REVIEW_RUNTIME } = require('./review-environment.cjs');
const { resolveDemoBuild, demoRuntimeForChannel, BETA_CHANNEL, APP_STORE_RELEASE_CHANNEL, ANDROID_INTERNAL_CHANNEL, ANDROID_PLAY_INTERNAL_CHANNEL } = require('./demo-mode.cjs');
const { resolveAskPsiDeviceQa, QA_PROFILE, QA_RUNTIME } = require('./ask-psi-device-qa.cjs');
const { resolveBoostPreview, BOOST_PREVIEW_PROFILE, BOOST_PREVIEW_RUNTIME, BOOST_PREVIEW_BUNDLE, BOOST_PREVIEW_SCHEME } = require('./boost-preview.cjs');

module.exports = ({ config }) => {
  const boostPreview = resolveBoostPreview({ flag: process.env.EXPO_PUBLIC_PSI_BOOST_PREVIEW, channel: process.env.EXPO_PUBLIC_PSI_UPDATE_CHANNEL, url: process.env.EXPO_PUBLIC_SUPABASE_URL, key: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, review: process.env.EXPO_PUBLIC_PSI_APPLE_REVIEW, googleReview: process.env.EXPO_PUBLIC_PSI_GOOGLE_REVIEW, privatePreview: process.env.EXPO_PUBLIC_ASK_PSI_PRIVATE_PREVIEW, auth: process.env.EXPO_PUBLIC_SUPABASE_AUTH_ENABLED, booking: process.env.EXPO_PUBLIC_SUPABASE_BOOKING_ENABLED, registration: process.env.EXPO_PUBLIC_SUPABASE_REGISTRATION_ENABLED, demo: process.env.EXPO_PUBLIC_PSI_DEMO_MODE_ENABLED, purchaseTest: process.env.EXPO_PUBLIC_PERFORMANCE_PURCHASE_TEST, deviceQa: process.env.EXPO_PUBLIC_ASK_PSI_DEVICE_QA, applePurchaseKey: process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY, googlePurchaseKey: process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY });
  if (boostPreview.enabled) {
    if (process.env.EAS_BUILD_PROFILE !== BOOST_PREVIEW_PROFILE) throw new Error('BOOST_PREVIEW_PROFILE_REQUIRED');
    if (process.env.EAS_BUILD_PLATFORM && process.env.EAS_BUILD_PLATFORM !== 'ios') throw new Error('BOOST_PREVIEW_IPHONE_ONLY');
    return { ...config, name: 'PSI Boost Preview', scheme: BOOST_PREVIEW_SCHEME, runtimeVersion: BOOST_PREVIEW_RUNTIME,
      // This first preview has no remote push entitlement or APNs signing capability.
      plugins: [...(config.plugins ?? []).filter(plugin => (Array.isArray(plugin) ? plugin[0] : plugin) !== 'expo-notifications'), './plugins/with-boost-preview-entitlements.cjs'],
      ios: { ...config.ios, bundleIdentifier: BOOST_PREVIEW_BUNDLE },
      extra: { ...config.extra, psiEnvironment: BOOST_PREVIEW_PROFILE, psiReviewProject: boostPreview.projectRef, psiBoostPreview: true } };
  }
  const deviceQa = resolveAskPsiDeviceQa({ flag: process.env.EXPO_PUBLIC_ASK_PSI_DEVICE_QA, users: process.env.EXPO_PUBLIC_ASK_PSI_DEVICE_QA_USERS, review: process.env.EXPO_PUBLIC_PSI_APPLE_REVIEW, googleReview: process.env.EXPO_PUBLIC_PSI_GOOGLE_REVIEW, privatePreview: process.env.EXPO_PUBLIC_ASK_PSI_PRIVATE_PREVIEW, url: process.env.EXPO_PUBLIC_SUPABASE_URL, key: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, channel: process.env.EXPO_PUBLIC_PSI_UPDATE_CHANNEL, auth: process.env.EXPO_PUBLIC_SUPABASE_AUTH_ENABLED, booking: process.env.EXPO_PUBLIC_SUPABASE_BOOKING_ENABLED, registration: process.env.EXPO_PUBLIC_SUPABASE_REGISTRATION_ENABLED, demo: process.env.EXPO_PUBLIC_PSI_DEMO_MODE_ENABLED, purchaseTest: process.env.EXPO_PUBLIC_PERFORMANCE_PURCHASE_TEST });
  if (deviceQa.enabled) {
    if (process.env.EAS_BUILD_PROFILE !== QA_PROFILE) throw new Error('ASK_PSI_DEVICE_QA_PROFILE_REQUIRED');
    return { ...config, name: 'PSI Message Test', runtimeVersion: QA_RUNTIME, extra: { ...config.extra, psiEnvironment: 'apple-review', psiReviewProject: deviceQa.projectRef, psiAskPsiDeviceQa: true } };
  }
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
    const channel = process.env.EXPO_PUBLIC_PSI_UPDATE_CHANNEL;
    const appStoreRelease = channel === APP_STORE_RELEASE_CHANNEL;
    const androidInternal = channel === ANDROID_INTERNAL_CHANNEL;
    const androidPlayInternal = channel === ANDROID_PLAY_INTERNAL_CHANNEL;
    if (purchaseTest !== appStoreRelease) throw new Error(appStoreRelease ? 'APP_STORE_RELEASE_REQUIRES_PURCHASE_REVIEW' : 'PURCHASE_TEST_REQUIRES_ISOLATED_PROFILE');
    if ((androidInternal || androidPlayInternal) && process.env.EAS_BUILD_PLATFORM && process.env.EAS_BUILD_PLATFORM !== 'android') throw new Error('ANDROID_INTERNAL_REQUIRES_ANDROID');
    const googleKey = process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY ?? '';
    if (androidInternal && googleKey !== 'disabled') throw new Error('ANDROID_INTERNAL_PURCHASES_MUST_BE_CLOSED');
    if (androidPlayInternal && !googleKey.startsWith('goog_')) throw new Error('ANDROID_PLAY_REQUIRES_GOOGLE_PURCHASE_KEY');
    const expectedProfile = appStoreRelease ? APP_STORE_RELEASE_CHANNEL : androidInternal ? ANDROID_INTERNAL_CHANNEL : androidPlayInternal ? ANDROID_PLAY_INTERNAL_CHANNEL : BETA_CHANNEL;
    if (process.env.EAS_BUILD_PROFILE && process.env.EAS_BUILD_PROFILE !== expectedProfile) throw new Error('DEMO_REQUIRES_MATCHING_BUILD_PROFILE');
    if (appStoreRelease && !(process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY ?? '').startsWith('appl_')) throw new Error('APP_STORE_RELEASE_REQUIRES_APPLE_PURCHASE_KEY');
    return { ...config, runtimeVersion: demoRuntimeForChannel(channel), extra: { ...config.extra, psiDemoModeAvailable: true } };
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
