import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/brand';
import { CUSTOMER_AUTH } from '@/lib/customer-auth';
import { useCustomerAuth } from '@/lib/customer-auth-context';
import { loadVaultOverview, type VaultOverview } from '@/lib/performance-plus';
import { useThemePreference } from '@/lib/theme-preference';

export function PerformanceVaultCard({ vehicleId }: { vehicleId?: string }) {
  const router = useRouter();
  const auth = useCustomerAuth();
  const { theme } = useThemePreference();
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
  const hasPlus = overview?.plan === 'performance_plus' && (!overview.expires_at || Date.parse(overview.expires_at) > now);
  const destination = hasPlus && vehicleId
    ? { pathname: '/vehicle-vault' as const, params: { vehicleId } }
    : { pathname: '/performance-plus' as const, params: vehicleId ? { vehicleId } : {} };

  return <Pressable accessibilityRole="button" accessibilityLabel={hasPlus ? 'Open your PSI Performance Plus vehicle vault' : 'Explore PSI Performance Plus access and vehicle vault'} onPress={() => router.push(destination)} style={({ pressed }) => [styles.card, { backgroundColor: theme.surface, borderColor: theme.lineAccent }, pressed && styles.pressed]}>
    <View style={styles.row}><View style={styles.heading}><Ionicons name="sparkles-outline" size={19} color={theme.accent} /><Text style={[styles.label, { color: theme.accent }]}>PSI PERFORMANCE+</Text></View><Text style={[styles.badge, { color: theme.text, borderColor: theme.border }]}>{hasPlus ? overview?.is_permanent ? 'PERMANENT ACCESS' : 'ACTIVE' : 'DIGITAL VEHICLE RECORD'}</Text></View>
    <Text style={[styles.title, { color: theme.text }]}>{hasPlus ? 'Your complete PSI record.' : 'Your car. Its complete story.'}</Text>
    <Text style={[styles.copy, { color: theme.textMuted }]}>{hasPlus ? 'Your invoices, workshop photos, dyno PDFs and build milestones are ready in your private vehicle history.' : 'Unlock every PSI invoice, workshop photo, dyno PDF and build milestone in one secure vehicle history.'}</Text>
    <Text style={[styles.features, { color: theme.accent }]}>INVOICES · PHOTOS · DYNO · SERVICE HISTORY</Text>
    <View style={[styles.actionRow, { backgroundColor: theme.accent }]}><Text style={[styles.action, { color: theme.textInverse }]}>{hasPlus ? 'Open vehicle vault' : 'Explore Performance+'}</Text><Ionicons name="arrow-forward" size={20} color={theme.textInverse} /></View>
  </Pressable>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: colors.inkSoft, borderColor: colors.accentDark, borderWidth: 1, borderRadius: 8, padding: 20, gap: 12 },
  pressed: { opacity: .82 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { color: colors.accent, fontSize: 13, fontWeight: '900', letterSpacing: 1.4 },
  badge: { color: colors.silver, borderColor: colors.accentDark, borderWidth: 1, borderRadius: 3, paddingHorizontal: 8, paddingVertical: 5, fontSize: 8, fontWeight: '900', letterSpacing: .8 },
  title: { color: colors.white, fontSize: 24, fontWeight: '800' },
  copy: { color: colors.silver, fontSize: 15, lineHeight: 23 },
  features: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: .7, lineHeight: 16 },
  actionRow: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 4, backgroundColor: colors.accent, paddingHorizontal: 14, paddingVertical: 11 },
  action: { color: colors.ink, fontSize: 14, fontWeight: '900' },
});
