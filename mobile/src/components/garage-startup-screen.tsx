import { Image, StyleSheet, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Bundled public artwork can appear before account data or private images load. */
export function GarageStartupScreen() {
  const insets = useSafeAreaInsets();
  return <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }]} accessibilityLabel="Opening PSI">
    <Image
      source={require('../../assets/images/psi-startup-wallpaper.png')}
      style={styles.artwork}
      resizeMode="contain"
      accessibilityLabel="PSI screensaver artwork with the Manthey GT3 RS, GTSR and BYD"
      onLoadEnd={() => { void SplashScreen.hideAsync().catch(() => undefined); }}
    />
  </View>;
}

const styles = StyleSheet.create({
  screen: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#050505' },
  artwork: { width: '100%', height: '100%' },
});
