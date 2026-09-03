import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { DevSettings, Platform } from 'react-native';

import { appModeRuntime, DEMO_MODE_AVAILABLE, REVIEW_ENVIRONMENT } from '@/lib/review-environment';

const MODE_KEY = '@psi-performance/app-mode/v1'; // Only 'live' or 'demo'; never tokens.
export async function initializeAppMode() {
  if (!DEMO_MODE_AVAILABLE) return;
  appModeRuntime.initialize(await AsyncStorage.getItem(MODE_KEY));
}

export async function restartInAppMode(mode: 'live' | 'demo') {
  if (!DEMO_MODE_AVAILABLE) throw new Error('DEMO_MODE_UNAVAILABLE');
  const previous = REVIEW_ENVIRONMENT.enabled ? 'demo' : 'live';
  await AsyncStorage.setItem(MODE_KEY, mode);
  try {
    // The active runtime/client NEVER changes. A fresh JS process reads the choice.
    if (Platform.OS === 'web') { window.location.reload(); return; }
    if (__DEV__) { DevSettings.reload(); return; }
    if (!Updates.isEnabled) throw new Error('APP_RESTART_UNAVAILABLE');
    await Updates.reloadAsync();
  } catch (error) {
    await AsyncStorage.setItem(MODE_KEY, previous);
    throw error;
  }
}
