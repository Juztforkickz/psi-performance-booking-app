import Constants from 'expo-constants';

import { resolveAskPsiDeviceQa, QA_RUNTIME } from '../../ask-psi-device-qa.cjs';
import { REVIEW_ENVIRONMENT } from '@/lib/review-environment';

const configuration = resolveAskPsiDeviceQa({
  flag: process.env.EXPO_PUBLIC_ASK_PSI_DEVICE_QA,
  users: process.env.EXPO_PUBLIC_ASK_PSI_DEVICE_QA_USERS,
  review: process.env.EXPO_PUBLIC_PSI_APPLE_REVIEW,
  googleReview: process.env.EXPO_PUBLIC_PSI_GOOGLE_REVIEW,
  privatePreview: process.env.EXPO_PUBLIC_ASK_PSI_PRIVATE_PREVIEW,
  url: process.env.EXPO_PUBLIC_SUPABASE_URL,
  key: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  channel: process.env.EXPO_PUBLIC_PSI_UPDATE_CHANNEL,
  auth: process.env.EXPO_PUBLIC_SUPABASE_AUTH_ENABLED,
  booking: process.env.EXPO_PUBLIC_SUPABASE_BOOKING_ENABLED,
  registration: process.env.EXPO_PUBLIC_SUPABASE_REGISTRATION_ENABLED,
  demo: process.env.EXPO_PUBLIC_PSI_DEMO_MODE_ENABLED,
  purchaseTest: process.env.EXPO_PUBLIC_PERFORMANCE_PURCHASE_TEST,
});

export const ASK_PSI_DEVICE_QA = {
  get enabled() { return configuration.enabled && REVIEW_ENVIRONMENT.enabled
    && Constants.expoConfig?.extra?.psiAskPsiDeviceQa === true
    && Constants.expoConfig?.runtimeVersion === QA_RUNTIME; },
  runtime: QA_RUNTIME,
  allowsUser(userId: string | null | undefined) { return this.enabled && Boolean(userId && configuration.userIds.includes(userId)); },
};

export function isAskPsiPush(data: Record<string, unknown> | undefined) {
  const id = typeof data?.askPsiConversationId === 'string' ? data.askPsiConversationId : '';
  return data?.psiAskPsiDeviceQa === true
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(id)
    && (data?.kind === 'staff_message_received' || data?.kind === 'customer_message_received');
}

export function notificationWorkerName() {
  return ASK_PSI_DEVICE_QA.enabled ? 'process-ask-psi-device-qa' : 'process-push-notifications';
}
