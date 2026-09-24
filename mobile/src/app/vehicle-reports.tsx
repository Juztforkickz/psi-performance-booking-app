import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StaffScrollSelect } from '@/components/staff-scroll-select';
import { PrimaryButton } from '@/components/ui';
import { CustomerVehicleNotes } from '@/components/customer-vehicle-notes';
import { colors } from '@/constants/brand';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { formatAustralianDate } from '@/lib/australian-date';
import { useCustomerAccount } from '@/lib/customer-account-context';
import { useCustomerAuth } from '@/lib/customer-auth-context';
import { CUSTOMER_AUTH } from '@/lib/customer-auth';
import { getAccountReportVehicles } from '@/lib/vehicle-reports-account';
import { loadVaultOverview, REPORT_KINDS, REPORT_LABELS, type VaultOverview } from '@/lib/performance-plus';

const REPORT_CATEGORY_ICONS = {
  service: 'construct-outline',
  recommendation: 'alert-circle-outline',
  dyno: 'speedometer-outline',
  invoice: 'receipt-outline',
  media: 'images-outline',
  modification: 'car-sport-outline',
  document: 'documents-outline',
} as const;

export default function VehicleReportsScreen() {
  const router = useRouter();
  const auth = useCustomerAuth();
  const { account, status, error } = useCustomerAccount();
  const { vehicleId } = useLocalSearchParams<{ vehicleId?: string }>();
  const { horizontalPadding } = useResponsiveLayout();
  const [selected, setSelected] = useState(vehicleId ?? '');
  const vehicles = account ? getAccountReportVehicles(account) : [];
  const vehicle = vehicles.find(item => item.id === selected) ?? vehicles.find(item => item.isPrimary) ?? vehicles[0];
  const signedIn = CUSTOMER_AUTH.enabled && auth.status === 'signed_in';
  return <SafeAreaView edges={['top', 'right', 'left']} style={styles.screen}>
    <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingHorizontal: horizontalPadding }]}>
      <Text style={styles.eyebrow}>YOUR VEHICLE</Text><Text style={styles.title}>Reports</Text>
      {auth.status === 'loading' ? <ActivityIndicator color={colors.accent} /> : !signedIn ? <><Text style={styles.copy}>Sign in to see your vehicle records and add notes for PSI.</Text><PrimaryButton label="Sign in" onPress={() => router.push('/account')} /></>
        : status === 'loading' ? <ActivityIndicator color={colors.accent} />
        : !account || error ? <Text accessibilityRole="alert" style={styles.copy}>{error || 'Your account could not be loaded.'}</Text>
        : !vehicle ? <><Text style={styles.copy}>Add a vehicle to start your report archive.</Text><PrimaryButton label="Open My Garage" onPress={() => router.push('/garage')} /></>
        : <>
          {vehicles.length > 1 ? <StaffScrollSelect
            label="Select vehicle"
            value={vehicle.id}
            options={vehicles.map(item => ({
              value: item.id,
              label: `${item.year} ${item.make} ${item.model}`,
              sublabel: item.registration || 'Registration not recorded',
            }))}
            onChange={setSelected}
          /> : null}
          <View style={styles.vehicle}>
            <Text style={styles.heading}>{vehicle.year} {vehicle.make} {vehicle.model}</Text>
            <Text style={styles.copy}>{vehicle.registration || 'Registration not recorded'}</Text>
            <Text style={styles.muted}>Customer odometer · {vehicle.odometerKm?.toLocaleString('en-AU') ?? 'Not recorded'} km</Text>
            <Text style={styles.muted}>Last PSI service · {vehicle.lastVisit ? formatAustralianDate(vehicle.lastVisit) : 'Not recorded'}</Text>
            <Text style={styles.muted}>Next PSI check-in · {vehicle.nextDue ? formatAustralianDate(vehicle.nextDue) : 'Not scheduled'}{vehicle.nextPsiCheckInOdometerKm ? ' · ' + vehicle.nextPsiCheckInOdometerKm.toLocaleString('en-AU') + ' km' : ''}</Text>
          </View>
          <ReportCategories key={auth.user!.id + ':' + vehicle.id} vehicleId={vehicle.id} />
          <CustomerVehicleNotes key={'notes:' + auth.user!.id + ':' + vehicle.id} vehicleId={vehicle.id} />
        </>}
    </ScrollView>
  </SafeAreaView>;
}

function ReportCategories({ vehicleId }: { vehicleId: string }) {
  const router = useRouter();
  const [overview, setOverview] = useState<VaultOverview | null>(null);
  const [message, setMessage] = useState('');
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  // Recheck whenever a purchase screen closes; no report contents are fetched here.
  useFocusEffect(useCallback(() => {
    let active = true;
    // The refresh revision deliberately invalidates the last overview request.
    void revision;
    void loadVaultOverview(vehicleId).then(value => {
      if (active) { setOverview(value); setMessage(''); }
    }).catch(() => { if (active) { setOverview(null); setMessage('Report access could not be checked. Please refresh.'); } });
    return () => { active = false; };
  }, [vehicleId, revision]));
  const unlocked = overview?.plan === 'performance_plus' &&
    (!overview.expires_at || Date.parse(overview.expires_at) > now);
  return <View style={styles.section}>
    <Text style={styles.eyebrow}>{unlocked ? 'PERFORMANCE+ · UNLOCKED' : 'PERFORMANCE+ · VEHICLE ARCHIVE'}</Text>
    <Text style={styles.copy}>{unlocked
      ? 'Open a category to see your saved records. PSI workshop records are read-only.'
      : 'See what is saved for your car. Performance+ unlocks the records, results, photos and files inside each category.'}</Text>
    {!overview && !message ? <ActivityIndicator color={colors.accent} /> : null}
    {REPORT_KINDS.map(kind => <Pressable key={kind} accessibilityRole="button"
      accessibilityLabel={REPORT_LABELS[kind] + (unlocked ? ', open records' : ', locked, explore Performance+')}
      disabled={!overview}
      onPress={() => router.push({ pathname: unlocked ? '/vehicle-vault' : '/performance-plus', params: { vehicleId, kind } })}
      style={({ pressed }) => [styles.category, pressed && { opacity: 0.8 }]}>
      <Ionicons name={unlocked ? REPORT_CATEGORY_ICONS[kind] : 'lock-closed-outline'} size={22} color={colors.accent} />
      <View style={styles.categoryCopy}>
        <Text style={styles.categoryTitle}>{REPORT_LABELS[kind]}</Text>
        <Text style={styles.muted}>{overview ? kind === 'media'
          ? `${overview.counts[kind] ?? 0} workshop ${(overview.counts[kind] ?? 0) === 1 ? 'photo' : 'photos'}`
          : String(overview.counts[kind] ?? 0) + ((overview.counts[kind] ?? 0) === 1 ? ' saved record' : ' saved records')
          : 'Checking records…'}{unlocked ? '' : ' · Performance+'}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.accent} />
    </Pressable>)}
    {!unlocked ? <>
      <PrimaryButton label="Explore Performance+" onPress={() => router.push({ pathname: '/performance-plus', params: { vehicleId } })} />
      <Text style={styles.muted}>Vehicle details, dates, kilometres, reminders, bookings and your notes stay free. Your original invoice is still emailed as normal.</Text>
    </> : null}
    {message ? <Text accessibilityRole="alert" style={styles.copy}>{message}</Text> : null}
    <PrimaryButton label="Refresh report access" variant="outline" onPress={() => setRevision(value => value + 1)} />
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  content: { width: '100%', maxWidth: 960, alignSelf: 'center', paddingVertical: 24, paddingBottom: 48, gap: 20 },
  title: { fontSize: 32, color: colors.white, fontWeight: '900' },
  eyebrow: { fontSize: 12, color: colors.accent, fontWeight: '800', letterSpacing: 1 },
  heading: { fontSize: 21, color: colors.white, fontWeight: '800' },
  copy: { fontSize: 15, lineHeight: 23, color: colors.silver },
  muted: { fontSize: 13, lineHeight: 20, color: colors.muted },
  vehicle: { padding: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, gap: 8 },
  section: { gap: 14, paddingBottom: 22, borderBottomWidth: 1, borderColor: colors.line },
  category: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, minHeight: 78 },
  categoryCopy: { flex: 1, minWidth: 0, gap: 5 },
  categoryTitle: { fontSize: 16, fontWeight: '800', color: colors.white },
});
