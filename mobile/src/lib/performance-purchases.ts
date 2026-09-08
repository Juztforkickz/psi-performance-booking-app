import { Platform } from 'react-native';
import { CUSTOMER_AUTH } from '@/lib/customer-auth';
import { REVIEW_ENVIRONMENT } from '@/lib/review-environment';
import { getSupabaseClient } from '@/lib/supabase';
import { PERFORMANCE_PRICING } from '@/lib/performance-plus';

const appleKey = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY?.trim() ?? '';
let configuredUser: string | null = null;
export function subscriptionPurchasesAvailable() {
  const isolatedPurchaseTest = process.env.EXPO_PUBLIC_PERFORMANCE_PURCHASE_TEST === 'true' && process.env.EXPO_PUBLIC_PSI_APPLE_REVIEW === 'true';
  return CUSTOMER_AUTH.enabled && (!REVIEW_ENVIRONMENT.enabled || isolatedPurchaseTest) && Platform.OS === 'ios' && appleKey.startsWith('appl_');
}
async function sdkFor(userId: string) {
  if (!subscriptionPurchasesAvailable()) throw new Error('Purchases are not open in this build yet.');
  const { data, error } = await getSupabaseClient().auth.getUser();
  if (error || data.user?.id !== userId) throw new Error('Sign into your PSI account before purchasing.');
  const Purchases = (await import('react-native-purchases')).default;
  if (!configuredUser) Purchases.configure({ apiKey: appleKey, appUserID: userId });
  else if (configuredUser !== userId) await Purchases.logIn(userId);
  configuredUser = userId;
  return Purchases;
}
export async function verifyWithServer() {
  const { data, error } = await getSupabaseClient().functions.invoke('sync-performance-subscription', { body: {} });
  if (error || !data?.verified) throw new Error('Your purchase needs another status check. Use Restore purchases; do not purchase again.');
}
export async function purchasePerformancePlus(userId: string, period: 'monthly' | 'annual') {
  const sdk = await sdkFor(userId);
  const offerings = await sdk.getOfferings();
  const offering = offerings.all.performance_plus;
  const selected = period === 'monthly' ? offering?.monthly : offering?.annual;
  if (!selected) throw new Error('This subscription is not available from Apple yet. Please try again later.');
  // Never display a hard-coded price then charge a different storefront price.
  const expected = PERFORMANCE_PRICING[period] / 100;
  if (selected.product.currencyCode !== 'AUD' || Math.abs(selected.product.price - expected) > .001) {
    throw new Error('The Apple price needs checking. No purchase has been started.');
  }
  try { await sdk.purchasePackage(selected); }
  catch (error) { if ((error as { userCancelled?: boolean }).userCancelled) throw new Error('Purchase cancelled. You can keep using PSI Free.'); throw error; }
  await verifyWithServer();
}
export async function restorePerformancePlus(userId: string) {
  await (await sdkFor(userId)).restorePurchases();
  await verifyWithServer();
}
