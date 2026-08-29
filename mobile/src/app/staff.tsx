import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field, FormInput, PrimaryButton } from '@/components/ui';
import { StaffRecordPublisher } from '@/components/staff-record-publisher';
import { StaffBookingReview } from '@/components/staff-booking-review';
import { StaffServiceCompletion } from '@/components/staff-service-completion';
import { colors, mobileFrame, spacing } from '@/constants/brand';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { CUSTOMER_AUTH } from '@/lib/customer-auth';
import { useCustomerAuth } from '@/lib/customer-auth-context';
import {
  beginStaffTotpEnrollment,
  loadStaffVehiclePhotoUrls,
  loadStaffPortalAccess,
  processBookingIntegrationJobs,
  type BookingIntegrationRunResult,
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

const INTEGRATION_JOB_LABELS: Record<StaffPortalSnapshot['integrationJobs'][number]['job_kind'], string> = {
  notify_customer_booking_confirmed: 'Email customer · booking confirmed',
  notify_customer_cancelled: 'Email customer · request cancelled',
  notify_customer_date_approved: 'Email customer · date approved',
  notify_customer_date_proposed: 'Email customer · alternative date',
  notify_customer_request_received: 'Email customer · request received',
  notify_psi_booking_confirmed: 'Email PSI · booking confirmed',
  notify_psi_request_received: 'Email PSI · new request',
  sync_google_calendar_confirmed: 'Google Calendar · confirmed booking',
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
      onRefresh={refreshStaffAccess}
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
        <Ionicons color={colors.accent} name="shield-checkmark" size={42} />
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
        {loading ? <ActivityIndicator color={colors.accent} size="large" /> : <Ionicons color={colors.accent} name="shield-checkmark" size={42} />}
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
  onRefresh,
  role,
  snapshot,
  verifiedTotpFactors,
}: {
  horizontalPadding: number;
  onRefresh: () => void;
  role: 'owner' | 'staff';
  snapshot: StaffPortalSnapshot;
  verifiedTotpFactors: Extract<StaffPortalAccess, { kind: 'ready' }>['verifiedTotpFactors'];
}) {
  const router = useRouter();
  const [integrationBusy, setIntegrationBusy] = useState(false);
  const [integrationResult, setIntegrationResult] = useState<BookingIntegrationRunResult | null>(null);
  const [integrationError, setIntegrationError] = useState('');
  const [vehiclePhotoUris, setVehiclePhotoUris] = useState<Record<string, string>>({});
  const activeBookings = snapshot.bookings.filter((booking) => !['cancelled', 'completed'].includes(booking.state));
  const waitingIntegrationJobs = snapshot.integrationJobs.filter((job) => ['blocked_configuration', 'failed', 'pending'].includes(job.status));
  const vehiclesByCustomer = useMemo(() => {
    const grouped = new Map<string, StaffPortalSnapshot['vehicles']>();
    snapshot.vehicles.forEach((vehicle) => grouped.set(vehicle.customer_id, [...(grouped.get(vehicle.customer_id) ?? []), vehicle]));
    return grouped;
  }, [snapshot.vehicles]);

  useEffect(() => {
    let active = true;
    void loadStaffVehiclePhotoUrls(snapshot.vehicleFiles)
      .then((urls) => {
        if (active) setVehiclePhotoUris(urls);
      })
      .catch(() => {
        if (active) setVehiclePhotoUris({});
      });
    return () => { active = false; };
  }, [snapshot.vehicleFiles]);

  const processIntegrationQueue = async () => {
    if (integrationBusy) return;
    setIntegrationBusy(true);
    setIntegrationError('');
    try {
      const result = await processBookingIntegrationJobs();
      setIntegrationResult(result);
      onRefresh();
    } catch {
      setIntegrationError('The protected worker could not be reached. Nothing was sent and no Calendar event was created.');
    } finally {
      setIntegrationBusy(false);
    }
  };

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
            <Text style={styles.securityCopy}>Booking review, controlled PSI record publishing, private customer photos and Complete Service are protected by staff authentication and MFA. Email delivery is active. Google Calendar remains limited to later payment-confirmed bookings. Payments, public customer registration and staff management remain disabled.</Text>
          </View>
        </View>

        <View style={styles.securityManagement}>
          <View style={styles.securityManagementHeading}>
            <View style={styles.flex}>
              <Text style={styles.securityTitle}>Authenticator security</Text>
              <Text style={styles.securityCopy}>{verifiedTotpFactors.length} verified authenticator{verifiedTotpFactors.length === 1 ? '' : 's'} connected.</Text>
            </View>
            <Ionicons color={colors.accent} name="key" size={22} />
          </View>
          {verifiedTotpFactors.length === 1 ? <Text style={styles.securityWarning}>Add a backup authenticator before replacing or retiring this device.</Text> : null}
          <PrimaryButton label="Manage authenticators" onPress={() => router.push('/staff-security')} variant="outline" />
        </View>

        <View style={styles.metrics}>
          <Metric label="Customers" value={snapshot.customers.length} />
          <Metric label="Vehicles" value={snapshot.vehicles.length} />
          <Metric label="Active requests" value={activeBookings.length} />
          <Metric label="Deletion requests" value={snapshot.accountDeletionRequests.filter((request) => request.status !== 'completed').length} />
        </View>

        <SectionHeading copy="Customer-initiated requests are visible only to Matt after MFA. Complete the documented storage, retained-record and Auth cleanup before recording completion." title="Account deletion queue" />
        {snapshot.accountDeletionRequests.length === 0 ? <EmptyState>No account deletion requests are currently shown.</EmptyState> : snapshot.accountDeletionRequests.map((request) => {
          const customer = snapshot.customers.find((item) => item.user_id === request.user_id);
          return (
            <View key={request.user_id} style={styles.card}>
              <View style={styles.cardHeading}>
                <Text style={styles.cardTitle}>{customerName(customer)}</Text>
                <Text style={styles.badge}>{humanize(request.status)}</Text>
              </View>
              <Text style={styles.cardCopy}>{customer?.email ?? 'Customer profile pending privacy review'}</Text>
              <Text style={styles.cardMeta}>Requested {formatDateTime(request.requested_at)} · Target completion within 30 days</Text>
              <Text style={styles.contextLine}>Owner procedure required · remove customer uploads and login access; retain or de-identify only records PSI must keep.</Text>
            </View>
          );
        })}

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
              {booking.approved_date ? <Text style={styles.cardMeta}>Workshop date {formatDate(booking.approved_date)}</Text> : null}
              {booking.request_notes ? <Text style={styles.cardCopy}>{booking.request_notes}</Text> : null}
              {bookingContextLines(booking.request_context).map((line, index) => <Text key={`${booking.id}-context-${index}`} style={styles.contextLine}>{line}</Text>)}
              {booking.staff_note ? <Text style={styles.staffNote}>PSI note · {booking.staff_note}</Text> : null}
              <StaffBookingReview booking={booking} onRefresh={onRefresh} />
              <StaffServiceCompletion
                booking={booking}
                customerLabel={customerName(customer)}
                onRefresh={onRefresh}
                vehicleLabel={vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model} · ${vehicle.registration}` : 'Vehicle record unavailable'}
              />
            </View>
          );
        })}

        <SectionHeading copy="Provider-neutral jobs are recorded once for audit and retry safety. Pending means queued only—it does not claim an email was sent or a Calendar event created." title="Email & Calendar queue" />
        <View style={styles.integrationControls}>
          <Text style={styles.securityCopy}>Only Matt&apos;s current AAL2 staff session can start this worker. Resend and Google Calendar credentials are configured as private provider secrets for this QA flow.</Text>
          <Text style={styles.contextLine}>Waiting integration jobs · {waitingIntegrationJobs.length}</Text>
          <PrimaryButton label="Check email & Calendar queue" loading={integrationBusy} onPress={() => void processIntegrationQueue()} variant="outline" />
          {integrationResult ? (
            <Text accessibilityLiveRegion="polite" style={styles.contextLine}>
              Processed {integrationResult.processed} · Email {integrationResult.readiness.emailConfigured ? 'ready' : 'not configured'} · Calendar {integrationResult.readiness.calendarConfigured ? 'ready' : 'not configured'} · Payments intentionally off
            </Text>
          ) : null}
          {integrationError ? <Text accessibilityRole="alert" style={styles.integrationError}>{integrationError}</Text> : null}
        </View>
        {snapshot.integrationJobs.length === 0 ? <EmptyState>No booking integration jobs are currently queued.</EmptyState> : snapshot.integrationJobs.slice(0, 16).map((job) => (
          <View key={job.id} style={styles.card}>
            <View style={styles.cardHeading}>
              <Text style={styles.cardTitle}>{INTEGRATION_JOB_LABELS[job.job_kind]}</Text>
              <Text style={styles.badge}>{humanize(job.status)}</Text>
            </View>
            <Text style={styles.cardMeta}>Booking · {job.booking_request_id.slice(0, 8).toUpperCase()}</Text>
            <Text style={styles.cardCopy}>Queued {formatDateTime(job.created_at)} · Attempts {job.attempt_count}</Text>
            {job.last_error_code ? <Text style={styles.integrationError}>Provider status · {humanize(job.last_error_code)}</Text> : null}
            {job.provider_reference ? <Text style={styles.contextLine}>Provider reference recorded</Text> : null}
          </View>
        ))}

        <SectionHeading copy="Recent protected database activity. This feed records who changed customer, vehicle, booking, workshop record and integration-job data." title="Audit history" />
        {snapshot.auditEvents.length === 0 ? <EmptyState>No audit events are currently shown.</EmptyState> : snapshot.auditEvents.slice(0, 16).map((event) => (
          <View key={event.id} style={styles.auditRow}>
            <Ionicons color={event.actor_kind === 'staff' ? colors.accent : colors.muted} name={event.actor_kind === 'staff' ? 'shield-checkmark' : event.actor_kind === 'customer' ? 'person' : 'cog'} size={18} />
            <View style={styles.flex}>
              <Text style={styles.auditTitle}>{humanize(event.table_name)} · {humanize(event.action)}</Text>
              <Text style={styles.contextLine}>{humanize(event.actor_kind)} · {formatDateTime(event.occurred_at)}</Text>
            </View>
          </View>
        ))}

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
                    {vehiclePhotoUris[vehicle.id] ? (
                      <Image accessibilityLabel={`Private customer photo of ${vehicle.year} ${vehicle.make} ${vehicle.model}`} source={{ uri: vehiclePhotoUris[vehicle.id] }} style={styles.vehiclePhoto} />
                    ) : <Ionicons color={colors.accent} name="car-sport" size={18} />}
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
        <Text style={styles.footer}>AAL2 STAFF ACCESS · PRIVATE STORAGE · AUDITED EMAIL/CALENDAR QUEUE · PAYMENTS DISABLED</Text>
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

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-AU', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    timeZone: 'Australia/Melbourne',
    year: 'numeric',
  });
}

function bookingContextLines(context: Record<string, unknown>) {
  const lines: string[] = [];
  if (typeof context.arrivalArrangement === 'string') lines.push(`Arrival · ${humanize(context.arrivalArrangement)}`);
  if (context.afterHoursCollection === true) lines.push('Collection · After-hours requested');
  if (context.notifyEarlierAvailability === true) lines.push('Earlier opening · Customer asked PSI to make contact');
  if (context.serviceReminderConsent === true) lines.push('Future service reminders · Customer opted in');
  if (typeof context.setupConfidence === 'string') lines.push(`Dyno setup · ${humanize(context.setupConfidence)}`);
  if (context.tuningDetails && typeof context.tuningDetails === 'object' && !Array.isArray(context.tuningDetails)) {
    Object.entries(context.tuningDetails as Record<string, unknown>)
      .filter(([, value]) => typeof value === 'string' && value.trim())
      .slice(0, 10)
      .forEach(([key, value]) => lines.push(`${humanize(key)} · ${humanize(value as string)}`));
  }
  return lines;
}

function humanize(value: string) {
  return value
    .replace(/([a-z])([A-Z])/gu, '$1 $2')
    .replace(/_/gu, ' ')
    .replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  flex: { flex: 1 },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
  stateTitle: { color: colors.white, fontSize: 27, fontWeight: '900', textAlign: 'center' },
  stateCopy: { color: colors.muted, fontSize: 15, lineHeight: 23, maxWidth: 520, textAlign: 'center' },
  mfaScroll: { alignItems: 'center', alignSelf: 'center', width: '100%', maxWidth: 620, paddingBottom: spacing.xxl, paddingTop: spacing.md },
  mfaCard: { ...mobileFrame, alignSelf: 'stretch', backgroundColor: colors.panel, gap: spacing.md, marginTop: spacing.lg, padding: spacing.lg },
  mfaKicker: { color: colors.accent, fontSize: 11, fontWeight: '900', letterSpacing: 1.4, textTransform: 'uppercase' },
  mfaTitle: { color: colors.white, fontSize: 22, fontWeight: '900' },
  mfaCopy: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  qrFrame: { alignItems: 'center', alignSelf: 'center', backgroundColor: colors.white, borderColor: colors.accent, borderWidth: 3, justifyContent: 'center', padding: spacing.sm },
  qrImage: { height: 220, width: 220 },
  manualLabel: { color: colors.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1.1, textTransform: 'uppercase' },
  manualSecret: { backgroundColor: colors.ink, borderColor: colors.line, borderWidth: 1, color: colors.white, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13, letterSpacing: 1.2, padding: spacing.md, textAlign: 'center' },
  errorText: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  scroll: { alignSelf: 'center', width: '100%', maxWidth: 880, paddingBottom: spacing.xxl, paddingTop: spacing.md },
  back: { alignSelf: 'flex-start', paddingVertical: spacing.sm },
  backText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  eyebrow: { color: colors.accent, fontSize: 12, fontWeight: '900', letterSpacing: 1.7, marginTop: spacing.md },
  title: { color: colors.white, fontSize: 38, fontWeight: '900', letterSpacing: -1.2, marginTop: spacing.xs },
  lead: { color: colors.muted, fontSize: 16, lineHeight: 24, marginTop: spacing.sm, maxWidth: 680 },
  securityBanner: { ...mobileFrame, backgroundColor: colors.panel, flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg, padding: spacing.md },
  securityTitle: { color: colors.white, fontSize: 15, fontWeight: '900', textTransform: 'uppercase' },
  securityCopy: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  securityManagement: { ...mobileFrame, gap: spacing.md, backgroundColor: colors.inkSoft, padding: spacing.md },
  securityManagementHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  securityWarning: { color: colors.silver, fontSize: 11, lineHeight: 17 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  metric: { ...mobileFrame, backgroundColor: colors.panelRaised, flexGrow: 1, minWidth: 120, padding: spacing.md },
  metricValue: { color: colors.accent, fontSize: 28, fontWeight: '900' },
  metricLabel: { color: colors.white, fontSize: 12, fontWeight: '800', marginTop: 2, textTransform: 'uppercase' },
  sectionHeading: { marginBottom: spacing.sm, marginTop: spacing.xl },
  sectionTitle: { color: colors.white, fontSize: 23, fontWeight: '900' },
  sectionCopy: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 3 },
  card: { ...mobileFrame, backgroundColor: colors.panel, marginBottom: spacing.sm, padding: spacing.md },
  cardHeading: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  cardTitle: { color: colors.white, flex: 1, fontSize: 17, fontWeight: '900' },
  cardPrimary: { color: colors.white, fontSize: 15, fontWeight: '800', marginTop: spacing.sm },
  cardCopy: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 2 },
  cardMeta: { color: colors.accent, fontSize: 12, fontWeight: '800', marginTop: spacing.xs },
  staffNote: { color: colors.silver, fontSize: 12, fontWeight: '800', lineHeight: 18, marginTop: spacing.xs },
  contextLine: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 2 },
  integrationError: { color: colors.danger, fontSize: 11, fontWeight: '800', lineHeight: 17, marginTop: spacing.xs },
  integrationControls: { ...mobileFrame, backgroundColor: colors.inkSoft, gap: spacing.sm, marginBottom: spacing.sm, padding: spacing.md },
  badge: { borderColor: colors.accentDark, borderWidth: 1, color: colors.accent, fontSize: 10, fontWeight: '900', paddingHorizontal: 8, paddingVertical: 5, textTransform: 'uppercase' },
  vehicleList: { gap: spacing.sm, marginTop: spacing.md },
  vehicleRow: { alignItems: 'center', borderTopColor: colors.line, borderTopWidth: 1, flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.sm },
  vehicleTitle: { color: colors.white, fontSize: 14, fontWeight: '800' },
  vehiclePhoto: { backgroundColor: colors.ink, borderColor: colors.line, borderWidth: 1, height: 54, resizeMode: 'contain', width: 76 },
  auditRow: { ...mobileFrame, alignItems: 'center', backgroundColor: colors.panel, flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs, padding: spacing.sm },
  auditTitle: { color: colors.white, fontSize: 12, fontWeight: '900' },
  empty: { ...mobileFrame, backgroundColor: colors.panel, padding: spacing.lg },
  emptyText: { color: colors.muted, fontSize: 14, textAlign: 'center' },
  footer: { color: colors.mutedDark, fontSize: 10, fontWeight: '900', letterSpacing: 1.1, lineHeight: 16, marginTop: spacing.xl, textAlign: 'center' },
});
