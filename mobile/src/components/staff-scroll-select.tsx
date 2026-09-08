import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, mobileFrame, spacing } from '@/constants/brand';

export type StaffSelectOption = {
  label: string;
  sublabel?: string;
  value: string;
};

export function StaffScrollSelect({
  label,
  onChange,
  options,
  placeholder = 'Choose an option',
  searchable = false,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: readonly StaffSelectOption[];
  placeholder?: string;
  searchable?: boolean;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((option) => option.value === value);
  const visibleOptions = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('en-AU');
    if (!normalized) return options;
    return options.filter((option) => `${option.label} ${option.sublabel ?? ''}`.toLocaleLowerCase('en-AU').includes(normalized));
  }, [options, query]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityLabel={`${label}. ${selected?.label ?? placeholder}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
      >
        <View style={styles.triggerCopy}>
          <Text numberOfLines={1} style={[styles.triggerTitle, !selected && styles.placeholder]}>{selected?.label ?? placeholder}</Text>
          {selected?.sublabel ? <Text numberOfLines={1} style={styles.triggerMeta}>{selected.sublabel}</Text> : null}
        </View>
        <Ionicons color={colors.accent} name="chevron-down" size={20} />
      </Pressable>

      <Modal animationType="fade" onRequestClose={close} transparent visible={open}>
        <View style={styles.backdrop}>
          <View accessibilityViewIsModal style={styles.modalCard}>
            <View style={styles.modalHeading}>
              <Text style={styles.modalTitle}>{label}</Text>
              <Pressable accessibilityLabel={`Close ${label}`} accessibilityRole="button" onPress={close} style={styles.closeButton}>
                <Ionicons color={colors.white} name="close" size={22} />
              </Pressable>
            </View>
            {searchable ? (
              <View style={styles.searchRow}>
                <Ionicons color={colors.accent} name="search" size={18} />
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={setQuery}
                  placeholder="Search name, email or vehicle"
                  placeholderTextColor={colors.mutedDark}
                  style={styles.searchInput}
                  value={query}
                />
              </View>
            ) : null}
            <ScrollView keyboardShouldPersistTaps="handled" style={styles.optionList}>
              {visibleOptions.map((option) => {
                const optionSelected = option.value === value;
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: optionSelected }}
                    key={option.value}
                    onPress={() => {
                      onChange(option.value);
                      close();
                    }}
                    style={({ pressed }) => [styles.option, optionSelected && styles.optionSelected, pressed && styles.pressed]}
                  >
                    <View style={styles.triggerCopy}>
                      <Text style={[styles.optionTitle, optionSelected && styles.optionTitleSelected]}>{option.label}</Text>
                      {option.sublabel ? <Text style={[styles.optionMeta, optionSelected && styles.optionMetaSelected]}>{option.sublabel}</Text> : null}
                    </View>
                    {optionSelected ? <Ionicons color={colors.ink} name="checkmark-circle" size={20} /> : null}
                  </Pressable>
                );
              })}
              {visibleOptions.length === 0 ? <Text style={styles.empty}>No matching customers or vehicles.</Text> : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  label: { color: colors.accent, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
  trigger: { ...mobileFrame, minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.inkSoft, padding: spacing.md },
  triggerCopy: { flex: 1, minWidth: 0, gap: 3 },
  triggerTitle: { color: colors.white, fontSize: 14, fontWeight: '900' },
  triggerMeta: { color: colors.muted, fontSize: 11 },
  placeholder: { color: colors.muted },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,.82)', padding: spacing.lg },
  modalCard: { ...mobileFrame, width: '100%', maxWidth: 560, maxHeight: '78%', backgroundColor: colors.panel, padding: spacing.md },
  modalHeading: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  modalTitle: { flex: 1, color: colors.white, fontSize: 18, fontWeight: '900', textTransform: 'uppercase' },
  closeButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  searchRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.ink, paddingHorizontal: spacing.md },
  searchInput: { flex: 1, color: colors.white, fontSize: 14, paddingVertical: spacing.sm },
  optionList: { flexGrow: 0, marginTop: spacing.sm },
  option: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line, padding: spacing.md },
  optionSelected: { backgroundColor: colors.silver },
  optionTitle: { color: colors.white, fontSize: 14, fontWeight: '900' },
  optionTitleSelected: { color: colors.ink },
  optionMeta: { color: colors.muted, fontSize: 11 },
  optionMetaSelected: { color: '#435159' },
  empty: { color: colors.muted, fontSize: 12, lineHeight: 18, padding: spacing.lg, textAlign: 'center' },
  pressed: { opacity: .72 },
});
