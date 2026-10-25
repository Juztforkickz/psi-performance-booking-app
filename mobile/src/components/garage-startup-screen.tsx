import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

/** Bundled public artwork fills the display before account data is ready. */
export function GarageStartupScreen() {
  const { width, height } = useWindowDimensions();
  const portrait = height >= width;
  const artwork = portrait
    ? require('../../assets/images/psi-startup-tori-yellow-calipers.png')
    : require('../../assets/images/psi-startup-tori-calipers-landscape.png');
  return <View style={styles.screen} accessibilityLabel="Opening PSI">
    <Image
      source={artwork}
      style={styles.artwork}
      resizeMode="cover"
      accessibilityLabel={portrait
        ? 'PSI Performance+ artwork with Tori, the GT3 RS with black wheels and yellow brake calipers, and GTSR'
        : 'PSI Performance+ artwork with Tori, the GT3 RS with yellow brake calipers, and GTSR'}
      onLoadEnd={() => { void SplashScreen.hideAsync().catch(() => undefined); }}
    />
  </View>;
}

const styles = StyleSheet.create({
  screen: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#050505', overflow: 'hidden' },
  artwork: { width: '100%', height: '100%' },
});
