import { resolveReviewEnvironment, REVIEW_PROJECT_REF } from '../../review-environment.cjs';
import { createDemoRuntime, resolveDemoBuild } from '../../demo-mode.cjs';

// Explicit property references are required for Expo's public-env replacement.
const reviewOnly = resolveReviewEnvironment({
  flag: process.env.EXPO_PUBLIC_PSI_APPLE_REVIEW,
  url: process.env.EXPO_PUBLIC_SUPABASE_URL,
  key: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  auth: process.env.EXPO_PUBLIC_SUPABASE_AUTH_ENABLED,
  booking: process.env.EXPO_PUBLIC_SUPABASE_BOOKING_ENABLED,
  registration: process.env.EXPO_PUBLIC_SUPABASE_REGISTRATION_ENABLED,
  channel: process.env.EXPO_PUBLIC_PSI_UPDATE_CHANNEL,
});

export const DEMO_MODE_AVAILABLE = resolveDemoBuild({
  demo: process.env.EXPO_PUBLIC_PSI_DEMO_MODE_ENABLED,
  review: process.env.EXPO_PUBLIC_PSI_APPLE_REVIEW,
  url: process.env.EXPO_PUBLIC_SUPABASE_URL,
  key: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  auth: process.env.EXPO_PUBLIC_SUPABASE_AUTH_ENABLED,
  booking: process.env.EXPO_PUBLIC_SUPABASE_BOOKING_ENABLED,
  registration: process.env.EXPO_PUBLIC_SUPABASE_REGISTRATION_ENABLED,
  channel: process.env.EXPO_PUBLIC_PSI_UPDATE_CHANNEL,
});
export const appModeRuntime = createDemoRuntime(DEMO_MODE_AVAILABLE, reviewOnly.enabled);
export const REVIEW_ENVIRONMENT = Object.freeze({
  get enabled() { return appModeRuntime.enabled; },
  get projectRef() { return appModeRuntime.enabled ? REVIEW_PROJECT_REF : null; },
});

export function environmentStorageKey(liveKey: string) {
  return REVIEW_ENVIRONMENT.enabled ? `apple-review.${liveKey}` : liveKey;
}
