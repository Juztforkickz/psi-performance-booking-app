import { resolveGoogleReviewEnvironment, resolveReviewEnvironment, REVIEW_PROJECT_REF } from '../../review-environment.cjs';
import { createDemoRuntime, demoModeAvailableForChannel, resolveDemoBuild } from '../../demo-mode.cjs';
import { resolveBoostPreview } from '../../boost-preview.cjs';

// Explicit property references are required for Expo's public-env replacement.
const googleReview = process.env.EXPO_PUBLIC_PSI_GOOGLE_REVIEW === 'true';
const boostPreview = resolveBoostPreview({
  flag: process.env.EXPO_PUBLIC_PSI_BOOST_PREVIEW,
  channel: process.env.EXPO_PUBLIC_PSI_UPDATE_CHANNEL,
  url: process.env.EXPO_PUBLIC_SUPABASE_URL,
  key: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  review: process.env.EXPO_PUBLIC_PSI_APPLE_REVIEW,
  googleReview: process.env.EXPO_PUBLIC_PSI_GOOGLE_REVIEW,
  privatePreview: process.env.EXPO_PUBLIC_ASK_PSI_PRIVATE_PREVIEW,
  auth: process.env.EXPO_PUBLIC_SUPABASE_AUTH_ENABLED,
  booking: process.env.EXPO_PUBLIC_SUPABASE_BOOKING_ENABLED,
  registration: process.env.EXPO_PUBLIC_SUPABASE_REGISTRATION_ENABLED,
  demo: process.env.EXPO_PUBLIC_PSI_DEMO_MODE_ENABLED,
  purchaseTest: process.env.EXPO_PUBLIC_PERFORMANCE_PURCHASE_TEST,
  deviceQa: process.env.EXPO_PUBLIC_ASK_PSI_DEVICE_QA,
  applePurchaseKey: process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY,
  googlePurchaseKey: process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY,
});
export const BOOST_PREVIEW = boostPreview;
const reviewOnly = boostPreview.enabled ? boostPreview : (googleReview ? resolveGoogleReviewEnvironment : resolveReviewEnvironment)({
  flag: googleReview ? process.env.EXPO_PUBLIC_PSI_GOOGLE_REVIEW : process.env.EXPO_PUBLIC_PSI_APPLE_REVIEW,
  url: process.env.EXPO_PUBLIC_SUPABASE_URL,
  key: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  auth: process.env.EXPO_PUBLIC_SUPABASE_AUTH_ENABLED,
  booking: process.env.EXPO_PUBLIC_SUPABASE_BOOKING_ENABLED,
  registration: process.env.EXPO_PUBLIC_SUPABASE_REGISTRATION_ENABLED,
  channel: process.env.EXPO_PUBLIC_PSI_UPDATE_CHANNEL,
});

const demoBuildConfigured = resolveDemoBuild({
  demo: process.env.EXPO_PUBLIC_PSI_DEMO_MODE_ENABLED,
  review: googleReview ? process.env.EXPO_PUBLIC_PSI_GOOGLE_REVIEW : process.env.EXPO_PUBLIC_PSI_APPLE_REVIEW,
  url: process.env.EXPO_PUBLIC_SUPABASE_URL,
  key: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  auth: process.env.EXPO_PUBLIC_SUPABASE_AUTH_ENABLED,
  booking: process.env.EXPO_PUBLIC_SUPABASE_BOOKING_ENABLED,
  registration: process.env.EXPO_PUBLIC_SUPABASE_REGISTRATION_ENABLED,
  channel: process.env.EXPO_PUBLIC_PSI_UPDATE_CHANNEL,
});
export const DEMO_MODE_AVAILABLE = demoModeAvailableForChannel(
  demoBuildConfigured,
  process.env.EXPO_PUBLIC_PSI_UPDATE_CHANNEL,
);
export const appModeRuntime = createDemoRuntime(DEMO_MODE_AVAILABLE, reviewOnly.enabled);
export const REVIEW_ENVIRONMENT = Object.freeze({
  get enabled() { return appModeRuntime.enabled; },
  get projectRef() { return appModeRuntime.enabled ? REVIEW_PROJECT_REF : null; },
});

export function environmentStorageKey(liveKey: string) {
  return REVIEW_ENVIRONMENT.enabled ? `apple-review.${liveKey}` : liveKey;
}
