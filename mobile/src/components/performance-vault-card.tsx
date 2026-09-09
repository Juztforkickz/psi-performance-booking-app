import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/brand';

export function PerformanceVaultCard({ vehicleId }: { vehicleId?: string }) {
  const router = useRouter();
  return <Pressable accessibilityRole="button" accessibilityLabel="Explore PSI Performance Plus access and vehicle vault" onPress={() => router.push({ pathname: '/performance-plus', params: vehicleId ? { vehicleId } : {} })} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
    <View style={styles.row}><View style={styles.heading}><Ionicons name="sparkles-outline" size={19} color={colors.accent} /><Text style={styles.label}>PSI PERFORMANCE+</Text></View><Text style={styles.badge}>DIGITAL VEHICLE RECORD</Text></View>
    <Text style={styles.title}>Your car. Its complete story.</Text>
    <Text style={styles.copy}>Unlock every PSI invoice, workshop photo, dyno PDF and build milestone in one secure vehicle history.</Text>
    <Text style={styles.features}>INVOICES · PHOTOS · DYNO · SERVICE HISTORY</Text>
    <View style={styles.actionRow}><Text style={styles.action}>Explore Performance+</Text><Ionicons name="arrow-forward" size={20} color={colors.ink} /></View>
  </Pressable>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: '#0B2029', borderColor: colors.accentDark, borderWidth: 1, borderRadius: 8, padding: 20, gap: 12 },
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
