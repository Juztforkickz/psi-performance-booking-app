import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { REVIEW_ENVIRONMENT } from '@/lib/review-environment';

export function AppleReviewBanner() {
  if (!REVIEW_ENVIRONMENT.enabled) return null;
  return (
    <SafeAreaView edges={['top']} style={styles.banner}>
      <Text style={styles.title}>APPLE REVIEW SANDBOX · FICTIONAL DATA</Text>
      <Text style={styles.copy}>No real bookings, payments, emails or calendar changes.</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: '#173b4c', paddingHorizontal: 12, paddingBottom: 6, paddingTop: 4 },
  title: { color: '#ffffff', fontSize: 11, fontWeight: '800', textAlign: 'center' },
  copy: { color: '#ffffff', fontSize: 11, textAlign: 'center', marginTop: 2 },
});
