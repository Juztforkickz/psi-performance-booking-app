import { resolveReviewEnvironment } from '../../review-environment.cjs';

// Explicit property references are required for Expo's public-env replacement.
export const REVIEW_ENVIRONMENT = resolveReviewEnvironment({
  flag: process.env.EXPO_PUBLIC_PSI_APPLE_REVIEW,
  url: process.env.EXPO_PUBLIC_SUPABASE_URL,
  key: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  auth: process.env.EXPO_PUBLIC_SUPABASE_AUTH_ENABLED,
  booking: process.env.EXPO_PUBLIC_SUPABASE_BOOKING_ENABLED,
  registration: process.env.EXPO_PUBLIC_SUPABASE_REGISTRATION_ENABLED,
  channel: process.env.EXPO_PUBLIC_PSI_UPDATE_CHANNEL,
});

export function environmentStorageKey(liveKey: string) {
  return REVIEW_ENVIRONMENT.enabled ? `apple-review.${liveKey}` : liveKey;
}
