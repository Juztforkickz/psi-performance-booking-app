import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { s } from './performance-plus';
import { aud, PERFORMANCE_PRICING } from '@/lib/performance-plus';
import { subscriptionPurchaseTestMode, subscriptionPurchasesAvailable, subscriptionStorefrontName } from '@/lib/performance-purchases';
import { REVIEW_ENVIRONMENT } from '@/lib/review-environment';
import { APP_PUBLISHER, WORKSHOP_OPERATOR } from '@/constants/legal-entities';

export default function SubscriptionTerms() {
  const router = useRouter();
  const storefront = subscriptionStorefrontName();
  const provider = storefront ?? 'Apple or Google Play';
  const purchaseNotice = !subscriptionPurchasesAvailable()
    ? 'Paid subscriptions are unavailable in this build. You can continue using PSI Free.'
    : REVIEW_ENVIRONMENT.enabled || subscriptionPurchaseTestMode()
      ? `Sandbox purchase testing is enabled in this build. ${storefront === 'Google Play' ? 'Use your Google Play license tester to test subscriptions and restore purchases.' : 'In TestFlight, use your normal Australian Media & Purchases account. A separate Apple sandbox test account is optional for additional testing controls. TestFlight purchases do not charge real money.'}`
      : `Choose a plan on the Performance+ page. ${provider} confirms product availability and the charge before you purchase.`;
  return <SafeAreaView style={s.screen}><ScrollView contentContainerStyle={s.content}>
    <Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={s.link}>‹ Back</Text></Pressable>
    <Text style={s.section}>Performance+ subscription terms</Text>
    <Text style={s.copy}>{APP_PUBLISHER} publishes the app and supplies Performance+ digital subscriptions. {WORKSHOP_OPERATOR} separately supplies workshop services and accepts workshop booking deposits. A Performance+ purchase is not a workshop deposit or payment for vehicle work.</Text>
    <Text style={s.copy}>PSI Performance+ provides in-app access to detailed service and repair history, recommendations, dyno results, invoice copies, workshop photos, supporting documents and downloads. Available records vary by vehicle and workshop work completed. Your PSI Free profile, garage, profile and vehicle photos, enquiries, booking options, service dates, kilometres, reminders, notifications and customer notes remain available without a subscription. Notes you add in Reports are shared with PSI and are labelled customer-supplied and unverified. Xero invoices continue to be delivered by email. A subscription does not include physical workshop services, parts or unlimited file uploads.</Text>
    <Text style={s.copy}>Monthly access is {aud(PERFORMANCE_PRICING.monthly)}. Annual access is {aud(PERFORMANCE_PRICING.annual)}, charged once per year. The {provider} purchase confirmation shows the charge before you agree. Payment is charged to your {storefront === 'Google Play' ? 'Google Play account' : storefront === 'Apple' ? 'Apple Account' : 'app-store account'} at confirmation.</Text>
    <Text style={s.copy}>Your subscription renews automatically unless cancelled at least 24 hours before the end of the current period. Manage or cancel it using the Manage subscription button in PSI, which opens your {storefront === 'Google Play' ? 'Google Play subscriptions' : storefront === 'Apple' ? 'Apple subscription management sheet' : 'app-store subscription settings'}. Deleting the PSI app or your PSI account does not itself cancel a store subscription.</Text>
    <Text style={s.copy}>Cancellation retains access through the paid period. After expiry your account returns to PSI Free and premium records become locked. Cancellation does not delete your records. Account deletion is a separate request, subject to applicable record retention requirements.</Text>
    <Text style={s.copy}>Use Restore purchases while signed into the same PSI account to check an existing {provider} purchase. Contact info@psiperformance.com.au for account assistance. Store purchase refunds are requested through {provider}; statutory consumer rights are unaffected.</Text>
    <Text style={s.muted}>{purchaseNotice}</Text>
  </ScrollView></SafeAreaView>;
}
