import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '@/constants/brand';
import { CustomerPreviewProvider } from '@/lib/customer-preview-context';
import { ThemePreferenceProvider, useThemePreference } from '@/lib/theme-preference';

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

  return (
    <ThemeProvider value={shellTheme}>
      <CustomerPreviewProvider>
        <StatusBar style={activeTheme === 'bright' ? 'dark' : 'light'} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.inkSoft },
            animation: 'slide_from_right',
          }}
        />
      </CustomerPreviewProvider>
    </ThemeProvider>
  );
}

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
