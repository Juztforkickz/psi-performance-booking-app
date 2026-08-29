import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field, FormInput, PrimaryButton } from '@/components/ui';
import { colors, mobileFrame, spacing } from '@/constants/brand';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { formatAustralianDate } from '@/lib/australian-date';
import { CUSTOMER_AUTH } from '@/lib/customer-auth';
import { useCustomerAuth } from '@/lib/customer-auth-context';
import {
  beginStaffTotpEnrollment,
  cancelStaffTotpEnrollment,
  loadStaffMfaSecurityAccess,
  removeStaffTotpFactor,
  type StaffMfaSecurityAccess,
  type StaffTotpEnrollment,
  verifyStaffTotp,
} from '@/lib/staff-portal';

type LoadState =
  | { access: null; status: 'error' | 'loading'; userId: string | null }
  | { access: StaffMfaSecurityAccess; status: 'ready'; userId: string };

export default function StaffSecurityScreen() {
  const router = useRouter();
  const auth = useCustomerAuth();
  const { horizontalPadding } = useResponsiveLayout();
  const [loadState, setLoadState] = useState<LoadState>({ access: null, status: 'loading', userId: null });
  const [refreshNonce, setRefreshNonce] = useState(0);

  const refreshSecurity = () => {
    setLoadState({ access: null, status: 'loading', userId: auth.user?.id ?? null });
    setRefreshNonce((current) => current + 1);
  };

  useEffect(() => {
    if (!CUSTOMER_AUTH.enabled || auth.status !== 'signed_in' || !auth.user?.id) return;
    let active = true;
    const userId = auth.user.id;
    void loadStaffMfaSecurityAccess()
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
    return <SecurityState copy="Staff authenticator management is unavailable in the public preview." title="Private security workspace" />;
  }
  if (auth.status === 'loading') return <SecurityState copy="Restoring the protected staff session…" loading title="Checking staff security" />;
  if (auth.status !== 'signed_in') {
    return (
      <SecurityState
        actionLabel="Open secure sign in"
        copy="Sign in with the approved PSI owner email before managing authenticators."
        onAction={() => router.replace({ pathname: '/account', params: { returnTo: '/staff' } })}
        title="Staff sign in required"
      />
    );
  }
  if (loadState.status === 'loading' || loadState.userId !== auth.user?.id) return <SecurityState copy="Checking the staff allowlist and AAL2 session…" loading title="Checking staff security" />;
  if (loadState.status === 'error' || !loadState.access) {
    return <SecurityState actionLabel="Try again" copy="Authenticator security could not be loaded. No factors were changed." onAction={refreshSecurity} title="Security unavailable" />;
  }
  if (loadState.access.kind === 'access_denied') {
    return <SecurityState copy="This account is not an active PSI staff identity. No factors were changed." title="Access denied" />;
  }
  if (loadState.access.kind === 'mfa_required') {
    return <SecurityState actionLabel="Verify authenticator" copy="An AAL2 staff session is required before authenticator devices can be managed." onAction={() => router.replace('/staff')} title="Authenticator verification required" />;
  }

  return (
    <StaffSecurityWorkspace
      access={loadState.access}
      horizontalPadding={horizontalPadding}
      onRefresh={refreshSecurity}
    />
  );
}

function StaffSecurityWorkspace({
  access,
  horizontalPadding,
  onRefresh,
}: {
  access: Extract<StaffMfaSecurityAccess, { kind: 'ready' }>;
  horizontalPadding: number;
  onRefresh: () => void;
}) {
  const router = useRouter();
  const [busyAction, setBusyAction] = useState('');
  const [code, setCode] = useState('');
  const [confirmRemoveId, setConfirmRemoveId] = useState('');
  const [enrollment, setEnrollment] = useState<StaffTotpEnrollment | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showManualKey, setShowManualKey] = useState(false);
  const factors = access.verifiedTotpFactors;

  const beginBackupEnrollment = async () => {
    if (busyAction) return;
    setBusyAction('begin');
    setError('');
    setNotice('');
    try {
      setEnrollment(await beginStaffTotpEnrollment('PSI backup authenticator'));
      setCode('');
      setShowManualKey(false);
    } catch {
      setError('A backup authenticator could not be started. Existing authenticators were not changed.');
    } finally {
      setBusyAction('');
    }
  };

  const cancelEnrollment = async () => {
    if (!enrollment || busyAction) return;
    setBusyAction('cancel');
    setError('');
    try {
      await cancelStaffTotpEnrollment(enrollment.factorId);
      setEnrollment(null);
      setCode('');
      setShowManualKey(false);
      setNotice('Backup authenticator setup cancelled.');
    } catch {
      setError('The temporary setup could not be cleared. It remains unverified and has no staff access.');
    } finally {
      setBusyAction('');
    }
  };

  const verifyEnrollment = async () => {
    if (!enrollment || busyAction || !/^\d{6}$/.test(code.replace(/\s/gu, ''))) {
      setError('Enter the current six-digit code from the new authenticator.');
      return;
    }
    setBusyAction('verify');
    setError('');
    setNotice('');
    try {
      await verifyStaffTotp(enrollment.factorId, code);
      setEnrollment(null);
      setCode('');
      setShowManualKey(false);
      setNotice('Backup authenticator verified. Other signed-in sessions were closed by Supabase.');
      onRefresh();
    } catch {
      setError('That code could not be verified. Wait for a fresh code from the new authenticator and try again.');
    } finally {
      setBusyAction('');
    }
  };

  const removeFactor = async (factorId: string) => {
    if (busyAction || factors.length < 2) return;
    setBusyAction(factorId);
    setError('');
    setNotice('');
    try {
      const result = await removeStaffTotpFactor(factorId);
      setConfirmRemoveId('');
      if (result.requiresSignIn) {
        router.replace('/staff');
        return;
      }
      router.replace('/staff');
    } catch {
      setError('That authenticator could not be removed. At least one other verified factor and a current AAL2 session are required.');
    } finally {
      setBusyAction('');
    }
  };

  const qrUri = enrollment ? normalizeQrCodeUri(enrollment.qrCode) : '';
  return (
    <SafeAreaView edges={['top', 'right', 'left']} style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingHorizontal: horizontalPadding }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Pressable accessibilityRole="button" onPress={() => router.replace('/staff')} style={styles.back}>
          <Text style={styles.backText}>← Workshop portal</Text>
        </Pressable>
        <Text style={styles.eyebrow}>PSI OWNER SECURITY</Text>
        <Text style={styles.title}>Authenticators</Text>
        <Text style={styles.lead}>Manage the separate authenticator devices required before this owner account can open workshop-wide customer records.</Text>

        <View style={styles.securityBanner}>
          <Ionicons color={colors.success} name="shield-checkmark" size={24} />
          <View style={styles.flex}>
            <Text style={styles.securityTitle}>AAL2 verified · {access.staff.role === 'owner' ? 'Owner access' : 'Staff access'}</Text>
            <Text style={styles.securityCopy}>This page never receives or stores your authenticator seed after setup closes.</Text>
          </View>
        </View>

        {notice ? <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

        <Text style={styles.sectionTitle}>Verified devices</Text>
        <Text style={styles.sectionCopy}>{factors.length} verified authenticator{factors.length === 1 ? '' : 's'} currently protect this account.</Text>
        {factors.map((factor, index) => (
          <View key={factor.id} style={styles.factorCard}>
            <View style={styles.factorHeading}>
              <View style={styles.factorIcon}><Ionicons color={colors.accent} name="phone-portrait-outline" size={21} /></View>
              <View style={styles.flex}>
                <Text style={styles.factorTitle}>{factor.friendlyName}</Text>
                <Text style={styles.factorMeta}>Verified device {index + 1} · added {formatMfaDate(factor.createdAt)}</Text>
              </View>
            </View>
            {factors.length < 2 ? (
              <Text style={styles.lockedCopy}>Protected as the last verified authenticator. Add a backup before removing or replacing it.</Text>
            ) : confirmRemoveId === factor.id ? (
              <View style={styles.confirmCard}>
                <Text style={styles.confirmTitle}>Remove this authenticator?</Text>
                <Text style={styles.confirmCopy}>You may need to verify again with the remaining device. This cannot remove the final verified authenticator.</Text>
                <View style={styles.actionRow}>
                  <View style={styles.action}><PrimaryButton label="Cancel" onPress={() => setConfirmRemoveId('')} variant="outline" /></View>
                  <View style={styles.action}><PrimaryButton label="Confirm remove" loading={busyAction === factor.id} onPress={() => void removeFactor(factor.id)} /></View>
                </View>
              </View>
            ) : (
              <PrimaryButton label="Remove this authenticator" onPress={() => setConfirmRemoveId(factor.id)} variant="outline" />
            )}
          </View>
        ))}

        <Text style={styles.sectionTitle}>Backup authenticator</Text>
        {!enrollment ? (
          <View style={styles.setupCard}>
            <Text style={styles.setupTitle}>Add a second device</Text>
            <Text style={styles.setupCopy}>A backup reduces lockout risk. Keep it on a separate trusted device or authenticator vault controlled by PSI.</Text>
            <PrimaryButton label="Add backup authenticator" loading={busyAction === 'begin'} onPress={() => void beginBackupEnrollment()} />
          </View>
        ) : (
          <View style={styles.setupCard}>
            <Text style={styles.setupTitle}>Connect the backup</Text>
            <Text style={styles.setupCopy}>Scan this once using the backup authenticator. Do not photograph or message the QR code or manual key.</Text>
            {Platform.OS === 'web' ? <View style={styles.qrFrame}><Image accessibilityLabel="PSI backup authenticator QR code" source={{ uri: qrUri }} style={styles.qrImage} /></View> : null}
            {Platform.OS !== 'web' ? <PrimaryButton label="Open authenticator app" onPress={() => void Linking.openURL(enrollment.uri)} variant="outline" /> : null}
            <Text style={styles.manualLabel}>Manual setup key</Text>
            {showManualKey ? <Text selectable style={styles.manualSecret}>{enrollment.secret}</Text> : <PrimaryButton label="Show manual key" onPress={() => setShowManualKey(true)} variant="outline" />}
            <Field error={error} hint="Use the code shown on the new backup device" label="Six-digit authenticator code">
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
            <PrimaryButton label="Verify backup authenticator" loading={busyAction === 'verify'} onPress={() => void verifyEnrollment()} />
            <PrimaryButton label="Cancel setup" loading={busyAction === 'cancel'} onPress={() => void cancelEnrollment()} variant="outline" />
          </View>
        )}

        <View style={styles.recoveryCard}>
          <Ionicons color={colors.accent} name="lock-closed" size={24} />
          <View style={styles.flex}>
            <Text style={styles.recoveryTitle}>Lost every authenticator?</Text>
            <Text style={styles.recoveryCopy}>There is no in-app bypass. PSI must use the documented owner recovery procedure to verify the incident, revoke sessions and remove the lost factor through trusted Supabase administration before enrolling a replacement.</Text>
          </View>
        </View>
        <Text style={styles.footer}>PRIVATE OWNER SECURITY · NO SERVICE-ROLE KEY IN THE APP · LAST FACTOR CANNOT BE REMOVED HERE</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SecurityState({
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
        {!loading ? <PrimaryButton label="Back to staff portal" onPress={() => router.replace('/staff')} variant="outline" /> : null}
      </View>
    </SafeAreaView>
  );
}

function normalizeQrCodeUri(qrCode: string) {
  const svgDataPrefix = 'data:image/svg+xml;utf-8,';
  if (qrCode.startsWith(svgDataPrefix)) return `${svgDataPrefix}${encodeURIComponent(qrCode.slice(svgDataPrefix.length))}`;
  if (qrCode.trimStart().startsWith('<svg')) return `${svgDataPrefix}${encodeURIComponent(qrCode)}`;
  return qrCode;
}

function formatMfaDate(value: string) {
  return formatAustralianDate(value, 'date unavailable');
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  flex: { flex: 1 },
  scroll: { alignSelf: 'center', width: '100%', maxWidth: 760, paddingBottom: spacing.xxl, paddingTop: spacing.md },
  back: { alignSelf: 'flex-start', paddingVertical: spacing.sm },
  backText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  eyebrow: { color: colors.accent, fontSize: 12, fontWeight: '900', letterSpacing: 1.7, marginTop: spacing.md },
  title: { color: colors.white, fontSize: 38, fontWeight: '900', letterSpacing: -1.2, marginTop: spacing.xs },
  lead: { color: colors.muted, fontSize: 16, lineHeight: 24, marginTop: spacing.sm, maxWidth: 680 },
  securityBanner: { ...mobileFrame, backgroundColor: colors.panel, flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg, padding: spacing.md },
  securityTitle: { color: colors.white, fontSize: 15, fontWeight: '900', textTransform: 'uppercase' },
  securityCopy: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  notice: { ...mobileFrame, backgroundColor: colors.inkSoft, color: colors.silver, fontSize: 13, lineHeight: 19, marginTop: spacing.md, padding: spacing.md },
  error: { ...mobileFrame, backgroundColor: colors.inkSoft, color: colors.danger, fontSize: 13, lineHeight: 19, marginTop: spacing.md, padding: spacing.md },
  sectionTitle: { color: colors.white, fontSize: 23, fontWeight: '900', marginTop: spacing.xl },
  sectionCopy: { color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: spacing.sm, marginTop: 3 },
  factorCard: { ...mobileFrame, backgroundColor: colors.panel, gap: spacing.md, marginBottom: spacing.sm, padding: spacing.md },
  factorHeading: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  factorIcon: { alignItems: 'center', backgroundColor: colors.inkSoft, borderColor: colors.line, borderWidth: 1, height: 42, justifyContent: 'center', width: 42 },
  factorTitle: { color: colors.white, fontSize: 16, fontWeight: '900' },
  factorMeta: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 2 },
  lockedCopy: { color: colors.silver, fontSize: 12, lineHeight: 18 },
  confirmCard: { backgroundColor: colors.inkSoft, borderColor: colors.line, borderWidth: 1, gap: spacing.sm, padding: spacing.md },
  confirmTitle: { color: colors.white, fontSize: 14, fontWeight: '900', textTransform: 'uppercase' },
  confirmCopy: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: { flex: 1, minWidth: 150 },
  setupCard: { ...mobileFrame, backgroundColor: colors.panel, gap: spacing.md, padding: spacing.md },
  setupTitle: { color: colors.white, fontSize: 18, fontWeight: '900', textTransform: 'uppercase' },
  setupCopy: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  qrFrame: { alignItems: 'center', alignSelf: 'center', backgroundColor: colors.white, padding: spacing.sm },
  qrImage: { height: 220, width: 220 },
  manualLabel: { color: colors.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1.1, textTransform: 'uppercase' },
  manualSecret: { backgroundColor: colors.ink, borderColor: colors.line, borderWidth: 1, color: colors.white, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13, letterSpacing: 1.2, padding: spacing.md, textAlign: 'center' },
  recoveryCard: { ...mobileFrame, backgroundColor: colors.inkSoft, flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl, padding: spacing.md },
  recoveryTitle: { color: colors.white, fontSize: 15, fontWeight: '900', textTransform: 'uppercase' },
  recoveryCopy: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  footer: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginTop: spacing.xl, textAlign: 'center' },
  state: { alignItems: 'center', alignSelf: 'center', flex: 1, gap: spacing.md, justifyContent: 'center', maxWidth: 620, width: '100%' },
  stateTitle: { color: colors.white, fontSize: 25, fontWeight: '900', textAlign: 'center', textTransform: 'uppercase' },
  stateCopy: { color: colors.muted, fontSize: 15, lineHeight: 23, maxWidth: 520, textAlign: 'center' },
});
