import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/ui';
import { getSupabaseClient } from '@/lib/supabase';
import { vaultClient } from '@/lib/performance-plus';
import { s } from '@/app/performance-plus';

export function StaffXeroConnection() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [candidates, setCandidates] = useState<{ tenant_id: string; tenant_name: string }[]>([]);
  async function connect() {
    setBusy(true);
    try {
      const { data, error } = await getSupabaseClient().functions.invoke('start-xero-connection');
      if (error || !data?.authorizationUrl) {
        setMessage('Xero setup is not ready, or owner verification has expired. No invoices have been imported.');
        return;
      }
      const url = new URL(data.authorizationUrl);
      if (url.origin !== 'https://login.xero.com' || url.pathname !== '/identity/connect/authorize' || url.username || url.password) throw new Error('invalid_destination');
      await Linking.openURL(url.toString());
      setMessage('Complete the Xero connection, then check the status here.');
    } catch { setMessage('Could not open the secure Xero connection. Please try again.'); }
    finally { setBusy(false); }
  }
  async function check() {
    setBusy(true);
    try {
      const { data, error } = await vaultClient().rpc('xero_connection_status');
      if (error) throw error;
      const pending = await vaultClient().rpc('xero_connection_candidates');
      if (pending.error) throw pending.error;
      setCandidates(pending.data ?? []);
      setMessage(pending.data?.length ? 'Confirm the PSI organisation below. Do not choose a demonstration or unrelated business.' : Array.isArray(data) && data.length ? 'Connection saved. Automatic invoice importing is not active yet.' : 'Xero is not connected yet.');
    } catch { setMessage('Connection status is unavailable. Check setup and your owner verification.'); }
    finally { setBusy(false); }
  }
  return <View style={s.pricing}>
    <Text style={s.section}>Xero invoices</Text>
    <Text style={s.copy}>Connect PSI’s Xero organisation securely. Customer and vehicle matching must be checked before importing.</Text>
    <PrimaryButton label="Connect Xero" disabled={busy} loading={busy} onPress={() => void connect()} />
    <PrimaryButton label="Check connection" variant="outline" disabled={busy} onPress={() => void check()} />
    {candidates.map(candidate => <View key={candidate.tenant_id}>
      <Text style={s.copy}>{candidate.tenant_name}</Text>
      <PrimaryButton label={`Confirm ${candidate.tenant_name}`} variant="outline" disabled={busy} onPress={async () => {
        setBusy(true);
        try {
          const { error } = await vaultClient().rpc('confirm_xero_organisation', { p_tenant_id: candidate.tenant_id });
          if (error) throw error;
          setCandidates([]); setMessage('PSI organisation confirmed. Automatic invoice importing remains off until the first vehicle/job match is checked.');
        } catch { setMessage('Could not confirm the organisation. Check owner verification or reconnect if the confirmation expired.'); }
        finally { setBusy(false); }
      }} />
    </View>)}
    {message ? <Text style={s.notice} accessibilityRole="alert">{message}</Text> : null}
  </View>;
}
