import { useRouter } from 'expo-router';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui';
import { colors, mobileFrame, spacing } from '@/constants/brand';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';

const deletionEmail = 'mailto:info@psiperformance.com.au?subject=PSI%20Performance%20App%20Account%20Deletion%20Request&body=Please%20send%20this%20request%20from%20the%20email%20address%20used%20for%20your%20PSI%20Performance%20App%20account.%20Do%20not%20include%20a%20password%20or%20sign-in%20code.';

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { horizontalPadding } = useResponsiveLayout();
  return (
    <SafeAreaView edges={['top', 'right', 'left']} style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingHorizontal: horizontalPadding }]} showsVerticalScrollIndicator={false}>
        <PrimaryButton label="← Back" onPress={() => router.back()} variant="outline" />
        <Text style={styles.eyebrow}>PSI ACCOUNT CONTROL</Text>
        <Text style={styles.title}>Request account deletion</Text>
        <Text style={styles.lead}>Delete your PSI app account and associated customer data.</Text>

        <View style={styles.card}>
          <Text style={styles.heading}>Inside the app</Text>
          <Text style={styles.copy}>Sign in, open Account and choose Request account deletion. Review the consequences and confirm the request. You can cancel while it remains pending.</Text>
          <PrimaryButton label="Open Account" onPress={() => router.push('/account')} variant="outline" />
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>Without access to the app</Text>
          <Text style={styles.copy}>Email PSI from the address used for your account. PSI may verify your identity using that address. Never send a password, sign-in code or authenticator secret.</Text>
          <PrimaryButton label="Email deletion request" onPress={() => void Linking.openURL(deletionEmail)} />
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>What happens</Text>
          <Text style={styles.copy}>PSI normally completes a verified request within 30 days and confirms completion. Login access, customer profile data, notification registrations and customer-uploaded files are removed. Information PSI must retain for workshop, accounting, safety, legal or dispute purposes is limited, protected and de-identified where appropriate.</Text>
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>No payment or subscription to cancel</Text>
          <Text style={styles.copy}>The PSI Performance App currently has no paid digital subscription or in-app purchase. Account deletion does not remove rights or remedies under the Australian Consumer Law.</Text>
        </View>

        <PrimaryButton label="Privacy & data handling" onPress={() => router.push('/privacy')} variant="outline" />
        <Text style={styles.updated}>PSI PERFORMANCE APP · LAST UPDATED 25/08/2026</Text>
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
  notice: { ...mobileFrame, gap: spacing.xs, backgroundColor: colors.panel, borderColor: colors.accent, padding: spacing.lg },
  noticeTitle: { color: colors.accent, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  updated: { marginTop: spacing.sm, color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1.1, textAlign: 'center' },
});
