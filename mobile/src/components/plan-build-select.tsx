import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, mobileFrame, spacing } from '@/constants/brand';
import type { PlanBuildOption } from '@/lib/plan-build-preview';

export function PlanBuildSelect({
  label,
  onChange,
  options,
  placeholder = 'Choose an option',
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: readonly PlanBuildOption[];
  placeholder?: string;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((option) => option.value === value)?.label;

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityLabel={`${label}. ${selectedLabel ?? placeholder}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
      >
        <Text numberOfLines={2} style={[styles.triggerText, !selectedLabel && styles.placeholder]}>
          {selectedLabel ?? placeholder}
        </Text>
        <Ionicons color={colors.accent} name="chevron-down" size={20} />
      </Pressable>

      <Modal
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        presentationStyle="overFullScreen"
        transparent
        visible={open}
      >
        <SafeAreaView accessibilityViewIsModal edges={['top', 'right', 'bottom', 'left']} style={styles.modalSafeArea}>
          <Pressable
            accessibilityLabel="Close option list"
            accessibilityRole="button"
            onPress={() => setOpen(false)}
            style={styles.backdrop}
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeadingCopy}>
                <Text style={styles.sheetKicker}>Plan & Build</Text>
                <Text style={styles.sheetTitle}>{label}</Text>
              </View>
              <Pressable
                accessibilityLabel="Close option list"
                accessibilityRole="button"
                hitSlop={10}
                onPress={() => setOpen(false)}
                style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
              >
                <Ionicons color={colors.ink} name="close" size={22} />
              </Pressable>
            </View>
            <ScrollView
              accessibilityRole="radiogroup"
              contentContainerStyle={styles.optionList}
              keyboardShouldPersistTaps="handled"
            >
              {options.map((option) => {
                const selected = option.value === value;
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    key={option.value}
                    onPress={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.option,
                      selected && styles.optionSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option.label}</Text>
                    <View style={[styles.radio, selected && styles.radioSelected]}>
                      {selected ? <View style={styles.radioDot} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  label: { color: colors.silver, fontSize: 10, fontWeight: '900', letterSpacing: .7, textTransform: 'uppercase' },
  trigger: { ...mobileFrame, minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.ink, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  triggerText: { flex: 1, minWidth: 0, color: colors.white, fontSize: 13, fontWeight: '800', lineHeight: 18 },
  placeholder: { color: colors.muted },
  modalSafeArea: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,.78)' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  sheet: { ...mobileFrame, width: '100%', maxWidth: 620, maxHeight: '82%', alignSelf: 'center', backgroundColor: colors.inkSoft },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line, padding: spacing.md },
  sheetHeadingCopy: { flex: 1, minWidth: 0, gap: 3 },
  sheetKicker: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  sheetTitle: { color: colors.white, fontSize: 17, fontWeight: '900', textTransform: 'uppercase' },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.silver },
  optionList: { gap: spacing.sm, padding: spacing.md, paddingBottom: spacing.xl },
  option: { ...mobileFrame, minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.panel, padding: spacing.md },
  optionSelected: { backgroundColor: colors.silver },
  optionText: { flex: 1, minWidth: 0, color: colors.white, fontSize: 13, fontWeight: '800', lineHeight: 18 },
  optionTextSelected: { color: colors.ink },
  radio: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.white, borderRadius: 11 },
  radioSelected: { borderColor: colors.ink },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.ink },
  pressed: { opacity: .72 },
});
