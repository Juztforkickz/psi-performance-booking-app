import Ionicons from '@expo/vector-icons/Ionicons';
import { type Href, usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/brand';
import { ASK_PSI_STAGE } from '@/lib/ask-psi-stage';

const HIDDEN_ROUTES = ['/messages', '/staff', '/staff-security', '/portal-preview'];

export function AskPsiLauncher() {
  const pathname = usePathname();
  const router = useRouter();
  if (!ASK_PSI_STAGE.privatePreviewEnabled || HIDDEN_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))) return null;

  return (
    <View pointerEvents="box-none" style={styles.layer}>
      <Pressable accessibilityLabel="Ask PSI" accessibilityRole="button" onPress={() => router.push('/messages' as Href)} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <View style={styles.mark}>
          <Ionicons color={colors.ink} name="chatbubble-ellipses" size={22} />
          <View style={styles.eye} />
        </View>
        <Text style={styles.label}>Ask PSI</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', right: 14, bottom: 78, zIndex: 50 },
  button: { minHeight: 48, borderRadius: 25, backgroundColor: '#101719', borderWidth: 1, borderColor: colors.accent, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 9, paddingRight: 14 },
  mark: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  eye: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.white, position: 'absolute', right: 7, top: 7 },
  label: { color: colors.white, fontSize: 13, fontWeight: '900' },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
});
