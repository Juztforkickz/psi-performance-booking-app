import { useCallback, useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/ui';
import { colors, spacing } from '@/constants/brand';
import { getSupabaseClient } from '@/lib/supabase';
import { vaultClient } from '@/lib/performance-plus';

export function StaffXeroConnection() {
  const [busyAction, setBusyAction] = useState('');
  const busy = !!busyAction;
  const [message, setMessage] = useState('');
  const [connected, setConnected] = useState<boolean | null>(null);
  const [depositStatus, setDepositStatus] = useState('Check status to view deposit syncing.');
  const [candidates, setCandidates] = useState<{ tenant_id: string; tenant_name: string }[]>([]);
  async function connect(deposits = false) {
    if (busy) return;
    setBusyAction('connect');
    try {
      const { data, error } = await getSupabaseClient().functions.invoke('start-xero-connection', { body: { deposits } });
      if (error || !data?.authorizationUrl) {
        setMessage('Connection unavailable. Check Xero setup or sign in again as the owner.');
        return;
      }
      const url = new URL(data.authorizationUrl);
      if (url.origin !== 'https://login.xero.com' || url.pathname !== '/identity/connect/authorize' || url.username || url.password) throw new Error('invalid_destination');
      await Linking.openURL(url.toString());
      setMessage(deposits ? 'Approve the payment and bank transaction permissions in Xero, then return here to check and enable deposit syncing.' : 'Complete the Xero connection, then check the status here.');
    } catch { setMessage('Could not open the secure Xero connection. Please try again.'); }
    finally { setBusyAction(''); }
  }
  const loadStatus = useCallback(async (showBusy: boolean) => {
    if (showBusy) setBusyAction('check');
    try {
      const { data, error } = await vaultClient().rpc('xero_connection_status');
      if (error) throw error;
      const pending = await vaultClient().rpc('xero_connection_candidates');
      if (pending.error) throw pending.error;
      setCandidates(pending.data ?? []);
      const isConnected = !pending.data?.length && Array.isArray(data) && data.length > 0;
      setConnected(isConnected);
      if (isConnected) {
        const deposit = await getSupabaseClient().functions.invoke('process-booking-xero-deposits', {body:{action:'status'}});
        setDepositStatus(deposit.error ? 'Deposit syncing status is unavailable.' : deposit.data?.enabled
          ? `Automatic deposit syncing is on. ${deposit.data.counts?.waiting_invoice ?? 0} waiting for a verified invoice. ${deposit.data.counts?.needs_review ?? 0} need owner review.`
          : 'Automatic deposit syncing is off. Authorise Xero access, then enable below.');
      }
      if (pending.data?.length) {
        setMessage('Select PSI’s organisation below. Check the business name carefully.');
      } else if (isConnected && showBusy) {
        const health = await getSupabaseClient().functions.invoke('process-xero-imports', { body: { action: 'health_check' } });
        if (health.error || health.data?.connected !== true) throw new Error('xero_health_check_failed');
        setMessage('Xero verified live. Invoice imports wait for an exact customer, vehicle and PSI job match.');
      } else {
        setMessage(isConnected ? 'Connected securely. Automatic invoice imports are off.' : 'Not connected.');
      }
    } catch {
      setConnected(null);
      setMessage('Connection status is unavailable. Check setup and your owner verification.');
    } finally {
      if (showBusy) setBusyAction('');
    }
  }, []);

  useEffect(() => {
    const statusCheck = setTimeout(() => void loadStatus(false), 0);
    return () => clearTimeout(statusCheck);
  }, [loadStatus]);

  async function check() {
    if (busy) return;
    await loadStatus(true);
  }
  async function enableDeposits() {
    if (busy) return;
    setBusyAction('deposits');
    try {
      const result = await getSupabaseClient().functions.invoke('process-booking-xero-deposits', {body:{action:'enable'}});
      if (result.error || result.data?.enabled !== true) {
        setMessage('Approve deposit syncing access in Xero first. If already approved, check your owner verification and try again.');
        return;
      }
      setDepositStatus('Automatic deposit syncing is on. Confirmed deposits are checked every five minutes and applied once the booking invoice is verified.');
      setMessage('Deposits and actual Stripe fees will sync once per verified booking. Stripe payout bank matching remains separate.');
    } catch { setMessage('Deposit syncing could not be enabled. Check the Xero connection and owner verification.'); }
    finally { setBusyAction(''); }
  }
  return <View style={styles.workspace}>
    <Text style={styles.title}>Xero invoices</Text>
    <Text style={styles.copy}>{connected
      ? 'PSI’s Xero organisation is connected. Invoice imports stay off until each customer, vehicle and job match is reviewed.'
      : 'Check the secure connection before connecting or replacing PSI’s Xero organisation. Automatic invoice imports remain off.'}</Text>
    <View style={styles.protection}>
      <View style={styles.protectionHeading}>
        <Text style={styles.businessName}>Duplicate invoice protection</Text>
        <Text style={styles.protectionStatus}>On</Text>
      </View>
      <Text style={styles.copy}>Before a Xero invoice is added, PSI checks the matched vehicle folder. If the same invoice number is already there, the Xero copy is skipped.</Text>
    </View>
    <PrimaryButton label="Check status" variant="outline" disabled={busy} loading={busyAction === 'check'} onPress={() => void check()} />
    <PrimaryButton label={connected ? 'Reconnect or replace Xero' : 'Connect Xero'} disabled={busy} loading={busyAction === 'connect'} onPress={() => void connect()} />
    <View style={styles.protection}>
      <Text style={styles.businessName}>Booking deposit syncing</Text>
      <Text style={styles.copy}>Allow PSI to credit verified booking deposits against invoices and record the actual Stripe fees. Xero requires your consent for payment and bank transaction access.</Text>
      <PrimaryButton label="Authorise deposit syncing in Xero" variant="outline" disabled={busy} onPress={() => void connect(true)} />
      <PrimaryButton label="Enable automatic deposit sync" disabled={busy} loading={busyAction === 'deposits'} onPress={() => void enableDeposits()} />
      <Text style={styles.copy}>{depositStatus}</Text>
    </View>
    {candidates.map(candidate => <View key={candidate.tenant_id} style={styles.candidate}>
      <Text style={styles.businessName}>{candidate.tenant_name}</Text>
      <PrimaryButton label={`Confirm ${candidate.tenant_name}`} variant="outline" disabled={busy} loading={busyAction === candidate.tenant_id} onPress={async () => {
        if (busy) return;
        setBusyAction(candidate.tenant_id);
        try {
          const { error } = await vaultClient().rpc('confirm_xero_organisation', { p_tenant_id: candidate.tenant_id });
          if (error) throw error;
          setCandidates([]); setConnected(true); setMessage('Organisation confirmed. Invoice imports remain off pending customer and vehicle matching.');
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
  protection: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: spacing.md, gap: spacing.sm, backgroundColor: colors.panel },
  protectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  protectionStatus: { color: colors.success, fontSize: 13, fontWeight: '700' },
  candidate: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: spacing.md, gap: spacing.sm, backgroundColor: colors.panel },
  businessName: { color: colors.white, fontSize: 14, fontWeight: '600' },
  notice: { color: colors.muted, fontSize: 13, lineHeight: 19, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.md },
});
