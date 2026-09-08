import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/brand';

export function PerformanceVaultCard({ vehicleId }: { vehicleId?: string }) {
  const router = useRouter();
  return <Pressable accessibilityRole="button" accessibilityLabel="Open PSI Performance Plus vehicle vault" onPress={() => router.push({ pathname: '/performance-plus', params: vehicleId ? { vehicleId } : {} })} style={styles.card}>
    <View style={styles.row}><Text style={styles.label}>PSI PERFORMANCE+</Text><Ionicons name="shield-checkmark-outline" size={24} color={colors.accent} /></View>
    <Text style={styles.title}>Your car. Its complete story.</Text>
    <Text style={styles.copy}>Invoices, workshop photos, dyno PDFs and your build history. Together in your vehicle vault.</Text>
    <View style={styles.row}><Text style={styles.action}>Explore your vault</Text><Ionicons name="arrow-forward" size={20} color={colors.accent} /></View>
  </Pressable>;
}
const styles = StyleSheet.create({ card: { backgroundColor: '#0B2029', borderColor: colors.accentDark, borderWidth: 1, borderRadius: 8, padding: 20, gap: 12 }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, label: { color: colors.accent, fontSize: 13, fontWeight: '900', letterSpacing: 1.4 }, title: { color: colors.white, fontSize: 24, fontWeight: '800' }, copy: { color: colors.silver, fontSize: 15, lineHeight: 23 }, action: { color: colors.accent, fontSize: 15, fontWeight: '700' } });
