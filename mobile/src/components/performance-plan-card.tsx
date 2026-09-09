import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui';
import { mobileFrame, spacing } from '@/constants/brand';
import { useCustomerAccount } from '@/lib/customer-account-context';
import { CUSTOMER_AUTH } from '@/lib/customer-auth';
import { useCustomerAuth } from '@/lib/customer-auth-context';
import { aud, loadVaultOverview, PERFORMANCE_PRICING, type VaultOverview } from '@/lib/performance-plus';
import { useThemePreference } from '@/lib/theme-preference';

const BENEFITS = [
  'Full PSI invoice and service history',
  'Workshop and build photo galleries',
  'Dyno PDFs, figures and comparisons',
  'One chronological vehicle story',
] as const;

export function PerformancePlanCard() {
  const router = useRouter();
  const auth = useCustomerAuth();
  const { account } = useCustomerAccount();
  const { theme } = useThemePreference();
  const vehicleId = account?.vehicles.find(vehicle => vehicle.is_primary)?.id ?? account?.vehicles[0]?.id;
  const [now] = useState(() => Date.now());
  const key = `${auth.user?.id ?? 'preview'}:${vehicleId ?? 'none'}`;
  const [state, setState] = useState<{ key: string; overview: VaultOverview } | null>(null);

  useEffect(() => {
    if (!CUSTOMER_AUTH.enabled || auth.status !== 'signed_in' || !vehicleId) return;
    let active = true;
    void loadVaultOverview(vehicleId).then(value => { if (active) setState({ key, overview: value }); }).catch(() => undefined);
    return () => { active = false; };
  }, [auth.status, vehicleId, key]);

  const overview = state?.key === key ? state.overview : null;
  const activePlus = overview?.plan === 'performance_plus' && (!overview.expires_at || Date.parse(overview.expires_at) > now);
  const permanentPlus = activePlus && overview?.is_permanent;
  const openPerformancePlus = () => router.push({ pathname: '/performance-plus', params: vehicleId ? { vehicleId } : {} });

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.borderStrong }]}>
      <View style={styles.topline}>
        <View style={styles.brandRow}>
          <Ionicons color={theme.accent} name={activePlus ? 'shield-checkmark' : 'sparkles-outline'} size={22} />
          <Text style={[styles.brand, { color: theme.accent }]}>PSI PERFORMANCE+</Text>
        </View>
        <View style={[styles.status, { backgroundColor: activePlus ? theme.accent : theme.surfaceRaised }]}>
          <Text style={[styles.statusText, { color: activePlus ? theme.textInverse : theme.text }]}>{activePlus ? 'ACTIVE' : 'PSI FREE'}</Text>
        </View>
      </View>

      <View style={styles.copyBlock}>
        <Text style={[styles.kicker, { color: theme.textMuted }]}>CURRENT PLAN</Text>
        <Text style={[styles.title, { color: theme.text }]}>{permanentPlus ? 'Performance+ included permanently' : activePlus ? 'Your complete vehicle record is unlocked' : 'Unlock your car’s complete story'}</Text>
        <Text style={[styles.copy, { color: theme.textMuted }]}>{permanentPlus
          ? 'Complimentary PSI owner access · A$0 AUD · no renewal or expiry.'
          : activePlus
            ? 'Open your private invoices, workshop photographs, dyno reports and vehicle history.'
            : `${aud(PERFORMANCE_PRICING.monthly)} monthly or ${aud(PERFORMANCE_PRICING.annual)} annually. One subscription covers every vehicle in your PSI account.`}</Text>
      </View>

      {!activePlus ? <View style={styles.benefits}>{BENEFITS.map(benefit => <View key={benefit} style={styles.benefitRow}><Ionicons color={theme.accent} name="checkmark-circle" size={18} /><Text style={[styles.benefit, { color: theme.text }]}>{benefit}</Text></View>)}</View> : null}

      <PrimaryButton label={activePlus ? 'Open Performance+' : 'Upgrade to Performance+'} onPress={openPerformancePlus} />
      {activePlus && !permanentPlus && Platform.OS === 'ios' ? <Pressable accessibilityRole="button" onPress={() => void Linking.openURL('https://apps.apple.com/account/subscriptions')} style={({ pressed }) => [styles.manage, { borderColor: theme.border }, pressed && styles.pressed]}><Text style={[styles.manageText, { color: theme.accent }]}>Manage Apple subscription</Text><Ionicons color={theme.accent} name="open-outline" size={18} /></Pressable> : null}
      {!permanentPlus ? <Pressable accessibilityRole="button" onPress={openPerformancePlus} style={({ pressed }) => [styles.restore, pressed && styles.pressed]}><Text style={[styles.restoreText, { color: theme.textMuted }]}>{activePlus ? 'View plan and restore purchases' : 'Already subscribed? Restore purchases'}</Text><Ionicons color={theme.textMuted} name="chevron-forward" size={17} /></Pressable> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...mobileFrame, gap: spacing.lg, padding: spacing.lg },
  topline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  brand: { fontSize: 12, fontWeight: '900', letterSpacing: 1.25 },
  status: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  statusText: { fontSize: 9, fontWeight: '900', letterSpacing: .8 },
  copyBlock: { gap: spacing.xs },
  kicker: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  title: { fontSize: 22, fontWeight: '900', lineHeight: 27 },
  copy: { fontSize: 12, lineHeight: 19 },
  benefits: { gap: spacing.sm },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  benefit: { flex: 1, minWidth: 0, fontSize: 12, fontWeight: '700', lineHeight: 18 },
  manage: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1, paddingHorizontal: spacing.md },
  manageText: { fontSize: 11, fontWeight: '900', letterSpacing: .5, textTransform: 'uppercase' },
  restore: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  restoreText: { fontSize: 11, fontWeight: '800' },
  pressed: { opacity: .72 },
});
