import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field, FormInput, PrimaryButton } from '@/components/ui';
import { StaffRecordPublisher } from '@/components/staff-record-publisher';
import { colors, mobileFrame, spacing } from '@/constants/brand';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { CUSTOMER_AUTH } from '@/lib/customer-auth';
import { useCustomerAuth } from '@/lib/customer-auth-context';
import {
  beginStaffTotpEnrollment,
  loadStaffPortalAccess,
  type StaffPortalAccess,
  type StaffPortalSnapshot,
  type StaffTotpEnrollment,
  verifyStaffTotp,
} from '@/lib/staff-portal';

type LoadState =
  | { access: null; status: 'error' | 'loading'; userId: string | null }
  | { access: StaffPortalAccess; status: 'ready'; userId: string };

const BOOKING_STATUS_LABELS: Record<StaffPortalSnapshot['bookings'][number]['state'], string> = {
  cancelled: 'Cancelled',
  completed: 'Completed',
  confirmed: 'Confirmed',
  date_approved: 'Date approved',
  date_proposed: 'Date proposed',
  pending_staff_review: 'Pending review',
};

export default function StaffPortalScreen() {
  const router = useRouter();
  const auth = useCustomerAuth();
  const { horizontalPadding } = useResponsiveLayout();
  const [loadState, setLoadState] = useState<LoadState>({ access: null, status: 'loading', userId: null });
  const [refreshNonce, setRefreshNonce] = useState(0);

  const refreshStaffAccess = () => {
    setLoadState({ access: null, status: 'loading', userId: auth.user?.id ?? null });
    setRefreshNonce((current) => current + 1);
  };

  useEffect(() => {
    if (!CUSTOMER_AUTH.enabled || auth.status !== 'signed_in') return;
    let active = true;
    const userId = auth.user?.id;
    if (!userId) return;
    void loadStaffPortalAccess()
      .then((access) => {
        if (active) setLoadState({ access, status: 'ready', userId });
      })
      .catch(() => {
        if (active) setLoadState({ access: null, status: 'error', userId });
      });
    return () => {
      active = false;
    };
  }, [auth.sessionRevision, auth.status, auth.user?.id, refreshNonce]);

  if (!CUSTOMER_AUTH.enabled) {
    return (
      <PortalState
        copy="The PSI staff portal is unavailable in the public preview. No workshop or customer records are loaded."
        title="Private staff workspace"
      />
    );
  }
  if (auth.status === 'loading') return <PortalState copy="Restoring the protected session…" loading title="Checking staff access" />;
  if (auth.status !== 'signed_in') {
    return (
      <PortalState
        actionLabel="Open secure sign in"
        copy="Sign in with an approved PSI staff email before this private workspace can check staff access."
        onAction={() => router.push({ pathname: '/account', params: { returnTo: '/staff' } })}
        title="Staff sign in required"
      />
    );
  }
  if (loadState.status === 'loading' || loadState.userId !== auth.user?.id) return <PortalState copy="Checking the staff allowlist and MFA level…" loading title="Checking staff access" />;
  if (loadState.status === 'error') {
    return (
      <PortalState
        actionLabel="Try again"
        copy="Staff access could not be verified. No workshop records were loaded."
        onAction={refreshStaffAccess}
        title="Staff portal unavailable"
      />
    );
  }
  const access = loadState.access;
  if (!access) {
    return <PortalState copy="Staff access could not be verified. No workshop records were loaded." title="Staff portal unavailable" />;
  }
  if (access.kind === 'access_denied') {
    return <PortalState copy="This account is not an active PSI staff identity. No workshop records were loaded." title="Access denied" />;
  }
  if (access.kind === 'mfa_required') {
    return (
      <StaffMfaGate
        access={access}
        onVerified={refreshStaffAccess}
      />
    );
  }

  return (
    <StaffWorkspace
      horizontalPadding={horizontalPadding}
      role={access.staff.role}
      snapshot={access.snapshot}
      verifiedTotpFactors={access.verifiedTotpFactors}
    />
  );
}

function StaffMfaGate({
  access,
  onVerified,
}: {
  access: Extract<StaffPortalAccess, { kind: 'mfa_required' }>;
  onVerified: () => void;
}) {
  const router = useRouter();
  const { horizontalPadding } = useResponsiveLayout();
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [enrollment, setEnrollment] = useState<StaffTotpEnrollment | null>(null);
  const [showManualKey, setShowManualKey] = useState(false);
  const verifiedFactor = access.verifiedTotpFactors[0];

  const beginEnrollment = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      setEnrollment(await beginStaffTotpEnrollment());
      setCode('');
      setShowManualKey(false);
    } catch {
      setError('Authenticator setup could not be started. No workshop records were loaded.');
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    const factorId = enrollment?.factorId ?? verifiedFactor?.id;
    if (!factorId || !/^\d{6}$/.test(code.replace(/\s/gu, ''))) {
      setError('Enter the current six-digit code from your authenticator app.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await verifyStaffTotp(factorId, code);
      setCode('');
      setEnrollment(null);
      onVerified();
    } catch {
      setError('That authenticator code could not be verified. Wait for a fresh code and try again.');
    } finally {
      setBusy(false);
    }
  };

  const qrUri = enrollment ? normalizeQrCodeUri(enrollment.qrCode) : '';
  return (
    <SafeAreaView edges={['top', 'right', 'left']} style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.mfaScroll, { paddingHorizontal: horizontalPadding }]} keyboardShouldPersistTaps="handled">
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Ionicons color={colors.gold} name="shield-checkmark" size={42} />
        <Text style={styles.stateTitle}>Authenticator verification required</Text>
        <Text style={styles.stateCopy}>
          Your PSI staff identity is active. A separate authenticator code is required before any workshop-wide customer records can load.
        </Text>

        <View style={styles.mfaCard}>
          {verifiedFactor ? (
            <>
              <Text style={styles.mfaKicker}>Registered authenticator</Text>
              <Text style={styles.mfaTitle}>{verifiedFactor.friendlyName}</Text>
              <Text style={styles.mfaCopy}>Open the authenticator app already linked to this PSI staff account and enter its current code.</Text>
            </>
          ) : enrollment ? (
            <>
              <Text style={styles.mfaKicker}>Private staff setup</Text>
              <Text style={styles.mfaTitle}>Connect an authenticator app</Text>
              <Text style={styles.mfaCopy}>Scan this QR code from Google Authenticator, Microsoft Authenticator, 1Password or another TOTP app. Do not photograph or share this setup key.</Text>
              {Platform.OS === 'web' ? <View style={styles.qrFrame}><Image accessibilityLabel="PSI staff authenticator QR code" source={{ uri: qrUri }} style={styles.qrImage} /></View> : null}
              {Platform.OS !== 'web' ? <PrimaryButton label="Open authenticator app" onPress={() => void Linking.openURL(enrollment.uri)} variant="outline" /> : null}
              <Text style={styles.manualLabel}>Manual setup key</Text>
              {showManualKey ? (
                <Text selectable style={styles.manualSecret}>{enrollment.secret}</Text>
              ) : (
                <PrimaryButton label="Show manual key" onPress={() => setShowManualKey(true)} variant="outline" />
              )}
            </>
          ) : (
            <>
              <Text style={styles.mfaKicker}>Private staff setup</Text>
              <Text style={styles.mfaTitle}>Protect workshop access</Text>
              <Text style={styles.mfaCopy}>Set up a time-based authenticator before opening customer-wide records. The setup secret is shown once and is never stored by this app.</Text>
              <PrimaryButton label="Set up authenticator" loading={busy} onPress={() => void beginEnrollment()} />
            </>
          )}

          {verifiedFactor || enrollment ? (
            <Field error={error} hint="The code changes approximately every 30 seconds" label="Six-digit authenticator code">
              <FormInput
                autoComplete="one-time-code"
                error={error}
                keyboardType="number-pad"
                maxLength={6}
                onChangeText={(value) => {
                  setCode(value.replace(/\D/gu, ''));
                  setError('');
                }}
                placeholder="000000"
                value={code}
              />
            </Field>
          ) : null}
          {error && !verifiedFactor && !enrollment ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
          {verifiedFactor || enrollment ? <PrimaryButton label="Verify and open staff portal" loading={busy} onPress={() => void verify()} /> : null}
        </View>
        <Text style={styles.footer}>NO CUSTOMER RECORDS LOAD BEFORE AAL2 · SETUP DETAILS STAY IN MEMORY ONLY</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function normalizeQrCodeUri(qrCode: string) {
  const svgDataPrefix = 'data:image/svg+xml;utf-8,';
  if (qrCode.startsWith(svgDataPrefix)) {
    return `${svgDataPrefix}${encodeURIComponent(qrCode.slice(svgDataPrefix.length))}`;
  }
  if (qrCode.trimStart().startsWith('<svg')) {
    return `${svgDataPrefix}${encodeURIComponent(qrCode)}`;
  }
  return qrCode;
}

function PortalState({
  actionLabel,
  copy,
  loading = false,
  onAction,
  title,
}: {
  actionLabel?: string;
  copy: string;
  loading?: boolean;
  onAction?: () => void;
  title: string;
}) {
  const router = useRouter();
  const { horizontalPadding } = useResponsiveLayout();
  return (
    <SafeAreaView edges={['top', 'right', 'left']} style={styles.screen}>
      <View style={[styles.state, { paddingHorizontal: horizontalPadding }]}>
        {loading ? <ActivityIndicator color={colors.gold} size="large" /> : <Ionicons color={colors.gold} name="shield-checkmark" size={42} />}
        <Text style={styles.stateTitle}>{title}</Text>
        <Text style={styles.stateCopy}>{copy}</Text>
        {actionLabel && onAction ? <PrimaryButton label={actionLabel} onPress={onAction} /> : null}
        {!loading ? <PrimaryButton label="Back" onPress={() => router.back()} variant="outline" /> : null}
      </View>
    </SafeAreaView>
  );
}

function StaffWorkspace({
  horizontalPadding,
  role,
  snapshot,
  verifiedTotpFactors,
}: {
  horizontalPadding: number;
  role: 'owner' | 'staff';
  snapshot: StaffPortalSnapshot;
  verifiedTotpFactors: Extract<StaffPortalAccess, { kind: 'ready' }>['verifiedTotpFactors'];
}) {
  const router = useRouter();
  const activeBookings = snapshot.bookings.filter((booking) => !['cancelled', 'completed'].includes(booking.state));
  const vehiclesByCustomer = useMemo(() => {
    const grouped = new Map<string, StaffPortalSnapshot['vehicles']>();
    snapshot.vehicles.forEach((vehicle) => grouped.set(vehicle.customer_id, [...(grouped.get(vehicle.customer_id) ?? []), vehicle]));
    return grouped;
  }, [snapshot.vehicles]);

  return (
    <SafeAreaView edges={['top', 'right', 'left']} style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingHorizontal: horizontalPadding }]} showsVerticalScrollIndicator={false}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.eyebrow}>PSI PRIVATE WORKSPACE</Text>
        <Text style={styles.title}>Workshop portal</Text>
        <Text style={styles.lead}>A protected operational workspace for approved PSI staff. Customer-wide access and controlled publishing are protected by the staff allowlist, verified MFA and database row-level policies.</Text>

        <View style={styles.securityBanner}>
          <Ionicons color={colors.success} name="shield-checkmark" size={22} />
          <View style={styles.flex}>
            <Text style={styles.securityTitle}>MFA verified · {role === 'owner' ? 'Owner access' : 'Staff access'}</Text>
            <Text style={styles.securityCopy}>Controlled PSI record publishing is enabled in this private QA build. Calendar actions, customer registration and staff management remain disabled.</Text>
          </View>
        </View>

        <View style={styles.securityManagement}>
          <View style={styles.securityManagementHeading}>
            <View style={styles.flex}>
              <Text style={styles.securityTitle}>Authenticator security</Text>
              <Text style={styles.securityCopy}>{verifiedTotpFactors.length} verified authenticator{verifiedTotpFactors.length === 1 ? '' : 's'} connected.</Text>
            </View>
            <Ionicons color={colors.gold} name="key" size={22} />
          </View>
          {verifiedTotpFactors.length === 1 ? <Text style={styles.securityWarning}>Add a backup authenticator before replacing or retiring this device.</Text> : null}
          <PrimaryButton label="Manage authenticators" onPress={() => router.push('/staff-security')} variant="outline" />
        </View>

        <View style={styles.metrics}>
          <Metric label="Customers" value={snapshot.customers.length} />
          <Metric label="Vehicles" value={snapshot.vehicles.length} />
          <Metric label="Active requests" value={activeBookings.length} />
        </View>

        <SectionHeading copy="Create customer-visible PSI records only after checking the selected customer and vehicle." title="Publish workshop records" />
        <StaffRecordPublisher snapshot={snapshot} />

        <SectionHeading copy="Recent requests visible through the existing MFA-gated staff policies." title="Booking queue" />
        {activeBookings.length === 0 ? <EmptyState>No active booking requests are currently shown.</EmptyState> : activeBookings.slice(0, 12).map((booking) => {
          const vehicle = snapshot.vehicles.find((item) => item.id === booking.vehicle_id);
          const customer = snapshot.customers.find((item) => item.user_id === booking.customer_id);
          return (
            <View key={booking.id} style={styles.card}>
              <View style={styles.cardHeading}>
                <Text style={styles.cardTitle}>{booking.booking_type === 'dyno' ? 'Dyno tuning' : 'Service & report'}</Text>
                <Text style={styles.badge}>{BOOKING_STATUS_LABELS[booking.state]}</Text>
              </View>
              <Text style={styles.cardPrimary}>{customerName(customer)}</Text>
              <Text style={styles.cardCopy}>{vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model} · ${vehicle.registration}` : 'Vehicle record unavailable'}</Text>
              <Text style={styles.cardMeta}>{booking.preferred_date ? `Preferred ${formatDate(booking.preferred_date)}` : 'Customer is flexible on date'}</Text>
            </View>
          );
        })}

        <SectionHeading copy="Customer contact and vehicle ownership remain read-only in this stage." title="Customer and vehicle lookup" />
        {snapshot.customers.length === 0 ? <EmptyState>No active customer accounts are currently shown.</EmptyState> : snapshot.customers.map((customer) => {
          const vehicles = vehiclesByCustomer.get(customer.user_id) ?? [];
          return (
            <View key={customer.user_id} style={styles.card}>
              <Text style={styles.cardTitle}>{customerName(customer)}</Text>
              <Text style={styles.cardCopy}>{customer.email}</Text>
              {customer.mobile ? <Text style={styles.cardCopy}>{customer.mobile}</Text> : null}
              <View style={styles.vehicleList}>
                {vehicles.length === 0 ? <Text style={styles.cardMeta}>No active vehicles.</Text> : vehicles.map((vehicle) => (
                  <View key={vehicle.id} style={styles.vehicleRow}>
                    <Ionicons color={colors.gold} name="car-sport" size={18} />
                    <View style={styles.flex}>
                      <Text style={styles.vehicleTitle}>{vehicle.year} {vehicle.make} {vehicle.model}</Text>
                      <Text style={styles.cardMeta}>{vehicle.registration}{vehicle.is_primary ? ' · Primary vehicle' : ''}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
        <Text style={styles.footer}>PRIVATE QA · AAL2 STAFF PUBLISHING · PRIVATE IMAGE ATTACHMENTS · NO CALENDAR ACTIONS</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function SectionHeading({ copy, title }: { copy: string; title: string }) {
  return <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.sectionCopy}>{copy}</Text></View>;
}

function EmptyState({ children }: { children: string }) {
  return <View style={styles.empty}><Text style={styles.emptyText}>{children}</Text></View>;
}

function customerName(customer: StaffPortalSnapshot['customers'][number] | undefined) {
  if (!customer) return 'Customer record unavailable';
  return [customer.first_name, customer.last_name].filter(Boolean).join(' ') || customer.email;
}

function formatDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  flex: { flex: 1 },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
  stateTitle: { color: colors.white, fontSize: 27, fontWeight: '900', textAlign: 'center' },
  stateCopy: { color: colors.muted, fontSize: 15, lineHeight: 23, maxWidth: 520, textAlign: 'center' },
  mfaScroll: { alignItems: 'center', alignSelf: 'center', width: '100%', maxWidth: 620, paddingBottom: spacing.xxl, paddingTop: spacing.md },
  mfaCard: { ...mobileFrame, alignSelf: 'stretch', backgroundColor: colors.panel, gap: spacing.md, marginTop: spacing.lg, padding: spacing.lg },
  mfaKicker: { color: colors.gold, fontSize: 11, fontWeight: '900', letterSpacing: 1.4, textTransform: 'uppercase' },
  mfaTitle: { color: colors.white, fontSize: 22, fontWeight: '900' },
  mfaCopy: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  qrFrame: { alignItems: 'center', alignSelf: 'center', backgroundColor: colors.white, borderColor: colors.gold, borderWidth: 3, justifyContent: 'center', padding: spacing.sm },
  qrImage: { height: 220, width: 220 },
  manualLabel: { color: colors.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1.1, textTransform: 'uppercase' },
  manualSecret: { backgroundColor: colors.ink, borderColor: colors.line, borderWidth: 1, color: colors.white, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13, letterSpacing: 1.2, padding: spacing.md, textAlign: 'center' },
  errorText: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  scroll: { alignSelf: 'center', width: '100%', maxWidth: 880, paddingBottom: spacing.xxl, paddingTop: spacing.md },
  back: { alignSelf: 'flex-start', paddingVertical: spacing.sm },
  backText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  eyebrow: { color: colors.gold, fontSize: 12, fontWeight: '900', letterSpacing: 1.7, marginTop: spacing.md },
  title: { color: colors.white, fontSize: 38, fontWeight: '900', letterSpacing: -1.2, marginTop: spacing.xs },
  lead: { color: colors.muted, fontSize: 16, lineHeight: 24, marginTop: spacing.sm, maxWidth: 680 },
  securityBanner: { ...mobileFrame, backgroundColor: colors.panel, flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg, padding: spacing.md },
  securityTitle: { color: colors.white, fontSize: 15, fontWeight: '900', textTransform: 'uppercase' },
  securityCopy: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  securityManagement: { ...mobileFrame, gap: spacing.md, backgroundColor: colors.inkSoft, padding: spacing.md },
  securityManagementHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  securityWarning: { color: colors.cream, fontSize: 11, lineHeight: 17 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  metric: { ...mobileFrame, backgroundColor: colors.panelRaised, flexGrow: 1, minWidth: 120, padding: spacing.md },
  metricValue: { color: colors.gold, fontSize: 28, fontWeight: '900' },
  metricLabel: { color: colors.white, fontSize: 12, fontWeight: '800', marginTop: 2, textTransform: 'uppercase' },
  sectionHeading: { marginBottom: spacing.sm, marginTop: spacing.xl },
  sectionTitle: { color: colors.white, fontSize: 23, fontWeight: '900' },
  sectionCopy: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 3 },
  card: { ...mobileFrame, backgroundColor: colors.panel, marginBottom: spacing.sm, padding: spacing.md },
  cardHeading: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  cardTitle: { color: colors.white, flex: 1, fontSize: 17, fontWeight: '900' },
  cardPrimary: { color: colors.white, fontSize: 15, fontWeight: '800', marginTop: spacing.sm },
  cardCopy: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 2 },
  cardMeta: { color: colors.gold, fontSize: 12, fontWeight: '800', marginTop: spacing.xs },
  badge: { borderColor: colors.goldDark, borderWidth: 1, color: colors.gold, fontSize: 10, fontWeight: '900', paddingHorizontal: 8, paddingVertical: 5, textTransform: 'uppercase' },
  vehicleList: { gap: spacing.sm, marginTop: spacing.md },
  vehicleRow: { alignItems: 'center', borderTopColor: colors.line, borderTopWidth: 1, flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.sm },
  vehicleTitle: { color: colors.white, fontSize: 14, fontWeight: '800' },
  empty: { ...mobileFrame, backgroundColor: colors.panel, padding: spacing.lg },
  emptyText: { color: colors.muted, fontSize: 14, textAlign: 'center' },
  footer: { color: colors.mutedDark, fontSize: 10, fontWeight: '900', letterSpacing: 1.1, lineHeight: 16, marginTop: spacing.xl, textAlign: 'center' },
});
