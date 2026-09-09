import { Stack, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StaffWorkspace } from '@/app/staff';
import { PrimaryButton } from '@/components/ui';
import { colors } from '@/constants/brand';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { CUSTOMER_AUTH } from '@/lib/customer-auth';
import { STAFF_PORTAL_PREVIEW_SNAPSHOT } from '@/lib/staff-portal-preview';

/** Public design preview only; authenticated builds retain the staff gate. */
export default function PortalPreviewScreen() {
  const router = useRouter();
  const { horizontalPadding } = useResponsiveLayout();

  if (CUSTOMER_AUTH.enabled) {
    return <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ title: 'Workshop portal' }} />
      <View style={[styles.gate, { paddingHorizontal: horizontalPadding }]}>
        <Text accessibilityRole="header" style={styles.title}>Open your workshop</Text>
        <Text style={styles.copy}>The design preview is available in the public demo. Use your protected workshop portal here to view customer records.</Text>
        <PrimaryButton label="Open workshop portal" onPress={() => router.replace('/staff')} />
        <PrimaryButton label="Return to app" onPress={() => router.replace('/')} variant="outline" />
      </View>
    </SafeAreaView>;
  }

  return <>
    <Stack.Screen options={{ title: 'PSI Workshop · Design preview' }} />
    <StaffWorkspace
      horizontalPadding={horizontalPadding}
      onRefresh={() => undefined}
      previewMode
      role="owner"
      snapshot={STAFF_PORTAL_PREVIEW_SNAPSHOT}
      verifiedTotpFactors={[]}
    />
  </>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  gate: { alignSelf: 'center', width: '100%', maxWidth: 620, paddingVertical: 36, gap: 18 },
  title: { color: colors.white, fontSize: 26, fontWeight: '800' },
  copy: { color: colors.muted, fontSize: 16, lineHeight: 24 },
});
