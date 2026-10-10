import { Image, StyleSheet, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

/** Bundled public artwork can appear before account data or private images load. */
export function GarageStartupScreen() {
  return <View style={styles.screen} accessibilityLabel="Opening PSI">
    <Image source={require('../../assets/images/psi-splash-logo.png')} style={styles.logo} resizeMode="contain" accessible={false} />
    <Image
      source={require('../../assets/images/psi-gtsr-porsche-mobile-clean.jpg')}
      style={styles.cars}
      resizeMode="contain"
      accessibilityLabel="PSI GT3 RS and GTSR"
      onLoadEnd={() => { void SplashScreen.hideAsync().catch(() => undefined); }}
    />
  </View>;
}

const styles = StyleSheet.create({
  screen: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#050505', alignItems: 'center', justifyContent: 'center', gap: 24 },
  logo: { width: '66%', maxWidth: 300, height: 100 },
  cars: { width: '100%', aspectRatio: 1, maxWidth: 600, maxHeight: '65%' },
});
