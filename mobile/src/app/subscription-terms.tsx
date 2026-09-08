import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { s } from './performance-plus';
import { aud, PERFORMANCE_PRICING } from '@/lib/performance-plus';

export default function SubscriptionTerms() {
  const router = useRouter();
  return <SafeAreaView style={s.screen}><ScrollView contentContainerStyle={s.content}>
    <Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={s.link}>‹ Back</Text></Pressable>
    <Text style={s.section}>Performance+ subscription terms</Text>
    <Text style={s.copy}>PSI Performance+ provides access to the premium digital records PSI has added to vehicles in your PSI account. Available records vary by vehicle and workshop work completed. A subscription does not include physical workshop services, parts or unlimited file uploads.</Text>
    <Text style={s.copy}>Monthly access is {aud(PERFORMANCE_PRICING.monthly)}. Annual access is {aud(PERFORMANCE_PRICING.annual)}, charged once per year. The Apple purchase confirmation shows the charge before you agree. Payment is charged to your Apple Account at confirmation.</Text>
    <Text style={s.copy}>Your subscription renews automatically unless cancelled at least 24 hours before the end of the current period. Manage or cancel an Apple subscription in your device Settings under your Apple Account → Subscriptions. Deleting the PSI app or your PSI account does not itself cancel an Apple subscription.</Text>
    <Text style={s.copy}>Cancellation retains access through the paid period. After expiry your account returns to PSI Free and premium records become locked. Cancellation does not delete your records. Account deletion is a separate request, subject to applicable record retention requirements.</Text>
    <Text style={s.copy}>Use Restore purchases while signed into the same PSI account to check an existing Apple purchase. Contact info@psiperformance.com.au for account assistance. Apple purchase refunds are requested through Apple; statutory consumer rights are unaffected.</Text>
    <Text style={s.muted}>Beta: paid subscriptions remain unavailable until Apple product configuration and purchase testing are completed.</Text>
  </ScrollView></SafeAreaView>;
}
