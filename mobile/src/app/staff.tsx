import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { type ComponentProps, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Image, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field, FormInput, PrimaryButton } from '@/components/ui';
import { StaffRecordWorkflow } from '@/components/staff-record-workflow';
import { StaffPerformanceAccess, StaffVaultReview } from '@/components/staff-vault-publisher';
import { StaffXeroConnection } from '@/components/staff-xero-connection';
import { StaffBookingReview } from '@/components/staff-booking-review';
import { StaffEventsManager } from '@/components/staff-events-manager';
import { StaffServiceCompletion } from '@/components/staff-service-completion';
import { colors, spacing } from '@/constants/brand';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { useCustomerProfilePhotoUri } from '@/hooks/use-customer-profile-photo-uri';
import { formatAustralianDate, formatAustralianDateTime } from '@/lib/australian-date';
import { CUSTOMER_AUTH } from '@/lib/customer-auth';
import { REVIEW_ENVIRONMENT } from '@/lib/review-environment';
import { useCustomerAuth } from '@/lib/customer-auth-context';
import { useNotifications } from '@/lib/notifications';
import { resolveStaffSection, STAFF_SECTIONS, staffTabForSection, type StaffSection } from '@/lib/staff-navigation';
import { useStaffNavigation } from '@/lib/staff-navigation-context';
import { useStaffExitGuard } from '@/hooks/use-staff-exit-guard';
import { useStaffDiscardConfirmation } from '@/hooks/use-staff-discard-confirmation';
import {
  beginStaffTotpEnrollment,
  completeCustomerAccountDeletion,
  inviteCustomer,
  loadStaffVehiclePhotoUrls,
  loadStaffPortalAccess,
  processBookingIntegrationJobs,
  type BookingIntegrationRunResult,
  type CustomerInvitationResult,
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

type HistoryPeriod = { label: string; value: string };
const portalFrame = { borderWidth: 1, borderColor: colors.line, borderRadius: 10 };

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
  const notifications = useNotifications();
  const portalProfilePhotoUri = useCustomerProfilePhotoUri();
  const params = useLocalSearchParams<{ section?: string; bookingId?: string; customerId?: string; vehicleId?: string; tool?: string; view?: string }>();
  const section = resolveStaffSection(params.section);
  const { registerNavigationHandler } = useStaffNavigation();
  const { confirmDiscard, discardDialog } = useStaffDiscardConfirmation();
  const [actionNotice, setActionNotice] = useState('');
  const [notificationSaving, setNotificationSaving] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const [recordDirty, setRecordDirty] = useState(false);
  const [recordBusy, setRecordBusy] = useState(false);
  const [bookingDirty, setBookingDirty] = useState(false);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [completionDirty, setCompletionDirty] = useState(false);
  const [completionBusy, setCompletionBusy] = useState(false);
  const [eventDirty, setEventDirty] = useState(false);
  const [eventBusy, setEventBusy] = useState(false);
  const [deletionDrafts, setDeletionDrafts] = useState<Record<string, boolean>>({});
  const [deletionActions, setDeletionActions] = useState<Record<string, boolean>>({});
  const [activeDeletionId, setActiveDeletionId] = useState('');
  const reportDeletionDirty = useCallback((id: string, value: boolean) => setDeletionDrafts(previous => previous[id] === value ? previous : { ...previous, [id]: value }), []);
  const reportDeletionBusy = useCallback((id: string, value: boolean) => setDeletionActions(previous => previous[id] === value ? previous : { ...previous, [id]: value }), []);
  const [bookingSearch, setBookingSearch] = useState('');
  const requestedBookingView = paramValue(params.view);
  const bookingFilter = requestedBookingView === 'review' || requestedBookingView === 'history' ? requestedBookingView : 'active';
  const [bookingPage, setBookingPage] = useState(0);
  const [expandedBookingDetailsId, setExpandedBookingDetailsId] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerPage, setCustomerPage] = useState(0);
  const [invitationSearch, setInvitationSearch] = useState('');
  const [invitationPage, setInvitationPage] = useState(0);
  const [deletionFilter, setDeletionFilter] = useState<'pending' | 'history'>('pending');
  const [deletionPage, setDeletionPage] = useState(0);
  const recordBackRef = useRef<(() => void) | null>(null);
  const [recordHasSteps, setRecordHasSteps] = useState(false);
  const registerRecordBack = useCallback((handler: (() => void) | null) => { recordBackRef.current = handler; setRecordHasSteps(Boolean(handler)); }, []);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditPage, setAuditPage] = useState(0);
  const connectionTool = ['xero', 'calendar', 'payments', 'uploads'].includes(paramValue(params.tool)) ? paramValue(params.tool) : '';

  const [integrationBusy, setIntegrationBusy] = useState(false);
  const [integrationResult, setIntegrationResult] = useState<BookingIntegrationRunResult | null>(null);
  const [integrationError, setIntegrationError] = useState('');
  const [invitationEmail, setInvitationEmail] = useState('');
  const [invitationBusy, setInvitationBusy] = useState(false);
  const [invitationError, setInvitationError] = useState('');
  const [invitationNotice, setInvitationNotice] = useState('');
  const [latestInvitation, setLatestInvitation] = useState<CustomerInvitationResult['invitation'] | null>(null);
  const [vehiclePhotoUris, setVehiclePhotoUris] = useState<Record<string, string>>({});
  const [auditPeriod, setAuditPeriod] = useState('');
  const [integrationHistoryOpen, setIntegrationHistoryOpen] = useState(false);
  const [invitationListOpen, setInvitationListOpen] = useState(false);
  const [integrationPeriod, setIntegrationPeriod] = useState('');
  const activeBookings = snapshot.bookings.filter((booking) => !['cancelled', 'completed'].includes(booking.state));
  const archivedBookings = snapshot.bookings.filter((booking) => ['cancelled', 'completed'].includes(booking.state));
  const waitingIntegrationJobs = snapshot.integrationJobs.filter((job) => ['blocked_configuration', 'failed', 'pending', 'processing'].includes(job.status));
  const completedIntegrationJobs = snapshot.integrationJobs.filter((job) => ['cancelled', 'succeeded'].includes(job.status));
  const auditPeriods = useMemo(() => historyPeriods(snapshot.auditEvents.map((event) => event.occurred_at)), [snapshot.auditEvents]);
  const integrationPeriods = useMemo(() => historyPeriods(completedIntegrationJobs.map((job) => job.completed_at ?? job.created_at)), [completedIntegrationJobs]);
  const selectedAuditPeriod = resolveHistoryPeriod(auditPeriod, auditPeriods);
  const selectedIntegrationPeriod = resolveHistoryPeriod(integrationPeriod, integrationPeriods);
  const filteredAuditEvents = snapshot.auditEvents.filter(event => historyPeriodValue(event.occurred_at) === selectedAuditPeriod && matchesSearch(`${humanize(event.table_name)} ${humanize(event.action)} ${event.actor_kind}`, auditSearch));
  const visibleAuditEvents = filteredAuditEvents.slice(auditPage * 8, auditPage * 8 + 8);
  const visibleIntegrationHistory = completedIntegrationJobs.filter((job) => historyPeriodValue(job.completed_at ?? job.created_at) === selectedIntegrationPeriod).slice(0, 24);
  const visibleInvitations = (latestInvitation
    ? [latestInvitation, ...snapshot.invitations.filter((invitation) => invitation.id !== latestInvitation.id)]
    : snapshot.invitations)
    .slice()
    .sort((left, right) => invitationCustomerLabel(left.email, snapshot.customers).localeCompare(invitationCustomerLabel(right.email, snapshot.customers), 'en-AU'));
  const matchingInvitations = visibleInvitations.filter(invitation => matchesSearch(`${invitationCustomerLabel(invitation.email, snapshot.customers)} ${invitation.email}`, invitationSearch));
  const vehiclesByCustomer = useMemo(() => {
    const grouped = new Map<string, StaffPortalSnapshot['vehicles']>();
    snapshot.vehicles.forEach((vehicle) => grouped.set(vehicle.customer_id, [...(grouped.get(vehicle.customer_id) ?? []), vehicle]));
    return grouped;
  }, [snapshot.vehicles]);
  const lookupCustomerOptions = useMemo(() => snapshot.customers
    .slice()
    .sort((left, right) => customerName(left).localeCompare(customerName(right), 'en-AU'))
    .map((customer) => ({ label: customerName(customer), sublabel: customer.email, value: customer.user_id })), [snapshot.customers]);
  const filteredCustomerOptions = lookupCustomerOptions.filter(option => matchesSearch(`${option.label} ${option.sublabel} ${(vehiclesByCustomer.get(option.value) ?? []).map(v => `${v.registration} ${v.make} ${v.model}`).join(' ')}`, customerSearch));
  const selectedLookupCustomer = section === 'customers' ? snapshot.customers.find(customer => customer.user_id === paramValue(params.customerId)) : undefined;
  const selectedLookupVehicles = selectedLookupCustomer ? vehiclesByCustomer.get(selectedLookupCustomer.user_id) ?? [] : [];
  const waitingBookings = activeBookings.filter(b => b.state === 'pending_staff_review');
  const workshopAlerts = notifications.events.filter(event => !event.read_at && event.deep_link === '/staff');
  const customerAlerts = notifications.events.filter(event => !event.read_at && event.deep_link !== '/staff');
  const pendingDeletions = snapshot.accountDeletionRequests.filter(request => request.status !== 'completed');
  const filteredDeletions = snapshot.accountDeletionRequests.filter(request => deletionFilter === 'pending' ? request.status !== 'completed' : request.status === 'completed');
  const selectedBooking = section === 'bookings' ? snapshot.bookings.find(b => b.id === paramValue(params.bookingId)) : undefined;
  const bookingDetailsOpen = Boolean(selectedBooking && expandedBookingDetailsId === selectedBooking.id);
  const filteredBookings = (bookingFilter === 'history' ? archivedBookings : bookingFilter === 'review' ? waitingBookings : activeBookings).filter(booking => {
    const customer = snapshot.customers.find(c => c.user_id === booking.customer_id);
    const vehicle = snapshot.vehicles.find(v => v.id === booking.vehicle_id);
    return matchesSearch(`${customerName(customer)} ${customer?.email ?? ''} ${vehicle?.registration ?? ''} ${vehicle?.make ?? ''} ${vehicle?.model ?? ''}`, bookingSearch);
  });
  const visibleBookings = filteredBookings.slice(bookingPage * 8, bookingPage * 8 + 8);
  const actionBusy = recordBusy || bookingBusy || completionBusy || eventBusy || invitationBusy || integrationBusy || Object.values(deletionActions).some(Boolean);
  const dirty = recordDirty || bookingDirty || completionDirty || eventDirty || Boolean(invitationEmail.trim()) || Object.values(deletionDrafts).some(Boolean);
  const confirmLeaving = useCallback((action: () => void) => {
    if (actionBusy) {
      setActionNotice('Please wait for the current action to finish.');
      return;
    }
    const leave = () => { setRecordDirty(false); setBookingDirty(false); setCompletionDirty(false); setEventDirty(false); setInvitationEmail(''); setDeletionDrafts({}); setActionNotice(''); action(); };
    if (!dirty) { leave(); return; }
    confirmDiscard(leave);
  }, [actionBusy, confirmDiscard, dirty]);
  useStaffExitGuard({ dirty, busy: actionBusy, onConfirmLeave: confirmLeaving });
  const navigate = useCallback((next: StaffSection, extra: Record<string, string> = {}) => {
    confirmLeaving(() => {
      const resetBookingView = next === 'bookings' && !extra.bookingId && (section !== 'bookings' || Boolean(extra.view));
      if (resetBookingView) {
        setBookingSearch(''); setBookingPage(0);
      }
      const nextBookingView = extra.view === 'review' || extra.view === 'history' ? extra.view : 'active';
      router.setParams({ section: next, bookingId: '', customerId: '', vehicleId: '', tool: '', ...extra, view: next === 'bookings' ? resetBookingView ? nextBookingView : bookingFilter : '' });
    });
  }, [bookingFilter, confirmLeaving, router, section]);
  const openPortalAlert = useCallback((event: (typeof notifications.events)[number]) => {
    void notifications.markRead(event.id).catch(() => undefined);
    if (event.deep_link === '/staff') {
      navigate('bookings', event.booking_request_id ? { bookingId: event.booking_request_id } : { view: 'review' });
    } else if (event.deep_link === '/events') {
      confirmLeaving(() => router.push('/events'));
    } else {
      confirmLeaving(() => router.push('/bookings'));
    }
  }, [confirmLeaving, navigate, notifications, router]);
  const goBack = useCallback(() => {
    if (section === 'records' && recordBackRef.current) { recordBackRef.current(); return; }
    if (selectedBooking) navigate('bookings');
    else if (section === 'customers' && params.customerId) navigate('customers');
    else if (section === 'connections' && connectionTool) navigate('connections');
    else if (staffTabForSection(section) !== section) navigate(staffTabForSection(section));
    else navigate('dashboard');
  }, [connectionTool, navigate, params.customerId, section, selectedBooking]);
  useFocusEffect(useCallback(() => registerNavigationHandler(navigate), [navigate, registerNavigationHandler]));
  useEffect(() => { scrollRef.current?.scrollTo({ y: 0, animated: false }); }, [section, params.bookingId, params.customerId, params.tool, bookingPage, customerPage, auditPage, deletionPage]);
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'android') return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (section === 'dashboard') confirmLeaving(() => router.replace('/'));
      else goBack();
      return true;
    });
    return () => listener.remove();
  }, [confirmLeaving, goBack, router, section]));


  useEffect(() => {
    if (section !== 'customers') return;
    let active = true;
    void loadStaffVehiclePhotoUrls(snapshot.vehicleFiles)
      .then((urls) => {
        if (active) setVehiclePhotoUris(urls);
      })
      .catch(() => {
        if (active) setVehiclePhotoUris({});
      });
    return () => { active = false; };
  }, [section, snapshot.vehicleFiles]);

  const processIntegrationQueue = async () => {
    if (integrationBusy) return;
    setIntegrationBusy(true);
    setIntegrationError('');
    try {
      const result = await processBookingIntegrationJobs();
      setIntegrationResult(result);
    } catch {
      setIntegrationError('Delivery status could not be confirmed. Refresh before retrying.');
    } finally {
      setIntegrationBusy(false);
    }
  };

  const approveCustomerAccess = async () => {
    if (invitationBusy) return;
    const normalizedEmail = invitationEmail.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setInvitationError('Enter the customer’s complete email address.');
      setInvitationNotice('');
      return;
    }
    setInvitationBusy(true);
    setInvitationError('');
    setInvitationNotice('');
    try {
      const result = await inviteCustomer(normalizedEmail);
      setInvitationEmail('');
      setLatestInvitation(result.invitation);
      setInvitationNotice(
        REVIEW_ENVIRONMENT.enabled ? `${result.invitation.email} recorded in the sandbox. No email or TestFlight invitation was sent. Use the supplied review customer credentials to inspect customer functionality.` : result.invitation.status === 'profile_complete'
          ? `${result.invitation.email} already has a completed PSI profile. Their account remains approved.`
          : `${result.invitation.email} can now request their own six-digit PSI sign-in code. Add the same email to TestFlight next.`,
      );
    } catch {
      setInvitationError(REVIEW_ENVIRONMENT.enabled ? 'Use demo1@example.invalid through demo5@example.invalid for fictional invitations. No real email is sent.' : 'Customer access could not be approved. Check the email, confirm your authenticator session is current, then try again. No public registration was opened.');
    } finally {
      setInvitationBusy(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'right', 'left']} style={styles.screen}>
      <View style={[styles.workspaceHeader, { paddingHorizontal: horizontalPadding }]}>
        <View style={styles.headerIdentity}>
          <Ionicons color={colors.accent} name="construct-outline" size={23} />
          <View style={styles.flex}>
            <Text style={styles.workspaceBrand}>PSI Workshop</Text>
            <Text style={styles.workspaceStatus}>{REVIEW_ENVIRONMENT.enabled ? 'Demo' : 'Live'} · {role === 'owner' ? 'Owner' : 'Staff'}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Portal settings" onPress={() => navigate('settings')} style={styles.headerButton}>
            {portalProfilePhotoUri ? <Image source={{ uri: portalProfilePhotoUri }} style={styles.headerAvatar} /> : <Ionicons color={colors.accent} name="settings-outline" size={23} />}
          </Pressable>
        </View>
      </View>
      <ScrollView ref={scrollRef} contentContainerStyle={[styles.workspaceContent, { paddingHorizontal: horizontalPadding }]} keyboardShouldPersistTaps="handled">
        <View style={styles.pageHeading}>
          {section !== 'dashboard' ? <Pressable accessibilityRole="button" accessibilityLabel="Back in workshop portal" onPress={goBack} style={styles.pageBack}><Ionicons name="chevron-back" color={colors.accent} size={22} /></Pressable> : null}
          <Text accessibilityRole="header" style={styles.pageTitle}>{selectedBooking ? 'Booking details' : selectedLookupCustomer ? 'Customer details' : connectionTool ? { xero: 'Xero invoices', calendar: 'Email & Calendar', payments: 'Payments', uploads: 'PC uploads' }[connectionTool] : STAFF_SECTIONS[section].title}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Refresh this workspace" disabled={actionBusy} onPress={() => confirmLeaving(() => { onRefresh(); void notifications.refresh(); })} style={styles.headerButton}><Ionicons name="refresh-outline" color={colors.accent} size={21} /></Pressable>
        </View>
        {actionNotice ? <Text accessibilityRole="alert" style={styles.cardMeta}>{actionNotice}</Text> : null}

        {section === 'dashboard' ? <>
          <View style={styles.dashboardMetrics}>
            <DashboardMetric label="To review" value={waitingBookings.length} onPress={() => navigate('bookings', { view: 'review' })} />
            <DashboardMetric label="Active bookings" value={activeBookings.length} onPress={() => navigate('bookings', { view: 'active' })} />
          </View>
          <PortalAlertSummary customerCount={notifications.customerUnreadCount} onPress={() => navigate('alerts')} pushReady={notifications.pushStatus === 'ready'} staffCount={notifications.staffUnreadCount} />
          <PrimaryButton label="Add vehicle record" onPress={() => navigate('records')} />
          <WorkspaceLink title="Find customer or vehicle" detail="Search name, email or registration" icon="search-outline" onPress={() => navigate('customers')} />
          {waitingIntegrationJobs.length || (role === 'owner' && pendingDeletions.length) ? <>
            <Text style={styles.groupLabel}>Needs attention</Text>
            {waitingIntegrationJobs.length ? <WorkspaceLink title="Email & Calendar" detail={`${waitingIntegrationJobs.length} deliveries to check`} icon="mail-outline" onPress={() => navigate('connections', { tool: 'calendar' })} /> : null}
            {role === 'owner' && pendingDeletions.length ? <WorkspaceLink title="Account requests" detail={`${pendingDeletions.length} awaiting review`} icon="person-circle-outline" onPress={() => navigate('deletion')} /> : null}
          </> : <Text style={styles.cardCopy}>No other items need attention.</Text>}
        </> : null}

        {section === 'alerts' ? <>
          <View style={[styles.notificationSetup, notifications.pushStatus === 'ready' && styles.notificationSetupReady]}>
            <Ionicons color={notifications.pushStatus === 'ready' ? colors.success : colors.accent} name={notifications.pushStatus === 'ready' ? 'notifications' : 'notifications-outline'} size={24} />
            <View style={styles.flex}>
              <Text style={styles.cardTitle}>{notifications.pushStatus === 'ready' ? 'Device alerts are on' : 'Turn on device alerts'}</Text>
              <Text style={styles.cardCopy}>{notifications.pushStatus === 'ready' ? 'This phone can show banners, sounds and app-icon badges.' : 'Register this phone so new enquiries are visible even when PSI is closed.'}</Text>
            </View>
          </View>
          {notifications.pushStatus !== 'ready' && !REVIEW_ENVIRONMENT.enabled ? <PrimaryButton label={notificationSaving ? 'Enabling alerts…' : 'Enable device alerts'} loading={notificationSaving} onPress={() => {
            setNotificationSaving(true);
            setActionNotice('');
            void notifications.enablePush()
              .then(() => setActionNotice('Device alerts are enabled on this phone.'))
              .catch((error) => setActionNotice(portalNotificationError(error)))
              .finally(() => setNotificationSaving(false));
          }} /> : null}
          <View style={styles.alertLegend}>
            <AlertCountBadge color="#2D9CDB" label="PSI workshop" value={notifications.staffUnreadCount} />
            <AlertCountBadge color="#D92D20" label="My account" value={notifications.customerUnreadCount} />
          </View>
          <View style={styles.sectionHeadingRow}>
            <Text style={styles.groupLabel}>Workshop enquiries</Text>
            {notifications.staffUnreadCount ? <Pressable accessibilityRole="button" onPress={() => void Promise.all(workshopAlerts.map(event => notifications.markRead(event.id)))}><Text style={styles.inlineActionText}>Mark PSI read</Text></Pressable> : null}
          </View>
          {workshopAlerts.length ? workshopAlerts.slice(0, 8).map(event => <PortalAlertRow color="#2D9CDB" event={event} key={event.id} onPress={() => openPortalAlert(event)} />) : <EmptyState>No workshop alerts need attention.</EmptyState>}
          <Text style={styles.groupLabel}>My customer account</Text>
          {customerAlerts.length ? customerAlerts.slice(0, 6).map(event => <PortalAlertRow color="#D92D20" event={event} key={event.id} onPress={() => openPortalAlert(event)} />) : <EmptyState>No personal account alerts need attention.</EmptyState>}
          <WorkspaceLink title="All alerts & preferences" detail="Read history, sounds and notification choices" icon="options-outline" onPress={() => confirmLeaving(() => router.push('/alerts'))} />
        </> : null}

        {section === 'bookings' ? selectedBooking ? <>
          {[selectedBooking].map((booking) => {
          const vehicle = snapshot.vehicles.find((item) => item.id === booking.vehicle_id);
          const customer = snapshot.customers.find((item) => item.user_id === booking.customer_id);
          return (
            <View key={booking.id} style={styles.card}>
              <View style={styles.cardHeading}>
                <Text style={styles.cardTitle}>{booking.booking_type === 'dyno' ? 'Dyno tuning' : 'Service & report'}</Text>
                <Text style={styles.badge}>{BOOKING_STATUS_LABELS[booking.state]}</Text>
              </View>
              <Text style={styles.cardPrimary}>{customerName(customer)}</Text>
              <View style={styles.contactPanel}>
                <View style={styles.flex}>
                  <Text selectable style={styles.contactValue}>{customer?.email ?? 'Email not supplied'}</Text>
                  <Text selectable style={styles.contactValue}>{customer?.mobile || 'Mobile not supplied'}</Text>
                </View>
                <View style={styles.contactActions}>
                  {customer?.email ? <ContactAction icon="mail-outline" label="Email" onPress={() => void openCustomerEmail(customer.email, booking.id, booking.request_notes)} /> : null}
                  {customer?.mobile ? <ContactAction icon="call-outline" label="Call" onPress={() => void Linking.openURL(`tel:${customer.mobile!.replace(/[^+\d]/g, '')}`)} /> : null}
                </View>
              </View>
              <Text style={styles.cardCopy}>{vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model} · ${vehicle.registration}` : 'Vehicle record unavailable'}</Text>
              <Text style={styles.cardMeta}>{booking.approved_date ? `Workshop date ${formatDate(booking.approved_date)}` : booking.preferred_date ? `Requested ${formatDate(booking.preferred_date)}` : 'Flexible date'}</Text>
              <Text style={styles.enquiryLabel}>Customer enquiry</Text>
              <Text style={styles.enquiryCopy}>{booking.request_notes || 'No additional enquiry notes supplied.'}</Text>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: bookingDetailsOpen }} onPress={() => setExpandedBookingDetailsId(bookingDetailsOpen ? null : selectedBooking.id)} style={styles.disclosure}>
                <Text style={styles.inlineActionText}>Visit details & notes</Text><Ionicons name={bookingDetailsOpen ? 'chevron-up' : 'chevron-down'} color={colors.accent} size={18} />
              </Pressable>
              {bookingDetailsOpen ? <View style={styles.detailStack}>
                {booking.approved_date && booking.preferred_date ? <Text style={styles.contextLine}>Originally requested {formatDate(booking.preferred_date)}</Text> : null}
                {bookingContextLines(booking.request_context).map((line, index) => <Text key={`${booking.id}-context-${index}`} style={styles.contextLine}>{line}</Text>)}
                {booking.staff_note ? <Text style={styles.staffNote}>PSI note · {booking.staff_note}</Text> : <Text style={styles.contextLine}>No staff note added.</Text>}
              </View> : null}
              <StaffBookingReview booking={booking} onRefresh={onRefresh} onDirtyChange={setBookingDirty} onBusyChange={setBookingBusy} />
              <StaffServiceCompletion
                booking={booking}
                onDirtyChange={setCompletionDirty}
                onBusyChange={setCompletionBusy}
                customerLabel={customerName(customer)}
                onRefresh={onRefresh}
                vehicleLabel={vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model} · ${vehicle.registration}` : 'Vehicle record unavailable'}
              />
            </View>
          );
        })}

          <WorkspaceLink title="Add a vehicle record" icon="add-circle-outline" onPress={() => navigate('records', { customerId: selectedBooking.customer_id, vehicleId: selectedBooking.vehicle_id })} />
        </> : <>
          <View style={styles.filterRow}>{(['active', 'review', 'history'] as const).map(filter => <Pressable key={filter} accessibilityRole="button" accessibilityState={{ selected: bookingFilter === filter }} onPress={() => { router.setParams({ view: filter }); setBookingPage(0); }} style={[styles.filterButton, bookingFilter === filter && styles.filterSelected]}><Text style={styles.filterText}>{filter === 'active' ? 'Active' : filter === 'review' ? 'To review' : 'History'}</Text></Pressable>)}</View>
          <Field label="Find booking"><FormInput value={bookingSearch} onChangeText={v => { setBookingSearch(v); setBookingPage(0); }} placeholder="Customer, registration or vehicle" /></Field>
          <Text style={styles.cardCopy}>{filteredBookings.length} booking{filteredBookings.length === 1 ? '' : 's'}{bookingFilter === 'review' ? ' awaiting review' : bookingFilter === 'history' ? ' in history' : ''}</Text>
          {visibleBookings.length ? visibleBookings.map(booking => {
            const customer = snapshot.customers.find(c => c.user_id === booking.customer_id);
            const vehicle = snapshot.vehicles.find(v => v.id === booking.vehicle_id);
            return <WorkspaceLink key={booking.id} title={customerName(customer)} detail={[vehicle ? `${vehicle.make} ${vehicle.model} · ${vehicle.registration}` : 'Vehicle unavailable', booking.approved_date ? formatDate(booking.approved_date) : booking.preferred_date ? formatDate(booking.preferred_date) : 'Flexible date', BOOKING_STATUS_LABELS[booking.state]].join(' · ')} icon={booking.booking_type === 'dyno' ? 'speedometer-outline' : 'car-sport-outline'} onPress={() => navigate('bookings', { bookingId: booking.id })} />;
          }) : <EmptyState>No bookings match this view.</EmptyState>}
          <Pagination page={bookingPage} total={filteredBookings.length} onChange={setBookingPage} />
        </> : null}

        {section === 'customers' ? <>
          {selectedLookupCustomer ? <>
              <View style={styles.lookupCustomerCard}>
                <View style={styles.lookupIdentity}>
                  <View style={styles.lookupInitials}><Text style={styles.lookupInitialsText}>{customerInitials(selectedLookupCustomer)}</Text></View>
                  <View style={styles.flex}>
                    <Text style={styles.cardTitle}>{customerName(selectedLookupCustomer)}</Text>
                    <Text selectable style={styles.cardCopy}>{selectedLookupCustomer.email}</Text>
                    {selectedLookupCustomer.mobile ? <Text selectable style={styles.cardCopy}>{selectedLookupCustomer.mobile}</Text> : null}
                  </View>
                </View>
              </View>
                <Text style={styles.groupLabel}>Vehicles</Text>
                <View style={styles.vehicleList}>
                  {selectedLookupVehicles.length === 0 ? <Text style={styles.cardMeta}>No active vehicles.</Text> : selectedLookupVehicles.map((vehicle) => (
                    <View key={vehicle.id} style={styles.vehicleRow}>
                      {vehiclePhotoUris[vehicle.id] ? (
                        <Image accessibilityLabel={`Private customer photo of ${vehicle.year} ${vehicle.make} ${vehicle.model}`} resizeMode="contain" source={{ uri: vehiclePhotoUris[vehicle.id] }} style={styles.vehiclePhoto} />
                      ) : <Ionicons color={colors.accent} name="car-sport" size={18} />}
                      <View style={styles.flex}>
                        <Text style={styles.vehicleTitle}>{vehicle.year} {vehicle.make} {vehicle.model}</Text>
                        <Text style={styles.cardMeta}>{vehicle.registration}{vehicle.is_primary ? ' · Primary vehicle' : ''}</Text>
                        <Pressable accessibilityRole="button" onPress={() => navigate('records', { customerId: selectedLookupCustomer.user_id, vehicleId: vehicle.id })} style={styles.inlineAction}><Text style={styles.inlineActionText}>Add vehicle record →</Text></Pressable>
                      </View>
                    </View>
                  ))}
                </View>
            {role === 'owner' ? <WorkspaceLink title="Performance+ access" icon="add-circle-outline" onPress={() => navigate('access', { customerId: selectedLookupCustomer.user_id })} /> : null}
          </> : <>
            {paramValue(params.customerId) ? <Text accessibilityRole="alert" style={styles.errorText}>That customer is no longer in the active list. Select a customer below.</Text> : null}
            <Field label="Find customer or vehicle"><FormInput value={customerSearch} onChangeText={value => { setCustomerSearch(value); setCustomerPage(0); }} placeholder="Name, email or registration" /></Field>
            <Text style={styles.cardCopy}>{filteredCustomerOptions.length} customer{filteredCustomerOptions.length === 1 ? '' : 's'}</Text>
            {filteredCustomerOptions.slice(customerPage * 8, customerPage * 8 + 8).map(option => {
              const vehicleCount = (vehiclesByCustomer.get(option.value) ?? []).length;
              return <WorkspaceLink key={option.value} title={option.label} detail={`${option.sublabel} · ${vehicleCount} vehicle${vehicleCount === 1 ? '' : 's'}`} icon="person-outline" onPress={() => navigate('customers', { customerId: option.value })} />;
            })}
            {filteredCustomerOptions.length === 0 ? <EmptyState>No customers match your search.</EmptyState> : null}
            <Pagination page={customerPage} total={filteredCustomerOptions.length} onChange={setCustomerPage} />
            {role === 'owner' ? <>
            <Text style={styles.groupLabel}>Manage accounts</Text>
            <WorkspaceLink title="Invite customer" icon="person-add-outline" onPress={() => navigate('invitations')} />
            <WorkspaceLink title="Account requests" detail={`${pendingDeletions.length} awaiting review`} icon="person-remove-outline" onPress={() => navigate('deletion')} />
            </> : null}
          </>}
        </> : null}

        {section === 'records' ? <>
          <StaffRecordWorkflow snapshot={snapshot} customerId={paramValue(params.customerId)} vehicleId={paramValue(params.vehicleId)} onBackHandlerChange={registerRecordBack} onDirtyChange={setRecordDirty} onBusyChange={setRecordBusy} />
          {!recordHasSteps ? <WorkspaceLink title="Imports & drafts" icon="file-tray-outline" onPress={() => navigate('imports')} /> : null}
        </> : null}
        {section === 'imports' ? <StaffVaultReview /> : null}
        {section === 'access' ? role === 'owner' ? <StaffPerformanceAccess snapshot={snapshot} customerId={paramValue(params.customerId)} onDirtyChange={setRecordDirty} onBusyChange={setRecordBusy} /> : <EmptyState>Owner access is required.</EmptyState> : null}
        {section === 'invitations' ? role === 'owner' ? <>
                  {role === 'owner' ? (
          <>
            <Text style={styles.cardCopy}>Approve their email, then invite them to TestFlight.</Text>
            <View style={styles.invitationPanel}>
              <Field error={invitationError} hint={REVIEW_ENVIRONMENT.enabled ? 'Demo only: demo1@example.invalid through demo5@example.invalid' : 'Use the same email for PSI access and the Apple TestFlight invitation'} label="Customer email">
                <FormInput
                  editable={!invitationBusy}
                  autoCapitalize="none"
                  autoComplete="email"
                  error={invitationError}
                  keyboardType="email-address"
                  maxLength={160}
                  onChangeText={(value) => {
                    setInvitationEmail(value);
                    setInvitationError('');
                    setInvitationNotice('');
                  }}
                  placeholder="customer@example.com"
                  value={invitationEmail}
                />
              </Field>
              <PrimaryButton label="Approve PSI account" loading={invitationBusy} onPress={() => void approveCustomerAccess()} />
              {invitationNotice ? <Text accessibilityLiveRegion="polite" style={styles.invitationNotice}>{invitationNotice}</Text> : null}
              {!REVIEW_ENVIRONMENT.enabled ? <><View style={styles.testFlightStep}>
                <Ionicons color={colors.accent} name="logo-apple" size={22} />
                <View style={styles.flex}>
                  <Text style={styles.securityTitle}>TestFlight invitation</Text>
                  <Text style={styles.securityCopy}>Use the same email in App Store Connect so the customer can install PSI.</Text>
                </View>
              </View>
              <PrimaryButton
                label="Open TestFlight setup"
                onPress={() => void Linking.openURL('https://appstoreconnect.apple.com/apps/6806902732/testflight')}
                variant="outline"
              />
              </> : null}
            </View>
            <View style={styles.approvedAccountsPanel}>
              <Pressable
                accessibilityLabel={`${visibleInvitations.length} approved customer accounts`}
                accessibilityRole="button"
                accessibilityState={{ expanded: invitationListOpen }}
                onPress={() => setInvitationListOpen((current) => !current)}
                style={({ pressed }) => [styles.historyHeading, pressed && styles.pressed]}
              >
                <View style={styles.flex}>
                  <Text style={styles.historyTitle}>Approved customer accounts</Text>
                  <Text style={styles.historyMeta}>{visibleInvitations.length} account{visibleInvitations.length === 1 ? '' : 's'} · alphabetical</Text>
                </View>
                <Ionicons color={colors.accent} name={invitationListOpen ? 'chevron-up' : 'chevron-down'} size={22} />
              </Pressable>
              {invitationListOpen ? <>
              <Field label="Find approved account"><FormInput value={invitationSearch} onChangeText={value => { setInvitationSearch(value); setInvitationPage(0); }} placeholder="Name or email" /></Field>
              <Pagination page={invitationPage} total={matchingInvitations.length} onChange={setInvitationPage} />
              {matchingInvitations.slice(invitationPage * 8, invitationPage * 8 + 8).map((invitation) => {
                const profileLabel = invitationCustomerLabel(invitation.email, snapshot.customers);
                return (
                  <View key={invitation.id} style={styles.invitationRow}>
                    <View style={styles.flex}>
                      <Text style={styles.cardTitle}>{profileLabel}</Text>
                      {profileLabel !== invitation.email ? <Text style={styles.cardCopy}>{invitation.email}</Text> : null}
                      <Text style={styles.cardMeta}>Approved {formatDateTime(invitation.invited_at)}</Text>
                    </View>
                    <Text style={styles.badge}>{invitation.status === 'profile_complete' ? 'Profile ready' : 'Profile pending'}</Text>
                  </View>
                );
              })}
              {matchingInvitations.length === 0 ? <Text style={styles.cardCopy}>No approved accounts match.</Text> : null}
              </> : null}
            </View>
          </>
        ) : null}

        </> : <EmptyState>Owner access is required.</EmptyState> : null}
        {section === 'deletion' ? role === 'owner' ? <>
        <Text style={styles.cardCopy}>Review customer requests to close their accounts.</Text>
        <View style={styles.filterRow}>{(['pending', 'history'] as const).map(filter => <Pressable key={filter} accessibilityRole="button" accessibilityState={{ selected: deletionFilter === filter }} onPress={() => confirmLeaving(() => { setDeletionFilter(filter); setDeletionPage(0); setActiveDeletionId(''); })} style={[styles.filterButton, deletionFilter === filter && styles.filterSelected]}><Text style={styles.filterText}>{filter === 'pending' ? 'Awaiting review' : 'Completed'}</Text></Pressable>)}</View>
        {filteredDeletions.length === 0 ? <EmptyState>No account requests in this view.</EmptyState> : filteredDeletions.slice(deletionPage * 8, deletionPage * 8 + 8).map((request) => {
          const customer = snapshot.deletionCustomers.find((item) => item.user_id === request.user_id);
          const expanded = activeDeletionId === request.user_id;
          return <AccountDeletionRequestCard
            customer={customer}
            key={`${request.user_id}:${expanded ? 'open' : 'closed'}`}
            expanded={expanded}
            disabled={actionBusy}
            onToggleExpanded={() => confirmLeaving(() => setActiveDeletionId(expanded ? '' : request.user_id))}
            onComplete={onRefresh}
            onDirtyChange={reportDeletionDirty}
            onBusyChange={reportDeletionBusy}
            owner={role === 'owner'}
            request={request}
          />;
        })}
        <Pagination page={deletionPage} total={filteredDeletions.length} onChange={page => confirmLeaving(() => { setDeletionPage(page); setActiveDeletionId(''); })} />

        </> : <EmptyState>Owner access is required.</EmptyState> : null}
        {section === 'events' ? <StaffEventsManager onDirtyChange={setEventDirty} onBusyChange={setEventBusy} /> : null}

        {section === 'menu' ? <>
          <WorkspaceLink title="PSI events" detail="Upcoming events and customer announcements" icon="flag-outline" onPress={() => navigate('events')} />
          <WorkspaceLink title="Connections" detail="Xero, payments, email and Calendar" icon="link-outline" onPress={() => navigate('connections')} />
          <WorkspaceLink title="Activity history" icon="time-outline" onPress={() => navigate('history')} />
          <WorkspaceLink title="Return to customer app" icon="phone-portrait-outline" onPress={() => confirmLeaving(() => router.replace('/'))} />
          <WorkspaceLink title="Settings" detail="Account and authenticator security" icon="settings-outline" onPress={() => navigate('settings')} />
        </> : null}

        {section === 'connections' ? !connectionTool ? <>
          {role === 'owner' ? <WorkspaceLink title="Xero invoices" detail={REVIEW_ENVIRONMENT.enabled ? 'Unavailable in the demo' : 'Connection and organisation verification'} icon="receipt-outline" onPress={() => navigate('connections', { tool: 'xero' })} /> : null}
          <WorkspaceLink title="Email & Calendar" detail={`${waitingIntegrationJobs.length} waiting delivery jobs`} icon="calendar-outline" onPress={() => navigate('connections', { tool: 'calendar' })} />
          <WorkspaceLink title="Payments" detail="Setup pending" icon="card-outline" onPress={() => navigate('connections', { tool: 'payments' })} />
          <WorkspaceLink title="Workshop PC uploads" detail="Verified folders for photos and dyno PDFs" icon="desktop-outline" onPress={() => navigate('connections', { tool: 'uploads' })} />
        </> : connectionTool === 'xero' ? role === 'owner' && !REVIEW_ENVIRONMENT.enabled ? <StaffXeroConnection /> : <EmptyState>Xero setup is available to the owner in the live portal.</EmptyState> : connectionTool === 'calendar' ? <>
        <View style={styles.integrationControls}>
          <View style={styles.queueStatusRow}>
            <Ionicons color={waitingIntegrationJobs.length ? colors.danger : colors.success} name={waitingIntegrationJobs.length ? 'alert-circle' : 'checkmark-circle'} size={22} />
            <View style={styles.flex}>
              <Text style={styles.securityTitle}>{waitingIntegrationJobs.length ? `${waitingIntegrationJobs.length} job${waitingIntegrationJobs.length === 1 ? '' : 's'} need attention` : 'No waiting deliveries in this snapshot'}</Text>
              <Text style={styles.securityCopy}>{REVIEW_ENVIRONMENT.enabled ? 'External email and Calendar delivery are deliberately disabled. Queue entries demonstrate the workflow without contacting anyone or creating appointments.' : 'Confirmed bookings can create email and Calendar jobs. Processing checks the current connection status.'}</Text>
            </View>
          </View>
          <PrimaryButton label="Process waiting deliveries" loading={integrationBusy} onPress={() => void processIntegrationQueue()} variant="outline" />
          {integrationResult ? (
            <View accessibilityLiveRegion="polite" style={styles.integrationSuccess}>
              <Ionicons color={colors.success} name="checkmark-circle" size={20} />
              <View style={styles.flex}>
                <Text style={styles.integrationSuccessTitle}>Queue check complete</Text>
                <Text style={styles.integrationSuccessCopy}>{REVIEW_ENVIRONMENT.enabled ? 'Sandbox queue checked. No emails were sent and no Calendar events were created. External delivery remains disabled.' : `${integrationResult.processed === 0 ? 'No waiting jobs were found.' : `${integrationResult.processed} waiting job${integrationResult.processed === 1 ? '' : 's'} checked.`} Email ${integrationResult.readiness.emailConfigured ? 'connected' : 'needs configuration'} · Calendar ${integrationResult.readiness.calendarConfigured ? 'connected' : 'needs configuration'} · Payments ${integrationResult.readiness.paymentsConfigured ? 'connected' : 'needs configuration'}.`}</Text>
              </View>
            </View>
          ) : null}
          {integrationResult?.processed ? <PrimaryButton label="Refresh portal records" onPress={onRefresh} /> : null}
          {integrationError ? <Text accessibilityRole="alert" style={styles.integrationError}>{integrationError}</Text> : null}
        </View>
        {waitingIntegrationJobs.slice(0, 8).map((job) => (
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
        {waitingIntegrationJobs.length > 8 ? <Text style={styles.cardCopy}>Showing the first 8 of {waitingIntegrationJobs.length} waiting deliveries.</Text> : null}

        {completedIntegrationJobs.length ? (
          <View style={styles.historyPanel}>
            <Pressable accessibilityRole="button" onPress={() => setIntegrationHistoryOpen((current) => !current)} style={({ pressed }) => [styles.historyHeading, pressed && styles.pressed]}>
              <View style={styles.flex}>
                <Text style={styles.historyTitle}>Completed delivery history</Text>
                <Text style={styles.historyMeta}>{completedIntegrationJobs.length} recorded job{completedIntegrationJobs.length === 1 ? '' : 's'}</Text>
              </View>
              <Ionicons color={colors.accent} name={integrationHistoryOpen ? 'chevron-up' : 'chevron-down'} size={22} />
            </Pressable>
            {integrationHistoryOpen ? (
              <>
                <HistoryDropdown label="Month and year" onChange={setIntegrationPeriod} options={integrationPeriods} value={selectedIntegrationPeriod} />
                {visibleIntegrationHistory.map((job) => (
                  <View key={job.id} style={styles.compactHistoryRow}>
                    <Ionicons color={job.status === 'succeeded' ? colors.success : colors.muted} name={job.status === 'succeeded' ? 'checkmark-circle' : 'remove-circle-outline'} size={18} />
                    <View style={styles.flex}>
                      <Text style={styles.auditTitle}>{INTEGRATION_JOB_LABELS[job.job_kind]}</Text>
                      <Text style={styles.contextLine}>{humanize(job.status)} · {formatDateTime(job.completed_at ?? job.created_at)}</Text>
                    </View>
                  </View>
                ))}
              </>
            ) : null}
          </View>
        ) : null}

        </> : connectionTool === 'payments' ? <View style={styles.settingsCard}>
          <Text style={styles.cardTitle}>Payment setup</Text>
          <Text style={styles.cardCopy}>Stripe setup and Apple subscription activation are still pending.</Text>
          <Text style={styles.cardCopy}>Verify an existing bank transfer from its booking after checking the cleared deposit in PSI’s bank statement.</Text>
          <WorkspaceLink title="Open bookings" icon="calendar-outline" onPress={() => navigate('bookings')} />
        </View> : <View style={styles.settingsCard}>
          <Text style={styles.cardTitle}>Workshop PC uploads</Text>
          <Text style={styles.cardCopy}>Prepare a separate folder for each PSI job. Photos and dyno PDFs must be linked to a verified customer, vehicle and job.</Text>
          <Text style={styles.cardCopy}>The PC importer is being prepared for installation. Daily unattended uploads have not been activated.</Text>
          <WorkspaceLink title="Add files manually" icon="cloud-upload-outline" onPress={() => navigate('records')} />
          <WorkspaceLink title="Review imports" icon="file-tray-outline" onPress={() => navigate('imports')} />
        </View> : null}

        {section === 'history' ? <>
          <Field label="Find activity"><FormInput value={auditSearch} onChangeText={v => { setAuditSearch(v); setAuditPage(0); }} placeholder="Vehicles, records or staff" /></Field>
                  {snapshot.auditEvents.length === 0 ? <EmptyState>No audit events are currently shown.</EmptyState> : (
          <View style={styles.historyPanel}>
            <HistoryDropdown label="Month and year" onChange={(value) => { setAuditPeriod(value); setAuditPage(0); }} options={auditPeriods} value={selectedAuditPeriod} />
            <Text style={styles.historyMeta}>{filteredAuditEvents.length} matching entries in the loaded history</Text>
            <Pagination page={auditPage} total={filteredAuditEvents.length} onChange={setAuditPage} />
            {visibleAuditEvents.map((event) => (
              <View key={event.id} style={styles.auditRow}>
                <Ionicons color={event.actor_kind === 'staff' ? colors.accent : colors.muted} name={event.actor_kind === 'staff' ? 'shield-checkmark' : event.actor_kind === 'customer' ? 'person' : 'cog'} size={18} />
                <View style={styles.flex}>
                  <Text style={styles.auditTitle}>{humanize(event.table_name)} · {humanize(event.action)}</Text>
                  <Text style={styles.contextLine}>{humanize(event.actor_kind)} · {formatDateTime(event.occurred_at)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

          <Text style={styles.cardCopy}>Recent activity from the loaded portal snapshot. Use the month filter to narrow the list.</Text>
        </> : null}

        {section === 'settings' ? <>
          <View style={styles.settingsCard}>
            <Text style={styles.cardTitle}>{REVIEW_ENVIRONMENT.enabled ? 'Demo workspace' : 'Verified workshop access'}</Text>
            <Text style={styles.cardCopy}>{REVIEW_ENVIRONMENT.enabled ? 'Fictional accounts and records. External delivery and payments are disabled.' : 'Customer records and publishing remain protected by staff authentication and vehicle ownership checks.'}</Text>
          </View>
                  {!REVIEW_ENVIRONMENT.enabled ? <View style={styles.securityManagement}>
          <View style={styles.securityManagementHeading}>
            <View style={styles.flex}>
              <Text style={styles.securityTitle}>Authenticator security</Text>
              <Text style={styles.securityCopy}>{verifiedTotpFactors.length} verified authenticator{verifiedTotpFactors.length === 1 ? '' : 's'} connected.</Text>
            </View>
            <Ionicons color={colors.accent} name="key" size={22} />
          </View>
          {verifiedTotpFactors.length === 1 ? <Text style={styles.securityWarning}>Add a backup authenticator before replacing or retiring this device.</Text> : null}
          <PrimaryButton label="Manage authenticators" onPress={() => router.push('/staff-security')} variant="outline" />
        </View> : null}

          <WorkspaceLink title="My account" icon="person-circle-outline" onPress={() => confirmLeaving(() => router.push('/account'))} />
          <WorkspaceLink title="Return to customer app" icon="phone-portrait-outline" onPress={() => confirmLeaving(() => router.replace('/'))} />
        </> : null}
      </ScrollView>
      {discardDialog}
    </SafeAreaView>
  );
}

function paramValue(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] ?? '' : value ?? ''; }

function matchesSearch(value: string, query: string) {
  const normalize = (text: string) => text.toLocaleLowerCase('en-AU').replace(/[^\p{L}\p{N}]/gu, '');
  return normalize(value).includes(normalize(query));
}

function WorkspaceLink({ title, detail, icon, onPress }: { title: string; detail?: string; icon: ComponentProps<typeof Ionicons>['name']; onPress: () => void }) {
  const { largeText } = useResponsiveLayout();
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => [styles.workspaceLink, largeText && styles.linkStacked, pressed && styles.pressed]}>
    <View style={styles.linkIcon}><Ionicons name={icon} color={colors.accent} size={24} /></View>
    <View style={largeText ? styles.stackedCopy : styles.flex}><Text style={styles.linkTitle}>{title}</Text>{detail ? <Text style={styles.linkDetail}>{detail}</Text> : null}</View>
    {!largeText ? <Ionicons name="chevron-forward" color={colors.accent} size={18} /> : null}
  </Pressable>;
}

function DashboardMetric({ label, value, onPress }: { label: string; value: number; onPress: () => void }) {
  const { largeText } = useResponsiveLayout();
  return <Pressable accessibilityRole="button" accessibilityLabel={`${value} ${label}`} style={[styles.dashboardMetric, largeText && styles.metricStacked]} onPress={onPress}><Text style={styles.dashboardValue}>{value}</Text><Text style={styles.linkDetail}>{label}</Text></Pressable>;
}

function PortalAlertSummary({ customerCount, onPress, pushReady, staffCount }: { customerCount: number; onPress: () => void; pushReady: boolean; staffCount: number }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.alertSummary, pressed && styles.pressed]}>
    <View style={styles.alertSummaryIcon}><Ionicons color={colors.accent} name="notifications-outline" size={22} /></View>
    <View style={styles.flex}><Text style={styles.cardTitle}>Alerts</Text><Text style={styles.linkDetail}>{pushReady ? 'Device alerts on' : 'Device alerts need setup'}</Text></View>
    <View style={styles.alertSummaryCounts}><AlertCountBadge color="#2D9CDB" label="PSI" value={staffCount} compact /><AlertCountBadge color="#D92D20" label="Me" value={customerCount} compact /></View>
    <Ionicons color={colors.accent} name="chevron-forward" size={19} />
  </Pressable>;
}

function AlertCountBadge({ color, compact = false, label, value }: { color: string; compact?: boolean; label: string; value: number }) {
  return <View accessibilityLabel={`${value} unread ${label} alerts`} style={[styles.alertCountBadge, compact && styles.alertCountBadgeCompact, { borderColor: color }]}><View style={[styles.alertCountDot, { backgroundColor: color }]} /><Text style={styles.alertCountText}>{label} {value}</Text></View>;
}

function PortalAlertRow({ color, event, onPress }: { color: string; event: (ReturnType<typeof useNotifications>)['events'][number]; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.portalAlertRow, { borderLeftColor: color }, pressed && styles.pressed]}><View style={styles.flex}><Text style={styles.portalAlertTitle}>{event.title}</Text><Text numberOfLines={2} style={styles.cardCopy}>{event.body}</Text><Text style={styles.cardMeta}>{formatAustralianDateTime(event.created_at, true)}</Text></View><Ionicons color={color} name="chevron-forward" size={18} /></Pressable>;
}

function ContactAction({ icon, label, onPress }: { icon: ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.contactAction, pressed && styles.pressed]}><Ionicons color={colors.ink} name={icon} size={16} /><Text style={styles.contactActionText}>{label}</Text></Pressable>;
}

function Pagination({ page, total, onChange }: { page: number; total: number; onChange: (page: number) => void }) {
  const pages = Math.ceil(total / 8);
  if (pages < 2) return null;
  return <View style={styles.pagination}>
    <Pressable accessibilityRole="button" accessibilityLabel="Previous page" disabled={page === 0} onPress={() => onChange(page - 1)} style={[styles.pageControl, page === 0 && styles.disabled]}><Ionicons name="chevron-back" color={colors.accent} size={23} /></Pressable>
    <Text style={styles.cardCopy}>Page {page + 1} of {pages}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Next page" disabled={page + 1 >= pages} onPress={() => onChange(page + 1)} style={[styles.pageControl, page + 1 >= pages && styles.disabled]}><Ionicons name="chevron-forward" color={colors.accent} size={23} /></Pressable>
  </View>;
}

function AccountDeletionRequestCard({
  customer,
  expanded,
  disabled,
  onToggleExpanded,
  onComplete,
  onDirtyChange,
  onBusyChange,
  owner,
  request,
}: {
  customer: StaffPortalSnapshot['deletionCustomers'][number] | undefined;
  expanded: boolean;
  disabled: boolean;
  onToggleExpanded: () => void;
  onComplete: () => void;
  onDirtyChange: (id: string, dirty: boolean) => void;
  onBusyChange: (id: string, busy: boolean) => void;
  owner: boolean;
  request: StaffPortalSnapshot['accountDeletionRequests'][number];
}) {
  const [busy, setBusy] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState('');
  const [error, setError] = useState('');
  const [retentionConfirmed, setRetentionConfirmed] = useState(false);
  const [staffNote, setStaffNote] = useState('');
  const customerEmail = customer?.email ?? '';
  const dirty = Boolean(confirmationEmail.trim() || staffNote.trim() || retentionConfirmed);
  useEffect(() => { onDirtyChange(request.user_id, dirty); }, [dirty, onDirtyChange, request.user_id]);
  useEffect(() => { onBusyChange(request.user_id, busy); }, [busy, onBusyChange, request.user_id]);
  useEffect(() => () => { onDirtyChange(request.user_id, false); onBusyChange(request.user_id, false); }, [onDirtyChange, onBusyChange, request.user_id]);

  const completeDeletion = async () => {
    if (busy) return;
    if (!customerEmail || confirmationEmail.trim().toLowerCase() !== customerEmail.toLowerCase()) {
      setError('Type the customer email exactly as shown before continuing.');
      return;
    }
    if (!retentionConfirmed) {
      setError('Confirm the retention review before permanently deleting this account.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await completeCustomerAccountDeletion({
        confirmationEmail,
        retentionReviewConfirmed: retentionConfirmed,
        staffNote,
        userId: request.user_id,
      });
      Alert.alert(
        'Account deleted',
        result.auditWarning
          ? 'Customer access and private data were removed. The completion audit needs a technical follow-up.'
          : 'Customer access and private data were removed. Send the customer a completion confirmation.',
      );
      onComplete();
    } catch {
      setError('Deletion did not complete. If cleanup started, the customer account is safely locked. Refresh and retry this same request; no other customer was affected.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeading}>
        <Text style={styles.cardTitle}>{customerName(customer)}</Text>
        <Text style={styles.badge}>{humanize(request.status)}</Text>
      </View>
      <Text style={styles.cardCopy}>{customerEmail || 'Customer profile is locked for deletion review'}</Text>
      <Text style={styles.cardMeta}>Requested {formatDateTime(request.requested_at)} · Target completion within 30 days</Text>
      <Text style={styles.contextLine}>Review retained workshop, taxation, dispute and legal records before removing active customer data.</Text>
      {owner && customerEmail ? (
        expanded ? (
          <View style={styles.deletionPanel}>
            <View style={styles.deletionWarning}>
              <Ionicons color={colors.danger} name="warning" size={20} />
              <Text style={styles.deletionWarningText}>Permanent action. This removes private uploads, customer app records and sign-in access. It cannot be undone.</Text>
            </View>
            <Pressable
              accessibilityLabel="Retention review completed"
              accessibilityRole="checkbox"
              accessibilityState={{ checked: retentionConfirmed }}
              disabled={busy}
              onPress={() => {
                setRetentionConfirmed((current) => !current);
                setError('');
              }}
              style={styles.deletionCheck}
            >
              <Ionicons color={retentionConfirmed ? colors.accent : colors.muted} name={retentionConfirmed ? 'checkbox' : 'square-outline'} size={24} />
              <Text style={styles.deletionCheckText}>I have retained, exported or de-identified only the records PSI is required to keep.</Text>
            </Pressable>
            <Field hint={`Type ${customerEmail} exactly`} label="Confirm customer email">
              <FormInput
                editable={!busy}
                autoCapitalize="none"
                autoComplete="off"
                keyboardType="email-address"
                maxLength={160}
                onChangeText={(value) => {
                  setConfirmationEmail(value);
                  setError('');
                }}
                placeholder={customerEmail}
                value={confirmationEmail}
              />
            </Field>
            <Field hint="Optional non-sensitive completion note · maximum 500 characters" label="Staff note">
              <FormInput
                editable={!busy}
                maxLength={500}
                multiline
                numberOfLines={3}
                onChangeText={setStaffNote}
                placeholder="Retention review completed and customer identity verified"
                textAlignVertical="top"
                value={staffNote}
              />
            </Field>
            {error ? <Text accessibilityRole="alert" style={styles.deletionError}>{error}</Text> : null}
            <PrimaryButton label="Permanently delete account" loading={busy} onPress={() => void completeDeletion()} />
            <PrimaryButton disabled={busy} label="Cancel" onPress={onToggleExpanded} variant="outline" />
          </View>
        ) : <PrimaryButton disabled={disabled} label={request.status === 'in_review' ? 'Resume protected deletion' : 'Review and delete account'} onPress={onToggleExpanded} variant="outline" />
      ) : null}
    </View>
  );
}

function EmptyState({ children }: { children: string }) {
  return <View style={styles.empty}><Text style={styles.emptyText}>{children}</Text></View>;
}

function HistoryDropdown({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: HistoryPeriod[]; value: string }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? options[0];
  if (!selected) return null;
  return (
    <>
      <Pressable accessibilityLabel={`${label}: ${selected.label}`} accessibilityRole="button" onPress={() => setOpen(true)} style={({ pressed }) => [styles.historySelect, pressed && styles.pressed]}>
        <View style={styles.flex}>
          <Text style={styles.historySelectLabel}>{label}</Text>
          <Text style={styles.historySelectValue}>{selected.label}</Text>
        </View>
        <Ionicons color={colors.accent} name="chevron-down" size={20} />
      </Pressable>
      <Modal animationType="fade" onRequestClose={() => setOpen(false)} transparent visible={open}>
        <View style={styles.modalBackdrop}>
          <View accessibilityViewIsModal style={styles.modalCard}>
            <View style={styles.modalHeading}>
              <Text style={styles.modalTitle}>Choose month and year</Text>
              <Pressable accessibilityLabel="Close month and year menu" accessibilityRole="button" onPress={() => setOpen(false)} style={styles.modalClose}>
                <Ionicons color={colors.white} name="close" size={22} />
              </Pressable>
            </View>
            <ScrollView style={styles.modalOptions}>
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <Pressable accessibilityRole="button" accessibilityState={{ selected: isSelected }} key={option.value} onPress={() => { onChange(option.value); setOpen(false); }} style={({ pressed }) => [styles.modalOption, isSelected && styles.modalOptionSelected, pressed && styles.pressed]}>
                    <Text style={[styles.modalOptionText, isSelected && styles.modalOptionTextSelected]}>{option.label}</Text>
                    {isSelected ? <Ionicons color={colors.ink} name="checkmark" size={20} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

function historyPeriods(values: string[]): HistoryPeriod[] {
  const unique = [...new Set(values.filter(Boolean).map(historyPeriodValue))].sort((a, b) => b.localeCompare(a));
  return unique.map((value) => ({ value, label: historyPeriodLabel(value) }));
}

function resolveHistoryPeriod(selected: string, options: HistoryPeriod[]) {
  return options.some((option) => option.value === selected) ? selected : options[0]?.value ?? '';
}

function historyPeriodValue(value: string) {
  const parts = new Intl.DateTimeFormat('en-AU', { month: '2-digit', timeZone: 'Australia/Melbourne', year: 'numeric' }).formatToParts(new Date(value));
  const year = parts.find((part) => part.type === 'year')?.value ?? '';
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  return `${year}-${month}`;
}

function historyPeriodLabel(value: string) {
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-AU', { month: 'long', year: 'numeric' }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function customerName(customer: StaffPortalSnapshot['customers'][number] | undefined) {
  if (!customer) return 'Customer record unavailable';
  return [customer.first_name, customer.last_name].filter(Boolean).join(' ') || customer.email;
}

function invitationCustomerLabel(email: string, customers: StaffPortalSnapshot['customers']) {
  const customer = customers.find((item) => item.email.toLocaleLowerCase('en-AU') === email.toLocaleLowerCase('en-AU'));
  return customer ? customerName(customer) : email;
}

function customerInitials(customer: StaffPortalSnapshot['customers'][number]) {
  const initials = [customer.first_name, customer.last_name]
    .filter(Boolean)
    .map((value) => value?.charAt(0) ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return initials || customer.email.charAt(0).toUpperCase();
}

function formatDate(value: string) {
  return formatAustralianDate(value, value);
}

function formatDateTime(value: string) {
  return formatAustralianDateTime(value);
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

async function openCustomerEmail(email: string, bookingId: string, enquiry: string | null) {
  const subject = encodeURIComponent(`PSI booking ${bookingId.slice(0, 8).toUpperCase()}`);
  const body = encodeURIComponent(`Hi,\n\nThanks for your PSI enquiry${enquiry ? ` about: ${enquiry}` : ''}.\n\n`);
  await Linking.openURL(`mailto:${email}?subject=${subject}&body=${body}`);
}

function portalNotificationError(error: unknown) {
  const detail = error instanceof Error ? error.message : '';
  if (detail.includes('NATIVE_DEVICE_REQUIRED')) return 'Open the installed PSI app on iPhone or Android to enable banners, sounds and badges.';
  if (detail.includes('PERMISSION_DENIED')) return 'Notification permission is off. Enable PSI notifications in this phone’s Settings, then try again.';
  return 'This phone could not be registered yet. Check the internet connection and try again.';
}

const styles = StyleSheet.create({
  workspaceHeader: { borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 8, backgroundColor: colors.ink },
  headerIdentity: { alignSelf: 'center', width: '100%', maxWidth: 880, flexDirection: 'row', alignItems: 'center', gap: 10 },
  workspaceBrand: { color: colors.white, fontSize: 18, fontWeight: '900' },
  workspaceStatus: { color: colors.accent, fontSize: 11, fontWeight: '700' },
  headerButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  headerAvatar: { width: 34, height: 34, borderRadius: 17 },
  workspaceContent: { alignSelf: 'center', width: '100%', maxWidth: 880, paddingVertical: 18, paddingBottom: 36, gap: 12 },
  pageHeading: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pageTitle: { color: colors.white, fontSize: 23, fontWeight: '800', flex: 1, minWidth: 0 },
  pageBack: { minHeight: 44, width: 36, alignItems: 'center', justifyContent: 'center' },
  groupLabel: { color: colors.silver, fontSize: 13, fontWeight: '800', marginTop: 8 },
  workspaceLink: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.panel, padding: 14, minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 12 },
  linkIcon: { backgroundColor: colors.inkSoft, width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  linkTitle: { color: colors.white, fontSize: 16, fontWeight: '800' },
  linkStacked: { flexDirection: 'column', alignItems: 'flex-start' },
  stackedCopy: { width: '100%' },
  metricStacked: { flexBasis: '100%' },
  linkDetail: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  dashboardMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  dashboardMetric: { flex: 1, minWidth: 120, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, borderRadius: 12, padding: 14, gap: 2 },
  dashboardValue: { color: colors.accent, fontSize: 26, fontWeight: '900' },
  alertSummary: { ...portalFrame, alignItems: 'center', backgroundColor: colors.panel, flexDirection: 'row', gap: spacing.sm, minHeight: 72, padding: spacing.md },
  alertSummaryIcon: { alignItems: 'center', backgroundColor: colors.inkSoft, borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  alertSummaryCounts: { alignItems: 'flex-end', gap: 5 },
  alertLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  alertCountBadge: { alignItems: 'center', backgroundColor: colors.panel, borderWidth: 1, borderRadius: 18, flexDirection: 'row', gap: 7, minHeight: 38, paddingHorizontal: 12 },
  alertCountBadgeCompact: { minHeight: 25, paddingHorizontal: 7 },
  alertCountDot: { borderRadius: 5, height: 9, width: 9 },
  alertCountText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  notificationSetup: { ...portalFrame, alignItems: 'flex-start', backgroundColor: colors.inkSoft, borderLeftColor: colors.accent, borderLeftWidth: 3, flexDirection: 'row', gap: spacing.md, padding: spacing.md },
  notificationSetupReady: { borderLeftColor: colors.success },
  sectionHeadingRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  portalAlertRow: { ...portalFrame, alignItems: 'center', backgroundColor: colors.panel, borderLeftWidth: 4, flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  portalAlertTitle: { color: colors.white, fontSize: 14, fontWeight: '800' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterButton: { minHeight: 44, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 8 },
  filterSelected: { borderColor: colors.accent, backgroundColor: colors.panelRaised },
  filterText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  pageControl: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 8 },
  disabled: { opacity: 0.35 },
  inlineAction: { paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  inlineActionText: { color: colors.accent, fontSize: 13, fontWeight: '800' },
  disclosure: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44, gap: 10 },
  detailStack: { gap: 6, paddingBottom: 12 },
  settingsCard: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 16, gap: 12 },

  screen: { flex: 1, backgroundColor: colors.ink },
  flex: { flex: 1, minWidth: 0 },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
  stateTitle: { color: colors.white, fontSize: 27, fontWeight: '900', textAlign: 'center' },
  stateCopy: { color: colors.muted, fontSize: 15, lineHeight: 23, maxWidth: 520, textAlign: 'center' },
  mfaScroll: { alignItems: 'center', alignSelf: 'center', width: '100%', maxWidth: 620, paddingBottom: spacing.xxl, paddingTop: spacing.md },
  mfaCard: { ...portalFrame, alignSelf: 'stretch', backgroundColor: colors.panel, gap: spacing.md, marginTop: spacing.lg, padding: spacing.lg },
  mfaKicker: { color: colors.accent, fontSize: 11, fontWeight: '900', letterSpacing: 1.4, textTransform: 'uppercase' },
  mfaTitle: { color: colors.white, fontSize: 22, fontWeight: '900' },
  mfaCopy: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  qrFrame: { alignItems: 'center', alignSelf: 'center', backgroundColor: colors.white, borderColor: colors.accent, borderWidth: 3, justifyContent: 'center', padding: spacing.sm },
  qrImage: { height: 220, width: 220 },
  manualLabel: { color: colors.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1.1, textTransform: 'uppercase' },
  manualSecret: { backgroundColor: colors.ink, borderColor: colors.line, borderWidth: 1, color: colors.white, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13, letterSpacing: 1.2, padding: spacing.md, textAlign: 'center' },
  errorText: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  back: { alignSelf: 'flex-start', paddingVertical: spacing.sm },
  backText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  securityTitle: { color: colors.white, fontSize: 15, fontWeight: '700' },
  securityCopy: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  securityManagement: { ...portalFrame, gap: spacing.md, backgroundColor: colors.inkSoft, padding: spacing.md },
  securityManagementHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  securityWarning: { color: colors.silver, fontSize: 11, lineHeight: 17 },
  card: { ...portalFrame, backgroundColor: colors.panel, marginBottom: spacing.sm, padding: spacing.md },
  cardHeading: { alignItems: 'flex-start', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between' },
  cardTitle: { color: colors.white, flex: 1, minWidth: 0, fontSize: 17, fontWeight: '700' },
  cardPrimary: { color: colors.white, fontSize: 15, fontWeight: '800', marginTop: spacing.sm },
  contactPanel: { alignItems: 'center', backgroundColor: colors.inkSoft, borderRadius: 8, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm, padding: spacing.sm },
  contactValue: { color: colors.silver, fontSize: 12, lineHeight: 19 },
  contactActions: { flexDirection: 'row', gap: spacing.xs },
  contactAction: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: 7, flexDirection: 'row', gap: 5, minHeight: 38, paddingHorizontal: 11 },
  contactActionText: { color: colors.ink, fontSize: 11, fontWeight: '900' },
  enquiryLabel: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: .8, marginTop: spacing.md, textTransform: 'uppercase' },
  enquiryCopy: { color: colors.white, fontSize: 14, lineHeight: 21, marginTop: spacing.xs },
  cardCopy: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 2 },
  cardMeta: { color: colors.accent, fontSize: 12, fontWeight: '800', marginTop: spacing.xs },
  staffNote: { color: colors.silver, fontSize: 12, fontWeight: '800', lineHeight: 18, marginTop: spacing.xs },
  contextLine: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 2 },
  deletionPanel: { borderTopColor: colors.line, borderTopWidth: 1, gap: spacing.md, marginTop: spacing.md, paddingTop: spacing.md },
  deletionWarning: { alignItems: 'flex-start', backgroundColor: colors.panelRaised, borderLeftWidth: 3, borderLeftColor: colors.danger, flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  deletionWarningText: { color: colors.white, flex: 1, fontSize: 12, fontWeight: '800', lineHeight: 18 },
  deletionCheck: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm },
  deletionCheckText: { color: colors.silver, flex: 1, fontSize: 12, fontWeight: '800', lineHeight: 18 },
  deletionError: { color: colors.danger, fontSize: 12, fontWeight: '800', lineHeight: 18 },
  integrationError: { color: colors.danger, fontSize: 11, fontWeight: '800', lineHeight: 17, marginTop: spacing.xs },
  integrationControls: { ...portalFrame, backgroundColor: colors.inkSoft, gap: spacing.sm, marginBottom: spacing.sm, padding: spacing.md },
  queueStatusRow: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm },
  integrationSuccess: { alignItems: 'flex-start', backgroundColor: colors.panelRaised, borderLeftWidth: 3, borderLeftColor: colors.success, flexDirection: 'row', gap: spacing.sm, padding: spacing.sm },
  integrationSuccessTitle: { color: colors.success, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  integrationSuccessCopy: { color: colors.silver, fontSize: 11, lineHeight: 17, marginTop: 2 },
  historyPanel: { ...portalFrame, backgroundColor: colors.inkSoft, gap: spacing.sm, marginBottom: spacing.sm, padding: spacing.md },
  historyHeading: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between', minHeight: 48 },
  historyTitle: { color: colors.white, fontSize: 15, fontWeight: '700' },
  historyMeta: { color: colors.accent, fontSize: 11, fontWeight: '800', lineHeight: 17 },
  historySelect: { alignItems: 'center', backgroundColor: colors.panelRaised, borderColor: colors.line, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 60, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  historySelectLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  historySelectValue: { color: colors.white, fontSize: 15, fontWeight: '900', marginTop: 2 },
  compactHistoryRow: { alignItems: 'center', borderTopColor: colors.line, borderTopWidth: 1, flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.sm },
  modalBackdrop: { alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.78)', flex: 1, justifyContent: 'center', padding: spacing.lg },
  modalCard: { ...portalFrame, backgroundColor: colors.panel, maxHeight: '72%', maxWidth: 520, padding: spacing.md, width: '100%' },
  modalHeading: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between', marginBottom: spacing.sm },
  modalTitle: { color: colors.white, flex: 1, fontSize: 18, fontWeight: '900' },
  modalClose: { alignItems: 'center', height: 40, justifyContent: 'center', width: 40 },
  modalOptions: { flexGrow: 0 },
  modalOption: { alignItems: 'center', borderTopColor: colors.line, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 52, paddingHorizontal: spacing.sm },
  modalOptionSelected: { backgroundColor: colors.accent },
  modalOptionText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  modalOptionTextSelected: { color: colors.ink },
  invitationPanel: { ...portalFrame, backgroundColor: colors.panel, gap: spacing.md, padding: spacing.md },
  invitationNotice: { color: colors.success, fontSize: 12, fontWeight: '800', lineHeight: 18 },
  testFlightStep: { alignItems: 'flex-start', backgroundColor: colors.inkSoft, flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  approvedAccountsPanel: { ...portalFrame, backgroundColor: colors.inkSoft, gap: spacing.xs, marginTop: spacing.md, padding: spacing.md },
  invitationRow: { ...portalFrame, alignItems: 'center', backgroundColor: colors.panel, flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs, padding: spacing.md },
  badge: { alignSelf: 'flex-start', flexShrink: 1, borderColor: colors.accentDark, borderWidth: 1, color: colors.accent, fontSize: 10, fontWeight: '900', paddingHorizontal: 8, paddingVertical: 5, textTransform: 'uppercase' },
  lookupCustomerCard: { ...portalFrame, backgroundColor: colors.inkSoft, padding: spacing.md },
  lookupIdentity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  lookupInitials: { width: 48, height: 48, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: colors.silver },
  lookupInitialsText: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  vehicleList: { gap: spacing.sm },
  vehicleRow: { ...portalFrame, backgroundColor: colors.panel, alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, padding: spacing.md },
  vehicleTitle: { color: colors.white, fontSize: 14, fontWeight: '800' },
  vehiclePhoto: { backgroundColor: colors.ink, borderColor: colors.line, borderWidth: 1, height: 54, resizeMode: 'contain', width: 76 },
  auditRow: { ...portalFrame, alignItems: 'center', backgroundColor: colors.panel, flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs, padding: spacing.sm },
  auditTitle: { color: colors.white, fontSize: 14, fontWeight: '700' },
  empty: { ...portalFrame, backgroundColor: colors.panel, padding: spacing.lg },
  emptyText: { color: colors.muted, fontSize: 14, textAlign: 'center' },
  footer: { color: colors.mutedDark, fontSize: 10, fontWeight: '900', letterSpacing: 1.1, lineHeight: 16, marginTop: spacing.xl, textAlign: 'center' },
  pressed: { opacity: .72 },
});
