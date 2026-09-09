import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/ui';
import { colors, spacing } from '@/constants/brand';
import { getSupabaseClient } from '@/lib/supabase';
import { vaultClient } from '@/lib/performance-plus';

export function StaffXeroConnection() {
  const [busyAction, setBusyAction] = useState('');
  const busy = !!busyAction;
  const [message, setMessage] = useState('');
  const [candidates, setCandidates] = useState<{ tenant_id: string; tenant_name: string }[]>([]);
  async function connect() {
    if (busy) return;
    setBusyAction('connect');
    try {
      const { data, error } = await getSupabaseClient().functions.invoke('start-xero-connection');
      if (error || !data?.authorizationUrl) {
        setMessage('Connection unavailable. Check Xero setup or sign in again as the owner.');
        return;
      }
      const url = new URL(data.authorizationUrl);
      if (url.origin !== 'https://login.xero.com' || url.pathname !== '/identity/connect/authorize' || url.username || url.password) throw new Error('invalid_destination');
      await Linking.openURL(url.toString());
      setMessage('Complete the Xero connection, then check the status here.');
    } catch { setMessage('Could not open the secure Xero connection. Please try again.'); }
    finally { setBusyAction(''); }
  }
  async function check() {
    if (busy) return;
    setBusyAction('check');
    try {
      const { data, error } = await vaultClient().rpc('xero_connection_status');
      if (error) throw error;
      const pending = await vaultClient().rpc('xero_connection_candidates');
      if (pending.error) throw pending.error;
      setCandidates(pending.data ?? []);
      setMessage(pending.data?.length ? 'Select PSI’s organisation below. Check the business name carefully.' : Array.isArray(data) && data.length ? 'Connected. Automatic invoice imports are off.' : 'Not connected.');
    } catch { setMessage('Connection status is unavailable. Check setup and your owner verification.'); }
    finally { setBusyAction(''); }
  }
  return <View style={styles.workspace}>
    <Text style={styles.title}>Xero invoices</Text>
    <Text style={styles.copy}>Connect PSI’s organisation. Automatic invoice imports remain off.</Text>
    <PrimaryButton label="Connect" disabled={busy} loading={busyAction === 'connect'} onPress={() => void connect()} />
    <PrimaryButton label="Check status" variant="outline" disabled={busy} loading={busyAction === 'check'} onPress={() => void check()} />
    {candidates.map(candidate => <View key={candidate.tenant_id} style={styles.candidate}>
      <Text style={styles.businessName}>{candidate.tenant_name}</Text>
      <PrimaryButton label={`Confirm ${candidate.tenant_name}`} variant="outline" disabled={busy} loading={busyAction === candidate.tenant_id} onPress={async () => {
        if (busy) return;
        setBusyAction(candidate.tenant_id);
        try {
          const { error } = await vaultClient().rpc('confirm_xero_organisation', { p_tenant_id: candidate.tenant_id });
          if (error) throw error;
          setCandidates([]); setMessage('Organisation confirmed. Invoice imports remain off pending customer and vehicle matching.');
        } catch { setMessage('Could not confirm the organisation. Check owner verification or reconnect if the confirmation expired.'); }
        finally { setBusyAction(''); }
      }} />
    </View>)}
    {message ? <Text style={styles.notice} accessibilityRole="alert">{message}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  workspace: { gap: spacing.md },
  title: { color: colors.white, fontSize: 16, fontWeight: '700' },
  copy: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  candidate: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: spacing.md, gap: spacing.sm, backgroundColor: colors.panel },
  businessName: { color: colors.white, fontSize: 14, fontWeight: '600' },
  notice: { color: colors.muted, fontSize: 13, lineHeight: 19, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.md },
});
