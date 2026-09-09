import { type ReactNode, useCallback, useRef, useState } from 'react';
import { Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/constants/brand';

type DiscardConfirmationOptions = {
  title?: string;
  body?: string;
};

export function useStaffDiscardConfirmation({
  title = 'Discard unfinished changes?',
  body = 'Changes on this page have not been saved.',
}: DiscardConfirmationOptions = {}): {
  confirmDiscard: (action: () => void) => void;
  discardDialog: ReactNode;
} {
  const pendingAction = useRef<(() => void) | null>(null);
  const [visible, setVisible] = useState(false);

  const confirmDiscard = useCallback((action: () => void) => {
    if (pendingAction.current) return;
    pendingAction.current = action;
    Keyboard.dismiss();
    setVisible(true);
  }, []);

  const keepEditing = useCallback(() => {
    pendingAction.current = null;
    setVisible(false);
  }, []);

  const discardChanges = useCallback(() => {
    const action = pendingAction.current;
    pendingAction.current = null;
    setVisible(false);
    action?.();
  }, []);

  const discardDialog = (
    <Modal animationType="fade" onRequestClose={keepEditing} transparent visible={visible}>
      <SafeAreaView style={styles.backdrop}>
        <View accessibilityLabel={title} accessibilityViewIsModal role="alertdialog" style={styles.card}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" style={styles.scroll}>
            <Text accessibilityRole="header" style={styles.title}>{title}</Text>
            <Text style={styles.body}>{body}</Text>
            <Pressable accessibilityRole="button" onPress={keepEditing} style={({ pressed }) => [styles.button, styles.keepButton, pressed && styles.pressed]}>
              <Text style={styles.keepText}>Keep editing</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={discardChanges} style={({ pressed }) => [styles.button, styles.discardButton, pressed && styles.pressed]}>
              <Text style={styles.discardText}>Discard changes</Text>
            </Pressable>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );

  return { confirmDiscard, discardDialog };
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,.82)', padding: spacing.md },
  card: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, width: '100%', maxWidth: 480, maxHeight: '90%', backgroundColor: colors.panel },
  scroll: { flexGrow: 0 },
  content: { gap: spacing.md, padding: spacing.lg },
  title: { color: colors.white, fontSize: 20, fontWeight: '900' },
  body: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  button: { borderWidth: 1, borderColor: colors.line, borderRadius: 8, width: '100%', minHeight: 48, alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  keepButton: { backgroundColor: colors.silver },
  keepText: { color: colors.ink, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  discardButton: { borderColor: colors.danger, backgroundColor: colors.inkSoft },
  discardText: { color: colors.danger, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  pressed: { opacity: .72 },
});
