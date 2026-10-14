import { Linking, Platform, View } from 'react-native';
import { PrimaryButton } from '@/components/ui';
import { spacing } from '@/constants/brand';

export function PhoneAppLinks() {
  if (Platform.OS !== 'web') return null;
  return <View style={{ gap: spacing.sm }}>
    <PrimaryButton label="PSI on the App Store" variant="outline" onPress={() => void Linking.openURL('https://apps.apple.com/au/app/psi-performance-garage/id6806902732')} />
    <PrimaryButton label="PSI on Google Play" variant="outline" onPress={() => void Linking.openURL('https://play.google.com/store/apps/details?id=com.psiperformance.booking')} />
  </View>;
}
