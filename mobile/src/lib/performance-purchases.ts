import { Platform } from 'react-native';
import { CUSTOMER_AUTH } from '@/lib/customer-auth';
import { REVIEW_ENVIRONMENT } from '@/lib/review-environment';
import { getSupabaseClient } from '@/lib/supabase';
import { PERFORMANCE_PRICING } from '@/lib/performance-plus';

const appleKey = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY?.trim() ?? '';
const googleKey = process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY?.trim() ?? '';
let configuredUser: string | null = null;

export type SubscriptionStorefront = 'Apple' | 'Google Play';

function storefrontConfiguration(): { key: string; name: SubscriptionStorefront; managementUrl: string } | null {
  if (Platform.OS === 'ios') return { key: appleKey, name: 'Apple', managementUrl: 'https://apps.apple.com/account/subscriptions' };
  if (Platform.OS === 'android') return { key: googleKey, name: 'Google Play', managementUrl: 'https://play.google.com/store/account/subscriptions?package=com.psiperformance.booking' };
  return null;
}

export function subscriptionStorefrontName() {
  return storefrontConfiguration()?.name ?? null;
}

export function subscriptionManagementUrl() {
  return storefrontConfiguration()?.managementUrl ?? null;
}

export function subscriptionPurchaseTestMode() {
  if (process.env.EXPO_PUBLIC_PERFORMANCE_PURCHASE_TEST !== 'true') return false;
  if (Platform.OS === 'ios') return process.env.EXPO_PUBLIC_PSI_APPLE_REVIEW === 'true';
  if (Platform.OS === 'android') return process.env.EXPO_PUBLIC_PSI_GOOGLE_REVIEW === 'true';
  return false;
}

export function subscriptionPurchasesAvailable() {
  const storefront = storefrontConfiguration();
  const expectedPrefix = Platform.OS === 'ios' ? 'appl_' : Platform.OS === 'android' ? 'goog_' : '';
  return CUSTOMER_AUTH.enabled && (!REVIEW_ENVIRONMENT.enabled || subscriptionPurchaseTestMode()) && !!storefront && storefront.key.startsWith(expectedPrefix);
}
async function sdkFor(userId: string) {
  if (!subscriptionPurchasesAvailable()) throw new Error('Purchases are not open in this build yet.');
  const { data, error } = await getSupabaseClient().auth.getUser();
  if (error || data.user?.id !== userId) throw new Error('Sign into your PSI account before purchasing.');
  const Purchases = (await import('react-native-purchases')).default;
  const storefront = storefrontConfiguration();
  if (!storefront) throw new Error('Purchases are not available on this device.');
  if (!configuredUser) Purchases.configure({ apiKey: storefront.key, appUserID: userId });
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
  const storefront = subscriptionStorefrontName() ?? 'your app store';
  if (!selected) throw new Error(`This subscription is not available from ${storefront} yet. Please try again later.`);
  // Never display a hard-coded price then charge a different storefront price.
  const expected = PERFORMANCE_PRICING[period] / 100;
  if (selected.product.currencyCode !== 'AUD' || Math.abs(selected.product.price - expected) > .001) {
    throw new Error(`The ${storefront} price needs checking. No purchase has been started.`);
  }
  try { await sdk.purchasePackage(selected); }
  catch (error) { if ((error as { userCancelled?: boolean }).userCancelled) throw new Error('Purchase cancelled. You can keep using PSI Free.'); throw error; }
  await verifyWithServer();
}
export async function restorePerformancePlus(userId: string) {
  await (await sdkFor(userId)).restorePurchases();
  await verifyWithServer();
}
