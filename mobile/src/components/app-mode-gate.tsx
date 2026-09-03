import { type PropsWithChildren, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/ui';
import { initializeAppMode, restartInAppMode } from '@/lib/app-mode-storage';
import { DEMO_MODE_AVAILABLE } from '@/lib/review-environment';

export function AppModeGate({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(!DEMO_MODE_AVAILABLE);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    void initializeAppMode().then(() => { if (active) setReady(true); }, () => { if (active) setError(true); });
    return () => { active = false; };
  }, []);
  if (ready) return children;
  return <View style={styles.screen}>
    {error ? <>
      <Text style={styles.copy}>Your app mode could not be loaded. No account has been opened.</Text>
      <PrimaryButton label="Restart in normal PSI app" onPress={() => { void restartInAppMode('live').catch(() => setError(true)); }} />
    </> : <><ActivityIndicator color="#65CFF8" /><Text style={styles.copy}>Opening PSI…</Text></>}
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: '#050505', justifyContent: 'center', padding: 24, gap: 16 }, copy: { color: '#ffffff', textAlign: 'center' } });
