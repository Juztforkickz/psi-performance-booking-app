import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field, FormInput, PrimaryButton } from '@/components/ui';
import { CustomerProfileGate } from '@/components/customer-profile-gate';
import { colors, mobileFrame, spacing } from '@/constants/brand';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { useCustomerAccount } from '@/lib/customer-account-context';
import { beginHistoryImportPayment, openHistoryImportCheckout } from '@/lib/history-import';

type Step = 'details' | 'information' | 'review';

const STATUS_COPY = {
  paid: ['Payment received', 'Your request is ready for PSI to begin reviewing.'],
  in_progress: ['PSI is reviewing your history', 'We are locating and organising records that can be confidently matched to this vehicle.'],
  needs_information: ['PSI needs one more detail', 'Check the PSI note below, then contact the workshop with the requested information.'],
  completed: ['Your PSI history is ready', 'Verified older records are now available in this vehicle archive.'],
  cancelled: ['Request closed', 'Contact PSI if you would like to discuss this request.'],
  awaiting_payment: ['Payment not completed', 'Continue to secure checkout when you are ready.'],
} as const;

export default function HistoryImportScreen() {
  return <CustomerProfileGate returnTo="/history-import" requireVehicle feature="requesting your vehicle history"><HistoryImportContent /></CustomerProfileGate>;
}

function HistoryImportContent() {
  const router = useRouter();
  const { vehicleId } = useLocalSearchParams<{ vehicleId?: string }>();
  const { horizontalPadding } = useResponsiveLayout();
  const { account, error, refreshAccount, status } = useCustomerAccount();
  const [step, setStep] = useState<Step>('details');
  const [previousDetails, setPreviousDetails] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useFocusEffect(useCallback(() => {
    refreshAccount();
  }, [refreshAccount]));

  const vehicle = useMemo(() => account?.vehicles.find((item) => item.id === vehicleId)
    ?? account?.vehicles.find((item) => item.is_primary)
    ?? account?.vehicles[0], [account?.vehicles, vehicleId]);
  const request = account?.historyImports.find((item) => item.vehicle_id === vehicle?.id && item.status !== 'cancelled') ?? null;
  const vehicleLabel = vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : '';

  const startCheckout = async () => {
    if (!vehicle || !consent) return;
    setBusy(true);
    setNotice('');
    try {
      const result = await beginHistoryImportPayment(vehicle.id, previousDetails);
      refreshAccount();
      if (result.checkoutUrl) {
        await openHistoryImportCheckout(result.checkoutUrl);
        setNotice('Secure checkout opened. Return here after payment, then refresh your request.');
      } else {
        setNotice('This request has already been paid. PSI can now begin the review.');
      }
    } catch {
      setNotice('Secure checkout could not be opened. Please try again or contact PSI. No payment was taken by this screen.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'right', 'left']} style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: horizontalPadding }]} showsVerticalScrollIndicator={false}>
        <View style={styles.headingRow}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>PSI HISTORY IMPORT</Text>
            <Text style={styles.title}>Bring your PSI history into the{`\u00a0`}app</Text>
          </View>
          <Ionicons color={colors.accent} name="archive-outline" size={34} />
        </View>

        {status === 'loading' ? <ActivityIndicator color={colors.accent} size="large" />
          : error || !account ? <Text accessibilityRole="alert" style={styles.error}>{error || 'Your account could not be loaded.'}</Text>
          : !vehicle ? <View style={styles.card}><Text style={styles.copy}>Add a vehicle before requesting a history import.</Text><PrimaryButton label="Open My Garage" onPress={() => router.replace('/garage')} /></View>
          : request ? <RequestStatus request={request} vehicleLabel={vehicleLabel} onRefresh={refreshAccount} onOpenRecords={() => router.push({ pathname: '/vehicle-reports', params: { vehicleId: vehicle.id } })} />
          : <>
            <View style={styles.vehicleCard}>
              <Ionicons color={colors.accent} name="car-sport" size={25} />
              <View style={styles.flex}>
                <Text style={styles.vehicleTitle}>{vehicleLabel}</Text>
                <Text style={styles.meta}>{vehicle.registration} · One vehicle</Text>
              </View>
            </View>

            {step === 'details' ? <>
              <View style={[styles.card, styles.offerCard]}>
                <Text style={styles.eyebrow}>ONE TIME SERVICE</Text>
                <Text style={styles.heading}>Your history, properly organised.</Text>
                <Text style={styles.copy}>PSI will search for eligible older records and connect verified items to this vehicle.</Text>
                {['Eligible PSI invoices and service records', 'Dyno results and workshop documents', 'Available vehicle photos and reports', 'Permanent access to the completed vehicle archive'].map((item) => <View key={item} style={styles.listRow}><Ionicons color={colors.accent} name="checkmark-circle" size={18} /><Text style={styles.listCopy}>{item}</Text></View>)}
                <View style={styles.priceRow}><Text style={styles.price}>AUD $199</Text><Text style={styles.priceNote}>ONCE ONLY{`\n`}ONE VEHICLE</Text></View>
                <Text style={styles.boundary}>PSI can only import records that can be located and confidently matched to you and this vehicle.</Text>
              </View>
              <PrimaryButton label="Continue" onPress={() => setStep('information')} />
            </> : null}

            {step === 'information' ? <View style={styles.card}>
              <Text style={styles.eyebrow}>STEP 1 OF 2</Text>
              <Text style={styles.heading}>Help PSI find your records</Text>
              <Text style={styles.copy}>Add any previous registration, email address, phone number or other detail PSI may have known you by.</Text>
              <Field hint="Optional, up to 1,000 characters" label="Previous details">
                <FormInput multiline maxLength={1000} onChangeText={setPreviousDetails} placeholder="Previous registration, email or phone" value={previousDetails} />
              </Field>
              <PrimaryButton label="Review request" onPress={() => setStep('review')} />
              <PrimaryButton label="Back" onPress={() => setStep('details')} variant="outline" />
            </View> : null}

            {step === 'review' ? <View style={styles.card}>
              <Text style={styles.eyebrow}>STEP 2 OF 2</Text>
              <Text style={styles.heading}>Review and pay</Text>
              <Summary label="Service" value="PSI history import" />
              <Summary label="Vehicle" value={`${vehicleLabel} · ${vehicle.registration}`} />
              <Summary label="Access" value="Permanent after completion" />
              <Summary label="Total" value="AUD $199" strong />
              <PrimaryButton label={consent ? 'Authorisation confirmed' : 'Confirm authorisation'} onPress={() => setConsent((value) => !value)} variant={consent ? undefined : 'outline'} />
              <Text style={styles.boundary}>By confirming, you authorise PSI to review its workshop records and attach verified history to this vehicle. Payment starts a manual review and does not guarantee that every older record can be located.</Text>
              <PrimaryButton disabled={!consent} label="Pay AUD $199 and submit" loading={busy} onPress={() => void startCheckout()} />
              <PrimaryButton disabled={busy} label="Back" onPress={() => setStep('information')} variant="outline" />
              {notice ? <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}
            </View> : null}
          </>}
      </ScrollView>
    </SafeAreaView>
  );
}

function RequestStatus({ request, vehicleLabel, onRefresh, onOpenRecords }: {
  request: NonNullable<ReturnType<typeof useCustomerAccount>['account']>['historyImports'][number];
  vehicleLabel: string;
  onRefresh: () => void;
  onOpenRecords: () => void;
}) {
  const [title, copy] = STATUS_COPY[request.status];
  const stages = ['Payment received', 'PSI review', 'History organised', 'Import complete'];
  const stageIndex = request.status === 'completed' ? 3 : request.status === 'in_progress' || request.status === 'needs_information' ? 1 : request.payment_status === 'paid' ? 0 : -1;
  return <>
    <View style={styles.vehicleCard}>
      <Ionicons color={colors.accent} name="car-sport" size={25} />
      <View style={styles.flex}><Text style={styles.vehicleTitle}>{vehicleLabel}</Text><Text style={styles.meta}>Request {request.id.slice(0, 8).toUpperCase()}</Text></View>
    </View>
    <View style={[styles.card, request.status === 'completed' && styles.offerCard]}>
      <Ionicons color={colors.accent} name={request.status === 'completed' ? 'checkmark-circle' : 'time-outline'} size={42} />
      <Text style={styles.heading}>{title}</Text>
      <Text style={styles.copy}>{copy}</Text>
      {stages.map((stage, index) => <View key={stage} style={styles.timelineRow}>
        <Ionicons color={index <= stageIndex ? colors.accent : colors.mutedDark} name={index <= stageIndex ? 'checkmark-circle' : 'ellipse-outline'} size={18} />
        <Text style={[styles.listCopy, index <= stageIndex && styles.timelineActive]}>{stage}</Text>
      </View>)}
      {request.staff_note ? <View style={styles.note}><Text style={styles.eyebrow}>PSI NOTE</Text><Text style={styles.copy}>{request.staff_note}</Text></View> : null}
      {request.status === 'completed' ? <PrimaryButton label="Open vehicle records" onPress={onOpenRecords} /> : null}
      {request.payment_status === 'awaiting_payment' && request.provider_checkout_url ? <PrimaryButton label="Resume secure checkout" onPress={() => void openHistoryImportCheckout(request.provider_checkout_url!)} /> : null}
      <PrimaryButton label="Refresh request" onPress={onRefresh} variant="outline" />
    </View>
  </>;
}

function Summary({ label, value, strong = false }: { label: string; strong?: boolean; value: string }) {
  return <View style={styles.summary}><Text style={styles.meta}>{label}</Text><Text style={[styles.summaryValue, strong && styles.summaryStrong]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', gap: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl + spacing.lg },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  flex: { flex: 1, minWidth: 0 },
  eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { color: colors.white, fontSize: 31, lineHeight: 34, fontWeight: '900', textTransform: 'uppercase' },
  heading: { color: colors.white, fontSize: 20, lineHeight: 25, fontWeight: '900', textTransform: 'uppercase' },
  copy: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 20 },
  vehicleCard: { ...mobileFrame, flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.panel, padding: spacing.md },
  vehicleTitle: { color: colors.white, fontSize: 16, fontWeight: '900', textTransform: 'uppercase' },
  meta: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  card: { ...mobileFrame, gap: spacing.md, backgroundColor: colors.panel, padding: spacing.lg },
  offerCard: { borderColor: colors.accent, borderWidth: 2 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: spacing.sm },
  listCopy: { flex: 1, color: colors.silver, fontSize: 12, lineHeight: 18 },
  priceRow: { alignItems: 'flex-start', gap: spacing.xs, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, paddingVertical: spacing.md },
  price: { color: colors.white, fontSize: 29, fontWeight: '900' },
  priceNote: { maxWidth: '100%', color: colors.accent, fontSize: 10, lineHeight: 15, fontWeight: '900', textAlign: 'left' },
  boundary: { color: colors.silver, fontSize: 10, lineHeight: 16 },
  summary: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: spacing.sm },
  summaryValue: { flex: 1, minWidth: 0, color: colors.white, fontSize: 12, fontWeight: '800', textAlign: 'right' },
  summaryStrong: { color: colors.accent, fontSize: 18 },
  notice: { color: colors.silver, fontSize: 11, lineHeight: 17 },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  timelineActive: { color: colors.white, fontWeight: '800' },
  note: { gap: spacing.xs, borderLeftWidth: 3, borderLeftColor: colors.accent, backgroundColor: colors.inkSoft, padding: spacing.md },
});
