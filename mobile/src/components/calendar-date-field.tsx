import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MonthCalendarPicker } from '@/components/month-calendar-picker';
import { Field } from '@/components/ui';
import { colors, spacing } from '@/constants/brand';
import { australianDateToIso, isoDateToAustralian } from '@/lib/australian-date';

type CalendarDateFieldProps = {
  disabled?: boolean;
  error?: string;
  hint?: string;
  isDateEnabled?: (isoDate: string) => boolean;
  label: string;
  maximumDate?: string;
  minimumDate?: string;
  onChange: (australianDate: string) => void;
  optional?: boolean;
  value: string;
};

export function CalendarDateField({
  disabled = false,
  error,
  hint,
  isDateEnabled,
  label,
  maximumDate,
  minimumDate,
  onChange,
  optional = false,
  value,
}: CalendarDateFieldProps) {
  const [open, setOpen] = useState(false);
  const isoValue = australianDateToIso(value) ?? '';

  return (
    <Field error={error} hint={hint ?? (optional ? 'Optional · choose from calendar' : 'Choose from calendar')} label={label}>
      <Pressable
        accessibilityLabel={`${label}, ${value || 'no date selected'}`}
        accessibilityRole="button"
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={() => setOpen((current) => !current)}
        style={({ pressed }) => [styles.trigger, error && styles.triggerError, pressed && styles.pressed]}
      >
        <Ionicons color={colors.accent} name="calendar-outline" size={20} />
        <Text style={[styles.value, !value && styles.placeholder]}>{value || 'Choose date'}</Text>
        <Ionicons color={colors.muted} name={open ? 'chevron-up' : 'chevron-down'} size={18} />
      </Pressable>
      {open ? (
        <View style={styles.picker}>
          <MonthCalendarPicker
            disabled={disabled}
            isDateEnabled={isDateEnabled}
            maximumDate={maximumDate}
            minimumDate={minimumDate}
            onChange={(isoDate) => {
              onChange(isoDateToAustralian(isoDate));
              setOpen(false);
            }}
            value={isoValue}
          />
          {optional && value ? (
            <Pressable accessibilityRole="button" onPress={() => { onChange(''); setOpen(false); }} style={styles.clear}>
              <Text style={styles.clearText}>Clear date</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Field>
  );
}

const styles = StyleSheet.create({
  trigger: { alignItems: 'center', borderColor: colors.line, borderRadius: 6, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 50, paddingHorizontal: spacing.md },
  triggerError: { borderColor: colors.danger },
  value: { color: colors.white, flex: 1, fontSize: 14, fontWeight: '700' },
  placeholder: { color: colors.muted },
  picker: { gap: spacing.sm, marginTop: spacing.sm },
  clear: { alignSelf: 'flex-end', minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.sm },
  clearText: { color: colors.accent, fontSize: 12, fontWeight: '800' },
  pressed: { opacity: 0.72 },
});
