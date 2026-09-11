import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { s } from './performance-plus';
import { aud, PERFORMANCE_PRICING } from '@/lib/performance-plus';
import { subscriptionPurchaseTestMode, subscriptionPurchasesAvailable, subscriptionStorefrontName } from '@/lib/performance-purchases';
import { REVIEW_ENVIRONMENT } from '@/lib/review-environment';

export default function SubscriptionTerms() {
  const router = useRouter();
  const storefront = subscriptionStorefrontName();
  const provider = storefront ?? 'Apple or Google Play';
  const purchaseNotice = !subscriptionPurchasesAvailable()
    ? 'Paid subscriptions are unavailable in this build. You can continue using PSI Free.'
    : REVIEW_ENVIRONMENT.enabled || subscriptionPurchaseTestMode()
      ? `Sandbox purchase testing is enabled in this build. Use your ${storefront === 'Google Play' ? 'Google Play license tester' : 'Apple sandbox test account'} to test subscriptions and restore purchases.`
      : `Choose a plan on the Performance+ page. ${provider} confirms product availability and the charge before you purchase.`;
  return <SafeAreaView style={s.screen}><ScrollView contentContainerStyle={s.content}>
    <Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={s.link}>‹ Back</Text></Pressable>
    <Text style={s.section}>Performance+ subscription terms</Text>
    <Text style={s.copy}>PSI Performance+ provides access to the premium digital records PSI has added to vehicles in your PSI account. Available records vary by vehicle and workshop work completed. A subscription does not include physical workshop services, parts or unlimited file uploads.</Text>
    <Text style={s.copy}>Monthly access is {aud(PERFORMANCE_PRICING.monthly)}. Annual access is {aud(PERFORMANCE_PRICING.annual)}, charged once per year. The {provider} purchase confirmation shows the charge before you agree. Payment is charged to your {storefront === 'Google Play' ? 'Google Play account' : storefront === 'Apple' ? 'Apple Account' : 'app-store account'} at confirmation.</Text>
    <Text style={s.copy}>Your subscription renews automatically unless cancelled at least 24 hours before the end of the current period. Manage or cancel it in your {storefront === 'Google Play' ? 'Google Play subscriptions' : storefront === 'Apple' ? 'Apple Account → Subscriptions settings' : 'app-store subscription settings'}. Deleting the PSI app or your PSI account does not itself cancel a store subscription.</Text>
    <Text style={s.copy}>Cancellation retains access through the paid period. After expiry your account returns to PSI Free and premium records become locked. Cancellation does not delete your records. Account deletion is a separate request, subject to applicable record retention requirements.</Text>
    <Text style={s.copy}>Use Restore purchases while signed into the same PSI account to check an existing {provider} purchase. Contact info@psiperformance.com.au for account assistance. Store purchase refunds are requested through {provider}; statutory consumer rights are unaffected.</Text>
    <Text style={s.muted}>{purchaseNotice}</Text>
  </ScrollView></SafeAreaView>;
}
