import { type Href, usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Keyboard, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
      <Pressable accessibilityLabel="Ask PSI" accessibilityHint="Open messages with PSI" accessibilityRole="button" onPress={() => router.push('/messages' as Href)} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <Image accessible={false} resizeMode="contain" source={BOOST_ASSISTANT} style={styles.boostImage} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', right: 14, bottom: 78, zIndex: 50 },
  button: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center' },
  boostImage: { width: 76, height: 76 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
});
