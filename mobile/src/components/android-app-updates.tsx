import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { createContext, type PropsWithChildren, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, AppState, Platform, StyleSheet, Text, View } from 'react-native';

import { GarageStartupScreen } from '@/components/garage-startup-screen';
import { PrimaryButton } from '@/components/ui';
import { createAndroidUpdateController } from '@/lib/android-update-controller';
import { formatAustralianDateTime } from '@/lib/australian-date';
import { useThemePreference } from '@/lib/theme-preference';

const ATTEMPT_KEY = '@psi-performance/android-update-attempt/v1';
const enabled = Platform.OS === 'android' && !__DEV__ && Updates.isEnabled
  && Updates.channel === 'android-play-internal' && Updates.runtimeVersion === '1.0.0-android-play-internal-1';
const controller = createAndroidUpdateController({
  enabled, runningId: Updates.updateId,
  check: () => Updates.checkForUpdateAsync(), fetch: () => Updates.fetchUpdateAsync(), reload: () => Updates.reloadAsync(),
  readAttempt: () => AsyncStorage.getItem(ATTEMPT_KEY), writeAttempt: value => AsyncStorage.setItem(ATTEMPT_KEY, value),
});
const UpdateContext = createContext(controller);

/** Android only. Never reload a customer's mounted form, payment or upload. */
export function AndroidAppUpdates({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(!enabled);
  useEffect(() => {
    if (!enabled) return;
    let mounted = true;
    let startupWindow = true;
    const timer = setTimeout(() => { startupWindow = false; if (mounted) setReady(true); }, 8000);
    void controller.check(true).then(() => controller.apply(() => mounted && startupWindow && AppState.currentState === 'active'))
      .finally(() => { clearTimeout(timer); startupWindow = false; if (mounted) setReady(true); });
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active' && previous !== 'active') void controller.check();
      previous = next;
    });
    // Retry transient network failures while open. Checks are coalesced and throttled.
    const retry = setInterval(() => { if (AppState.currentState === 'active') void controller.check(); }, 300_000);
    return () => { mounted = false; startupWindow = false; clearTimeout(timer); clearInterval(retry); subscription.remove(); };
  }, []);
  return <UpdateContext.Provider value={controller}>{ready ? children : <View style={styles.startup}>
    <GarageStartupScreen />
    <View style={styles.startupStatus}><ActivityIndicator color="#65CFF8" /><Text style={styles.startupText}>Opening the latest PSI app…</Text></View>
  </View>}</UpdateContext.Provider>;
}

export function AndroidAppUpdateStatus() {
  const updater = useContext(UpdateContext);
  const state = useSyncExternalStore(updater.subscribe, updater.getSnapshot, updater.getSnapshot);
  const { theme } = useThemePreference();
  const [details, setDetails] = useState(false);
  const [nativeErrorCode, setNativeErrorCode] = useState<string | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'android' || !details || !Updates.isEnabled) return;
    let active = true;
    void Updates.readLogEntriesAsync(86400_000).then(entries => {
      const entry = [...entries].reverse().find(item => item.level === 'error' || item.level === 'fatal');
      // Display a fixed provider code only. Never expose stack traces, URLs or tokens.
      if (active) setNativeErrorCode(entry?.code ?? null);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [details, state.checkedAt]);
  if (Platform.OS !== 'android') return null;
  const busy = ['checking', 'downloading', 'applying'].includes(state.phase);
  const copy = state.phase === 'checking' ? 'Checking for the latest PSI update…'
    : state.phase === 'downloading' ? 'Downloading your update. You can keep using PSI.'
      : state.phase === 'ready' ? 'Your update is downloaded. It will open next time PSI starts, or you can restart now.'
        : state.phase === 'applying' ? 'Opening your downloaded update…'
          : state.phase === 'error' ? state.error === 'update_connection_or_download_failed'
            ? 'The update could not download. Your account and saved information are safe. Connect to the internet and retry.'
            : 'An update could not start. PSI has kept a working version. Show update details for support.'
            : !enabled ? 'Automatic updates are unavailable in this build. Check Google Play for the current PSI app.'
              : 'PSI checks for updates automatically. Downloads continue while you use the app.';
  return <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
    <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>App updates</Text>
    <Text style={[styles.copy, { color: theme.textMuted }]}>{copy}</Text>
    <Text style={[styles.copy, { color: theme.textMuted }]}>Content version {Constants.expoConfig?.version ?? 'unknown'}{Updates.createdAt ? ` · Updated ${formatAustralianDateTime(Updates.createdAt.toISOString())}` : ''}</Text>
    {enabled ? <PrimaryButton label={state.pendingId ? 'Restart to finish update' : busy ? 'Checking updates…' : 'Check for updates'} disabled={busy}
      onPress={() => { if (state.pendingId) void updater.apply(() => AppState.currentState === 'active'); else void updater.check(true); }} /> : null}
    <PrimaryButton variant="outline" label={details ? 'Hide update details' : 'Show update details'} onPress={() => setDetails(value => !value)} />
    {details ? <Text selectable style={[styles.details, { color: theme.textMuted }]}>
      {`Installed build: ${Constants.platform?.android?.versionCode ?? 'unavailable'}\nUpdate: ${Updates.updateId ?? 'bundled'}\nChannel: ${Updates.channel ?? 'unavailable'}\nAutomatic updates: ${Updates.isEnabled ? 'enabled' : 'unavailable'}\nSource: ${Updates.isEmergencyLaunch ? 'recovery launch' : Updates.isEmbeddedLaunch ? 'installed app' : 'downloaded update'}\nStatus: ${state.error ?? state.phase}${nativeErrorCode ? `\nProvider: ${nativeErrorCode}` : ''}`}
    </Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  startup: { flex: 1, backgroundColor: '#050505' },
  startupStatus: { position: 'absolute', left: 20, right: 20, bottom: 48, padding: 16, borderRadius: 20, backgroundColor: 'rgba(3,11,18,0.9)', alignItems: 'center', gap: 8 },
  startupText: { color: '#ffffff', fontSize: 14, textAlign: 'center' },
  panel: { padding: 18, borderWidth: 1, borderRadius: 24, gap: 12 },
  title: { fontSize: 20, fontWeight: '800' }, copy: { fontSize: 14, lineHeight: 21 }, details: { fontSize: 12, lineHeight: 19 },
});
