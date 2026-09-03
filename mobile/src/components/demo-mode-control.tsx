import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/ui';
import { restartInAppMode } from '@/lib/app-mode-storage';
import { DEMO_MODE_AVAILABLE, REVIEW_ENVIRONMENT } from '@/lib/review-environment';
import { getSupabaseClient } from '@/lib/supabase';

export function DemoModeControl() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!DEMO_MODE_AVAILABLE) return null;
  const exiting = REVIEW_ENVIRONMENT.enabled;
  const label = exiting ? 'Return to normal PSI app' : 'Open demonstration';
  const change = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const client = getSupabaseClient();
      const session = await client.auth.getSession();
      if (session.error) throw session.error;
      if (!exiting && session.data.session) throw new Error('SIGN_OUT_FIRST');
      if (exiting && session.data.session) {
        const result = await client.auth.signOut({ scope: 'local' });
        if (result.error) throw result.error;
      }
      await restartInAppMode(exiting ? 'live' : 'demo');
      // Keep the blocking modal visible until the new runtime starts.
    } catch (failure) {
      setError(failure instanceof Error && failure.message === 'SIGN_OUT_FIRST' ? 'Sign out of your normal account first, then open the demonstration.' : 'The app could not switch safely. Check your connection and try again.');
      setBusy(false);
    }
  };
  return <>
    <Pressable accessibilityRole="button" onPress={() => { setError(''); setOpen(true); }} style={styles.link}><Text style={styles.linkText}>{label}</Text></Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => { if (!busy) setOpen(false); }}>
      <View style={styles.overlay}><View accessibilityViewIsModal style={styles.card}>
        <Text accessibilityRole="header" style={styles.heading}>{label}</Text>
        <Text style={styles.copy}>{exiting ? 'The demonstration will sign out and the app will restart normally. Your real PSI account and records have not been changed.' : 'For app review and exploration using dedicated demo credentials. Only fictional cars, documents and bookings are available. Real emails, push alerts, Calendar changes and payments are disabled. The app will restart; your normal account and saved records stay separate.'}</Text>
        {error ? <Text accessibilityRole="alert" style={styles.copy}>{error}</Text> : null}
        {busy ? <><ActivityIndicator color="#65CFF8" /><Text style={styles.copy}>Restarting PSI…</Text></> : <>
          <PrimaryButton label={exiting ? 'Return and restart' : 'Enter demo and restart'} onPress={() => void change()} />
          <PrimaryButton label="Cancel" variant="outline" onPress={() => setOpen(false)} />
        </>}
      </View></View>
    </Modal>
  </>;
}
const styles = StyleSheet.create({
  link: { paddingVertical: 12, paddingHorizontal: 14 }, linkText: { color: '#65CFF8', textAlign: 'center', fontSize: 14, fontWeight: '700' },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000000cc', padding: 20 },
  card: { width: '100%', maxWidth: 480, backgroundColor: '#101010', borderWidth: 1, borderColor: '#65CFF8', padding: 22, gap: 18 },
  heading: { color: '#ffffff', fontSize: 23, fontWeight: '800' }, copy: { color: '#DBE3E7', fontSize: 15, lineHeight: 23 },
});
