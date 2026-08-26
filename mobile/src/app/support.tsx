import { useRouter } from 'expo-router';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui';
import { colors, mobileFrame, spacing } from '@/constants/brand';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';

export default function SupportScreen() {
  const router = useRouter();
  const { horizontalPadding } = useResponsiveLayout();
  return (
    <SafeAreaView edges={['top', 'right', 'left']} style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingHorizontal: horizontalPadding }]} showsVerticalScrollIndicator={false}>
        <PrimaryButton label="← Back" onPress={() => router.back()} variant="outline" />
        <Text style={styles.eyebrow}>PSI SUPPORT</Text>
        <Text style={styles.title}>Account & booking help</Text>
        <Text style={styles.lead}>Direct support for sign-in, customer records, booking requests and privacy enquiries.</Text>

        <View style={styles.card}>
          <Text style={styles.heading}>Contact PSI</Text>
          <Text style={styles.copy}>Monday–Friday · 8:30 am–5:00 pm{`\n`}21 Exchange Drive, Pakenham VIC 3810</Text>
          <PrimaryButton label="Call 0433 431 781" onPress={() => void Linking.openURL('tel:+61433431781')} />
          <PrimaryButton label="Email info@psiperformance.com.au" onPress={() => void Linking.openURL('mailto:info@psiperformance.com.au?subject=PSI%20App%20Support')} variant="outline" />
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>Sign-in help</Text>
          <Text style={styles.copy}>Use the newest six-digit email code within 10 minutes. A code can be used once. If the app returns from email before the session is visible, reopen Account; it will restore a valid session securely. PSI will never ask you to share a code or authenticator secret.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>Account deletion</Text>
          <Text style={styles.copy}>Sign in, open Account and select Request account deletion. If you no longer have access to the app, use the public deletion page to email a request from your account address. PSI normally completes verified requests within 30 days and confirms completion.</Text>
          <PrimaryButton label="Open Account" onPress={() => router.push('/account')} variant="outline" />
          <PrimaryButton label="Account deletion information" onPress={() => router.push('/delete-account')} variant="outline" />
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>Booking requests</Text>
          <Text style={styles.copy}>A request does not reserve a date and does not take payment. PSI reviews availability first. The app and email show any proposed, approved or cancelled date. Customers cannot see PSI’s private Google Calendar.</Text>
          <PrimaryButton label="Open Bookings" onPress={() => router.push('/bookings')} variant="outline" />
        </View>

        <PrimaryButton label="Privacy & data handling" onPress={() => router.push('/privacy')} variant="outline" />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  scroll: { width: '100%', maxWidth: 680, alignSelf: 'center', gap: spacing.md, paddingTop: spacing.lg, paddingBottom: 72 },
  eyebrow: { marginTop: spacing.lg, color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: colors.white, fontSize: 34, fontWeight: '900', letterSpacing: -1.2, lineHeight: 38, textTransform: 'uppercase' },
  lead: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  card: { ...mobileFrame, gap: spacing.md, backgroundColor: colors.panel, padding: spacing.lg },
  heading: { color: colors.white, fontSize: 16, fontWeight: '900', textTransform: 'uppercase' },
  copy: { color: colors.muted, fontSize: 12, lineHeight: 19 },
});
