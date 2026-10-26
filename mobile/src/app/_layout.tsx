import { DarkTheme, DefaultTheme, Stack, ThemeProvider, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, type PropsWithChildren } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PersistentBottomNavigation } from '@/components/persistent-bottom-navigation';
import { AmbientBackground, AmbientScreen } from '@/components/ambient-background';
import { GarageStartupScreen } from '@/components/garage-startup-screen';
import { AppleReviewBanner } from '@/components/apple-review-banner';
import { AppModeGate } from '@/components/app-mode-gate';
import { AndroidAppUpdates } from '@/components/android-app-updates';
import { AskPsiLauncher } from '@/components/ask-psi-launcher';
import { UiToneProvider } from '@/components/ui';
import { colors } from '@/constants/brand';
import { CustomerAccountProvider } from '@/lib/customer-account-context';
import { ambientUsesBrightTheme } from '@/lib/ambient-scene';
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
  // Keep the navigator mounted for cold notification links while the first
  // frame remains covered until the account's artwork selection is hydrated.
  return <View style={styles.shell}>
    <View style={[styles.shell, !ready && styles.startupHidden]} pointerEvents={ready ? 'auto' : 'none'} accessibilityElementsHidden={!ready}>{children}</View>
    {!ready ? <GarageStartupScreen /> : null}
  </View>;
}

function ThemeAwareRootShell() {
  const pathname = usePathname();
  const { activeTheme, theme } = useThemePreference();
  const baseTheme = activeTheme === 'bright' ? DefaultTheme : DarkTheme;
  const shellTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      background: 'transparent',
      card: 'transparent',
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
                <UiToneProvider tone={pathname === '/staff' || pathname === '/staff-security' || pathname === '/staff-messages' || pathname === '/rewards-scan' || pathname === '/portal-preview' ? 'staff' : 'brand'}>
                <StatusBar style={ambientUsesBrightTheme(activeTheme, pathname, Platform.OS) ? 'dark' : 'light'} />
                <GarageStartupGate><View style={[styles.shell, { backgroundColor: theme.ink }]}>
                  <AmbientBackground pathname={pathname} />
                  <AppleReviewBanner />
                  <View style={styles.content}>
                    <Stack
                      screenLayout={({ children, route }) => <AmbientScreen routeName={route.name}>{children}</AmbientScreen>}
                      screenOptions={{
                        headerShown: false,
                        contentStyle: { backgroundColor: 'transparent' },
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
  startupHidden: { opacity: 0 },
  shell: { flex: 1 },
  content: { flex: 1, minHeight: 0 },
});

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemePreferenceProvider>
          <AndroidAppUpdates><AppModeGate><ThemeAwareRootShell /></AppModeGate></AndroidAppUpdates>
        </ThemePreferenceProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
