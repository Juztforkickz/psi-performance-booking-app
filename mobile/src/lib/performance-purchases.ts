import { Linking, Platform } from 'react-native';
import { CUSTOMER_AUTH } from '@/lib/customer-auth';
import { REVIEW_ENVIRONMENT } from '@/lib/review-environment';
import { getSupabaseClient } from '@/lib/supabase';

const appleKey = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY?.trim() ?? '';
const googleKey = process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY?.trim() ?? '';
let configuredUser: string | null = null;

export type SubscriptionStorefront = 'Apple' | 'Google Play';
export type PerformancePlusStorePrice = {
  productId: string;
  value: number;
  priceString: string;
  currencyCode: string;
};
export type PerformancePlusStorePrices = Record<'monthly' | 'annual', PerformancePlusStorePrice> & {
  applePurchaseTest?: true;
};

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

async function performancePlusPackages(userId: string) {
  const sdk = await sdkFor(userId);
  const offerings = await sdk.getOfferings();
  const offering = offerings.all.performance_plus ?? (offerings.current?.identifier === 'performance_plus' ? offerings.current : null);
  const monthly = offering?.monthly ?? offering?.availablePackages.find(item => item.identifier === '$rc_monthly');
  const annual = offering?.annual ?? offering?.availablePackages.find(item => item.identifier === '$rc_annual');
  const storefront = subscriptionStorefrontName() ?? 'your app store';
  if (!monthly || !annual) throw new Error(`${storefront} has not returned both Performance+ options yet. Please try again shortly.`);
  if (monthly.product.identifier !== 'psi_performance_plus_monthly' || annual.product.identifier !== 'psi_performance_plus_annual') {
    throw new Error(`The ${storefront} returned the wrong Performance+ products. No purchase has been started.`);
  }
  return { sdk, monthly, annual };
}

function isolatedApplePurchaseTest() {
  return Platform.OS === 'ios' && REVIEW_ENVIRONMENT.enabled && subscriptionPurchaseTestMode();
}

export async function loadPerformancePlusStorePrices(userId: string): Promise<PerformancePlusStorePrices> {
  const { monthly, annual } = await performancePlusPackages(userId);
  const toPrice = (item: typeof monthly): PerformancePlusStorePrice => ({
    productId: item.product.identifier,
    value: Number(item.product.price),
    priceString: item.product.priceString,
    currencyCode: item.product.currencyCode?.trim().toUpperCase() ?? '',
  });
  return {
    monthly: toPrice(monthly), annual: toPrice(annual),
    ...(isolatedApplePurchaseTest() ? { applePurchaseTest: true as const } : {}),
  };
}
export async function verifyWithServer() {
  const { data, error } = await getSupabaseClient().functions.invoke('sync-performance-subscription', { body: {} });
  if (error || !data?.verified) throw new Error('Your purchase needs another status check. Use Restore purchases; do not purchase again.');
}
export async function purchasePerformancePlus(userId: string, period: 'monthly' | 'annual') {
  const { sdk, monthly, annual } = await performancePlusPackages(userId);
  const selected = period === 'monthly' ? monthly : annual;
  const storefront = subscriptionStorefrontName() ?? 'your app store';
  // TestFlight can report inconsistent prices and storefronts. Only the isolated
  // Apple test build may pass non-AUD metadata to Apple's native confirmation.
  // A reported storefront must not prevent this test flow from reaching Apple.
  // https://www.revenuecat.com/docs/test-and-launch/sandbox/apple-app-store#currency
  const currency = selected.product.currencyCode?.trim().toUpperCase();
  if (!isolatedApplePurchaseTest() && currency !== 'AUD') {
    throw new Error(`${storefront} has not confirmed an AUD price. No purchase has been started.`);
  }
  if (!currency) throw new Error(`${storefront} has not returned the price currency yet. Please retry. No purchase has been started.`);
  try { await sdk.purchasePackage(selected); }
  catch (error) { if ((error as { userCancelled?: boolean }).userCancelled) throw new Error('Purchase cancelled. You can keep using PSI Free.'); throw error; }
  await verifyWithServer();
}
export async function restorePerformancePlus(userId: string) {
  await (await sdkFor(userId)).restorePurchases();
  await verifyWithServer();
}

export async function managePerformancePlusSubscription(userId: string) {
  const sdk = await sdkFor(userId);
  if (Platform.OS === 'ios') {
    await sdk.showManageSubscriptions();
    return;
  }
  const managementUrl = storefrontConfiguration()?.managementUrl;
  if (!managementUrl) throw new Error('Subscription management is unavailable on this device.');
  await Linking.openURL(managementUrl);
}
