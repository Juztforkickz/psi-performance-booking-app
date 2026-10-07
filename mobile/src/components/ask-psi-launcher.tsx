import Ionicons from '@expo/vector-icons/Ionicons';
import { type Href, usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/brand';
import { ASK_PSI_STAGE } from '@/lib/ask-psi-stage';

const HIDDEN_ROUTES = ['/messages', '/staff', '/staff-security', '/staff-messages', '/portal-preview'];
const BOOST_ASSISTANT = require('../../assets/images/boost-assistant.png');

export function AskPsiLauncher() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { shown.remove(); hidden.remove(); };
  }, []);

  if (!ASK_PSI_STAGE.privatePreviewEnabled || keyboardVisible || HIDDEN_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))) return null;

  return (
    <View pointerEvents="box-none" style={[styles.layer, { bottom: 78 + insets.bottom, right: 14 + insets.right }]}>
      <Pressable accessibilityLabel="Ask PSI" accessibilityRole="button" onPress={() => router.push('/messages' as Href)} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <View style={styles.mark}>
          <Image accessibilityLabel="Boost, the Ask PSI assistant" resizeMode="contain" source={BOOST_ASSISTANT} style={styles.boostImage} />
        </View>
        <Ionicons color={colors.accent} name="chatbubble-ellipses" size={17} />
        <Text style={styles.label}>Ask PSI</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', right: 14, bottom: 78, zIndex: 50 },
  button: { minHeight: 54, borderRadius: 28, backgroundColor: '#101719', borderWidth: 1, borderColor: colors.accent, flexDirection: 'row', alignItems: 'center', gap: 7, paddingLeft: 5, paddingRight: 14 },
  mark: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#071317', borderWidth: 1, borderColor: '#BDEEFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  boostImage: { width: 42, height: 42 },
  label: { color: colors.white, fontSize: 13, fontWeight: '900' },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
});
