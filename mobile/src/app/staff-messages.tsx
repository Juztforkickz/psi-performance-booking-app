import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { type ComponentProps, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StaffAskPsiInbox } from '@/components/staff-ask-psi-inbox';
import { PrimaryButton } from '@/components/ui';
import { ASK_PSI_STAGE } from '@/lib/ask-psi-stage';
import { CUSTOMER_AUTH } from '@/lib/customer-auth';
import { useCustomerAuth } from '@/lib/customer-auth-context';
import { loadStaffPortalAccess, type StaffPortalAccess } from '@/lib/staff-portal';
import { useThemePreference } from '@/lib/theme-preference';

export default function StaffMessagesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ conversationId?: string }>();
  const auth = useCustomerAuth();
  const { theme } = useThemePreference();
  const [retryCount, setRetryCount] = useState(0);
  const accessKey = `${auth.user?.id ?? ''}:${auth.sessionRevision}:${retryCount}`;
  const [verification, setVerification] = useState<{ key: string; access: StaffPortalAccess | null; error: string } | null>(null);
  const currentVerification = verification?.key === accessKey ? verification : null;
  const access = currentVerification?.access;
  const error = currentVerification?.error;

  useEffect(() => {
    if (!ASK_PSI_STAGE.privatePreviewEnabled || !CUSTOMER_AUTH.enabled || auth.status !== 'signed_in') return;
    let active = true;
    void loadStaffPortalAccess().then((result) => {
      if (active) setVerification({ key: accessKey, access: result, error: '' });
    }).catch(() => {
      if (active) setVerification({ key: accessKey, access: null, error: 'Staff access could not be verified. Check your connection and try again.' });
    });
    return () => { active = false; };
  }, [accessKey, auth.status]);
  useEffect(() => {
    if (!ASK_PSI_STAGE.privatePreviewEnabled) router.replace('/staff');
  }, [router]);

  if (!ASK_PSI_STAGE.privatePreviewEnabled) return <SafeAreaView edges={['top', 'right', 'left']} style={[styles.screen, { backgroundColor: theme.inkSoft }]} />;
  if (!CUSTOMER_AUTH.enabled) return <StaffMessageState icon="shield-outline" title="Messages unavailable" copy="Secure account access is required before workshop messages can load." action="Back to workshop" onAction={() => router.replace('/staff')} />;
  if (auth.status === 'loading' || (auth.status === 'signed_in' && !currentVerification)) return <SafeAreaView edges={['top', 'right', 'left']} style={[styles.screen, { backgroundColor: theme.inkSoft }]}><View style={styles.state}><ActivityIndicator color={theme.accent} /><Text style={[styles.copy, { color: theme.textMuted }]}>Checking protected staff access</Text></View></SafeAreaView>;
  if (auth.status !== 'signed_in') return <StaffMessageState icon="person-circle-outline" title="Staff sign in required" copy="Sign in with an approved PSI staff account before opening customer messages." action="Open secure sign in" onAction={() => router.push({ pathname: '/account', params: { returnTo: '/staff-messages' } })} />;
  if (error) return <StaffMessageState icon="cloud-offline-outline" title="Connection needed" copy={error} action="Try again" onAction={() => setRetryCount((count) => count + 1)} />;
  if (!access || access.kind === 'access_denied') return <StaffMessageState icon="shield-outline" title="Access denied" copy="This account is not an active PSI staff identity." action="Back to workshop" onAction={() => router.replace('/staff')} />;
  if (access.kind === 'mfa_required') return <StaffMessageState icon="shield-checkmark-outline" title="Authenticator required" copy="Complete staff authenticator verification before customer messages can load." action="Verify in workshop portal" onAction={() => router.replace('/staff')} />;

  return <SafeAreaView edges={['top', 'right', 'left']} style={[styles.screen, { backgroundColor: theme.inkSoft }]}><StaffAskPsiInbox initialConversationId={typeof params.conversationId === 'string' ? params.conversationId : ''} key={accessKey} onBack={() => router.replace('/staff')} snapshot={access.snapshot} staffUserId={access.staff.user_id ?? undefined} /></SafeAreaView>;
}

function StaffMessageState({ action, copy, icon, onAction, title }: { action: string; copy: string; icon: ComponentProps<typeof Ionicons>['name']; onAction: () => void; title: string }) {
  const { theme } = useThemePreference();
  return <SafeAreaView edges={['top', 'right', 'left']} style={[styles.screen, { backgroundColor: theme.inkSoft }]}><View style={styles.state}><Ionicons color={theme.accent} name={icon} size={38} /><Text style={[styles.title, { color: theme.text }]}>{title}</Text><Text style={[styles.copy, { color: theme.textMuted }]}>{copy}</Text><PrimaryButton label={action} onPress={onAction} /></View></SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  state: { flex: 1, maxWidth: 520, width: '100%', alignSelf: 'center', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  title: { fontSize: 27, fontWeight: '900', textAlign: 'center' },
  copy: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
