import type { PropsWithChildren } from 'react';
import { Modal, type ModalProps, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/constants/brand';

/** A native modal owns a different window from the portal behind it. */
export function StaffModal({ children, transparent = false, ...props }: PropsWithChildren<ModalProps>) {
  return (
    <Modal {...props} transparent={transparent}>
      {/* Measure this window, rather than reuse the underlying stack's insets.
          Do not seed remounting modals with launch-time window metrics. */}
      <SafeAreaProvider style={[styles.fill, !transparent && styles.screen]}>
        <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.fill}>
          {children}
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  screen: { backgroundColor: colors.ink },
});
