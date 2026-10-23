import { type PropsWithChildren } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';

import { ambientSceneForPath, ambientUsesBrightTheme } from '@/lib/ambient-scene';
import { useThemePreference } from '@/lib/theme-preference';

const BACKGROUNDS = {
  garage: require('../../assets/images/ambient/garage.png'),
  reports: require('../../assets/images/ambient/reports.png'),
  forms: require('../../assets/images/ambient/forms.png'),
} as const;

// Dedicated daylight photography keeps bright mode natural, rather than
// washing the dark artwork out with an almost opaque white overlay.
const BRIGHT_BACKGROUNDS = {
  garage: require('../../assets/images/ambient/bright-garage.jpg'),
  reports: require('../../assets/images/ambient/bright-reports.jpg'),
  forms: require('../../assets/images/ambient/bright-forms.jpg'),
} as const;

/**
 * A fixed, decorative workshop layer sits behind screen content or the footer.
 * Forms scroll above it without moving or downloading the artwork. The car
 * hero belongs to Home and is deliberately absent from these backgrounds.
 */
export function AmbientBackground({ pathname }: { pathname: string }) {
  const { activeTheme } = useThemePreference();
  const bright = ambientUsesBrightTheme(activeTheme, pathname, Platform.OS);

  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, bright ? styles.brightBase : styles.darkBase]}
    >
      <Image
        accessible={false}
        fadeDuration={0}
        resizeMode="cover"
        source={(bright ? BRIGHT_BACKGROUNDS : BACKGROUNDS)[ambientSceneForPath(pathname)]}
        style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
      />
      <View style={[StyleSheet.absoluteFill, bright ? styles.brightTint : styles.darkTint]} />
    </View>
  );
}

/**
 * Navigators retain inactive screens and their form state. Each scene needs
 * its own opaque backing so translucent panels cannot reveal another screen.
 * Resolve its own route, rather than the currently active global pathname.
 */
export function AmbientScreen({ children, routeName }: PropsWithChildren<{ routeName: string }>) {
  const pathname = '/' + routeName.split('/').filter(part => part && !/^\(.+\)$/.test(part) && part !== 'index').join('/');
  const { activeTheme } = useThemePreference();
  const bright = ambientUsesBrightTheme(activeTheme, pathname, Platform.OS);

  return (
    <View style={[styles.scene, bright ? styles.brightBase : styles.darkBase]}>
      {/* Nested tabs supply their own artwork and opaque scene backing. */}
      {routeName !== '(tabs)' ? <AmbientBackground pathname={pathname} /> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scene: { flex: 1, minWidth: 0, minHeight: 0 },
  darkBase: { backgroundColor: '#030B12' },
  brightBase: { backgroundColor: '#F4F8FA' },
  darkTint: { backgroundColor: 'rgba(3, 11, 18, 0.46)' },
  brightTint: { backgroundColor: 'rgba(248, 251, 253, 0.48)' },
});
