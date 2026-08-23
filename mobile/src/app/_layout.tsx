import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PersistentBottomNavigation } from '@/components/persistent-bottom-navigation';
import { colors } from '@/constants/brand';
import { CustomerPreviewProvider } from '@/lib/customer-preview-context';
import { ThemePreferenceProvider, useThemePreference } from '@/lib/theme-preference';
import { startSupabaseAuthLifecycle } from '@/lib/supabase';

function ThemeAwareRootShell() {
  const { activeTheme, theme } = useThemePreference();
  const baseTheme = activeTheme === 'bright' ? DefaultTheme : DarkTheme;
  const shellTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      background: theme.ink,
      card: theme.ink,
      border: theme.border,
      primary: theme.accent,
      text: activeTheme === 'bright' ? theme.text : colors.white,
    },
  };

  useEffect(() => startSupabaseAuthLifecycle(), []);

  return (
    <ThemeProvider value={shellTheme}>
      <CustomerPreviewProvider>
        <StatusBar style={activeTheme === 'bright' ? 'dark' : 'light'} />
        <View style={styles.shell}>
          <View style={styles.content}>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: theme.inkSoft },
                animation: 'slide_from_right',
              }}
            />
          </View>
          <PersistentBottomNavigation />
        </View>
      </CustomerPreviewProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  content: { flex: 1, minHeight: 0 },
});

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemePreferenceProvider>
          <ThemeAwareRootShell />
        </ThemePreferenceProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
