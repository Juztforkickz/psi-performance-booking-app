import { DarkTheme, DefaultTheme, Stack, ThemeProvider, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, type PropsWithChildren } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PersistentBottomNavigation } from '@/components/persistent-bottom-navigation';
import { AppleReviewBanner } from '@/components/apple-review-banner';
import { AppModeGate } from '@/components/app-mode-gate';
import { AskPsiLauncher } from '@/components/ask-psi-launcher';
import { UiToneProvider } from '@/components/ui';
import { colors } from '@/constants/brand';
import { CustomerAccountProvider } from '@/lib/customer-account-context';
import { CustomerAuthProvider } from '@/lib/customer-auth-context';
import { CustomerPreviewProvider } from '@/lib/customer-preview-context';
import { NotificationProvider } from '@/lib/notifications';
import { StaffNavigationProvider } from '@/lib/staff-navigation-context';
import { ThemePreferenceProvider, useThemePreference } from '@/lib/theme-preference';
import { startSupabaseAuthLifecycle } from '@/lib/supabase';
import { PrivateGarageArtworkProvider, useGarageStartupArtwork } from '@/hooks/use-private-garage-artwork';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function GarageStartupGate({ children }: PropsWithChildren) {
  const { ready } = useGarageStartupArtwork();
  useEffect(() => { if (ready) void SplashScreen.hideAsync().catch(() => undefined); }, [ready]);
  return ready ? children : <View style={styles.startup}><ActivityIndicator color={colors.accent} /></View>;
}

function ThemeAwareRootShell() {
  const pathname = usePathname();
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
      <CustomerAuthProvider>
        <CustomerAccountProvider>
          <PrivateGarageArtworkProvider>
          <NotificationProvider>
            <CustomerPreviewProvider>
              <StaffNavigationProvider>
                <UiToneProvider tone={pathname === '/staff' || pathname === '/staff-security' || pathname === '/staff-messages' || pathname === '/portal-preview' ? 'staff' : 'brand'}>
                <StatusBar style={activeTheme === 'bright' ? 'dark' : 'light'} />
                <GarageStartupGate><View style={[styles.shell, { backgroundColor: theme.ink }]}>
                  <AppleReviewBanner />
                  <View style={styles.content}>
                    <Stack
                      screenOptions={{
                        headerShown: false,
                        contentStyle: { backgroundColor: theme.inkSoft },
                        animation: 'slide_from_right',
                      }}
                    />
                  </View>
                  <AskPsiLauncher />
                  <PersistentBottomNavigation />
                </View></GarageStartupGate>
                </UiToneProvider>
              </StaffNavigationProvider>
            </CustomerPreviewProvider>
          </NotificationProvider>
          </PrivateGarageArtworkProvider>
        </CustomerAccountProvider>
      </CustomerAuthProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  startup: { flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  shell: { flex: 1 },
  content: { flex: 1, minHeight: 0 },
});

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemePreferenceProvider>
          <AppModeGate><ThemeAwareRootShell /></AppModeGate>
        </ThemePreferenceProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
