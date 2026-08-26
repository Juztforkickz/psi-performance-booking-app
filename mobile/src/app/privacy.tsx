import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui';
import { colors, mobileFrame, spacing } from '@/constants/brand';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';

const SECTIONS = [
  {
    title: 'Who operates the app',
    copy: 'PSI PERFORMANCE PTY LTD publishes the PSI Performance app. Workshop bookings, vehicle services and related customer transactions are supplied by Matthew Ebert trading as PSI Performance. The app is free and does not currently offer paid digital products or subscriptions.',
  },
  {
    title: 'Information we handle',
    copy: 'When account access is enabled, the app may handle your verified email address, name, mobile number, vehicle details, odometer readings, booking requests, booking status, service and repair history, recommendations, dyno results, invoice metadata, customer-selected vehicle photos, private workshop attachments, notification preferences and device push token. Payment-card details are not collected or stored by this app.',
  },
  {
    title: 'Why we use it',
    copy: 'We use this information to authenticate you, provide customer-owned vehicle records, review and administer workshop requests, communicate booking changes, display PSI-published workshop history, protect the service from misuse and meet accounting, safety, dispute and legal obligations. We do not sell customer personal information.',
  },
  {
    title: 'Storage and service providers',
    copy: 'Private customer account records and files use PSI-controlled Supabase services configured in the Sydney region. Resend supports transactional email, Expo supports authorised app builds and opted-in push delivery, and Google Calendar receives only PSI internal booking events after the future verified-payment step. Customers cannot list or read PSI calendar contents. Providers receive only the information required to perform their service.',
  },
  {
    title: 'Your control and access',
    copy: 'You can review and correct editable profile and vehicle information after secure sign-in. PSI-authored service, invoice and verified dyno records remain read-only so workshop history cannot be falsified. Contact PSI to request access to, correction of or an export of personal information that is not already available in the app.',
  },
  {
    title: 'Account deletion',
    copy: 'Signed-in customers can initiate deletion from Account. PSI normally completes verified requests within 30 days. Customer profile data, login access, notification tokens and customer-uploaded files will be removed. Information that must still be retained for workshop, accounting, legal, safety or dispute purposes will be limited, protected and, where appropriate, de-identified. PSI confirms when the process is complete.',
  },
  {
    title: 'Retention and security',
    copy: 'We retain personal information only while needed for the purposes described above or while a legal or operational obligation applies. Access is protected through email-code authentication, customer ownership controls, private file storage and MFA for PSI workshop-wide access. No internet service can guarantee absolute security; suspected privacy or security concerns should be reported promptly.',
  },
  {
    title: 'Contact',
    copy: 'Privacy and account enquiries: info@psiperformance.com.au · PSI Performance, 21 Exchange Drive, Pakenham VIC 3810 · 0433 431 781.',
  },
] as const;

export default function PrivacyScreen() {
  const router = useRouter();
  const { horizontalPadding } = useResponsiveLayout();
  return (
    <SafeAreaView edges={['top', 'right', 'left']} style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingHorizontal: horizontalPadding }]} showsVerticalScrollIndicator={false}>
        <PrimaryButton label="← Back" onPress={() => router.back()} variant="outline" />
        <Text style={styles.eyebrow}>PSI PRIVACY</Text>
        <Text style={styles.title}>Privacy & data handling</Text>
        <Text style={styles.lead}>How the PSI Performance app protects customer accounts, vehicles, bookings and workshop records.</Text>
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Current release boundary</Text>
          <Text style={styles.copy}>Public previews use synthetic data with account access and submissions disabled. These terms apply when PSI deliberately enables an authenticated customer build.</Text>
        </View>
        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.card}>
            <Text style={styles.heading}>{section.title}</Text>
            <Text style={styles.copy}>{section.copy}</Text>
          </View>
        ))}
        <PrimaryButton label="Request account deletion" onPress={() => router.push('/delete-account')} variant="outline" />
        <Text style={styles.updated}>LAST UPDATED · 25 AUGUST 2026</Text>
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
  notice: { ...mobileFrame, gap: spacing.xs, backgroundColor: colors.panel, borderColor: colors.accent, padding: spacing.lg },
  noticeTitle: { color: colors.accent, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  card: { ...mobileFrame, gap: spacing.sm, backgroundColor: colors.panel, padding: spacing.lg },
  heading: { color: colors.white, fontSize: 16, fontWeight: '900', textTransform: 'uppercase' },
  copy: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  updated: { marginTop: spacing.sm, color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1.1, textAlign: 'center' },
});
